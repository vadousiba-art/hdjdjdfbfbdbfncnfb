-- ============================================================================
-- YORU: the Night Crew. YORU bot accounts, always labeled as bots ("· Night
-- Crew" in every name, a bot note in every bio, marked AI), that like members'
-- new posts and follow members, so nobody posts into silence while YORU is
-- small. The owner decides how many there are and when they act (Watchtower ->
-- Controls); their names and bios can be written by Gemini.
--
-- - Bots are never in Moonrise test audiences and never on leaderboards.
-- - Randomized: each post gets between 1 and the "likes per post" setting (one
--   more for a member's first 3 posts), added at random times after the first
--   3 minutes, fewer once real people engage, none past 5 of them. Each member
--   is followed by "follows per member" crew members, at random moments.
-- - "Unleash" fills every post's and member's quota at once.
-- ============================================================================

create table if not exists public.crew_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  max_likes int not null default 3 check (max_likes between 1 and 50),
  follows int not null default 1 check (follows between 0 and 50),
  chance real not null default 0.35 check (chance > 0 and chance <= 1),
  updated_at timestamptz not null default now()
);
insert into public.crew_settings (id) values (true) on conflict do nothing;

create table if not exists public.crew_members (
  id uuid primary key references public.profiles (id) on delete cascade,
  n int not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.crew_settings enable row level security;
alter table public.crew_members enable row level security;
revoke all on public.crew_settings, public.crew_members from anon, authenticated;

insert into public.profiles (id, username, display_name, avatar_url, bio, badge, verified, is_bot, leaderboard_opt_in, interests)
values
  ('00000000-0000-4000-8000-0000000000c1', 'NightCrew1', 'Kai · Night Crew', null, 'I cheer on new posts so nobody posts into silence. (YORU Night Crew bot)', '🌙', false, true, false, '{anime,gaming}'),
  ('00000000-0000-4000-8000-0000000000c2', 'NightCrew2', 'Rin · Night Crew', null, 'Here for your art, music and late-night thoughts. (YORU Night Crew bot)', '🌙', false, true, false, '{art,music}'),
  ('00000000-0000-4000-8000-0000000000c3', 'NightCrew3', 'Sora · Night Crew', null, 'I like posts so new members know someone''s reading. (YORU Night Crew bot)', '🌙', false, true, false, '{manga,memes}'),
  ('00000000-0000-4000-8000-0000000000c4', 'NightCrew4', 'Mika · Night Crew', null, 'Cosplay, fashion and everything after midnight. (YORU Night Crew bot)', '🌙', false, true, false, '{cosplay,fashion}'),
  ('00000000-0000-4000-8000-0000000000c5', 'NightCrew5', 'Yuki · Night Crew', null, 'Tech, film and the occasional 3 am idea. (YORU Night Crew bot)', '🌙', false, true, false, '{tech,film}')
on conflict (id) do nothing;
insert into public.crew_members (id, n)
select id, row_number() over (order by id) from public.profiles
where id in ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3',
             '00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c5')
on conflict do nothing;

-- The crew members who act (switched-off ones keep their past likes).
create or replace function public.crew_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.id order by c.n), '{}') from public.crew_members c
  join public.profiles p on p.id = c.id where c.active and not p.banned
$$;

create or replace function public.crew_owner() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if not exists (select 1 from public.profiles where id = v and role = 'owner') then
    raise exception 'FORBIDDEN|Only the owner runs the Night Crew.' using errcode = '42501';
  end if;
  return v;
end $$;

