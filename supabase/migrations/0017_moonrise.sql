-- ============================================================================
-- YORU: following, notifications that wait 30 s, and Moonrise. docs/MOONRISE.md
--
-- Additive. New tables (follows, moon_*, not_interested), new functions, and
-- these existing functions extended (each keeps everything it did before):
--   notify_user        knows the new kinds (follow, new_post, top_post, moon)
--   on_post_insert     "new post" notifications go to followers only, not everyone
--   mark_channel_read  also marks that chat's message notifications read
--   push_claim         only sends pushes that have waited 30 s (and are still unread)
--   post_json          adds 'moon' (3 or 4) for posts that reached Full / Blood Moon
--
-- Moonrise is off until an admin turns it on (Watchtower -> Controls). With it
-- off, For You works exactly as before.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Following
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);
alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;

-- Blocking ends following in both directions.
create or replace function public.follows_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end $$;
drop trigger if exists blocks_end_follows on public.blocks;
create trigger blocks_end_follows after insert on public.blocks for each row execute function public.follows_on_block();

create or replace function public.get_follow_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  return jsonb_build_object(
    'followers', (select count(*) from public.follows f join public.profiles q on q.id = f.follower_id
                  where f.followee_id = p_user and not q.banned),
    'following', (select count(*) from public.follows f join public.profiles q on q.id = f.followee_id
                  where f.follower_id = p_user and not q.banned),
    'i_follow', exists (select 1 from public.follows where follower_id = v and followee_id = p_user),
    'follows_me', exists (select 1 from public.follows where follower_id = p_user and followee_id = v)
  );
end $$;

create or replace function public.follow_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  n int;
begin
  if p_user is null or p_user = v then
    raise exception 'INVALID|You can''t follow yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and not banned) then
    raise exception 'NOT_FOUND|That account doesn''t exist.' using errcode = 'P0002';
  end if;
  if public.is_hidden_author(p_user) then
    raise exception 'FORBIDDEN|You can''t follow this account.';
  end if;
  perform public.enforce_rate_limit('follow', 100, 3600);
  insert into public.follows (follower_id, followee_id) values (v, p_user) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    perform public.notify_user(p_user, v, 'follow');
  end if;
  return public.get_follow_state(p_user);
end $$;

create or replace function public.unfollow_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  delete from public.follows where follower_id = v and followee_id = p_user;
  return public.get_follow_state(p_user);
end $$;

-- Followers or following of a member, newest first, without hidden accounts.
create or replace function public.list_follows(p_user uuid, p_kind text default 'followers', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if p_kind not in ('followers', 'following') then
    raise exception 'INVALID|Followers or following.';
  end if;
  return coalesce((
    select jsonb_agg(public.profile_lite(q) order by f.created_at desc)
    from public.follows f
    join public.profiles q on q.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where (case when p_kind = 'followers' then f.followee_id else f.follower_id end) = p_user
      and not q.banned and not public.is_hidden_author(q.id)
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Notifications: the new kinds, "new post" to followers only, settings
-- ---------------------------------------------------------------------------

create or replace function public.notify_user(
  p_user uuid, p_actor uuid, p_kind text,
  p_post uuid default null, p_comment uuid default null,
  p_channel uuid default null, p_message uuid default null,
  p_body text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare
  prefs jsonb;
  pref_key text;
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  select notification_prefs into prefs from public.profiles
  where id = p_user and not is_bot and not banned;
  if not found then
    return;
  end if;
  pref_key := case p_kind
    when 'like' then 'likes' when 'reaction' then 'likes'
    when 'comment' then 'comments' when 'reply' then 'comments' when 'roast' then 'comments'
    when 'mention' then 'mentions' when 'repost' then 'reposts'
    when 'message' then 'messages' when 'award' then 'awards'
    when 'friend_post' then 'friend_posts'
    when 'new_post' then 'following_posts'
    when 'follow' then 'follows'
    when 'top_post' then 'top_posts'
    when 'moon' then 'moonrise'
    else null end;
  if pref_key is not null and coalesce((prefs ->> pref_key)::boolean, true) = false then
    return;
  end if;
  if p_actor is not null and exists (
    select 1 from public.blocks where blocker_id = p_user and blocked_id = p_actor
  ) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, channel_id, message_id, body)
  values (p_user, p_actor, p_kind, p_post, p_comment, p_channel, p_message, left(coalesce(p_body, ''), 200));
end $$;

-- Same as before, except the "new post" notification: it now goes to the
-- author's followers (setting "Posts from people you follow", on unless turned
-- off), instead of to every member who had "every time anyone posts" on.
create or replace function public.on_post_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m uuid;
  orig_author uuid;
  fan uuid;
begin
  if new.repost_of is not null then
    select author_id into orig_author from public.posts where id = new.repost_of;
    perform public.notify_user(orig_author, new.author_id, 'repost', new.repost_of, null, null, null, new.body);
  end if;
  foreach m in array new.mentions loop
    perform public.notify_user(m, new.author_id, 'mention', new.id, null, null, null, new.body);
  end loop;
  if new.target_user_id is not null then
    perform public.notify_user(new.target_user_id, new.author_id, 'roast', new.id, null, null, null, coalesce(new.roast, new.body));
  end if;
  if new.repost_of is null and new.author_id <> public.bot_id() then
    for fan in
      select f.follower_id from public.follows f
      join public.profiles q on q.id = f.follower_id
      where f.followee_id = new.author_id and not q.is_bot and not q.banned
    loop
      perform public.notify_user(fan, new.author_id, 'new_post', new.id, null, null, null, new.body);
    end loop;
  end if;
  return null;
end $$;

-- Notification settings, including the new ones (update_my_profile keeps
-- accepting the original seven).
create or replace function public.set_notification_prefs(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if jsonb_typeof(p) <> 'object' then
    raise exception 'INVALID|Settings must be an object.';
  end if;
  update public.profiles set notification_prefs = notification_prefs || (
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(p)
    where key in ('likes', 'comments', 'mentions', 'reposts', 'messages', 'awards', 'friend_posts',
                  'following_posts', 'follows', 'top_posts', 'moonrise')
      and jsonb_typeof(value) = 'boolean'
  ) where id = v;
  return (select notification_prefs from public.profiles where id = v);
end $$;

-- Reading a chat also reads its message notifications, so no push is sent for
-- messages you've already seen.
create or replace function public.mark_channel_read(p_channel_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  update public.channel_members set last_read_at = now() where channel_id = p_channel_id and user_id = v;
  update public.notifications set read_at = now()
  where user_id = v and channel_id = p_channel_id and kind = 'message' and read_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Pushes wait 30 seconds: if it's read in the app by then, nothing is sent
-- ---------------------------------------------------------------------------

alter table public.push_outbox add column if not exists due_at timestamptz not null default (now() + interval '30 seconds');
create index if not exists push_outbox_due_idx on public.push_outbox (due_at);

create or replace function public.push_claim(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  out jsonb;
begin
  with taken as (
    delete from public.push_outbox
    where notification_id in (
      select notification_id from public.push_outbox
      where due_at <= now()
      order by created_at limit least(greatest(p_limit, 1), 500))
    returning notification_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'body', left(n.body, 200), 'post_id', n.post_id, 'channel_id', n.channel_id,
    'created_at', n.created_at,
    'actor', case when a.id is null then null else jsonb_build_object('name', a.display_name, 'username', a.username, 'avatar', a.avatar_url) end,
    'unread', (select count(*) from public.notifications u where u.user_id = n.user_id and u.read_at is null),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
                from public.push_subscriptions s where s.user_id = n.user_id)
  )), '[]'::jsonb) into out
  from taken t
  join public.notifications n on n.id = t.notification_id
  left join public.profiles a on a.id = n.actor_id
  where n.read_at is null and n.created_at > now() - interval '1 day';
  return out;
end $$;

-- Server only: seconds until the next queued push is due (null when none).
create or replace function public.push_next_due() returns double precision
language sql stable security definer set search_path = public as $$
  select greatest(0, extract(epoch from (d - now())))::double precision from (select min(due_at) as d from public.push_outbox) s where d is not null
$$;

-- ---------------------------------------------------------------------------
-- Moonrise: settings
-- ---------------------------------------------------------------------------

create table if not exists public.moon_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.moon_settings (id) values (true) on conflict do nothing;
alter table public.moon_settings enable row level security;
revoke all on public.moon_settings from anon, authenticated;

-- The defaults, overridden by whatever an admin saved.
create or replace function public.moon_cfg() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sizes', '[20, 100, 500]'::jsonb,          -- New Moon, Crescent, Half Moon audiences
    'quotas', '[0.40, 0.25, 0.15, 0.05]'::jsonb, -- share that moves up from New, Crescent, Half, Full
    'starter', '[0.10, 0.12, 0.15, 0.20]'::jsonb, -- bars until a phase has 20 results this week
    'phase_hours', 12,
    'full_hours', 24,
    'min_decide', 10,
    'prior_n', 20,
    'prior_rate', 0.10,
    'second_night', true,
    'new_account_hours', 24,
    'new_account_weight', 0.5,
    'slots', 2,
    'top_post_gap_hours', 24
  ) || coalesce((select config from public.moon_settings where id), '{}'::jsonb)
$$;

create or replace function public.moon_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.moon_settings where id), false)
$$;

