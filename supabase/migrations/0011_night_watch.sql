-- ============================================================================
-- YORU — Night Watch: automated moderation, Watchtower, Watch and interests.
-- docs/night-watch.md
--
--   * Rules engine (this file): runs inside the database on every new post,
--     comment and story, so it can't be skipped by calling the API directly.
--     Blocks slurs, threats, scams, doxxing and spam floods; holds unclear
--     cases for review; flags posts about self-harm so a person checks in.
--   * AI layer (src/lib/server/moderation.ts): when ANTHROPIC_API_KEY is set,
--     the server also screens text and images before they post, screens
--     reported content (including reported DMs, never unreported ones) and
--     gives appeals a second opinion. It records its decisions through the
--     service-only nw_* functions below.
--   * Strikes: warning → 24 h mute → 7 day mute → 30 day mute. Strikes expire
--     after 90 days. Bans are never automatic: Watchtower recommends them and
--     an admin decides.
--   * Every decision is logged (mod_events), explained to the member by the
--     YORU official account, and can be appealed from Account Standing.
--   * Moderator role: reviews the queue and appeals; can't ban or change roles.
--   * get_watch / get_interest_feed for the Watch tab and the Interests feed.
--
-- Additive and backward-compatible: new tables (RLS on, no direct writes),
-- new defaulted columns, one widened check constraint (roles), one widened
-- settings key list, restrictive read policies that only hide content held
-- for review. Existing functions keep their signatures. Safe to re-run.
-- ============================================================================

create or replace function public.night_watch_version() returns int
language sql immutable as $$ select 1 $$;

-- ---------------------------------------------------------------------------
-- Roles: moderator
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'moderator', 'member'));

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and not banned and role in ('owner', 'admin', 'moderator')
  )
$$;

create or replace function public.require_moderator() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if not public.is_moderator() then
    raise exception 'FORBIDDEN|Moderators only.' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_admin();
  my_role text;
  their_role text;
begin
  select role into my_role from public.profiles where id = v;
  select role into their_role from public.profiles where id = p_user_id and not is_bot;
  if their_role is null then
    raise exception 'NOT_FOUND|No such member.' using errcode = 'P0002';
  end if;
  if p_role not in ('admin', 'moderator', 'member') then
    raise exception 'INVALID|Roles are admin, moderator or member.';
  end if;
  if their_role = 'owner' or p_user_id = v then
    raise exception 'FORBIDDEN|That role can''t be changed here.' using errcode = '42501';
  end if;
  -- The owner hands out admin. Admins can add or remove moderators.
  if my_role <> 'owner' and (p_role = 'admin' or their_role = 'admin') then
    raise exception 'FORBIDDEN|Only the owner hands out the crowns.' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end $$;

-- ---------------------------------------------------------------------------
-- The YORU official account: sends moderation notices. Not a login.
-- ---------------------------------------------------------------------------

create or replace function public.official_id() returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-0000000000f1'::uuid $$;