-- One pass (pg_cron every 10 minutes; demo: the server's timer). p_chance null
-- uses the setting; 1 ("unleash") fills every quota now.
create or replace function public.crew_tick(p_chance double precision default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg public.crew_settings;
  crew uuid[] := public.crew_ids();
  size int;
  chance double precision;
  r record;
  who uuid;
  want int;
  kinds text[] := array['heart', 'heart', 'heart', 'fire', 'w', 'skull'];
  liked int := 0;
  followed int := 0;
begin
  select * into cfg from public.crew_settings where id;
  size := cardinality(crew);
  if not coalesce(cfg.enabled, false) or size = 0 then
    return jsonb_build_object('enabled', coalesce(cfg.enabled, false), 'crew', size);
  end if;
  chance := least(1, greatest(0.01, coalesce(p_chance, cfg.chance)));

  -- likes: real members' posts from the last 48 hours, 3 minutes old or more
  for r in
    select p.id, p.author_id, x.crew_now,
      least(size, case when x.human >= 5 then 0
           else 1 + abs(hashtext(p.id::text)) % cfg.max_likes
                + case when (select count(*) from public.posts e where e.author_id = p.author_id and e.created_at <= p.created_at and e.repost_of is null) <= 3 then 1 else 0 end
                - case when x.human >= 2 then 1 else 0 end
      end) as target
    from public.posts p
    join public.profiles a on a.id = p.author_id
    cross join lateral (
      select count(distinct re.user_id) filter (where not (re.user_id = any (crew)) and re.user_id <> p.author_id and not q.is_bot) as human,
             count(distinct re.user_id) filter (where re.user_id = any (crew)) as crew_now
      from public.reactions re join public.profiles q on q.id = re.user_id where re.post_id = p.id
    ) x
    where p.created_at > now() - interval '48 hours' and p.created_at < now() - interval '3 minutes'
      and p.deleted_at is null and p.repost_of is null and p.kind in ('post', 'poll') and p.mod_state <> 'held'
      and not a.is_bot and not a.banned
    order by p.created_at desc
    limit 500
  loop
    continue when r.crew_now >= r.target or random() >= chance;
    want := case when chance >= 1 then r.target - r.crew_now else 1 end;
    for who in
      select c from unnest(crew) c
      where not exists (select 1 from public.reactions re where re.post_id = r.id and re.user_id = c)
        and not exists (select 1 from public.blocks b where (b.blocker_id = r.author_id and b.blocked_id = c) or (b.blocker_id = c and b.blocked_id = r.author_id))
      order by random() limit want
    loop
      insert into public.reactions (post_id, user_id, kind) values (r.id, who, kinds[1 + floor(random() * 6)::int]) on conflict do nothing;
      liked := liked + 1;
    end loop;
    exit when liked >= 2000;
  end loop;

  -- follows: each member gets "follows" crew followers, at random moments
  for r in
    select q.id, cfg.follows - (select count(*) from public.follows f where f.followee_id = q.id and f.follower_id = any (crew)) as missing
    from public.profiles q
    where not q.is_bot and not q.banned
      and (select count(*) from public.follows f where f.followee_id = q.id and f.follower_id = any (crew)) < least(cfg.follows, size)
    order by random() limit case when chance >= 1 then 5000 else 50 end
  loop
    continue when random() >= chance;
    for who in
      select c from unnest(crew) c
      where not exists (select 1 from public.follows f where f.follower_id = c and f.followee_id = r.id)
        and not exists (select 1 from public.blocks b where (b.blocker_id = r.id and b.blocked_id = c) or (b.blocker_id = c and b.blocked_id = r.id))
      order by random() limit case when chance >= 1 then r.missing else 1 end
    loop
      insert into public.follows (follower_id, followee_id) values (who, r.id) on conflict do nothing;
      perform public.notify_user(r.id, who, 'follow');
      followed := followed + 1;
    end loop;
  end loop;

  return jsonb_build_object('enabled', true, 'crew', size, 'liked', liked, 'followed', followed);
end $$;

create or replace function public.admin_get_crew() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select jsonb_build_object(
    'enabled', s.enabled, 'max_likes', s.max_likes, 'follows', s.follows, 'chance', s.chance,
    'likes_week', (select count(*) from public.reactions re join public.crew_members c on c.id = re.user_id where re.created_at > now() - interval '7 days'),
    'follows_total', (select count(*) from public.follows f join public.crew_members c on c.id = f.follower_id),
    'crew', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio, 'active', c.active) order by c.n)
                      from public.crew_members c join public.profiles p on p.id = c.id), '[]'::jsonb)
  ) from public.crew_settings s where s.id);
