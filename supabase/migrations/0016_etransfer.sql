-- ============================================================================
-- YORU Pro and donations by Interac e-Transfer (Autodeposit). docs/etransfer.md
--
-- Additive. Nothing existing changes except one widened check: entitlements
-- may now have source 'etransfer'.
--
-- How it works
--   1. A member starts a checkout. They get an order with
--        - an exact amount, a few cents under the price (CAD 5.99 -> 5.84 say).
--          No two waiting orders share an amount, so the owner's deposits can
--          be matched to people by the cents;
--        - a reference code (YORU-XXXXX) to put in the e-Transfer message.
--   2. They send the e-Transfer and tap "I've sent it" (status 'sent'),
--      optionally with the name their bank shows as the sender.
--   3. The owner enters each day's deposit total in the Watchtower. The app
--      works out which waiting orders that total is made of. Only the owner's
--      confirmation grants Pro (status 'confirmed', one month per payment,
--      stacked after any Pro already running). Nothing is ever confirmed
--      automatically.
--   4. A wrong confirmation can be undone: the Pro month it gave is removed.
--
-- Members can only read and act on their own orders. Every owner action is in
-- the audit log. Tables have RLS on and no policies: everything goes through
-- the functions below.
-- ============================================================================

alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check
  check (source in ('comp', 'stripe', 'paddle', 'paypal', 'lemonsqueezy', 'etransfer'));

create table if not exists public.etransfer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('pro', 'donation')),
  base_cents int not null check (base_cents between 100 and 100000),
  amount_cents int not null check (amount_cents between 50 and 100000 and amount_cents <= base_cents),
  code text not null unique check (code ~ '^YORU-[A-HJ-NP-Z2-9]{5}$'),
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  status text not null default 'open' check (status in ('open', 'sent', 'confirmed', 'rejected', 'canceled')),
  entitlement_id uuid references public.entitlements (id) on delete set null,
  matched_day date,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
create index if not exists etransfer_orders_status_idx on public.etransfer_orders (status, created_at);
create index if not exists etransfer_orders_user_idx on public.etransfer_orders (user_id, created_at desc);
create index if not exists etransfer_orders_day_idx on public.etransfer_orders (matched_day) where matched_day is not null;
-- No two waiting orders may share an exact amount: that is what lets a deposit be traced to a person.
create unique index if not exists etransfer_orders_waiting_amount on public.etransfer_orders (amount_cents)
  where status in ('open', 'sent');

create table if not exists public.etransfer_days (
  day date primary key,
  total_cents int not null check (total_cents between 0 and 10000000),
  note text not null default '' check (char_length(note) <= 200),
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- When an account is deleted its orders stay for the books, without anything personal:
-- the user link is cleared by the foreign key, and this clears the bank name with it.
create or replace function public.etransfer_forget_sender() returns trigger
language plpgsql as $$
begin
  if new.user_id is null and old.user_id is not null then
    new.sender_name := '';
  end if;
  return new;
end $$;
drop trigger if exists etransfer_forget_sender on public.etransfer_orders;
create trigger etransfer_forget_sender before update on public.etransfer_orders
  for each row execute function public.etransfer_forget_sender();

alter table public.etransfer_orders enable row level security;
alter table public.etransfer_days enable row level security;
revoke all on public.etransfer_orders from public, anon, authenticated;
revoke all on public.etransfer_days from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settings and helpers
-- ---------------------------------------------------------------------------

-- What a checkout shows. Changing the email or the price is a new migration on purpose:
-- money settings should not be one click away.
create or replace function public.etransfer_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'version', 1,
    'email', 'nextyoru@gmail.com',
    'currency', 'CAD',
    'pro_cents', 599,
    'pro_months', 1,
    'donation_min_cents', 200,
    'donation_max_cents', 50000,
    'max_waiting', 3,
    'open_days', 7
  )
$$;

create or replace function public.etransfer_require_owner() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if not exists (select 1 from public.profiles where id = v and role = 'owner' and not banned) then
    raise exception 'FORBIDDEN|Only the owner can manage payments.' using errcode = '42501';
  end if;
  return v;
end $$;

-- Orders started but never marked as sent lapse after a week, which frees their amount.
create or replace function public.etransfer_expire() returns void
language sql security definer set search_path = public as $$
  update public.etransfer_orders
  set status = 'canceled', decided_at = now(), note = 'Not sent within 7 days'
  where status = 'open' and created_at < now() - interval '7 days'