insert into public.profiles (id, username, display_name, avatar_url, bio, badge, verified, is_bot, leaderboard_opt_in)
values (
  '00000000-0000-4000-8000-0000000000f1',
  'YORU',
  'YORU',
  '/brand/yoru/app-icon-512.png',
  'Official notices from the YORU team: moderation decisions, appeals and safety updates.',
  '',
  true,
  true,
  false
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Moderation state on content
--   ok     visible
--   label  visible behind a sensitive-content screen (posts)
--   held   only the author and moderators can see it until it is reviewed
-- ---------------------------------------------------------------------------

alter table public.posts add column if not exists mod_state text not null default 'ok';
alter table public.posts add column if not exists mod_label text;
alter table public.posts add column if not exists mod_checked_at timestamptz;
alter table public.posts add column if not exists media_sha256 text;
alter table public.comments add column if not exists mod_state text not null default 'ok';
alter table public.comments add column if not exists mod_label text;
alter table public.comments add column if not exists mod_checked_at timestamptz;
alter table public.stories add column if not exists mod_state text not null default 'ok';
alter table public.stories add column if not exists mod_label text;
alter table public.stories add column if not exists mod_checked_at timestamptz;
alter table public.stories add column if not exists media_sha256 text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_mod_state_check') then
    alter table public.posts add constraint posts_mod_state_check check (mod_state in ('ok', 'label', 'held'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comments_mod_state_check') then
    alter table public.comments add constraint comments_mod_state_check check (mod_state in ('ok', 'held'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_mod_state_check') then
    alter table public.stories add constraint stories_mod_state_check check (mod_state in ('ok', 'held'));
  end if;
end $$;

create index if not exists posts_held_idx on public.posts (created_at desc) where mod_state <> 'ok';
create index if not exists posts_video_idx on public.posts (created_at desc) where media_type = 'video' and deleted_at is null;

-- Held content is hidden from everyone except its author and moderators.
-- Restrictive: combined with the existing read policies, never loosens them.
drop policy if exists "night watch holds posts" on public.posts;
create policy "night watch holds posts" on public.posts as restrictive for select to authenticated
  using (mod_state <> 'held' or author_id = auth.uid() or (select public.is_moderator()));
drop policy if exists "night watch holds comments" on public.comments;
create policy "night watch holds comments" on public.comments as restrictive for select to authenticated
  using (mod_state <> 'held' or author_id = auth.uid() or (select public.is_moderator()));
drop policy if exists "night watch holds stories" on public.stories;
create policy "night watch holds stories" on public.stories as restrictive for select to authenticated
  using (mod_state <> 'held' or author_id = auth.uid() or (select public.is_moderator()));

-- Posts carry their moderation state so the app can show a sensitive-content
-- screen, or "under review" to the author.
create or replace function public.post_json(p public.posts, v uuid) returns jsonb
language sql stable as $$
  select public.post_json_core(p, v) || jsonb_build_object(
    'repost_of', (
      select public.post_json_core(rp, v) from public.posts rp
      where rp.id = p.repost_of and rp.deleted_at is null
    ),
    'mod', case when p.mod_state <> 'ok' then jsonb_build_object('state', p.mod_state, 'label', p.mod_label) end
  )
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.mod_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  target_type text not null check (target_type in ('post', 'comment', 'story', 'message', 'user')),
  target_id uuid,                       -- null when the content was blocked before it was saved
  author_id uuid references public.profiles (id) on delete cascade,
  source text not null check (source in ('rules', 'ai', 'reports', 'media', 'staff')),
  verdict text not null check (verdict in ('allow', 'label', 'flag', 'hold', 'remove', 'block')),
  category text not null default 'other' check (char_length(category) <= 30),
  severe boolean not null default false,
  confidence real,
  reason text not null default '' check (char_length(reason) <= 400),
  excerpt text not null default '' check (char_length(excerpt) <= 600),
  media_url text,
  scores jsonb not null default '{}'::jsonb,
  test_mode boolean not null default false,
  removed boolean not null default false, -- Night Watch removed it, so a review can restore it
  status text not null default 'open' check (status in ('open', 'auto', 'upheld', 'overturned', 'dismissed')),
  report_count int not null default 0,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  note text not null default '' check (char_length(note) <= 500)
);
create index if not exists mod_events_status_idx on public.mod_events (status, created_at desc);
create index if not exists mod_events_author_idx on public.mod_events (author_id, created_at desc);
create index if not exists mod_events_target_idx on public.mod_events (target_type, target_id);

create table if not exists public.mod_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.mod_events (id) on delete set null,
  category text not null,
  severity int not null default 1 check (severity between 1 and 3),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null
);
create index if not exists mod_strikes_user_idx on public.mod_strikes (user_id, created_at desc);

create table if not exists public.mod_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null unique references public.mod_events (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'granted', 'denied')),
  priority int not null default 0,
  auto_note text not null default '' check (char_length(auto_note) <= 400),
  note text not null default '' check (char_length(note) <= 500),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mod_appeals_status_idx on public.mod_appeals (status, priority desc, created_at);

-- Fingerprints of removed media, so the same file can't be uploaded again.
create table if not exists public.mod_media_hashes (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  category text not null default 'other',
  event_id uuid references public.mod_events (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.mod_events enable row level security;
alter table public.mod_strikes enable row level security;
alter table public.mod_appeals enable row level security;
alter table public.mod_media_hashes enable row level security;
-- No policies: read and written only through the functions below.
revoke all on public.mod_events, public.mod_strikes, public.mod_appeals, public.mod_media_hashes from anon, authenticated;
grant all on public.mod_events, public.mod_strikes, public.mod_appeals, public.mod_media_hashes to service_role;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table public.app_settings drop constraint if exists app_settings_key_check;
alter table public.app_settings add constraint app_settings_key_check
  check (key in ('announcement', 'lockdown', 'slow_mode', 'word_filter', 'nightly_prompt', 'open_signup', 'night_watch'));

-- Defaults. Terms are matched after normalising text (case, l33t spelling,
-- punctuation, stretched letters). A term starting with * also matches inside
-- words with spaces and symbols removed; use it only for unambiguous terms.
create or replace function public.nw_default_config() returns jsonb
language sql immutable as $$ select $json${
  "enabled": true,
  "test_mode": false,
  "ai_text": true,
  "ai_images": true,
  "auto_dismiss_reports": true,
  "new_account_hours": 24,
  "new_account_links": "hold",
  "max_mentions": 8,
  "max_links": 3,
  "duplicate_minutes": 10,
  "burst_posts": 6,
  "burst_minutes": 5,
  "strike_days": 90,
  "ladder": [0, 1440, 10080, 43200],
  "categories": {
    "minors":       {"action": "remove", "threshold": 0.5,  "rules": "remove"},
    "hate":         {"action": "remove", "threshold": 0.8,  "rules": "remove"},
    "threats":      {"action": "remove", "threshold": 0.8,  "rules": "hold"},
    "sexual":       {"action": "remove", "threshold": 0.8,  "rules": "hold"},
    "scam":         {"action": "remove", "threshold": 0.85, "rules": "remove"},
    "private_info": {"action": "hold",   "threshold": 0.8,  "rules": "hold"},
    "harassment":   {"action": "hold",   "threshold": 0.8,  "rules": "hold"},
    "violence":     {"action": "label",  "threshold": 0.7,  "rules": "label"},
    "self_harm":    {"action": "flag",   "threshold": 0.6,  "rules": "flag"},
    "spam":         {"action": "hold",   "threshold": 0.85, "rules": "hold"}
  },
  "terms": {
    "minors": ["child porn", "*childporn", "cp links", "loli nudes", "underage nudes", "jailbait"],
    "minor_signals": ["im 12", "im 13", "im 14", "im 15", "12 yo", "13 yo", "14 yo", "15 yo", "12 year old", "13 year old", "14 year old", "15 year old", "underage", "middle schooler", "loli", "shota"],
    "hate": ["*nigger", "*niggers", "*faggot", "*faggots", "kike", "kikes", "chink", "chinks", "spic", "spics", "wetback", "wetbacks", "raghead", "towelhead", "gook", "gooks", "*sandnigger", "beaner", "beaners", "tranny", "trannies"],
    "harassment": ["retard", "retards", "fag", "fags", "nigga", "kill urself", "go kill yourself", "nobody would miss you", "you should die"],
    "threats": ["kys", "kill yourself", "i will kill you", "ill kill you", "im going to kill you", "im gonna kill you", "i will find you", "i know where you live", "shoot up the school", "bomb the school", "im going to hurt you"],
    "sexual": ["send nudes", "nudes", "porn", "pornhub", "onlyfans", "nsfw", "sexting", "dick pic"],
    "scam": ["free robux", "free nitro", "free vbucks", "crypto giveaway", "double your money", "send me your password", "dm me to earn", "cash app me", "steam gift card", "claim your prize", "investment opportunity", "guaranteed profit", "verify your account here"],
    "self_harm": ["kill myself", "want to die", "end my life", "end it all", "suicide", "suicidal", "cut myself", "self harm", "dont want to live", "no reason to live", "better off dead"]
  }
}$json$::jsonb $$;

create or replace function public.nw_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.nw_default_config() || coalesce((select value from public.app_settings where key = 'night_watch'), '{}'::jsonb)
$$;

create or replace function public.nw_label(p_category text) returns text
language sql immutable as $$
  select case p_category
    when 'minors' then 'child safety'
    when 'hate' then 'hate speech'
    when 'threats' then 'threats and violence'
    when 'sexual' then 'sexual content'
    when 'scam' then 'scams'
    when 'private_info' then 'private information'
    when 'harassment' then 'harassment'
    when 'violence' then 'graphic content'
    when 'self_harm' then 'self-harm'
    when 'spam' then 'spam'
    else 'community rules' end
$$;

-- ---------------------------------------------------------------------------
-- Rules engine
-- ---------------------------------------------------------------------------

create or replace function public.nw_normalize(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(translate(lower(coalesce(p, '')), '0134578@$', 'oieastbas'), '[''’`]', '', 'g'),
        '[^a-z0-9]+', ' ', 'g'),
      '([a-z])\1{2,}', '\1\1', 'g'),
    '\s+', ' ', 'g'))
$$;

-- Letters doubled for effect ("kiill") collapsed to one.
create or replace function public.nw_collapse(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '([a-z])\1+', '\1', 'g') $$;

-- First term from p_terms found in the text, or null.
create or replace function public.nw_match(p_norm text, p_squash text, p_terms jsonb) returns text
language plpgsql immutable as $$
declare
  t text;
  n text;
  c text;
  norm1 text := ' ' || public.nw_collapse(p_norm) || ' ';
begin
  if p_terms is null or jsonb_typeof(p_terms) <> 'array' or coalesce(p_norm, '') = '' then
    return null;
  end if;
  for t in select jsonb_array_elements_text(p_terms) loop
    if left(t, 1) = '*' then
      n := regexp_replace(public.nw_normalize(substr(t, 2)), '[^a-z]', '', 'g');
      if char_length(n) >= 4 and position(n in p_squash) > 0 then
        return substr(t, 2);
      end if;
    else
      n := public.nw_normalize(t);
      c := public.nw_collapse(n);
      if n <> '' and (position(' ' || n || ' ' in ' ' || p_norm || ' ') > 0
                      or (char_length(c) >= 4 and position(' ' || c || ' ' in norm1) > 0)) then
        return t;
      end if;
    end if;
  end loop;
  return null;
end $$;

-- A rules verdict for a category, using that category's rules action.
create or replace function public.nw_rule(p_category text, p_hit text, p_cfg jsonb, p_reason text default null) returns jsonb
language plpgsql immutable as $$
declare
  act text := coalesce(p_cfg -> 'categories' -> p_category ->> 'rules', 'hold');
  verdict text := case act when 'remove' then 'block' else act end;
begin
  if p_category = 'minors' then
    verdict := 'block';
  end if;
  return jsonb_build_object(
    'verdict', verdict,
    'category', p_category,
    'severe', p_category = 'minors',
    'strike', verdict = 'block',
    'source', 'rules',
    'reason', left(coalesce(p_reason, format('Matched the %s rule ("%s").', public.nw_label(p_category), p_hit)), 400),
    'message', case verdict
      when 'block' then format('This wasn''t posted because it looks like it breaks our %s rule.', public.nw_label(p_category))
      else null end
  );
end $$;

-- Screens text before it is saved. p_kind is the table: posts, comments or
-- stories. Staff and the official accounts are exempt. Never writes anything.
create or replace function public.nw_screen(
  p_user uuid, p_kind text, p_text text, p_link text default null, p_has_media boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := public.nw_config();
  pr public.profiles;
  raw text := coalesce(p_text, '');
  norm text := public.nw_normalize(p_text);
  sq text;
  hit text;
  cat text;
  links int;
  mentions int;
  allow jsonb := jsonb_build_object('verdict', 'allow', 'source', 'rules');
begin
  if not coalesce((cfg ->> 'enabled')::boolean, true) then
    return allow;
  end if;
  select * into pr from public.profiles where id = p_user;
  if pr.id is null or pr.is_bot or pr.role in ('owner', 'admin', 'moderator') then
    return allow;
  end if;
  sq := regexp_replace(norm, '[^a-z]', '', 'g');

  -- Child safety first: explicit terms, or sexual terms next to an age signal.
  hit := public.nw_match(norm, sq, cfg -> 'terms' -> 'minors');
  if hit is null and public.nw_match(norm, sq, cfg -> 'terms' -> 'sexual') is not null then
    hit := public.nw_match(norm, sq, cfg -> 'terms' -> 'minor_signals');
  end if;
  if hit is not null then
    return public.nw_rule('minors', hit, cfg);
  end if;

  foreach cat in array array['hate', 'threats', 'scam', 'sexual', 'harassment', 'self_harm'] loop
    hit := public.nw_match(norm, sq, cfg -> 'terms' -> cat);
    if hit is not null then
      return public.nw_rule(cat, hit, cfg);
    end if;
  end loop;

  -- Other people's contact details.
  if raw ~ '\(?\m\d{3}\)?[ .-]?\d{3}[ .-]\d{4}\M' then
    return public.nw_rule('private_info', 'phone number', cfg, 'Contains what looks like a phone number.');
  end if;
  if raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return public.nw_rule('private_info', 'email address', cfg, 'Contains what looks like an email address.');
  end if;

  -- Spam: floods are refused without a strike. Reported content skips these.
  if p_kind = 'report' then
    return allow;
  end if;
  select count(*) into links from regexp_matches(raw, 'https?://', 'g');
  links := links + case when p_link is not null then 1 else 0 end;
  select count(*) into mentions from regexp_matches(raw, '@[A-Za-z0-9_]{3,20}', 'g');
  if mentions > coalesce((cfg ->> 'max_mentions')::int, 8) then
    return jsonb_build_object('verdict', 'block', 'category', 'spam', 'strike', false, 'source', 'rules',
      'reason', 'Too many mentions.', 'message', 'That''s a lot of mentions for one post. Try tagging fewer people.');
  end if;
  if links > coalesce((cfg ->> 'max_links')::int, 3) then
    return jsonb_build_object('verdict', 'block', 'category', 'spam', 'strike', false, 'source', 'rules',
      'reason', 'Too many links.', 'message', 'Too many links in one post. Keep it to a few.');
  end if;
  if p_kind in ('posts', 'comments') and char_length(norm) >= 8 then
    if exists (
      select 1 from public.posts
      where author_id = p_user and deleted_at is null and kind <> 'repost'
        and created_at > now() - make_interval(mins => coalesce((cfg ->> 'duplicate_minutes')::int, 10))
        and public.nw_normalize(body) = norm
    ) or exists (
      select 1 from public.comments
      where author_id = p_user and deleted_at is null
        and created_at > now() - make_interval(mins => coalesce((cfg ->> 'duplicate_minutes')::int, 10))
        and public.nw_normalize(body) = norm
    ) then
      return jsonb_build_object('verdict', 'block', 'category', 'spam', 'strike', false, 'source', 'rules',
        'reason', 'Duplicate of a recent post.', 'message', 'You just posted that. Give it a minute before posting it again.');
    end if;
  end if;
  if p_kind = 'posts' and (
    select count(*) from public.posts
    where author_id = p_user and kind <> 'repost'
      and created_at > now() - make_interval(mins => coalesce((cfg ->> 'burst_minutes')::int, 5))
  ) >= coalesce((cfg ->> 'burst_posts')::int, 6) then
    return jsonb_build_object('verdict', 'block', 'category', 'spam', 'strike', false, 'source', 'rules',
      'reason', 'Posting burst.', 'message', 'You''re posting very fast. Take a short break and try again in a few minutes.');
  end if;
  if raw ~ '(.)\1{24,}' then
    return public.nw_rule('spam', 'repeated characters', cfg, 'Long run of repeated characters.');
  end if;
  if links > 0 and cfg ->> 'new_account_links' = 'hold'
     and pr.created_at > now() - make_interval(hours => coalesce((cfg ->> 'new_account_hours')::int, 24)) then
    return jsonb_build_object('verdict', 'hold', 'category', 'spam', 'strike', false, 'source', 'rules',
      'reason', 'New account posting a link.', 'message', null);
  end if;
  return allow;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers: log, notify, strike
-- ---------------------------------------------------------------------------

create or replace function public.nw_log(
  p_type text, p_id uuid, p_author uuid, p_verdict jsonb, p_text text, p_status text,
  p_removed boolean default false, p_media text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  insert into public.mod_events (target_type, target_id, author_id, source, verdict, category, severe, confidence, reason,
                                 excerpt, media_url, scores, test_mode, removed, status)
  values (
    p_type, p_id, p_author,
    coalesce(nullif(p_verdict ->> 'source', ''), 'rules'),
    coalesce(p_verdict ->> 'verdict', 'flag'),
    left(coalesce(p_verdict ->> 'category', 'other'), 30),
    coalesce((p_verdict ->> 'severe')::boolean, false),
    (p_verdict ->> 'confidence')::real,
    left(coalesce(p_verdict ->> 'reason', ''), 400),
    left(coalesce(p_text, ''), 600),
    p_media,
    coalesce(p_verdict -> 'scores', '{}'::jsonb),
    coalesce((public.nw_config() ->> 'test_mode')::boolean, false),
    p_removed,
    p_status
  ) returning mod_events.id into new_id;
  return new_id;
end $$;

-- The member's notice channel with the official account.
create or replace function public.nw_official_channel(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ch uuid;
begin
  select c.id into ch from public.channels c
  where c.kind = 'dm'
    and exists (select 1 from public.channel_members where channel_id = c.id and user_id = public.official_id())
    and exists (select 1 from public.channel_members where channel_id = c.id and user_id = p_user)
  limit 1;
  if ch is null then
    insert into public.channels (kind, name, emoji, is_private, created_by)
    values ('dm', 'YORU', '夜', true, public.official_id()) returning id into ch;
    insert into public.channel_members (channel_id, user_id) values (ch, public.official_id()), (ch, p_user);
  end if;
  return ch;
end $$;

create or replace function public.nw_notify(p_user uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  ch uuid;
begin
  if p_user is null or p_user = public.official_id() then
    return;
  end if;
  ch := public.nw_official_channel(p_user);
  insert into public.messages (channel_id, author_id, body) values (ch, public.official_id(), left(p_body, 2000));
  update public.channels set last_message_at = now() where id = ch;
  insert into public.notifications (user_id, actor_id, kind, channel_id, body)
  values (p_user, public.official_id(), 'moderation', ch, left(split_part(p_body, E'\n', 1), 200));
end $$;

-- Supportive check-in for posts about self-harm. At most once a day.
create or replace function public.nw_care(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notifications
    where user_id = p_user and kind = 'moderation' and body like 'Checking in%' and created_at > now() - interval '1 day'
  ) then
    return;
  end if;
  perform public.nw_notify(p_user,
    'Checking in, because your post sounded heavy. You''re not alone, and you don''t have to handle it by yourself.' || E'\n\n' ||
    'In Canada or the US you can call or text 988 any time. It''s free and confidential. Anywhere else, findahelpline.com lists free helplines near you.' || E'\n\n' ||
    'If you''re in danger right now, call 911 or your local emergency number. Your post is still up, and nobody is in trouble.');
end $$;

-- Adds a strike and applies the mute ladder. Owners and admins are exempt.
create or replace function public.nw_strike(p_user uuid, p_event uuid, p_category text, p_severity int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.nw_config();
  ladder jsonb := coalesce(cfg -> 'ladder', '[0,1440,10080,43200]'::jsonb);
  pr public.profiles;
  n int;
  mins int;
  until timestamptz;
begin
  select * into pr from public.profiles where id = p_user;
  if pr.id is null or pr.is_bot or pr.role in ('owner', 'admin') then
    return '{}'::jsonb;
  end if;
  if coalesce((cfg ->> 'test_mode')::boolean, false) then
    return jsonb_build_object('test_mode', true);
  end if;
  insert into public.mod_strikes (user_id, event_id, category, severity, expires_at)
  values (p_user, p_event, p_category, greatest(1, least(coalesce(p_severity, 1), 3)),
          now() + make_interval(days => coalesce((cfg ->> 'strike_days')::int, 90)));
  select count(*) into n from public.mod_strikes where user_id = p_user and revoked_at is null and expires_at > now();
  if p_severity >= 3 then
    mins := (ladder ->> (jsonb_array_length(ladder) - 1))::int;
  else
    mins := (ladder ->> (least(n, jsonb_array_length(ladder)) - 1))::int;
  end if;
  if coalesce(mins, 0) > 0 then
    until := now() + make_interval(mins => mins);
    update public.profiles set muted_until = greatest(coalesce(muted_until, now()), until) where id = p_user;
  end if;
  return jsonb_build_object('strikes', n, 'muted_minutes', coalesce(mins, 0), 'muted_until', until,
                            'ban_recommended', n >= 4 or p_severity >= 3);
end $$;

create or replace function public.nw_strike_notice(p_user uuid, p_what text, p_category text, p_strike jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  n int := coalesce((p_strike ->> 'strikes')::int, 0);
  until timestamptz := (p_strike ->> 'muted_until')::timestamptz;
  body text;
begin
  body := format('Your %s was removed because it broke our %s rule.', p_what, public.nw_label(p_category));
  if n > 0 then
    body := body || E'\n\n' || format('This is strike %s. Strikes expire after %s days.', n,
                                       coalesce((public.nw_config() ->> 'strike_days')::int, 90));
  end if;
  if until is not null then
    body := body || ' ' || format('You can''t post, comment or send messages until %s UTC.',
                                  to_char(until at time zone 'utc', 'Mon FMDD, HH24:MI'));
  end if;
  body := body || E'\n\n' || 'If you think we got it wrong, open Account Standing to appeal.';
  perform public.nw_notify(p_user, body);
end $$;

-- ---------------------------------------------------------------------------
-- Database guard: every member post, comment and story passes the rules.
-- ---------------------------------------------------------------------------

create or replace function public.nw_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  r jsonb;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'posts' and j ->> 'kind' = 'repost' and coalesce(j ->> 'body', '') = '' then
    return new;
  end if;
  r := public.nw_screen(new.author_id, tg_table_name, coalesce(j ->> 'body', j ->> 'text'), j ->> 'link_url', j ->> 'media_url' is not null);
  if r ->> 'verdict' = 'block' then
    raise exception 'AUTOMOD|%', coalesce(r ->> 'message', 'This wasn''t posted because it looks like it breaks the community rules.') using errcode = 'P0001';
  elsif r ->> 'verdict' = 'hold' then
    new.mod_state := 'held';
    new.mod_label := r ->> 'category';
  elsif r ->> 'verdict' = 'label' and tg_table_name = 'posts' then
    new.mod_state := 'label';
    new.mod_label := r ->> 'category';
  end if;
  if r ->> 'verdict' in ('hold', 'label', 'flag') then
    perform set_config('nw.pending', r::text, true);
  end if;
  return new;
end $$;

create or replace function public.nw_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := nullif(current_setting('nw.pending', true), '')::jsonb;
  j jsonb := to_jsonb(new);
begin
  if r is null then
    return null;
  end if;
  perform set_config('nw.pending', '', true);
  perform public.nw_log(
    case tg_table_name when 'posts' then 'post' when 'comments' then 'comment' else 'story' end,
    new.id, new.author_id, r, coalesce(j ->> 'body', j ->> 'text'),
    case when r ->> 'verdict' = 'label' then 'auto' else 'open' end, false, j ->> 'media_url');
  if r ->> 'category' = 'self_harm' then
    perform public.nw_care(new.author_id);
  end if;
  return null;
end $$;

drop trigger if exists posts_01_night_watch on public.posts;
create trigger posts_01_night_watch before insert on public.posts for each row execute function public.nw_guard();
drop trigger if exists comments_01_night_watch on public.comments;
create trigger comments_01_night_watch before insert on public.comments for each row execute function public.nw_guard();
drop trigger if exists stories_01_night_watch on public.stories;
create trigger stories_01_night_watch before insert on public.stories for each row execute function public.nw_guard();
drop trigger if exists posts_night_watch_log on public.posts;
create trigger posts_night_watch_log after insert on public.posts for each row execute function public.nw_after();
drop trigger if exists comments_night_watch_log on public.comments;
create trigger comments_night_watch_log after insert on public.comments for each row execute function public.nw_after();
drop trigger if exists stories_night_watch_log on public.stories;
create trigger stories_night_watch_log after insert on public.stories for each row execute function public.nw_after();

-- The official notice channel is one-way.
create or replace function public.nw_official_readonly() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.author_id <> public.official_id()
     and exists (select 1 from public.channel_members where channel_id = new.channel_id and user_id = public.official_id()) then
    raise exception 'FORBIDDEN|This is YORU''s notice channel, so replies aren''t read. To appeal, open Account Standing.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_01_official_readonly on public.messages;
create trigger messages_01_official_readonly before insert on public.messages for each row execute function public.nw_official_readonly();

-- ---------------------------------------------------------------------------
-- Server-only entry points (the AI layer and the report pipeline)
-- ---------------------------------------------------------------------------

-- Content refused before it was saved. Logs it, strikes if the rule says so.
create or replace function public.nw_record_block(
  p_user uuid, p_type text, p_text text, p_verdict jsonb, p_media_hash text default null, p_media text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev uuid;
  s jsonb := '{}'::jsonb;
  severe boolean := coalesce((p_verdict ->> 'severe')::boolean, false);
begin
  ev := public.nw_log(p_type, null, p_user, p_verdict || '{"verdict":"block"}'::jsonb, p_text,
                      case when severe then 'open' else 'auto' end, false, p_media);
  if p_media_hash ~ '^[0-9a-f]{64}$' and (severe or p_verdict ->> 'category' in ('sexual', 'violence', 'hate')) then
    insert into public.mod_media_hashes (sha256, category, event_id) values (p_media_hash, p_verdict ->> 'category', ev)
    on conflict do nothing;
  end if;
  if coalesce((p_verdict ->> 'strike')::boolean, true) then
    s := public.nw_strike(p_user, ev, p_verdict ->> 'category', case when severe then 3 else 1 end);
    perform public.nw_strike_notice(p_user, case p_type when 'comment' then 'comment' when 'story' then 'story' else 'post' end,
                                    p_verdict ->> 'category', s);
  end if;
  return jsonb_build_object('event_id', ev, 'strike', s);
end $$;

-- Applies a verdict to content that was just saved (or found by the sweep).
create or replace function public.nw_apply(p_type text, p_id uuid, p_verdict jsonb, p_media_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v text := coalesce(p_verdict ->> 'verdict', 'allow');
  author uuid;
  body text;
  media text;
  ev uuid;
  s jsonb;
  removed boolean := false;
begin
  if p_type = 'post' then
    update public.posts set mod_checked_at = now(), media_sha256 = coalesce(p_media_hash, media_sha256)
    where id = p_id returning author_id, posts.body, media_url into author, body, media;
  elsif p_type = 'comment' then
    update public.comments set mod_checked_at = now() where id = p_id returning author_id, comments.body into author, body;
  elsif p_type = 'story' then
    update public.stories set mod_checked_at = now(), media_sha256 = coalesce(p_media_hash, media_sha256)
    where id = p_id returning author_id, stories.text, media_url into author, body, media;
  else
    raise exception 'INVALID|Unknown target.';
  end if;
  if author is null or v = 'allow' then
    return jsonb_build_object('verdict', v);
  end if;
  if coalesce((public.nw_config() ->> 'test_mode')::boolean, false) then
    ev := public.nw_log(p_type, p_id, author, p_verdict, body, 'auto', false, media);
    return jsonb_build_object('verdict', v, 'event_id', ev, 'test_mode', true);
  end if;

  if v in ('remove', 'block') then
    if p_type = 'post' then update public.posts set deleted_at = coalesce(deleted_at, now()) where id = p_id;
    elsif p_type = 'comment' then update public.comments set deleted_at = coalesce(deleted_at, now()) where id = p_id;
    else update public.stories set deleted_at = coalesce(deleted_at, now()) where id = p_id;
    end if;
    removed := true;
  elsif v = 'hold' then
    if p_type = 'post' then update public.posts set mod_state = 'held', mod_label = p_verdict ->> 'category' where id = p_id;
    elsif p_type = 'comment' then update public.comments set mod_state = 'held', mod_label = p_verdict ->> 'category' where id = p_id;
    else update public.stories set mod_state = 'held', mod_label = p_verdict ->> 'category' where id = p_id;
    end if;
  elsif v = 'label' and p_type = 'post' then
    update public.posts set mod_state = 'label', mod_label = p_verdict ->> 'category' where id = p_id and mod_state = 'ok';
  end if;

  ev := public.nw_log(p_type, p_id, author, p_verdict || jsonb_build_object('verdict', case when v = 'block' then 'remove' else v end),
                      body, case when v in ('hold', 'flag') or coalesce((p_verdict ->> 'severe')::boolean, false) then 'open' else 'auto' end,
                      removed, media);
  if removed then
    if p_media_hash ~ '^[0-9a-f]{64}$' then
      insert into public.mod_media_hashes (sha256, category, event_id) values (p_media_hash, p_verdict ->> 'category', ev) on conflict do nothing;
    end if;
    if coalesce((p_verdict ->> 'strike')::boolean, true) then
      s := public.nw_strike(author, ev, p_verdict ->> 'category', case when coalesce((p_verdict ->> 'severe')::boolean, false) then 3 else 1 end);
      perform public.nw_strike_notice(author, p_type, p_verdict ->> 'category', s);
    end if;
  end if;
  if p_verdict ->> 'category' = 'self_harm' then
    perform public.nw_care(author);
  end if;
  return jsonb_build_object('verdict', v, 'event_id', ev);
end $$;

create or replace function public.nw_media_blocked(p_hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mod_media_hashes where sha256 = lower(p_hash))
$$;

-- Content saved without passing the server's AI check (for example an API
-- call that skipped it). The sweep screens these after the fact.
create or replace function public.nw_unchecked(p_limit int default 20) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select * from (
      select jsonb_build_object('type', 'post', 'id', p.id, 'author_id', p.author_id, 'text', p.body,
                                'media_url', p.media_url, 'media_type', p.media_type) as x, p.created_at
      from public.posts p join public.profiles a on a.id = p.author_id
      where p.mod_checked_at is null and p.deleted_at is null and p.kind <> 'repost'
        and p.created_at between now() - interval '2 days' and now() - interval '45 seconds'
        and not a.is_bot and a.role not in ('owner', 'admin', 'moderator')
      union all
      select jsonb_build_object('type', 'comment', 'id', c.id, 'author_id', c.author_id, 'text', c.body), c.created_at
      from public.comments c join public.profiles a on a.id = c.author_id
      where c.mod_checked_at is null and c.deleted_at is null and not c.is_ai
        and c.created_at between now() - interval '2 days' and now() - interval '45 seconds'
        and not a.is_bot and a.role not in ('owner', 'admin', 'moderator')
      union all
      select jsonb_build_object('type', 'story', 'id', s.id, 'author_id', s.author_id, 'text', s.text,
                                'media_url', s.media_url, 'media_type', s.media_type), s.created_at
      from public.stories s join public.profiles a on a.id = s.author_id
      where s.mod_checked_at is null and s.deleted_at is null and s.expires_at > now()
        and s.created_at between now() - interval '2 days' and now() - interval '45 seconds'
        and not a.is_bot and a.role not in ('owner', 'admin', 'moderator')
    ) q order by created_at limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ) t
$$;

-- What a report points at, for screening. Reported DMs are read only here.
create or replace function public.nw_report_target(p_type text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  if p_type = 'post' then
    select jsonb_build_object('exists', true, 'author_id', author_id, 'text', body, 'media_url', media_url, 'media_type', media_type)
    into r from public.posts where id = p_id and deleted_at is null;
  elsif p_type = 'comment' then
    select jsonb_build_object('exists', true, 'author_id', author_id, 'text', body) into r from public.comments where id = p_id and deleted_at is null;
  elsif p_type = 'message' then
    select jsonb_build_object('exists', true, 'author_id', author_id, 'text', body, 'media_url', media_url, 'media_type', media_type)
    into r from public.messages where id = p_id and deleted_at is null;
  elsif p_type = 'story' then
    select jsonb_build_object('exists', true, 'author_id', author_id, 'text', text, 'media_url', media_url, 'media_type', media_type)
    into r from public.stories where id = p_id and deleted_at is null;
  elsif p_type = 'user' then
    select jsonb_build_object('exists', true, 'author_id', id, 'text', concat_ws(E'\n', display_name, bio, status))
    into r from public.profiles where id = p_id and not banned;
  end if;
  return coalesce(r, '{"exists": false}'::jsonb) || jsonb_build_object('type', p_type, 'id', p_id);
end $$;

create or replace function public.nw_remove_target(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'post' then update public.posts set deleted_at = coalesce(deleted_at, now()) where id = p_id;
  elsif p_type = 'comment' then update public.comments set deleted_at = coalesce(deleted_at, now()) where id = p_id;
  elsif p_type = 'message' then update public.messages set deleted_at = coalesce(deleted_at, now()) where id = p_id;
  elsif p_type = 'story' then update public.stories set deleted_at = coalesce(deleted_at, now()) where id = p_id;
  end if;
end $$;

create or replace function public.nw_close_reports(p_type text, p_id uuid, p_status text, p_action text, p_by uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  rep record;
begin
  for rep in
    update public.reports set status = p_status, action = p_action, resolved_by = p_by, resolved_at = now()
    where target_type = p_type and target_id = p_id and status = 'open'
    returning reporter_id
  loop
    insert into public.notifications (user_id, actor_id, kind, body)
    values (rep.reporter_id, public.official_id(), 'report_update', left(p_note, 200));
  end loop;
end $$;

-- Decides what happens to reported content. p_verdict comes from the rules
-- or the AI. Clear-cut cases are handled automatically; anything unclear,
-- coordinated or about someone at risk goes to the Watchtower queue.
create or replace function public.nw_report_verdict(p_type text, p_id uuid, p_verdict jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.nw_config();
  t jsonb := public.nw_report_target(p_type, p_id);
  author uuid := (t ->> 'author_id')::uuid;
  v text := coalesce(p_verdict ->> 'verdict', 'allow');
  conf real := coalesce((p_verdict ->> 'confidence')::real, 0);
  reporters int;
  fresh int;
  urgent boolean;
  brigade boolean;
  staff boolean;
  ev public.mod_events;
  s jsonb;
  what text := case p_type when 'message' then 'message' when 'comment' then 'comment' when 'story' then 'story' when 'user' then 'profile' else 'post' end;
begin
  if not coalesce((t ->> 'exists')::boolean, false) then
    perform public.nw_close_reports(p_type, p_id, 'resolved', 'gone', null, 'Thanks for your report. That content is no longer on YORU.');
    return jsonb_build_object('action', 'gone');
  end if;
  select count(distinct r.reporter_id), count(distinct r.reporter_id) filter (where p.created_at > now() - interval '7 days'),
         bool_or(r.escalated or r.category = 'self_harm')
  into reporters, fresh, urgent
  from public.reports r join public.profiles p on p.id = r.reporter_id
  where r.target_type = p_type and r.target_id = p_id and r.status = 'open';
  if coalesce(reporters, 0) = 0 then
    return jsonb_build_object('action', 'none');
  end if;
  brigade := reporters >= 3 and fresh >= 2;
  staff := exists (select 1 from public.profiles where id = author and role in ('owner', 'admin'));

  select * into ev from public.mod_events
  where target_type = p_type and target_id = p_id and source = 'reports' and status = 'open' limit 1;
  if ev.id is null then
    insert into public.mod_events (target_type, target_id, author_id, source, verdict, category, severe, confidence, reason, excerpt,
                                   media_url, scores, test_mode, status, report_count)
    values (p_type, p_id, author, 'reports', case when v = 'block' then 'remove' else v end,
            left(coalesce(p_verdict ->> 'category', 'other'), 30), coalesce((p_verdict ->> 'severe')::boolean, false),
            nullif(conf, 0), left(coalesce(p_verdict ->> 'reason', ''), 400), left(coalesce(t ->> 'text', ''), 600),
            t ->> 'media_url', coalesce(p_verdict -> 'scores', '{}'::jsonb), coalesce((cfg ->> 'test_mode')::boolean, false),
            'open', reporters)
    returning * into ev;
  else
    update public.mod_events set report_count = reporters, verdict = case when v = 'block' then 'remove' else v end,
      category = left(coalesce(p_verdict ->> 'category', category), 30), confidence = nullif(conf, 0),
      reason = left(coalesce(p_verdict ->> 'reason', reason), 400)
    where id = ev.id returning * into ev;
  end if;

  if brigade then
    update public.mod_events set reason = left('Possible coordinated reporting: several new accounts reported this at once. ' || reason, 400)
    where id = ev.id;
    return jsonb_build_object('action', 'review', 'event_id', ev.id, 'brigade', true);
  end if;
  if staff or ev.test_mode then
    return jsonb_build_object('action', 'review', 'event_id', ev.id);
  end if;

  if v in ('remove', 'block') and p_type <> 'user'
     and (p_verdict ->> 'source' = 'rules' or conf >= coalesce((cfg -> 'categories' -> (p_verdict ->> 'category') ->> 'threshold')::real, 0.8)) then
    perform public.nw_remove_target(p_type, p_id);
    update public.mod_events set status = case when ev.severe then 'open' else 'auto' end, removed = true where id = ev.id;
    s := public.nw_strike(author, ev.id, ev.category, case when ev.severe then 3 else 1 end);
    perform public.nw_strike_notice(author, what, ev.category, s);
    perform public.nw_close_reports(p_type, p_id, 'resolved', 'auto_remove', null,
      'Thanks for your report. We removed it for breaking our ' || public.nw_label(ev.category) || ' rule.');
    return jsonb_build_object('action', 'removed', 'event_id', ev.id);
  end if;
  if v = 'hold' and p_type in ('post', 'comment', 'story') then
    if p_type = 'post' then update public.posts set mod_state = 'held', mod_label = ev.category where id = p_id;
    elsif p_type = 'comment' then update public.comments set mod_state = 'held', mod_label = ev.category where id = p_id;
    else update public.stories set mod_state = 'held', mod_label = ev.category where id = p_id;
    end if;
    return jsonb_build_object('action', 'held', 'event_id', ev.id);
  end if;
  if v = 'allow' and conf >= 0.9 and not coalesce(urgent, false) and reporters < 3
     and coalesce((cfg ->> 'auto_dismiss_reports')::boolean, true) then
    update public.mod_events set status = 'dismissed' where id = ev.id;
    perform public.nw_close_reports(p_type, p_id, 'dismissed', 'auto_dismiss', null,
      'Thanks for your report. We checked it and didn''t find a rule break. You can always block or mute people you don''t want to see.');
    return jsonb_build_object('action', 'dismissed', 'event_id', ev.id);
  end if;
  return jsonb_build_object('action', 'review', 'event_id', ev.id);
end $$;

-- ---------------------------------------------------------------------------
-- Restoring and appeals
-- ---------------------------------------------------------------------------

create or replace function public.nw_restore(p_event uuid, p_by uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.mod_events;
  revoked int;
begin
  select * into e from public.mod_events where id = p_event;
  if e.id is null then
    return;
  end if;
  if e.target_id is not null then
    if e.target_type = 'post' then
      update public.posts set mod_state = 'ok', mod_label = null,
        deleted_at = case when e.removed then null else deleted_at end where id = e.target_id;
    elsif e.target_type = 'comment' then
      update public.comments set mod_state = 'ok', mod_label = null,
        deleted_at = case when e.removed then null else deleted_at end where id = e.target_id;
    elsif e.target_type = 'story' then
      update public.stories set mod_state = 'ok', mod_label = null,
        deleted_at = case when e.removed then null else deleted_at end where id = e.target_id;
    elsif e.target_type = 'message' and e.removed then
      update public.messages set deleted_at = null where id = e.target_id;
    end if;
  end if;
  update public.mod_strikes set revoked_at = now(), revoked_by = p_by
  where event_id = e.id and revoked_at is null;
  get diagnostics revoked = row_count;
  -- A revoked strike lifts the mute it caused, unless another recent strike stands.
  if revoked > 0 and not exists (
    select 1 from public.mod_strikes
    where user_id = e.author_id and revoked_at is null and expires_at > now() and created_at > now() - interval '30 days'
  ) then
    update public.profiles set muted_until = null where id = e.author_id and muted_until > now();
  end if;
  update public.mod_events set status = 'overturned', reviewed_by = p_by, reviewed_at = now(),
    note = left(coalesce(p_note, ''), 500) where id = e.id;
end $$;

create or replace function public.nw_grant_appeal(p_appeal uuid, p_by uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.mod_appeals;
begin
  update public.mod_appeals set status = 'granted', decided_by = p_by, decided_at = now(), note = left(coalesce(p_note, ''), 500)
  where id = p_appeal and status = 'open' returning * into a;
  if a.id is null then
    return;
  end if;
  perform public.nw_restore(a.event_id, p_by, p_note);
  perform public.nw_notify(a.user_id, 'Your appeal was granted. We reversed the decision and removed the strike.'
    || case when coalesce(p_note, '') <> '' then E'\n\n' || p_note else '' end);
end $$;

-- Member: appeal a decision about their own content.
create or replace function public.submit_appeal(p_event_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  e public.mod_events;
  a public.mod_appeals;
  strikes int;
begin
  select * into e from public.mod_events where id = p_event_id and author_id = v and not test_mode;
  if e.id is null then
    raise exception 'NOT_FOUND|No such decision.' using errcode = 'P0002';
  end if;
  if e.verdict not in ('block', 'remove', 'hold', 'label') or e.status in ('overturned', 'dismissed') then
    raise exception 'INVALID|There''s nothing to appeal here.';
  end if;
  if e.created_at < now() - interval '30 days' then
    raise exception 'INVALID|Decisions can be appealed for 30 days.';
  end if;
  if exists (select 1 from public.mod_appeals where event_id = e.id) then
    raise exception 'INVALID|You already appealed this decision.';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 3 then
    raise exception 'INVALID|Tell us why you think we got it wrong.';
  end if;
  perform public.enforce_rate_limit('appeal', 5, 86400);
  select count(*) into strikes from public.mod_strikes where user_id = v and revoked_at is null and expires_at > now();
  insert into public.mod_appeals (user_id, event_id, body, priority)
  values (v, e.id, left(trim(p_body), 1000),
          case when e.severe then 100 else 50 end + case when e.source = 'ai' then 10 else 0 end - least(strikes, 4) * 5)
  returning * into a;
  -- Rules-only holds of links from new accounts are lifted automatically.
  if e.source = 'rules' and e.category = 'spam' and e.verdict = 'hold' then
    perform public.nw_grant_appeal(a.id, null, 'Lifted automatically: links from new accounts are only held while the account is brand new.');
    return jsonb_build_object('id', a.id, 'status', 'granted');
  end if;
  return jsonb_build_object('id', a.id, 'status', 'open');
end $$;

-- Server: the context an AI second opinion needs.
create or replace function public.nw_appeal_context(p_appeal uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('appeal', a.body, 'status', a.status, 'category', e.category, 'verdict', e.verdict,
                            'source', e.source, 'severe', e.severe, 'excerpt', e.excerpt, 'reason', e.reason, 'media_url', e.media_url)
  from public.mod_appeals a join public.mod_events e on e.id = a.event_id where a.id = p_appeal
$$;

create or replace function public.nw_auto_appeal(p_appeal uuid, p_grant boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_grant then
    perform public.nw_grant_appeal(p_appeal, null, 'Reviewed again automatically: ' || left(coalesce(p_note, ''), 300));
  else
    update public.mod_appeals set auto_note = left(coalesce(p_note, ''), 400) where id = p_appeal and status = 'open';
  end if;
end $$;

-- Member: their account standing (like a report card, not a mystery).
create or replace function public.get_my_standing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  pr public.profiles;
  active int;
begin
  select * into pr from public.profiles where id = v;
  select count(*) into active from public.mod_strikes where user_id = v and revoked_at is null and expires_at > now();
  return jsonb_build_object(
    'status', case when pr.muted_until > now() then 'muted' when active >= 2 then 'limited' when active = 1 then 'warned' else 'good' end,
    'muted_until', case when pr.muted_until > now() then pr.muted_until end,
    'active_strikes', active,
    'strike_days', coalesce((public.nw_config() ->> 'strike_days')::int, 90),
    'ladder', public.nw_config() -> 'ladder',
    'strikes', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'category', s.category, 'label', public.nw_label(s.category),
                                          'created_at', s.created_at, 'expires_at', s.expires_at,
                                          'active', s.revoked_at is null and s.expires_at > now(), 'revoked', s.revoked_at is not null)
                       order by s.created_at desc)
      from public.mod_strikes s where s.user_id = v and s.created_at > now() - interval '1 year'), '[]'::jsonb),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'created_at', e.created_at, 'target_type', e.target_type, 'verdict', e.verdict,
        'category', e.category, 'label', public.nw_label(e.category), 'excerpt', e.excerpt, 'status', e.status,
        'appealable', e.verdict in ('block', 'remove', 'hold', 'label') and e.status not in ('overturned', 'dismissed')
                      and e.created_at > now() - interval '30 days' and a.id is null,
        'appeal', case when a.id is not null then jsonb_build_object('status', a.status, 'note', a.note, 'created_at', a.created_at) end)
        order by e.created_at desc)
      from public.mod_events e left join public.mod_appeals a on a.event_id = e.id
      where e.author_id = v and not e.test_mode and e.verdict in ('block', 'remove', 'hold', 'label')
        and e.created_at > now() - interval '1 year'), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Watchtower (moderators)
-- ---------------------------------------------------------------------------

create or replace function public.nw_event_json(e public.mod_events) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'created_at', e.created_at, 'target_type', e.target_type, 'target_id', e.target_id,
    'source', e.source, 'verdict', e.verdict, 'category', e.category, 'label', public.nw_label(e.category),
    'severe', e.severe, 'confidence', e.confidence, 'reason', e.reason, 'excerpt', e.excerpt,
    'media_url', e.media_url,
    'media_type', case when e.target_type = 'post' then (select media_type from public.posts where id = e.target_id)
                       when e.target_type = 'story' then (select media_type from public.stories where id = e.target_id)
                       when e.target_type = 'message' then (select media_type from public.messages where id = e.target_id) end,
    'status', e.status, 'removed', e.removed, 'test_mode', e.test_mode, 'report_count', e.report_count, 'note', e.note,
    'reviewed_at', e.reviewed_at,
    'reviewer', (select public.profile_lite(p) from public.profiles p where p.id = e.reviewed_by),
    'author', (select public.profile_lite(p) || jsonb_build_object('created_at', p.created_at, 'role', p.role,
                 'muted_until', p.muted_until, 'banned', p.banned,
                 'strikes', (select count(*) from public.mod_strikes s where s.user_id = p.id and s.revoked_at is null and s.expires_at > now()))
               from public.profiles p where p.id = e.author_id),
    'reports', case when e.target_id is not null then coalesce((
      select jsonb_agg(jsonb_build_object('reason', r.reason, 'category', r.category, 'created_at', r.created_at) order by r.created_at desc)
      from public.reports r where r.target_type = e.target_type and r.target_id = e.target_id), '[]'::jsonb) end,
    'appeal', (select jsonb_build_object('id', a.id, 'status', a.status, 'body', a.body) from public.mod_appeals a where a.event_id = e.id)
  )
$$;

create or replace function public.nw_queue(p_view text default 'open', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  return coalesce((
    select jsonb_agg(public.nw_event_json(e) order by
      case when p_view in ('open', 'held', 'reports') then (case when e.severe then 0 when e.category = 'self_harm' then 1 else 2 end) else 0 end,
      case when p_view in ('open', 'held', 'reports') then -e.report_count else 0 end,
      e.created_at desc)
    from (
      select * from public.mod_events e
      where case p_view
        when 'open' then e.status = 'open'
        when 'held' then e.status = 'open' and e.verdict = 'hold'
        when 'reports' then e.status = 'open' and e.source = 'reports'
        when 'auto' then e.status in ('auto', 'dismissed') and e.reviewed_by is null and e.created_at > now() - interval '14 days'
        when 'reviewed' then e.reviewed_by is not null and e.created_at > now() - interval '30 days'
        else e.created_at > now() - interval '30 days'
      end
      order by e.created_at desc limit lim
    ) e
  ), '[]'::jsonb);
end $$;

-- remove: take it down (and strike); restore: undo Night Watch; dismiss: no action.
create or replace function public.nw_review(p_event_id uuid, p_decision text, p_strike boolean default true, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  e public.mod_events;
  author_role text;
  s jsonb;
  hash text;
begin
  select * into e from public.mod_events where id = p_event_id;
  if e.id is null then
    raise exception 'NOT_FOUND|No such case.' using errcode = 'P0002';
  end if;
  if p_decision not in ('remove', 'restore', 'dismiss') then
    raise exception 'INVALID|Decide remove, restore or dismiss.';
  end if;
  select role into author_role from public.profiles where id = e.author_id;
  if author_role in ('owner', 'admin') and not public.is_admin() then
    raise exception 'FORBIDDEN|Ask an admin to review staff content.' using errcode = '42501';
  end if;

  if p_decision = 'remove' then
    if e.target_id is not null and e.target_type <> 'user' then
      perform public.nw_remove_target(e.target_type, e.target_id);
    end if;
    update public.mod_events set status = 'upheld', removed = e.target_id is not null and e.target_type <> 'user',
      reviewed_by = v, reviewed_at = now(), note = left(coalesce(p_note, ''), 500) where id = e.id;
    if coalesce(p_strike, true) and not exists (select 1 from public.mod_strikes where event_id = e.id and revoked_at is null) then
      s := public.nw_strike(e.author_id, e.id, e.category, case when e.severe then 3 else 1 end);
      perform public.nw_strike_notice(e.author_id, case e.target_type when 'user' then 'profile' else e.target_type end, e.category, s);
    end if;
    select coalesce(
      (select media_sha256 from public.posts where id = e.target_id and e.target_type = 'post'),
      (select media_sha256 from public.stories where id = e.target_id and e.target_type = 'story')) into hash;
    if hash is not null then
      insert into public.mod_media_hashes (sha256, category, event_id) values (hash, e.category, e.id) on conflict do nothing;
    end if;
    if e.target_id is not null then
      perform public.nw_close_reports(e.target_type, e.target_id, 'resolved', 'delete', v,
        'Thanks for your report. A moderator reviewed it and removed it.');
    end if;
  elsif p_decision = 'restore' then
    perform public.nw_restore(e.id, v, p_note);
    if e.target_id is not null then
      perform public.nw_close_reports(e.target_type, e.target_id, 'dismissed', 'dismiss', v,
        'Thanks for your report. A moderator reviewed it and didn''t find a rule break.');
    end if;
    if e.removed or e.verdict in ('hold', 'block') then
      perform public.nw_notify(e.author_id, 'A moderator reviewed Night Watch''s decision about your '
        || case e.target_type when 'user' then 'profile' else e.target_type end || ' and reversed it. Sorry about that.');
    end if;
    update public.mod_appeals set status = 'granted', decided_by = v, decided_at = now() where event_id = e.id and status = 'open';
  else
    update public.mod_events set status = 'dismissed', reviewed_by = v, reviewed_at = now(), note = left(coalesce(p_note, ''), 500) where id = e.id;
    if e.target_id is not null then
      perform public.nw_close_reports(e.target_type, e.target_id, 'dismissed', 'dismiss', v,
        'Thanks for your report. A moderator reviewed it and didn''t find a rule break.');
    end if;
  end if;
  perform public.audit('nw.' || p_decision, e.author_id, e.id::text, jsonb_build_object('category', e.category, 'strike', p_strike));
  return public.nw_event_json((select x from public.mod_events x where x.id = e.id));
end $$;

create or replace function public.nw_appeals(p_status text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'created_at', a.created_at, 'body', a.body, 'status', a.status, 'priority', a.priority,
      'auto_note', a.auto_note, 'note', a.note, 'decided_at', a.decided_at,
      'event', public.nw_event_json(e)) order by a.priority desc, a.created_at)
    from public.mod_appeals a join public.mod_events e on e.id = a.event_id
    where (p_status = 'all' and a.created_at > now() - interval '60 days') or a.status = p_status
  ), '[]'::jsonb);
end $$;

create or replace function public.nw_decide_appeal(p_appeal_id uuid, p_grant boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  a public.mod_appeals;
begin
  select * into a from public.mod_appeals where id = p_appeal_id and status = 'open';
  if a.id is null then
    raise exception 'NOT_FOUND|That appeal is already decided.' using errcode = 'P0002';
  end if;
  if p_grant then
    perform public.nw_grant_appeal(a.id, v, p_note);
  else
    update public.mod_appeals set status = 'denied', decided_by = v, decided_at = now(), note = left(coalesce(p_note, ''), 500) where id = a.id;
    update public.mod_events set status = case when status = 'open' then 'upheld' else status end, reviewed_by = v, reviewed_at = now()
    where id = a.event_id;
    perform public.nw_notify(a.user_id, 'A moderator reviewed your appeal and the decision stands.'
      || case when coalesce(p_note, '') <> '' then E'\n\n' || p_note else '' end);
  end if;
  perform public.audit(case when p_grant then 'nw.appeal_grant' else 'nw.appeal_deny' end, a.user_id, a.id::text, '{}'::jsonb);
end $$;

create or replace function public.nw_revoke_strike(p_strike_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  s public.mod_strikes;
begin
  update public.mod_strikes set revoked_at = now(), revoked_by = v where id = p_strike_id and revoked_at is null returning * into s;
  if s.id is null then
    raise exception 'NOT_FOUND|No active strike.' using errcode = 'P0002';
  end if;
  perform public.audit('nw.strike_revoke', s.user_id, s.id::text, '{}'::jsonb);
end $$;

-- Moderators can mute for up to 7 days; admins up to 30.
create or replace function public.nw_mute(p_user_id uuid, p_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  their_role text;
  cap int := case when public.is_admin() then 43200 else 10080 end;
begin
  select role into their_role from public.profiles where id = p_user_id and not is_bot;
  if their_role is null then
    raise exception 'NOT_FOUND|No such member.' using errcode = 'P0002';
  end if;
  if p_user_id = v or their_role in ('owner', 'admin') or (their_role = 'moderator' and not public.is_admin()) then
    raise exception 'FORBIDDEN|You can''t mute that person.' using errcode = '42501';
  end if;
  update public.profiles set muted_until = case when p_minutes <= 0 then null else now() + make_interval(mins => least(p_minutes, cap)) end
  where id = p_user_id;
  perform public.audit('nw.mute', p_user_id, null, jsonb_build_object('minutes', least(greatest(p_minutes, 0), cap)));
  if p_minutes > 0 then
    perform public.nw_notify(p_user_id, format('A moderator muted your account for %s. You can still read and browse. Open Account Standing for details.',
      case when least(p_minutes, cap) >= 1440 then (least(p_minutes, cap) / 1440) || ' day(s)' else least(p_minutes, cap) || ' minutes' end));
  end if;
end $$;

create or replace function public.nw_member_file(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  p public.profiles;
begin
  select * into p from public.profiles where id = p_user_id;
  if p.id is null then
    raise exception 'NOT_FOUND|No such member.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'profile', public.profile_lite(p) || jsonb_build_object('created_at', p.created_at, 'role', p.role, 'banned', p.banned,
                                                             'muted_until', p.muted_until, 'bio', p.bio, 'last_seen_at', p.last_seen_at),
    'counts', jsonb_build_object(
      'posts', (select count(*) from public.posts where author_id = p.id and deleted_at is null),
      'comments', (select count(*) from public.comments where author_id = p.id and deleted_at is null),
      'reports_against', (select count(*) from public.reports r where
          (r.target_type = 'user' and r.target_id = p.id)
          or (r.target_type = 'post' and r.target_id in (select id from public.posts where author_id = p.id))
          or (r.target_type = 'comment' and r.target_id in (select id from public.comments where author_id = p.id))
          or (r.target_type = 'message' and r.target_id in (select id from public.messages where author_id = p.id))),
      'reports_filed', (select count(*) from public.reports where reporter_id = p.id),
      'reports_filed_dismissed', (select count(*) from public.reports where reporter_id = p.id and status = 'dismissed')),
    'strikes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'category', s.category, 'label', public.nw_label(s.category),
        'severity', s.severity, 'created_at', s.created_at, 'expires_at', s.expires_at, 'revoked_at', s.revoked_at,
        'active', s.revoked_at is null and s.expires_at > now()) order by s.created_at desc)
      from public.mod_strikes s where s.user_id = p.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(public.nw_event_json(e) order by e.created_at desc)
      from (select * from public.mod_events where author_id = p.id order by created_at desc limit 50) e), '[]'::jsonb),
    'ban_recommended', (select count(*) from public.mod_strikes s where s.user_id = p.id and s.revoked_at is null and s.expires_at > now()) >= 4
      or exists (select 1 from public.mod_strikes s where s.user_id = p.id and s.severity >= 3 and s.revoked_at is null)
  );
end $$;

create or replace function public.nw_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
begin
  return jsonb_build_object(
    'config', public.nw_config() - 'terms',
    'open', (select count(*) from public.mod_events where status = 'open'),
    'open_severe', (select count(*) from public.mod_events where status = 'open' and (severe or category = 'self_harm')),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'open_appeals', (select count(*) from public.mod_appeals where status = 'open'),
    'week', jsonb_build_object(
      'total', (select count(*) from public.mod_events where created_at > now() - interval '7 days'),
      'automatic', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and reviewed_by is null and status in ('auto', 'dismissed')),
      'human', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and reviewed_by is not null),
      'blocked', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and verdict = 'block'),
      'removed', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and removed),
      'held', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and verdict = 'hold'),
      'labeled', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and verdict = 'label'),
      'overturned', (select count(*) from public.mod_events where created_at > now() - interval '7 days' and status = 'overturned'),
      'appeals_granted', (select count(*) from public.mod_appeals where decided_at > now() - interval '7 days' and status = 'granted'),
      'appeals_denied', (select count(*) from public.mod_appeals where decided_at > now() - interval '7 days' and status = 'denied')),
    'active_strikes', (select count(*) from public.mod_strikes where revoked_at is null and expires_at > now()),
    'muted_now', (select count(*) from public.profiles where muted_until > now()),
    'median_review_minutes', (select round((percentile_cont(0.5) within group (order by extract(epoch from reviewed_at - created_at)) / 60)::numeric, 1)
                              from public.mod_events where reviewed_at > now() - interval '30 days'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day,
        'automatic', (select count(*) from public.mod_events e where e.created_at::date = d.day and e.reviewed_by is null and e.status in ('auto', 'dismissed')),
        'human', (select count(*) from public.mod_events e where e.created_at::date = d.day and e.reviewed_by is not null),
        'waiting', (select count(*) from public.mod_events e where e.created_at::date = d.day and e.status = 'open')) order by d.day), '[]'::jsonb)
      from (select generate_series((now() - interval '13 days')::date, now()::date, interval '1 day')::date as day) d),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'label', public.nw_label(c.category), 'n', c.n) order by c.n desc), '[]'::jsonb)
      from (select category, count(*) n from public.mod_events where created_at > now() - interval '30 days' group by category) c),
    'ban_recommended', (select coalesce(jsonb_agg(public.profile_lite(p) || jsonb_build_object('strikes', x.n, 'severe', x.severe)), '[]'::jsonb)
      from (select user_id, count(*) n, bool_or(severity >= 3) severe from public.mod_strikes
            where revoked_at is null and expires_at > now() group by user_id having count(*) >= 4 or bool_or(severity >= 3)) x
      join public.profiles p on p.id = x.user_id where not p.banned),
    'media_fingerprints', (select count(*) from public.mod_media_hashes)
  );
