-- ============================================================================
-- YORU — push notifications. docs/notifications.md
--
-- Notifications reach members even when YORU is closed, on the website, the
-- installed web app (iPhone: added to the Home Screen) and the Android app.
-- The browser hands us a "push subscription" (an address at Google, Mozilla,
-- Apple or Microsoft's push service plus two public keys) once the member
-- allows notifications; the server encrypts each message for that device and
-- sends it there (Web Push, RFC 8030/8291/8292).
--
--   * push_subscriptions  one row per device that turned notifications on:
--                         a browser (Web Push) or the Android app (Firebase
--                         Cloud Messaging token, when Firebase is set up).
--   * push_outbox         a short queue: every new row in public.notifications
--                         for someone with a device is queued here, and the
--                         server sends and deletes it. Members without a
--                         device never queue anything.
-- What gets pushed follows public.notifications exactly, so the existing
-- notification settings, blocks and bans already apply.
--
-- Additive: two new tables, one trigger on notifications, four functions.
-- Nothing existing changes. Safe to run more than once.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'webpush' check (kind in ('webpush', 'fcm')),
  endpoint text not null unique check (char_length(endpoint) <= 4096 and (
    (kind = 'webpush' and endpoint ~ '^https://') or (kind = 'fcm' and endpoint ~ '^[A-Za-z0-9_:-]{20,}$'))),
  p256dh text check (p256dh is null or char_length(p256dh) between 40 and 200),
  auth text check (auth is null or char_length(auth) between 10 and 100),
  device text not null default '' check (char_length(device) <= 80),
  created_at timestamptz not null default now(),
  last_ok timestamptz,
  failures int not null default 0,
  check (kind = 'fcm' or (p256dh is not null and auth is not null))
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

create table if not exists public.push_outbox (
  notification_id uuid primary key references public.notifications (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_outbox enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions, public.push_outbox from anon;
revoke insert, update, delete, truncate on public.push_subscriptions from authenticated;
revoke all on public.push_outbox from authenticated;
grant select on public.push_subscriptions to authenticated;

-- Queue a push for every new notification whose recipient has a device.
create or replace function public.push_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    insert into public.push_outbox (notification_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications for each row execute function public.push_enqueue();

-- A device turns notifications on (or refreshes its subscription). An
-- endpoint belongs to one device, so if someone else signs in on that device
-- the subscription moves to them.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_device text default '', p_kind text default 'webpush')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  n int;
begin
  if p_kind not in ('webpush', 'fcm') or char_length(p_endpoint) > 4096
     or (p_kind = 'webpush' and p_endpoint !~ '^https://')
     or (p_kind = 'fcm' and p_endpoint !~ '^[A-Za-z0-9_:-]{20,}$') then
    raise exception 'INVALID|That push address isn''t valid.';
  end if;
  insert into public.push_subscriptions (user_id, kind, endpoint, p256dh, auth, device)
  values (v, p_kind, p_endpoint, case when p_kind = 'webpush' then p_p256dh end, case when p_kind = 'webpush' then p_auth end, left(coalesce(p_device, ''), 80))
  on conflict (endpoint) do update set user_id = v, kind = excluded.kind, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, failures = 0;
  -- Ten devices per member is plenty; drop the oldest beyond that.
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = v order by created_at desc offset 10
  );
  select count(*) into n from public.push_subscriptions where user_id = v;
  return jsonb_build_object('devices', n);
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  delete from public.push_subscriptions where user_id = v and endpoint = p_endpoint;
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions where user_id = v));
end $$;

-- Server only: take up to p_limit queued notifications (removing them from
-- the queue) with what's needed to word them and the devices to send to.
create or replace function public.push_claim(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  out jsonb;
begin
  with taken as (
    delete from public.push_outbox
    where notification_id in (select notification_id from public.push_outbox order by created_at limit least(greatest(p_limit, 1), 500))
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

-- Server only: record delivery results. Devices the push service says are
-- gone (404/410) are removed; others are dropped after 5 failures in a row.
create or replace function public.push_report(p_ok text[], p_gone text[], p_failed text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.push_subscriptions set last_ok = now(), failures = 0 where endpoint = any (coalesce(p_ok, '{}'));
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
  update public.push_subscriptions set failures = failures + 1 where endpoint = any (coalesce(p_failed, '{}'));
  delete from public.push_subscriptions where failures >= 5;
end $$;

revoke execute on function public.push_enqueue() from public, anon, authenticated;
revoke execute on function public.push_subscribe(text, text, text, text, text) from public, anon;
revoke execute on function public.push_unsubscribe(text) from public, anon;
revoke execute on function public.push_claim(int) from public, anon, authenticated;
revoke execute on function public.push_report(text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.push_unsubscribe(text) to authenticated, service_role;
grant execute on function public.push_claim(int) to service_role;
grant execute on function public.push_report(text[], text[], text[]) to service_role;