$$;

create or replace function public.etransfer_order_json(o public.etransfer_orders) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'kind', o.kind, 'base_cents', o.base_cents, 'amount_cents', o.amount_cents,
    'code', o.code, 'sender_name', o.sender_name, 'status', o.status, 'matched_day', o.matched_day,
    'note', o.note, 'created_at', o.created_at, 'sent_at', o.sent_at, 'decided_at', o.decided_at,
    'pro_until', (select e.ends_at from public.entitlements e where e.id = o.entitlement_id and e.status = 'active')
  )
$$;

-- Moves a member's e-Transfer Pro months so they run back to back with no gap,
-- starting no later than now (used after a confirmation is undone). Months only
-- ever move earlier.
create or replace function public.etransfer_restack(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cur timestamptz;
  e record;
begin
  cur := null;
  for e in
    select id, starts_at, ends_at from public.entitlements
    where user_id = p_user and source = 'etransfer' and status = 'active' and ends_at > now()
    order by starts_at, created_at
  loop
    if cur is null then
      cur := least(e.starts_at, now());
    end if;
    if e.starts_at > cur then
      update public.entitlements
      set starts_at = cur, ends_at = cur + (e.ends_at - e.starts_at), updated_at = now()
      where id = e.id;
      cur := cur + (e.ends_at - e.starts_at);
    else
      cur := e.ends_at;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------

-- Starts a checkout, or returns the waiting Pro order this member already has.
create or replace function public.etransfer_start(p_kind text, p_amount_cents int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  cfg jsonb := public.etransfer_config();
  base int;
  o public.etransfer_orders;
  t int;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  i int;
begin
  perform public.etransfer_expire();
  if p_kind not in ('pro', 'donation') then
    raise exception 'INVALID|Choose Pro or a donation.';
  end if;
  if p_kind = 'pro' then
    select * into o from public.etransfer_orders
    where user_id = v and kind = 'pro' and status in ('open', 'sent')
    order by created_at desc limit 1;
    if found then
      return public.etransfer_order_json(o);
    end if;
    base := (cfg ->> 'pro_cents')::int;
  else
    if p_amount_cents is null or p_amount_cents < (cfg ->> 'donation_min_cents')::int
       or p_amount_cents > (cfg ->> 'donation_max_cents')::int then
      raise exception 'INVALID|Donations can be from $% to $%.',
        ((cfg ->> 'donation_min_cents')::int / 100), ((cfg ->> 'donation_max_cents')::int / 100);
    end if;
    base := p_amount_cents;
  end if;
  if (select count(*) from public.etransfer_orders where user_id = v and status in ('open', 'sent')) >= (cfg ->> 'max_waiting')::int then
    raise exception 'LIMIT|You already have % payments waiting. Finish or cancel one first.', (cfg ->> 'max_waiting');
  end if;
  perform public.enforce_rate_limit('etransfer_start', 10, 3600);

  -- the smallest free number of cents off (1 to 49, then up to 99 if the first 49 are all waiting)
  for t in 1 .. least(99, base - 50) loop
    if not exists (select 1 from public.etransfer_orders where status in ('open', 'sent') and amount_cents = base - t) then
      -- a random reference code; retried in the rare case it is already taken
      for i in 1 .. 20 loop
        c := 'YORU-';
        for j in 1 .. 5 loop
          c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;
        begin
          insert into public.etransfer_orders (user_id, kind, base_cents, amount_cents, code)
          values (v, p_kind, base, base - t, c)
          returning * into o;
          return public.etransfer_order_json(o);
        exception when unique_violation then
          -- the code was taken, or another checkout took these cents a moment ago
          if exists (select 1 from public.etransfer_orders where status in ('open', 'sent') and amount_cents = base - t) then
            exit;
          end if;
        end;
      end loop;
    end if;
  end loop;
  raise exception 'BUSY|Too many payments are waiting right now. Try again later.';
end $$;

create or replace function public.etransfer_mark_sent(p_id uuid, p_sender_name text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  o public.etransfer_orders;
begin
  select * into o from public.etransfer_orders where id = p_id and user_id = v for update;
  if not found then
    raise exception 'NOT_FOUND|No such payment.' using errcode = 'P0002';
  end if;
  if o.status not in ('open', 'sent') then
    raise exception 'INVALID|This payment is already %.', o.status;
  end if;
  update public.etransfer_orders
  set status = 'sent', sent_at = coalesce(o.sent_at, now()),
      sender_name = left(btrim(coalesce(p_sender_name, '')), 80)
  where id = o.id
  returning * into o;
  return public.etransfer_order_json(o);
end $$;

create or replace function public.etransfer_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  o public.etransfer_orders;
begin
  select * into o from public.etransfer_orders where id = p_id and user_id = v for update;
  if not found then
    raise exception 'NOT_FOUND|No such payment.' using errcode = 'P0002';
  end if;
  if o.status <> 'open' then
    raise exception 'INVALID|Only a payment you haven''t sent yet can be canceled.';
  end if;
  update public.etransfer_orders set status = 'canceled', decided_at = now(), note = 'Canceled by the member'
  where id = o.id returning * into o;
  return public.etransfer_order_json(o);
end $$;

create or replace function public.etransfer_my_orders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  return coalesce((
    select jsonb_agg(public.etransfer_order_json(o) order by o.created_at desc)
    from (select * from public.etransfer_orders where user_id = v order by created_at desc limit 20) o
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Owner
-- ---------------------------------------------------------------------------

create or replace function public.etransfer_admin_orders(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
begin
  return coalesce((
    select jsonb_agg(public.etransfer_order_json(o) || jsonb_build_object(
      'user', case when p.id is null then null else public.profile_lite(p) end,
      'is_pro', p.id is not null and public.is_pro(p.id),
      'decided_by', o.decided_by
    ) order by o.created_at desc)
    from public.etransfer_orders o
    left join public.profiles p on p.id = o.user_id
    where o.status in ('open', 'sent') or o.created_at > coalesce(p_since, now() - interval '60 days')
  ), '[]'::jsonb);
end $$;

-- Confirms received payments. Pro orders get one month each, starting when the
-- member's current Pro ends (or now). A day ties them to that day's deposits.
create or replace function public.etransfer_confirm(p_ids uuid[], p_day date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
  o public.etransfer_orders;
  start timestamptz;
  ent uuid;
  done int := 0;
  months int := (public.etransfer_config() ->> 'pro_months')::int;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'INVALID|Pick at least one payment.';
  end if;
  if p_day is not null and p_day > (now() + interval '1 day')::date then
    raise exception 'INVALID|That day hasn''t happened yet.';
  end if;
  for o in select * from public.etransfer_orders where id = any (p_ids) order by created_at for update loop
    if o.status not in ('open', 'sent') then
      raise exception 'INVALID|Payment % is already %.', o.code, o.status;
    end if;
    ent := null;
    if o.kind = 'pro' and o.user_id is not null then
      select greatest(now(), coalesce(max(e.ends_at), now())) into start
      from public.entitlements e
      where e.user_id = o.user_id and e.plan = 'pro' and e.status = 'active' and e.ends_at is not null and e.ends_at > now();
      insert into public.entitlements (user_id, plan, source, status, starts_at, ends_at, external_id, note, granted_by)
      values (o.user_id, 'pro', 'etransfer', 'active', start, start + make_interval(months => months),
              'etransfer:' || o.id, 'e-Transfer ' || o.code, v)
      returning id into ent;
    end if;
    update public.etransfer_orders
    set status = 'confirmed', entitlement_id = ent, matched_day = p_day, decided_at = now(), decided_by = v,
        sent_at = coalesce(o.sent_at, now())
    where id = o.id;
    perform public.audit('etransfer.confirm', o.user_id, o.id::text,
      jsonb_build_object('code', o.code, 'kind', o.kind, 'amount_cents', o.amount_cents, 'day', p_day));
    if o.user_id is not null then
      perform public.notify_user(o.user_id, public.official_id(), 'system', null, null, null, null,
        case when o.kind = 'pro'
             then 'Payment received (' || o.code || '). YORU Pro is on. Thank you for supporting YORU.'
             else 'Donation received (' || o.code || '). Thank you for supporting YORU.' end);
    end if;
    done := done + 1;
  end loop;
  -- all or nothing: a missing id undoes the whole batch (the exception rolls everything back)
  if done <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'NOT_FOUND|One of those payments doesn''t exist.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('confirmed', done);
end $$;

create or replace function public.etransfer_reject(p_id uuid, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
  o public.etransfer_orders;
begin
  select * into o from public.etransfer_orders where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND|No such payment.' using errcode = 'P0002';
  end if;
  if o.status not in ('open', 'sent') then
    raise exception 'INVALID|Payment % is already %.', o.code, o.status;
  end if;
  update public.etransfer_orders
  set status = 'rejected', decided_at = now(), decided_by = v,
      note = left(coalesce(nullif(btrim(p_note), ''), 'Not received'), 200)
  where id = o.id returning * into o;
  perform public.audit('etransfer.reject', o.user_id, o.id::text, jsonb_build_object('code', o.code, 'amount_cents', o.amount_cents));
  if o.user_id is not null then
    perform public.notify_user(o.user_id, public.official_id(), 'system', null, null, null, null,
      'We couldn''t find your e-Transfer ' || o.code || '. If you sent it, reply to the e-Transfer email with this code, or contact support.');
  end if;
  return public.etransfer_order_json(o);
end $$;

-- Puts a confirmed or rejected payment back to waiting. A confirmed Pro month is removed.
create or replace function public.etransfer_undo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
  o public.etransfer_orders;
begin
  select * into o from public.etransfer_orders where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND|No such payment.' using errcode = 'P0002';
  end if;
  if o.status not in ('confirmed', 'rejected') then
    raise exception 'INVALID|Only a confirmed or rejected payment can be undone.';
  end if;
  if exists (select 1 from public.etransfer_orders where status in ('open', 'sent') and amount_cents = o.amount_cents and id <> o.id) then
    raise exception 'BUSY|Another waiting payment has the same amount now. Confirm or reject that one first.';
  end if;
  if o.entitlement_id is not null then
    update public.entitlements set status = 'expired', ends_at = least(ends_at, now()), updated_at = now()
    where id = o.entitlement_id;
    if o.user_id is not null then
      perform public.etransfer_restack(o.user_id);
    end if;
  end if;
  update public.etransfer_orders
  set status = 'sent', entitlement_id = null, matched_day = null, decided_at = null, decided_by = null, note = ''
  where id = o.id returning * into o;
  perform public.audit('etransfer.undo', o.user_id, o.id::text, jsonb_build_object('code', o.code));
  return public.etransfer_order_json(o);
end $$;

create or replace function public.etransfer_set_day(p_day date, p_total_cents int, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
begin
  if p_day is null or p_day > (now() + interval '1 day')::date or p_day < date '2026-01-01' then
    raise exception 'INVALID|Pick a day from this year up to today.';
  end if;
  if p_total_cents is null or p_total_cents < 0 or p_total_cents > 10000000 then
    raise exception 'INVALID|Enter the amount you received that day.';
  end if;
  insert into public.etransfer_days (day, total_cents, note, entered_by)
  values (p_day, p_total_cents, left(coalesce(p_note, ''), 200), v)
  on conflict (day) do update set total_cents = excluded.total_cents, note = excluded.note,
    entered_by = excluded.entered_by, updated_at = now();
  perform public.audit('etransfer.day', null, p_day::text, jsonb_build_object('total_cents', p_total_cents));
  return jsonb_build_object('day', p_day, 'total_cents', p_total_cents);
end $$;

create or replace function public.etransfer_days(p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.etransfer_require_owner();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', d.day, 'total_cents', d.total_cents, 'note', d.note, 'updated_at', d.updated_at,
      'confirmed_cents', coalesce((select sum(o.amount_cents) from public.etransfer_orders o
                                   where o.matched_day = d.day and o.status = 'confirmed'), 0),
      'confirmed_count', (select count(*) from public.etransfer_orders o where o.matched_day = d.day and o.status = 'confirmed')
    ) order by d.day desc)
    from (select * from public.etransfer_days order by day desc limit least(greatest(coalesce(p_limit, 60), 1), 366)) d
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'etransfer_config()', 'etransfer_start(text, int)', 'etransfer_mark_sent(uuid, text)', 'etransfer_cancel(uuid)',
    'etransfer_my_orders()', 'etransfer_admin_orders(timestamptz)', 'etransfer_confirm(uuid[], date)',
    'etransfer_reject(uuid, text)', 'etransfer_undo(uuid)', 'etransfer_set_day(date, int, text)', 'etransfer_days(int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'etransfer_require_owner()', 'etransfer_expire()', 'etransfer_order_json(public.etransfer_orders)', 'etransfer_restack(uuid)',
    'etransfer_forget_sender()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
