-- ============================================================================
-- YORU: the Night Crew. A few clearly labeled YORU bot accounts (marked as AI,
-- "Night Crew" in their names and bios) that like members' new posts and
-- follow members, so nobody posts into silence while YORU is small.
--
-- - They are bots (is_bot): never in Moonrise test audiences, never on
--   leaderboards, and they never decide how far a post goes.
-- - Randomized, so it doesn't feel mechanical: each post gets 1 to 3 crew
--   likes (one more for a member's first 3 posts), added one at a time across
--   the first hours, never in the first 3 minutes, and fewer once real people
--   are engaging. Each member gets followed by one crew member.
-- - On by default; an admin switches it off in Watchtower -> Controls.
-- ============================================================================

create table if not exists public.crew_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.crew_settings (id) values (true) on conflict do nothing;
alter table public.crew_settings enable row level security;
revoke all on public.crew_settings from anon, authenticated;

insert into public.profiles (id, username, display_name, avatar_url, bio, badge, verified, is_bot, leaderboard_opt_in, interests)
values
  ('00000000-0000-4000-8000-0000000000c1', 'NightCrewKai', 'Kai · Night Crew', null, 'YORU''s Night Crew (a bot). I cheer on new posts so nobody posts into silence.', '🌙', false, true, false, '{anime,gaming}'),
  ('00000000-0000-4000-8000-0000000000c2', 'NightCrewRin', 'Rin · Night Crew', null, 'YORU''s Night Crew (a bot). Here for your art, music and late-night thoughts.', '🌙', false, true, false, '{art,music}'),
  ('00000000-0000-4000-8000-0000000000c3', 'NightCrewSora', 'Sora · Night Crew', null, 'YORU''s Night Crew (a bot). I like posts so new members know someone''s reading.', '🌙', false, true, false, '{manga,memes}'),
  ('00000000-0000-4000-8000-0000000000c4', 'NightCrewMika', 'Mika · Night Crew', null, 'YORU''s Night Crew (a bot). Cosplay, fashion and everything after midnight.', '🌙', false, true, false, '{cosplay,fashion}'),
  ('00000000-0000-4000-8000-0000000000c5', 'NightCrewYuki', 'Yuki · Night Crew', null, 'YORU''s Night Crew (a bot). Tech, film and the occasional 3 am idea.', '🌙', false, true, false, '{tech,film}')
on conflict (id) do nothing;

create or replace function public.crew_ids() returns uuid[]
language sql immutable as $$
  select array['00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3',
               '00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c5']::uuid[]
$$;

-- One pass (pg_cron every 10 minutes; demo: the server's timer).
create or replace function public.crew_tick(p_chance double precision default 0.35) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  crew uuid[] := public.crew_ids();
  r record;
  who uuid;
  kinds text[] := array['heart', 'heart', 'heart', 'fire', 'w', 'skull'];
  liked int := 0;
  followed int := 0;
begin
  if not coalesce((select enabled from public.crew_settings where id), false) then
    return jsonb_build_object('enabled', false);
  end if;

  -- likes: real members' posts from the last 48 hours, 3 minutes old or more
  for r in
    select p.id, p.author_id,
      -- how many crew likes this post should end up with
      case when x.human >= 5 then 0
           else 1 + abs(hashtext(p.id::text)) % 3
                + case when (select count(*) from public.posts e where e.author_id = p.author_id and e.created_at <= p.created_at and e.repost_of is null) <= 3 then 1 else 0 end
                - case when x.human >= 2 then 1 else 0 end
      end as target,
      x.crew_now
    from public.posts p
    join public.profiles a on a.id = p.author_id
    cross join lateral (
      select count(distinct re.user_id) filter (where not (re.user_id = any (crew)) and re.user_id <> p.author_id) as human,
             count(distinct re.user_id) filter (where re.user_id = any (crew)) as crew_now
      from public.reactions re where re.post_id = p.id
    ) x
    where p.created_at > now() - interval '48 hours' and p.created_at < now() - interval '3 minutes'
      and p.deleted_at is null and p.repost_of is null and p.kind in ('post', 'poll') and p.mod_state <> 'held'
      and not a.is_bot and not a.banned
    order by p.created_at desc
    limit 300
  loop
    continue when r.crew_now >= r.target or random() >= p_chance;
    select c into who from unnest(crew) c
    where not exists (select 1 from public.reactions re where re.post_id = r.id and re.user_id = c)
      and not exists (select 1 from public.blocks b where (b.blocker_id = r.author_id and b.blocked_id = c) or (b.blocker_id = c and b.blocked_id = r.author_id))
    order by random() limit 1;
    continue when who is null;
    insert into public.reactions (post_id, user_id, kind) values (r.id, who, kinds[1 + floor(random() * 6)::int]) on conflict do nothing;
    liked := liked + 1;
    exit when liked >= 60;
  end loop;

  -- follows: each member gets one crew follower, at a random moment
  for r in
    select q.id from public.profiles q
    where not q.is_bot and not q.banned
      and not exists (select 1 from public.follows f where f.followee_id = q.id and f.follower_id = any (crew))
    order by random() limit 20
  loop
    continue when random() >= p_chance;
    select c into who from unnest(crew) c
    where not exists (select 1 from public.blocks b where (b.blocker_id = r.id and b.blocked_id = c) or (b.blocker_id = c and b.blocked_id = r.id))
    order by random() limit 1;
    continue when who is null;
    insert into public.follows (follower_id, followee_id) values (who, r.id) on conflict do nothing;
    perform public.notify_user(r.id, who, 'follow');
    followed := followed + 1;
  end loop;

  return jsonb_build_object('enabled', true, 'liked', liked, 'followed', followed);
end $$;

create or replace function public.admin_get_crew() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'enabled', coalesce((select enabled from public.crew_settings where id), false),
    'likes_week', (select count(*) from public.reactions where user_id = any (public.crew_ids()) and created_at > now() - interval '7 days'),
    'follows', (select count(*) from public.follows where follower_id = any (public.crew_ids())));
end $$;

create or replace function public.admin_set_crew(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.crew_settings set enabled = coalesce(p_enabled, enabled), updated_at = now() where id;
  perform public.audit('night_crew', null, null, jsonb_build_object('enabled', p_enabled));
  return public.admin_get_crew();
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('yoru-night-crew', '*/10 * * * *', 'select public.crew_tick(0.35)');
    exception when others then
      raise notice 'pg_cron not set up: %', sqlerrm;
    end;
  end if;
end $$;

revoke execute on function public.crew_tick(double precision) from public, anon, authenticated;
grant execute on function public.crew_tick(double precision) to service_role;
revoke execute on function public.admin_get_crew() from public, anon;
revoke execute on function public.admin_set_crew(boolean) from public, anon;
grant execute on function public.admin_get_crew() to authenticated, service_role;
grant execute on function public.admin_set_crew(boolean) to authenticated, service_role;