end $$;

create or replace function public.admin_set_crew(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.crew_owner();
  update public.crew_settings set
    enabled = case when p ? 'enabled' then (p ->> 'enabled')::boolean else enabled end,
    max_likes = case when p ? 'max_likes' then least(50, greatest(1, (p ->> 'max_likes')::int)) else max_likes end,
    follows = case when p ? 'follows' then least(50, greatest(0, (p ->> 'follows')::int)) else follows end,
    chance = case when p ? 'chance' then least(1, greatest(0.05, (p ->> 'chance')::real)) else chance end,
    updated_at = now()
  where id;
  perform public.audit('night_crew', null, null, p);
  return public.admin_get_crew();
end $$;

-- Add crew members. Each is {name, bio, interests}; whatever the text says,
-- the account is a labeled bot: "· Night Crew" is added to the name and a bot
-- note to the bio. At most 50 per call and 500 in all.
create or replace function public.admin_add_crew(p_members jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  nm text;
  bio text;
  ints text[];
  next_n int;
  new_id uuid;
begin
  perform public.crew_owner();
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 1 and 50 then
    raise exception 'INVALID|Add between 1 and 50 at a time.';
  end if;
  if (select count(*) from public.crew_members) + jsonb_array_length(p_members) > 500 then
    raise exception 'INVALID|The Night Crew tops out at 500.';
  end if;
  for m in select * from jsonb_array_elements(p_members) loop
    nm := left(nullif(trim(regexp_replace(coalesce(m ->> 'name', ''), '[^[:alpha:][:digit:] ''.-]', '', 'g')), ''), 24);
    nm := coalesce(nm, 'Crew');
    bio := left(trim(regexp_replace(coalesce(m ->> 'bio', ''), '\s+', ' ', 'g')), 150);
    bio := trim(bio || ' (YORU Night Crew bot)');
    select coalesce(array_agg(distinct t), '{}') into ints from jsonb_array_elements_text(coalesce(m -> 'interests', '[]'::jsonb)) t
    where t = any (public.interest_keys());
    ints := ints[1:4];
    select coalesce(max(n), 0) + 1 into next_n from public.crew_members;
    -- skip numbers a real member already uses as a username
    while exists (select 1 from public.profiles where lower(username) = lower('NightCrew' || next_n)) loop
      next_n := next_n + 1;
    end loop;
    new_id := gen_random_uuid();
    insert into public.profiles (id, username, display_name, avatar_url, bio, badge, verified, is_bot, leaderboard_opt_in, interests)
    values (new_id, 'NightCrew' || next_n, nm || ' · Night Crew', null, bio, '🌙', false, true, false, ints);
    insert into public.crew_members (id, n) values (new_id, next_n);
  end loop;
  perform public.audit('night_crew_add', null, null, jsonb_build_object('count', jsonb_array_length(p_members)));
  return public.admin_get_crew();
end $$;

create or replace function public.admin_set_crew_member(p_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.crew_owner();
  update public.crew_members set active = p_active where id = p_id;
  return public.admin_get_crew();
end $$;

create or replace function public.admin_unleash_crew() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  res jsonb;
begin
  perform public.crew_owner();
  perform public.enforce_rate_limit('crew_unleash', 30, 3600);
  res := public.crew_tick(1);
  perform public.audit('night_crew_unleash', null, null, res);
  return res;
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('yoru-night-crew', '*/10 * * * *', 'select public.crew_tick()');
    exception when others then
      raise notice 'pg_cron not set up: %', sqlerrm;
    end;
  end if;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['crew_tick(double precision)', 'crew_ids()', 'crew_owner()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['admin_get_crew()', 'admin_set_crew(jsonb)', 'admin_add_crew(jsonb)', 'admin_set_crew_member(uuid, boolean)', 'admin_unleash_crew()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