end $$;

create or replace function public.nw_get_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
begin
  return public.nw_config();
end $$;

-- Admins edit the rules. Unknown keys are dropped; values are clamped.
create or replace function public.nw_set_config(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_admin();
  cur jsonb := public.nw_config();
  k text;
  cat text;
  out jsonb := '{}'::jsonb;
  cats jsonb := '{}'::jsonb;
  terms jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p) <> 'object' then
    raise exception 'INVALID|Settings must be an object.';
  end if;
  cur := cur || p;
  foreach k in array array['enabled', 'test_mode', 'ai_text', 'ai_images', 'auto_dismiss_reports'] loop
    out := out || jsonb_build_object(k, coalesce((cur ->> k)::boolean, (public.nw_default_config() ->> k)::boolean));
  end loop;
  out := out || jsonb_build_object(
    'new_account_hours', least(greatest(coalesce((cur ->> 'new_account_hours')::int, 24), 0), 720),
    'new_account_links', case when cur ->> 'new_account_links' in ('hold', 'allow') then cur ->> 'new_account_links' else 'hold' end,
    'max_mentions', least(greatest(coalesce((cur ->> 'max_mentions')::int, 8), 1), 50),
    'max_links', least(greatest(coalesce((cur ->> 'max_links')::int, 3), 1), 20),
    'duplicate_minutes', least(greatest(coalesce((cur ->> 'duplicate_minutes')::int, 10), 0), 1440),
    'burst_posts', least(greatest(coalesce((cur ->> 'burst_posts')::int, 6), 2), 100),
    'burst_minutes', least(greatest(coalesce((cur ->> 'burst_minutes')::int, 5), 1), 120),
    'strike_days', least(greatest(coalesce((cur ->> 'strike_days')::int, 90), 7), 365),
    'ladder', (select jsonb_agg(least(greatest(coalesce(x::int, 0), 0), 43200))
               from jsonb_array_elements_text(case when jsonb_typeof(cur -> 'ladder') = 'array' and jsonb_array_length(cur -> 'ladder') between 1 and 6
                                                   then cur -> 'ladder' else '[0,1440,10080,43200]'::jsonb end) x));
  for cat in select jsonb_object_keys(public.nw_default_config() -> 'categories') loop
    cats := cats || jsonb_build_object(cat, jsonb_build_object(
      'action', case when cur -> 'categories' -> cat ->> 'action' in ('allow', 'label', 'flag', 'hold', 'remove')
                     then cur -> 'categories' -> cat ->> 'action' else public.nw_default_config() -> 'categories' -> cat ->> 'action' end,
      'rules', case when cur -> 'categories' -> cat ->> 'rules' in ('allow', 'label', 'flag', 'hold', 'remove')
                    then cur -> 'categories' -> cat ->> 'rules' else public.nw_default_config() -> 'categories' -> cat ->> 'rules' end,
      'threshold', least(greatest(coalesce((cur -> 'categories' -> cat ->> 'threshold')::real,
                                           (public.nw_default_config() -> 'categories' -> cat ->> 'threshold')::real), 0.3), 0.99)));
  end loop;
  -- Child safety can't be switched off.
  cats := jsonb_set(cats, '{minors,action}', '"remove"');
  cats := jsonb_set(cats, '{minors,rules}', '"remove"');
  for cat in select jsonb_object_keys(public.nw_default_config() -> 'terms') loop
    terms := terms || jsonb_build_object(cat, coalesce((
      select jsonb_agg(distinct left(trim(x), 60)) from jsonb_array_elements_text(
        case when jsonb_typeof(cur -> 'terms' -> cat) = 'array' then cur -> 'terms' -> cat else public.nw_default_config() -> 'terms' -> cat end) x
      where trim(x) <> ''), '[]'::jsonb));
  end loop;
  out := out || jsonb_build_object('categories', cats, 'terms', terms);
  insert into public.app_settings (key, value, updated_by) values ('night_watch', out, v)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.audit('nw.config', null, null, jsonb_build_object('keys', (select jsonb_agg(x) from jsonb_object_keys(p) x)));
  return public.nw_config();