create or replace function public.moon_phase_name(p_phase int) returns text
language sql immutable as $$
  select (array['New Moon', 'Crescent', 'Half Moon', 'Full Moon', 'Blood Moon'])[p_phase + 1]
$$;

create or replace function public.moon_phase_emoji(p_phase int) returns text
language sql immutable as $$
  select (array['🌑', '🌒', '🌓', '🌕', '🔴'])[p_phase + 1]
$$;

-- ---------------------------------------------------------------------------
-- Moonrise: tables
-- ---------------------------------------------------------------------------

-- One row per post in Moonrise: where it is now.
create table if not exists public.moon_posts (
  post_id uuid primary key references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  phase smallint not null default 0 check (phase between 0 and 4),
  round smallint not null default 1 check (round in (1, 2)),
  state text not null default 'testing' check (state in ('testing', 'waiting', 'done')),
  -- how a finished climb ended: 'failed' (a test said no), 'exhausted' (nobody
  -- left who could be asked, never a penalty) or 'top' (Blood Moon)
  ended text check (ended in ('failed', 'exhausted', 'top')),
  target int not null default 20 check (target >= 1),
  tags text[] not null default '{}',     -- its fandom: the interests it's tested on ('{}' = anyone)
  shown int not null default 0,          -- people shown in the current phase and round
  phase_started_at timestamptz not null default now(),
  not_before timestamptz not null default now(),
  best_score real not null default 0,     -- round 1's score, for Second Night
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moon_posts_open_idx on public.moon_posts (state, phase) where state <> 'done';
-- the order the Moonrise lane takes open tests in: least-seen first, then the oldest
create index if not exists moon_posts_queue_idx on public.moon_posts (((shown::float8) / target), created_at, post_id) where state <> 'done';

-- One row per decided phase: the record of how each step went.
create table if not exists public.moon_results (
  post_id uuid not null references public.posts (id) on delete cascade,
  phase smallint not null,
  round smallint not null,
  shown int not null,
  shown_w real not null,
  loved int not null,
  loved_w real not null,
  score real not null,
  bar real not null,
  result text not null check (result in ('up', 'stay', 'retry')),
  decided_at timestamptz not null default now(),
  primary key (post_id, phase, round)
);
create index if not exists moon_results_phase_idx on public.moon_results (phase, decided_at desc);

-- Which posts YORU showed to whom as part of a Moonrise test. Kept 7 days.
create table if not exists public.moon_shown (
  post_id uuid not null references public.posts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  phase smallint not null,
  round smallint not null,
  weight real not null default 1,
  shown_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);
create index if not exists moon_shown_phase_idx on public.moon_shown (post_id, phase, round);
create index if not exists moon_shown_time_idx on public.moon_shown (shown_at);

-- "Not interested": hides the post for you; its author and hashtags rank lower
-- in your For You for 30 days. Never shown to the author.
create table if not exists public.not_interested (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  hashtags text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists not_interested_user_idx on public.not_interested (user_id, created_at desc);

-- When each member last got a "top post" notification (at most one per day).
create table if not exists public.moon_top_notices (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_at timestamptz not null default now()
);

alter table public.moon_posts enable row level security;
alter table public.moon_results enable row level security;
alter table public.moon_shown enable row level security;
alter table public.not_interested enable row level security;
alter table public.moon_top_notices enable row level security;
revoke all on public.moon_posts, public.moon_results, public.moon_shown, public.not_interested, public.moon_top_notices from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Moonrise: helpers
-- ---------------------------------------------------------------------------

-- A post's fandom: the interests among its hashtags; if it has none, its
-- author's interests; if the author has none either, anyone ('{}').
create or replace function public.moon_tags(p_hashtags text[], p_author_interests text[]) returns text[]
language sql immutable as $$
  select case
    when coalesce(p_hashtags, '{}') && public.interest_keys()
      then array(select t from unnest(p_hashtags) t where t = any (public.interest_keys()) order by t)
    else array(select t from unnest(coalesce(p_author_interests, '{}')) t order by t) end
$$;

-- Who can be in a test of a post with these tags: someone with a matching
-- interest, or anyone when the post has no fandom. Members who haven't picked
-- interests yet are open to everything.
create or replace function public.moon_fits(p_tags text[], p_viewer_interests text[]) returns boolean
language sql immutable as $$
  select cardinality(coalesce(p_tags, '{}')) = 0 or cardinality(coalesce(p_viewer_interests, '{}')) = 0
      or p_viewer_interests && p_tags
$$;

-- Everyone a member is close to, in both directions: follows, plus reactions,
-- comments and direct messages in the last 30 days. They see each other's
-- posts anyway, so they're never in each other's test audiences.
create or replace function public.moon_circle(p_user uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select followee_id as x from public.follows where follower_id = p_user
    union select follower_id from public.follows where followee_id = p_user
    union select p.author_id from public.reactions r join public.posts p on p.id = r.post_id
          where r.user_id = p_user and r.created_at > now() - interval '30 days'
    union select r.user_id from public.reactions r join public.posts p on p.id = r.post_id
          where p.author_id = p_user and r.created_at > now() - interval '30 days'
    union select p.author_id from public.comments c join public.posts p on p.id = c.post_id
          where c.author_id = p_user and c.created_at > now() - interval '30 days'
    union select c.author_id from public.comments c join public.posts p on p.id = c.post_id
          where p.author_id = p_user and c.created_at > now() - interval '30 days'
    union select other.user_id from public.channel_members mine
          join public.channels ch on ch.id = mine.channel_id and ch.kind = 'dm'
          join public.channel_members other on other.channel_id = mine.channel_id and other.user_id <> p_user
          where mine.user_id = p_user
            and exists (select 1 from public.messages m where m.channel_id = ch.id and m.created_at > now() - interval '30 days')
  ) s where x is not null and x <> p_user
$$;

-- Did this person love the post? Any reaction except L, a comment, a repost,
-- a bookmark, an award or a poll vote; an L or "Not interested" cancels it.
create or replace function public.moon_loved(p_post uuid, p_viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (
      exists (select 1 from public.reactions r where r.post_id = p_post and r.user_id = p_viewer and r.kind <> 'l')
      or exists (select 1 from public.comments c where c.post_id = p_post and c.author_id = p_viewer and c.deleted_at is null)
      or exists (select 1 from public.posts rp where rp.repost_of = p_post and rp.author_id = p_viewer and rp.deleted_at is null)
      or exists (select 1 from public.bookmarks b where b.post_id = p_post and b.user_id = p_viewer)
      or exists (select 1 from public.awards a where a.post_id = p_post and a.giver_id = p_viewer)
      or exists (select 1 from public.poll_votes pv where pv.post_id = p_post and pv.user_id = p_viewer)
    )
    and not exists (select 1 from public.reactions r where r.post_id = p_post and r.user_id = p_viewer and r.kind = 'l')
    and not exists (select 1 from public.not_interested ni where ni.post_id = p_post and ni.user_id = p_viewer)
$$;

-- The score a phase is ranked by: the love rate as if prior_n more people (20)
-- had seen the post and prior_rate (10%) of them had loved it, a Bayesian
-- average. A small sample stays near 10% until there's real evidence, so 2 of 2
-- (18%) never outranks 30 of 100 (27%), while a rate still beats a total: 18 of
-- 100 (17%) beats 300 of 10,000 (3%).
create or replace function public.moon_score(k double precision, n double precision) returns double precision
language sql stable security definer set search_path = public as $$
  select (greatest(coalesce(k, 0), 0) + (c ->> 'prior_n')::float * (c ->> 'prior_rate')::float)
         / (greatest(coalesce(n, 0), 0) + greatest((c ->> 'prior_n')::float, 1))
  from (select public.moon_cfg() as c) s
$$;

-- How many people could still join this post's current test, counting up to
-- p_stop (1 answers "is anyone left?" without counting everyone).
create or replace function public.moon_eligible_left(p_post uuid, p_stop int default 1000000) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  mp public.moon_posts;
  circle uuid[];
  n int;
begin
  select * into mp from public.moon_posts where post_id = p_post;
  if mp.post_id is null then
    return 0;
  end if;
  circle := public.moon_circle(mp.author_id);
  select count(*)::int into n from (
    select 1 from public.profiles q
    where q.id <> mp.author_id and not q.is_bot and not q.banned
      and not (q.id = any (circle))
      and public.moon_fits(mp.tags, q.interests)
      and not exists (select 1 from public.blocks b where (b.blocker_id = q.id and b.blocked_id = mp.author_id) or (b.blocker_id = mp.author_id and b.blocked_id = q.id))
      and not exists (select 1 from public.moon_shown s where s.post_id = p_post and s.viewer_id = q.id)
      and not exists (select 1 from public.not_interested ni where ni.post_id = p_post and ni.user_id = q.id)
    limit greatest(coalesce(p_stop, 1), 1)
  ) x;
  return n;
end $$;

-- The bar to leave a phase: the score that the top <quota> of posts reached in
-- that phase over the last 7 days, or the starter bar until 20 posts have.
create or replace function public.moon_bar(p_phase int) returns real
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := public.moon_cfg();
  quota real := (cfg -> 'quotas' ->> p_phase)::real;
  bar real;
begin
  if (select count(*) from public.moon_results r where r.phase = p_phase and r.decided_at > now() - interval '7 days') >= 20 then
    select percentile_cont(1 - quota) within group (order by r.score) into bar
    from public.moon_results r where r.phase = p_phase and r.decided_at > now() - interval '7 days';
  else
    bar := (cfg -> 'starter' ->> p_phase)::real;
  end if;
  return bar;
end $$;

-- The public badge: 3 (Full Moon) or 4 (Blood Moon), else null.
create or replace function public.moon_badge(p_post uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select phase from public.moon_posts where post_id = p_post and phase >= 3
$$;

-- For the author only (whoever is signed in): where their post is in Moonrise.
create or replace function public.moon_mine(p_post uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phase', mp.phase, 'state', mp.state, 'round', mp.round, 'ended', mp.ended)
  from public.moon_posts mp where mp.post_id = p_post and mp.author_id = auth.uid()
$$;

-- Every post as before, plus its public moon badge (and, for its author, its phase).
create or replace function public.post_json(p public.posts, v uuid) returns jsonb
language sql stable as $$
  select public.post_json_core(p, v) || jsonb_build_object(
    'repost_of', (
      select public.post_json_core(rp, v) from public.posts rp
      where rp.id = p.repost_of and rp.deleted_at is null
    ),
    'mod', case when p.mod_state <> 'ok' then jsonb_build_object('state', p.mod_state, 'label', p.mod_label) end,
    'moon', public.moon_badge(p.id),
    'moon_mine', case when p.author_id = v then public.moon_mine(p.id) end
  )
$$;

-- New posts enter Moonrise while it's on.
create or replace function public.moon_enroll(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.posts;
  a_int text[];
begin
  select * into p from public.posts where id = p_post;
  select interests into a_int from public.profiles where id = p.author_id;
  if p.id is null or p.deleted_at is not null or p.repost_of is not null or p.kind not in ('post', 'poll')
     or p.author_id in (public.bot_id(), public.official_id())
     or exists (select 1 from public.profiles where id = p.author_id and (is_bot or banned)) then
    return;
  end if;
  insert into public.moon_posts (post_id, author_id, target, tags, phase_started_at, not_before, created_at)
  values (p.id, p.author_id, greatest(1, (public.moon_cfg() -> 'sizes' ->> 0)::int), public.moon_tags(p.hashtags, a_int),
          p.created_at, p.created_at, p.created_at)
  on conflict do nothing;
end $$;

create or replace function public.moon_on_post_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.moon_enabled() then
    perform public.moon_enroll(new.id);
  end if;
  return null;
end $$;
drop trigger if exists posts_moonrise on public.posts;
create trigger posts_moonrise after insert on public.posts for each row execute function public.moon_on_post_insert();

-- ---------------------------------------------------------------------------
-- For You: the Night Feed, with the Moonrise lane
-- ---------------------------------------------------------------------------
-- A page is filled from three lanes (your interests, people you're close to,
-- trending) in about a 6:4:3 split, plus up to 2 Moonrise slots: posts in a
-- test that you can join (any slots the lanes can't fill go to Moonrise too).
-- While a post is being tested in New Moon, Crescent or Half Moon, strangers
-- only meet it through the Moonrise lane; in Full Moon it's also in your
-- interests lane. Once its tests are over, it ranks by the phase it reached:
-- Blood Moon x2.5, Full Moon x1.6, Half Moon x0.85, Crescent x0.6, New Moon
-- x0.35. At most 2 posts per author, never two in a row where it can be
-- helped. p_seen: the ids this scroll has already shown.
create or replace function public.get_for_you(p_seen uuid[] default '{}', p_limit int default 15, p_hour int default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  lim int := least(greatest(coalesce(p_limit, 15), 5), 30);
  seen uuid[] := coalesce(p_seen[1:300], '{}');
  cfg jsonb := public.moon_cfg();
  moon_on boolean := public.moon_enabled();
  mine text[];
  circle uuid[];
  new_account boolean;
  weight real;
  n_moon int;
  n_rest int;
  q int[];
  ids uuid[];
  auths uuid[];
  whys text[];
  lanes text[];
  out_ids uuid[] := '{}';
  out_why text[] := '{}';
  out_lane text[] := '{}';
  cand_ids uuid[] := '{}';
  cand_auth uuid[] := '{}';
  cand_why text[] := '{}';
  moon_ids uuid[] := '{}';
  moon_auth uuid[] := '{}';
  moon_why text[] := '{}';
  spare_ids uuid[] := '{}';
  spare_auth uuid[] := '{}';
  spare_why text[] := '{}';
  per_author jsonb := '{}'::jsonb;
  ni_authors uuid[];
  ni_tags text[];
  r record;
  li int;
  i int;
  j int;
  take int;
  tmp uuid;
  tmpt text;
  res jsonb;
begin
  select interests, created_at > now() - make_interval(hours => (cfg ->> 'new_account_hours')::int)
    into mine, new_account from public.profiles where id = v;
  mine := coalesce(mine, '{}');
  circle := public.moon_circle(v);
  weight := case when new_account then (cfg ->> 'new_account_weight')::real else 1 end;
  n_moon := case when moon_on then least(greatest((cfg ->> 'slots')::int, 0), 4) else 0 end;
  n_rest := lim - n_moon;
  q := array[round(n_rest * 6.0 / 13)::int, round(n_rest * 4.0 / 13)::int];
  q := q || (n_rest - q[1] - q[2]);

  -- 1. Moonrise: tests this viewer can join, least-seen first (then the oldest).
  if moon_on then
    for r in
      select mp.post_id, p.author_id, mp.phase, mp.tags, p.hashtags
      from public.moon_posts mp
      join public.posts p on p.id = mp.post_id
      join public.profiles a on a.id = p.author_id
      where mp.state <> 'done' and mp.phase <= 3 and now() >= mp.not_before
        and (mp.round = 1 or p_hour is null or p_hour >= 21 or p_hour < 5)   -- Second Night runs at night
        and p.deleted_at is null and p.mod_state <> 'held' and p.author_id <> v
        and not a.banned and not (p.id = any (seen))
        and not (p.author_id = any (circle))
        and not exists (select 1 from public.blocks b where (b.blocker_id = v and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = v))
        and not exists (select 1 from public.moon_shown s where s.post_id = p.id and s.viewer_id = v)
        and not exists (select 1 from public.not_interested ni where ni.post_id = p.id and ni.user_id = v)
        and public.moon_fits(mp.tags, mine)
      order by ((mp.shown::float8) / mp.target), mp.created_at, mp.post_id
      limit lim
    loop
      cand_ids := cand_ids || r.post_id;
      cand_auth := cand_auth || r.author_id;
      tmpt := coalesce((select t from unnest(r.tags) t where t = any (mine) limit 1), r.tags[1]);
      cand_why := cand_why || (public.moon_phase_emoji(r.phase) || ' ' || public.moon_phase_name(r.phase) || ': '
        || case when tmpt is null then 'a new post, shown to a few people first'
                when r.hashtags && public.interest_keys() then 'new post in #' || tmpt
                else 'new post from someone into #' || tmpt end);
    end loop;
    -- the Moonrise slots: one post per author
    for i in 1..cardinality(cand_ids) loop
      exit when cardinality(moon_ids) >= n_moon;
      continue when cand_auth[i] = any (moon_auth);
      moon_ids := moon_ids || cand_ids[i];
      moon_auth := moon_auth || cand_auth[i];
      moon_why := moon_why || cand_why[i];
      per_author := per_author || jsonb_build_object(cand_auth[i]::text, 1);
    end loop;
  end if;

  -- 2. The three lanes, scored.
  select coalesce(array_agg(distinct ni.author_id), '{}'),
         coalesce((select array_agg(distinct t) from public.not_interested n2, unnest(n2.hashtags) t
                   where n2.user_id = v and n2.created_at > now() - interval '30 days'), '{}')
    into ni_authors, ni_tags
  from public.not_interested ni where ni.user_id = v and ni.created_at > now() - interval '30 days';

  -- Engagement from other people, counting people, not clicks: reactions 1 (an L
  -- alone 0.5), comments 2, reposts 3, awards 2, bookmarks 1.5. Posts you've
  -- already met in a test, and authors or hashtags you said "Not interested" to
  -- in the last 30 days, rank lower.
  create temp table if not exists _fy (id uuid, author uuid, created timestamptz,
    is_int boolean, is_cir boolean, score double precision, trend double precision,
    in_int boolean, in_tr boolean) on commit drop;
  truncate _fy;
  insert into _fy
  with pool as (
    -- the candidates a page is picked from (a bounded set, however busy YORU is):
    -- the newest posts, this week's most-reacted, your circle's newest, the newest
    -- in your interests, and this week's Full and Blood Moon posts
    (select p.id from public.posts p where p.created_at > now() - interval '7 days' and p.deleted_at is null
       and not (p.id = any (seen)) order by p.created_at desc limit 600)
    union
    (select re.post_id from public.reactions re where re.created_at > now() - interval '7 days'
       and not (re.post_id = any (seen)) group by re.post_id order by count(distinct re.user_id) desc, re.post_id limit 200)
    union
    (select p.id from public.posts p where p.author_id = any (circle) and p.created_at > now() - interval '7 days'
       and p.deleted_at is null and not (p.id = any (seen)) order by p.created_at desc limit 300)
    union
    (select p.id from public.posts p where p.hashtags && mine and p.created_at > now() - interval '7 days'
       and p.deleted_at is null and not (p.id = any (seen)) order by p.created_at desc limit 300)
    union
    (select mp.post_id from public.moon_posts mp where mp.phase >= 3 and mp.created_at > now() - interval '7 days')
  ),
  cand as materialized (
    select p.id, p.author_id, p.created_at, p.hashtags, a.username, a.interests as a_int,
      mp.post_id is not null as in_moon, mp.phase, mp.state, mp.ended, mp.tags
    from pool
    join public.posts p on p.id = pool.id
    join public.profiles a on a.id = p.author_id
    left join public.moon_posts mp on mp.post_id = p.id
    where p.deleted_at is null and p.kind <> 'repost' and p.created_at > now() - interval '7 days'
      and p.mod_state <> 'held' and p.author_id <> v and not a.banned
      and not (p.id = any (seen)) and not (p.id = any (moon_ids))
      and not exists (select 1 from public.blocks b where (b.blocker_id = v and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = v))
      and not exists (select 1 from public.not_interested ni where ni.post_id = p.id and ni.user_id = v)
  ),
  rx as (
    select re.post_id, count(distinct re.user_id) filter (where re.kind <> 'l') as pos,
           count(distinct re.user_id) - count(distinct re.user_id) filter (where re.kind <> 'l') as lonly
    from public.reactions re join cand c on c.id = re.post_id and re.user_id <> c.author_id group by re.post_id
  ),
  cm as (
    select co.post_id, count(distinct co.author_id) as n
    from public.comments co join cand c on c.id = co.post_id and co.author_id <> c.author_id
    where co.deleted_at is null group by co.post_id
  ),
  rp as (
    select q2.repost_of as post_id, count(distinct q2.author_id) as n
    from public.posts q2 join cand c on c.id = q2.repost_of and q2.author_id <> c.author_id
    where q2.deleted_at is null group by q2.repost_of
  ),
  aw as (select w.post_id, count(*) as n from public.awards w join cand c on c.id = w.post_id and w.giver_id <> c.author_id group by w.post_id),
  bm as (select bk.post_id, count(*) as n from public.bookmarks bk join cand c on c.id = bk.post_id and bk.user_id <> c.author_id group by bk.post_id),
  tested as (select s.post_id from public.moon_shown s where s.viewer_id = v),
  scored as (
    select c.*,
      (c.hashtags && mine or c.a_int && mine) as is_int,
      (c.author_id = any (circle)) as is_cir,
      ln(2 + coalesce(rx.pos, 0) + 0.5 * coalesce(rx.lonly, 0) + 2 * coalesce(cm.n, 0) + 3 * coalesce(rp.n, 0)
             + 2 * coalesce(aw.n, 0) + 1.5 * coalesce(bm.n, 0)) / ln(2)
      * 1.0 / power(extract(epoch from (now() - c.created_at)) / 3600.0 + 2, 1.4)
      * (case when c.author_id = any (ni_authors) or c.hashtags && ni_tags then 0.3 else 1 end)
      * (case when t.post_id is not null then 0.5 else 1 end)
      * (case when not moon_on or not c.in_moon then 1
              when c.phase = 4 then 2.5 when c.phase = 3 then 1.6
              when c.state = 'done' and c.ended = 'failed' then (array[0.35, 0.6, 0.85])[c.phase + 1]
              else 1 end) as trend
    from cand c
    left join rx on rx.post_id = c.id
    left join cm on cm.post_id = c.id
    left join rp on rp.post_id = c.id
    left join aw on aw.post_id = c.id
    left join bm on bm.post_id = c.id
    left join tested t on t.post_id = c.id
  )
  select x.id, x.author_id, x.created_at, x.is_int, x.is_cir,
    x.trend * (1 + 1.5 * x.is_int::int + 1.2 * x.is_cir::int), x.trend,
    (not moon_on or not x.in_moon or x.state = 'done' or x.phase >= 3),
    (not moon_on or not x.in_moon or x.state = 'done')
  from scored x;

  -- 3. Fill: quotas first, then spare slots in the order interests, circle, trending.
  for pass_no in 1..2 loop
    for li in 1..3 loop
      if pass_no = 1 then take := q[li]; else take := n_rest; end if;
      j := 0;
      for r in
        select f.id, f.author, li as why
        from _fy f
        where case li when 1 then f.is_int and f.in_int when 2 then f.is_cir else f.in_tr end
        order by case li when 3 then f.trend else f.score end desc, f.created desc, f.id
      loop
        exit when j >= take or cardinality(out_ids) >= n_rest;
        continue when r.id = any (out_ids);
        continue when coalesce((per_author ->> r.author::text)::int, 0) >= 2;
        out_ids := out_ids || r.id;
        out_why := out_why || r.why::text;
        out_lane := out_lane || (array['interests', 'circle', 'trending'])[li];
        per_author := per_author || jsonb_build_object(r.author::text, coalesce((per_author ->> r.author::text)::int, 0) + 1);
        j := j + 1;
      end loop;
    end loop;
    exit when cardinality(out_ids) >= n_rest;
  end loop;

  -- why each one is here (worked out only for the posts on the page)
  for i in 1..cardinality(out_ids) loop
    select case out_why[i]
        when '1' then case when p.hashtags && mine then '#' || (select t from unnest(p.hashtags) t where t = any (mine) limit 1) || ', one of your interests'
                           else 'from someone into ' || coalesce((select '#' || t from unnest(a.interests) t where t = any (mine) limit 1), 'what you like') end
        when '2' then case when exists (select 1 from public.follows f where f.follower_id = v and f.followee_id = p.author_id)
                           then 'from @' || a.username || ', who you follow' else 'from @' || a.username || ', who you talk to' end
        else case when moon_on and mp.phase = 4 then '🔴 Blood Moon: trending across YORU'
                  when moon_on and mp.phase = 3 then '🌕 Full Moon: a hit in #' || coalesce(mp.tags[1], 'its fandom')
                  else 'trending tonight' end
      end into tmpt
    from public.posts p join public.profiles a on a.id = p.author_id left join public.moon_posts mp on mp.post_id = p.id
    where p.id = out_ids[i];
    out_why[i] := tmpt;
  end loop;

  -- order the picks by their personal score
  select coalesce(array_agg(x.id order by x.score desc, x.created desc, x.id), '{}'),
         coalesce(array_agg(x.author order by x.score desc, x.created desc, x.id), '{}'),
         coalesce(array_agg(x.why order by x.score desc, x.created desc, x.id), '{}'),
         coalesce(array_agg(x.lane order by x.score desc, x.created desc, x.id), '{}')
    into ids, auths, whys, lanes
  from (
    select f.id, f.author, f.created, f.score, o.why, o.lane
    from unnest(out_ids, out_why, out_lane) as o(id, why, lane) join _fy f on f.id = o.id
  ) x;

  -- slots the lanes couldn't fill go to more Moonrise tests
  for i in 1..cardinality(cand_ids) loop
    exit when cardinality(ids) + cardinality(spare_ids) >= n_rest;
    continue when cand_ids[i] = any (moon_ids) or cand_ids[i] = any (ids);
    continue when coalesce((per_author ->> cand_auth[i]::text)::int, 0) >= 2;
    spare_ids := spare_ids || cand_ids[i];
    spare_auth := spare_auth || cand_auth[i];
    spare_why := spare_why || cand_why[i];
    per_author := per_author || jsonb_build_object(cand_auth[i]::text, coalesce((per_author ->> cand_auth[i]::text)::int, 0) + 1);
  end loop;
  ids := ids || spare_ids;
  auths := auths || spare_auth;
  whys := whys || spare_why;
  lanes := lanes || array_fill('moonrise'::text, array[cardinality(spare_ids)]);

  -- the Moonrise slots go in at the 3rd and 8th places
  for i in 1..cardinality(moon_ids) loop
    j := least(cardinality(ids) + 1, case i when 1 then 3 when 2 then 8 else 3 + 5 * (i - 1) end);
    ids := ids[1:j - 1] || moon_ids[i] || ids[j:];
    auths := auths[1:j - 1] || moon_auth[i] || auths[j:];
    whys := whys[1:j - 1] || moon_why[i] || whys[j:];
    lanes := lanes[1:j - 1] || 'moonrise'::text || lanes[j:];
  end loop;

  -- never two in a row from the same author: swap with the next different one
  for i in 2..coalesce(cardinality(ids), 0) loop
    if auths[i] = auths[i - 1] then
      for j in i + 1..cardinality(ids) loop
        if auths[j] <> auths[i - 1] and (j = cardinality(ids) or auths[j + 1] <> auths[i]) then
          tmp := ids[i]; ids[i] := ids[j]; ids[j] := tmp;
          tmp := auths[i]; auths[i] := auths[j]; auths[j] := tmp;
          tmpt := whys[i]; whys[i] := whys[j]; whys[j] := tmpt;
          tmpt := lanes[i]; lanes[i] := lanes[j]; lanes[j] := tmpt;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  -- record the Moonrise views (each person counts once per post)
  moon_ids := moon_ids || spare_ids;
  if cardinality(moon_ids) > 0 then
    with ins as (
      insert into public.moon_shown (post_id, viewer_id, phase, round, weight)
      select mp.post_id, v, mp.phase, mp.round, weight from public.moon_posts mp where mp.post_id = any (moon_ids)
      on conflict do nothing
      returning post_id
    )
    update public.moon_posts mp set shown = mp.shown + 1, updated_at = now() where mp.post_id in (select post_id from ins);
  end if;

  select coalesce(jsonb_agg(public.post_json(p, v) || jsonb_build_object('why', o.why, 'lane', o.lane) order by o.ord), '[]'::jsonb)
    into res
  from unnest(ids, whys, lanes) with ordinality as o(id, why, lane, ord)
  join public.posts p on p.id = o.id;
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- Moonrise: deciding phases (pg_cron every minute; demo: the server's timer)
-- ---------------------------------------------------------------------------

create or replace function public.moon_notify_top(p_post uuid, p_phase int) returns int
language plpgsql security definer set search_path = public as $$
declare
  p public.posts;
  tags text[];
  gap interval := make_interval(hours => (public.moon_cfg() ->> 'top_post_gap_hours')::int);
  who uuid;
  n int := 0;
begin
  select * into p from public.posts where id = p_post;
  select mp.tags into tags from public.moon_posts mp where mp.post_id = p_post;
  for who in
    select q.id from public.profiles q
    where q.id <> p.author_id and not q.is_bot and not q.banned
      and (p_phase = 4 or cardinality(coalesce(tags, '{}')) = 0 or q.interests && tags)
      and not exists (select 1 from public.moon_shown s where s.post_id = p.id and s.viewer_id = q.id)
      and not exists (select 1 from public.blocks b where (b.blocker_id = q.id and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = q.id))
      and not exists (select 1 from public.moon_top_notices t where t.user_id = q.id and t.last_at > now() - gap)
  loop
    perform public.notify_user(who, p.author_id, 'top_post', p.id, null, null, null,
      public.moon_phase_emoji(p_phase) || ' ' || public.moon_phase_name(p_phase) || ' · ' || left(p.body, 180));
    insert into public.moon_top_notices (user_id, last_at) values (who, now())
    on conflict (user_id) do update set last_at = excluded.last_at;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.moon_tick(p_limit int default 200) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.moon_cfg();
  m record;
  p public.posts;
  n int; nw real; k int; kw real;
  score real; bar real; bars real[]; left_n int;
  phase_age interval; limit_hours int;
  decide boolean;
  went_up boolean;
  moved int := 0; decided int := 0; erased int := 0;
begin
  delete from public.moon_shown where shown_at < now() - interval '7 days';
  if not public.moon_enabled() then
    return jsonb_build_object('enabled', false);
  end if;
  bars := array[public.moon_bar(0), public.moon_bar(1), public.moon_bar(2), public.moon_bar(3)];
  for m in
    select * from public.moon_posts where state <> 'done' and phase <= 3 order by updated_at, post_id limit greatest(1, p_limit)
  loop
    select * into p from public.posts where id = m.post_id;
    if p.id is null or p.deleted_at is not null then          -- removed: erase its phases
      delete from public.moon_results where post_id = m.post_id;
      delete from public.moon_shown where post_id = m.post_id;
      delete from public.moon_posts where post_id = m.post_id;
      erased := erased + 1;
      continue;
    end if;
    continue when p.mod_state = 'held';                       -- held: stops moving
    continue when now() < m.not_before;

    select count(*), coalesce(sum(x.weight), 0), count(*) filter (where x.loved), coalesce(sum(x.weight) filter (where x.loved), 0)
      into n, nw, k, kw
    from (select s.weight, public.moon_loved(s.post_id, s.viewer_id) as loved
          from public.moon_shown s where s.post_id = m.post_id and s.phase = m.phase and s.round = m.round) x;
    update public.moon_posts set shown = n where post_id = m.post_id and shown <> n;

    phase_age := now() - greatest(m.phase_started_at, m.not_before);
    limit_hours := case when m.phase = 3 then (cfg ->> 'full_hours')::int else (cfg ->> 'phase_hours')::int end;
    left_n := case when n >= m.target then 0 else public.moon_eligible_left(m.post_id, 1) end;
    decide := n >= case when m.phase = 3 then ceil(0.8 * m.target) else m.target end
           or (left_n = 0 and n >= 1)
           or (phase_age >= make_interval(hours => limit_hours) and n >= (cfg ->> 'min_decide')::int)
           or (p.created_at < now() - interval '7 days' and n >= 1);
    if not decide then
      if p.created_at < now() - interval '7 days' or (left_n = 0 and n = 0) then   -- nobody left who could see it
        update public.moon_posts set state = 'done', ended = 'exhausted', updated_at = now() where post_id = m.post_id;
      elsif phase_age >= make_interval(hours => limit_hours) and m.state <> 'waiting' then
        update public.moon_posts set state = 'waiting', updated_at = now() where post_id = m.post_id;
      else
        update public.moon_posts set updated_at = now() where post_id = m.post_id;
      end if;
      continue;
    end if;

    score := public.moon_score(kw, nw);
    if m.round = 2 then
      score := greatest(score, m.best_score);                 -- Second Night: the better result counts
    end if;
    bar := bars[m.phase + 1];
    went_up := kw > 0 and score >= bar;                     -- somebody has to have loved it
    decided := decided + 1;

    insert into public.moon_results (post_id, phase, round, shown, shown_w, loved, loved_w, score, bar, result)
    values (m.post_id, m.phase, m.round, n, nw, k, kw, score, bar,
      case when went_up then 'up' when m.phase = 0 and m.round = 1 and (cfg ->> 'second_night')::boolean then 'retry' else 'stay' end)
    on conflict (post_id, phase, round) do nothing;

    if went_up then
      moved := moved + 1;
      update public.moon_posts set
        phase = m.phase + 1, round = 1, shown = 0,
        state = case when m.phase + 1 = 4 then 'done' else 'testing' end,
        ended = case when m.phase + 1 = 4 then 'top' end,
        target = case
          when m.phase + 1 <= 2 then greatest(1, (cfg -> 'sizes' ->> (m.phase + 1))::int)
          when m.phase + 1 = 3 then greatest(1, public.moon_eligible_left(m.post_id))
          else m.target end,
        phase_started_at = now(), not_before = now(), best_score = 0, updated_at = now()
      where post_id = m.post_id;
      perform public.notify_user(m.author_id, null, 'moon', m.post_id, null, null, null, public.moon_phase_name(m.phase + 1));
      if m.phase + 1 >= 3 then
        perform public.moon_notify_top(m.post_id, m.phase + 1);
      end if;
    elsif m.phase = 0 and m.round = 1 and (cfg ->> 'second_night')::boolean then
      -- Second Night: one more New Moon with fresh people, at night, after a rest
      update public.moon_posts set round = 2, shown = 0, state = 'testing', best_score = score,
        not_before = now() + interval '6 hours', phase_started_at = now() + interval '6 hours', updated_at = now()
      where post_id = m.post_id;
    else
      update public.moon_posts set state = 'done', ended = 'failed', updated_at = now() where post_id = m.post_id;
    end if;
  end loop;
  return jsonb_build_object('enabled', true, 'decided', decided, 'moved_up', moved, 'erased', erased);
end $$;

-- ---------------------------------------------------------------------------
-- Moonrise: what members, authors and admins can call
-- ---------------------------------------------------------------------------

create or replace function public.get_moonrise() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_member();
  return jsonb_build_object('version', 1, 'enabled', public.moon_enabled(), 'sizes', public.moon_cfg() -> 'sizes');
end $$;

-- The author's view of their post's climb (staff can see it too).
create or replace function public.get_moon_status(p_post uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  m public.moon_posts;
  cfg jsonb := public.moon_cfg();
  n int; k int; nw real; kw real;
  bar real; quota real;
begin
  select * into m from public.moon_posts where post_id = p_post;
  if m.post_id is null then
    return null;
  end if;
  if m.author_id <> v and not public.is_moderator() then
    raise exception 'FORBIDDEN|Only the author can see this.';
  end if;
  select count(*), count(*) filter (where x.loved), coalesce(sum(x.weight), 0), coalesce(sum(x.weight) filter (where x.loved), 0)
    into n, k, nw, kw
  from (select s.weight, public.moon_loved(s.post_id, s.viewer_id) as loved
        from public.moon_shown s where s.post_id = p_post and s.phase = m.phase and s.round = m.round) x;
  if m.phase <= 3 then
    quota := (cfg -> 'quotas' ->> m.phase)::real;
    bar := public.moon_bar(m.phase);
  end if;
  return jsonb_build_object(
    'phase', m.phase, 'name', public.moon_phase_name(m.phase), 'emoji', public.moon_phase_emoji(m.phase),
    'round', m.round, 'state', m.state, 'ended', m.ended, 'target', m.target,
    'shown', n, 'loved', k, 'rate', case when n > 0 then k::float / n end,
    'score', public.moon_score(kw, nw), 'bar', bar,
    'quota', case when m.phase <= 3 then quota end,
    'resumes_at', case when m.not_before > now() then m.not_before end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('phase', r.phase, 'name', public.moon_phase_name(r.phase), 'round', r.round,
        'shown', r.shown, 'loved', r.loved, 'score', r.score, 'bar', r.bar, 'result', r.result, 'decided_at', r.decided_at)
        order by r.decided_at)
      from public.moon_results r where r.post_id = p_post), '[]'::jsonb)
  );
end $$;

create or replace function public.mark_not_interested(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  p public.posts;
begin
  select * into p from public.posts where id = p_post and deleted_at is null;
  if p.id is null then
    raise exception 'NOT_FOUND|That post is gone.' using errcode = 'P0002';
  end if;
  if p.author_id = v then
    raise exception 'INVALID|That''s your own post.';
  end if;
  perform public.enforce_rate_limit('not_interested', 200, 3600);
  insert into public.not_interested (user_id, post_id, author_id, hashtags)
  values (v, p.id, p.author_id, p.hashtags) on conflict do nothing;
end $$;

create or replace function public.undo_not_interested(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  delete from public.not_interested where user_id = v and post_id = p_post;
end $$;

create or replace function public.admin_get_moonrise() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'enabled', public.moon_enabled(),
    'config', public.moon_cfg(),
    'phases', (select coalesce(jsonb_object_agg(phase, n), '{}'::jsonb) from (
      select phase, count(*) as n from public.moon_posts where created_at > now() - interval '7 days' group by phase) s),
    'open', (select count(*) from public.moon_posts where state <> 'done'),
    'decided_week', (select count(*) from public.moon_results where decided_at > now() - interval '7 days'),
    'moved_up_week', (select count(*) from public.moon_results where decided_at > now() - interval '7 days' and result = 'up')
  );
end $$;

-- Turn Moonrise on or off, or change its numbers. Turning it on brings in the
-- last 24 hours of posts.
create or replace function public.admin_set_moonrise(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_admin();
  cfg jsonb := '{}'::jsonb;
  x jsonb;
  was boolean := public.moon_enabled();
  post_id uuid;
begin
  perform public.enforce_rate_limit('moonrise_settings', 60, 3600);
  if p ? 'sizes' then
    x := p -> 'sizes';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) <> 3
       or exists (select 1 from jsonb_array_elements(x) e where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric not between 2 and 100000)
       or not ((x ->> 0)::int < (x ->> 1)::int and (x ->> 1)::int < (x ->> 2)::int) then
      raise exception 'INVALID|Audience sizes are three growing numbers from 2 to 100,000.';
    end if;
    cfg := cfg || jsonb_build_object('sizes', x);
  end if;
  if p ? 'quotas' then
    x := p -> 'quotas';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) <> 4
       or exists (select 1 from jsonb_array_elements(x) e where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric <= 0 or (e #>> '{}')::numeric > 1) then
      raise exception 'INVALID|Quotas are four shares between 0 and 1.';
    end if;
    cfg := cfg || jsonb_build_object('quotas', x);
  end if;
  if p ? 'second_night' then
    if jsonb_typeof(p -> 'second_night') <> 'boolean' then raise exception 'INVALID|Second Night is on or off.'; end if;
    cfg := cfg || jsonb_build_object('second_night', p -> 'second_night');
  end if;
  if p ? 'slots' then
    if jsonb_typeof(p -> 'slots') <> 'number' or (p ->> 'slots')::numeric not in (0, 1, 2, 3, 4) then
      raise exception 'INVALID|Moonrise slots per page: 0 to 4.';
    end if;
    cfg := cfg || jsonb_build_object('slots', (p ->> 'slots')::int);
  end if;
  update public.moon_settings set
    enabled = case when p ? 'enabled' then (p ->> 'enabled')::boolean else enabled end,
    config = config || cfg, updated_by = v, updated_at = now()
  where id;
  if not was and public.moon_enabled() then
    for post_id in select id from public.posts where created_at > now() - interval '24 hours' and deleted_at is null loop
      perform public.moon_enroll(post_id);
    end loop;
  end if;
  perform public.audit('moonrise_settings', null, null, p);
  return public.admin_get_moonrise();
end $$;

-- ---------------------------------------------------------------------------
-- Scheduler: pg_cron every minute where it exists (Supabase); demo mode's
-- server calls moon_tick() on its own timer.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('yoru-moon-tick', '* * * * *', 'select public.moon_tick(500)');
    exception when others then
      raise notice 'pg_cron not set up: %', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'get_follow_state(uuid)', 'follow_user(uuid)', 'unfollow_user(uuid)', 'list_follows(uuid, text, int)',
    'set_notification_prefs(jsonb)', 'mark_channel_read(uuid)',
    'get_for_you(uuid[], int, int)', 'get_moonrise()', 'get_moon_status(uuid)',
    'mark_not_interested(uuid)', 'undo_not_interested(uuid)',
    'admin_get_moonrise()', 'admin_set_moonrise(jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'follows_on_block()', 'push_next_due()', 'moon_tags(text[], text[])', 'moon_cfg()', 'moon_enabled()', 'moon_circle(uuid)', 'moon_loved(uuid, uuid)',
    'moon_eligible_left(uuid, int)', 'moon_enroll(uuid)', 'moon_bar(int)', 'moon_score(double precision, double precision)',
    'moon_on_post_insert()', 'moon_notify_top(uuid, int)', 'moon_tick(int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  grant execute on function public.moon_badge(uuid) to anon, authenticated, service_role;
  grant execute on function public.moon_mine(uuid) to anon, authenticated, service_role;
end $$;