end $$;

-- Dry run of the rules on some text. Nothing is saved.
create or replace function public.nw_test(p_text text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_moderator();
  cfg jsonb := public.nw_config();
  norm text := public.nw_normalize(p_text);
  sq text := regexp_replace(public.nw_normalize(p_text), '[^a-z]', '', 'g');
  hit text;
  cat text;
begin
  hit := public.nw_match(norm, sq, cfg -> 'terms' -> 'minors');
  if hit is null and public.nw_match(norm, sq, cfg -> 'terms' -> 'sexual') is not null then
    hit := public.nw_match(norm, sq, cfg -> 'terms' -> 'minor_signals');
  end if;
  if hit is not null then
    return public.nw_rule('minors', hit, cfg) || jsonb_build_object('normalized', norm);
  end if;
  foreach cat in array array['hate', 'threats', 'scam', 'sexual', 'harassment', 'self_harm'] loop
    hit := public.nw_match(norm, sq, cfg -> 'terms' -> cat);
    if hit is not null then
      return public.nw_rule(cat, hit, cfg) || jsonb_build_object('normalized', norm);
    end if;
  end loop;
  if p_text ~ '\(?\m\d{3}\)?[ .-]?\d{3}[ .-]\d{4}\M' then
    return public.nw_rule('private_info', 'phone number', cfg) || jsonb_build_object('normalized', norm);
  end if;
  if p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return public.nw_rule('private_info', 'email address', cfg) || jsonb_build_object('normalized', norm);
  end if;
  return jsonb_build_object('verdict', 'allow', 'source', 'rules', 'normalized', norm);
end $$;

-- Old closed cases are deleted after a year; strikes a year after they expire.
create or replace function public.nw_purge() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev int;
  st int;
begin
  delete from public.mod_events where created_at < now() - interval '1 year' and status <> 'open';
  get diagnostics ev = row_count;
  delete from public.mod_strikes where expires_at < now() - interval '1 year';
  get diagnostics st = row_count;
  return jsonb_build_object('events', ev, 'strikes', st);
end $$;

-- ---------------------------------------------------------------------------
-- Watch and Interests feeds
-- ---------------------------------------------------------------------------

create or replace function public.get_watch(p_mode text default 'for_you', p_offset int default 0, p_limit int default 8) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v uuid := public.require_member();
  lim int := least(greatest(coalesce(p_limit, 8), 1), 20);
  res jsonb;
begin
  select coalesce(jsonb_agg(public.post_json(p, v) order by s.rk), '[]'::jsonb) into res
  from (
    select p.id, row_number() over (order by
      case when p_mode = 'latest' then 0 else
        ((select count(*) from public.reactions r where r.post_id = p.id)
          + 2 * (select count(*) from public.comments c where c.post_id = p.id and c.deleted_at is null) + 1)::float
        / power(extract(epoch from (now() - p.created_at)) / 3600.0 + 2, 0.8) end desc,
      p.created_at desc) as rk
    from public.posts p
    where p.deleted_at is null and p.media_type = 'video' and p.kind <> 'repost'
      and p.created_at > now() - interval '120 days'
      and not public.is_hidden_author(p.author_id)
    order by rk
    offset greatest(coalesce(p_offset, 0), 0) limit lim
  ) s join public.posts p on p.id = s.id;
  return res;
end $$;

create or replace function public.get_interest_feed(p_before timestamptz default null, p_limit int default 10) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v uuid := public.require_member();
  mine text[];
  lim int := least(greatest(coalesce(p_limit, 10), 1), 50);
  res jsonb;
begin
  select interests into mine from public.profiles where id = v;
  if coalesce(cardinality(mine), 0) = 0 then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(public.post_json(p, v) order by p.created_at desc), '[]'::jsonb) into res
  from (
    select p.id from public.posts p
    where p.deleted_at is null and p.kind <> 'repost'
      and (p_before is null or p.created_at < p_before)
      and not public.is_hidden_author(p.author_id)
      and (p.hashtags && mine or exists (
        select 1 from public.profiles a where a.id = p.author_id and a.id <> v and a.interests && mine))
    order by p.created_at desc limit lim
  ) s join public.posts p on p.id = s.id;
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  f text;
begin
  -- member and moderator RPCs (moderator checks happen inside)
  foreach f in array array[
    'is_moderator()', 'official_id()', 'night_watch_version()', 'get_my_standing()', 'submit_appeal(uuid, text)',
    'get_watch(text, int, int)', 'get_interest_feed(timestamptz, int)',
    'nw_queue(text, int)', 'nw_review(uuid, text, boolean, text)', 'nw_appeals(text)', 'nw_decide_appeal(uuid, boolean, text)',
    'nw_revoke_strike(uuid)', 'nw_mute(uuid, int)', 'nw_member_file(uuid)', 'nw_dashboard()', 'nw_get_config()',
    'nw_set_config(jsonb)', 'nw_test(text)', 'admin_set_role(uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  -- server only
  foreach f in array array[
    'require_moderator()', 'nw_default_config()', 'nw_config()', 'nw_label(text)', 'nw_normalize(text)', 'nw_collapse(text)', 'nw_match(text, text, jsonb)',
    'nw_rule(text, text, jsonb, text)', 'nw_screen(uuid, text, text, text, boolean)', 'nw_log(text, uuid, uuid, jsonb, text, text, boolean, text)',
    'nw_official_channel(uuid)', 'nw_notify(uuid, text)', 'nw_care(uuid)', 'nw_strike(uuid, uuid, text, int)',
    'nw_strike_notice(uuid, text, text, jsonb)', 'nw_record_block(uuid, text, text, jsonb, text, text)',
    'nw_apply(text, uuid, jsonb, text)', 'nw_media_blocked(text)', 'nw_unchecked(int)', 'nw_report_target(text, uuid)',
    'nw_remove_target(text, uuid)', 'nw_close_reports(text, uuid, text, text, uuid, text)', 'nw_report_verdict(text, uuid, jsonb)',
    'nw_restore(uuid, uuid, text)', 'nw_grant_appeal(uuid, uuid, text)', 'nw_appeal_context(uuid)',
    'nw_auto_appeal(uuid, boolean, text)', 'nw_event_json(public.mod_events)', 'nw_purge()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
