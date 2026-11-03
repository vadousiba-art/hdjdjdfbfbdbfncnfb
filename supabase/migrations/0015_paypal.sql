-- ============================================================================
-- YORU Pro through PayPal subscriptions. docs/billing.md
--
-- Additive: one server-only function. Pro is still nothing more than an active
-- row in public.entitlements; this writes the row for a PayPal subscription
-- (source 'paypal', external_id = the subscription id) after the server has
-- read the subscription back from PayPal itself. The browser never decides.
--
--   active    renews Pro until p_ends_at (the next billing date plus grace);
--             the date only ever moves forward
--   canceled  (p_active false, p_ends_at null) Pro stays until the end of the
--             period that was paid for, then lapses on its own
--   ended     (p_active false, p_ends_at now) suspended, expired or refunded:
--             Pro ends now
--
-- Webhook events are recorded once in public.payment_events. The state comes
-- from PayPal, never from the event body, so a replayed event changes nothing.
-- ============================================================================

create or replace function public.billing_paypal_sync(
  p_user uuid,
  p_subscription text,
  p_active boolean,
  p_ends_at timestamptz,
  p_event_id text default null,
  p_event_type text default null,
  p_payload jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e public.entitlements;
  had boolean;
begin
  if p_subscription is null or p_subscription !~ '^I-[A-Z0-9]{6,40}$' then
    raise exception 'INVALID|That is not a PayPal subscription id.';
  end if;
  if p_event_id is not null then
    insert into public.payment_events (provider, event_id, event_type, payload)
    values ('paypal', left(p_event_id, 100), left(coalesce(p_event_type, ''), 100), coalesce(p_payload, '{}'::jsonb))
    on conflict (provider, event_id) do nothing;
  end if;

  select * into e from public.entitlements where external_id = p_subscription for update;
  had := found;
  if had and p_user is not null and e.user_id <> p_user then
    raise exception 'FORBIDDEN|This subscription belongs to another member.' using errcode = '42501';
  end if;

  if p_active then
    if p_user is null then raise exception 'INVALID|A subscription needs a member.'; end if;
    if p_ends_at is null or p_ends_at <= now() then raise exception 'INVALID|An active subscription needs a future end date.'; end if;
    if not exists (select 1 from public.profiles where id = p_user and not is_bot) then
      raise exception 'NOT_FOUND|No such member.' using errcode = 'P0002';
    end if;
    if had then
      update public.entitlements
      set status = 'active', ends_at = greatest(coalesce(e.ends_at, p_ends_at), p_ends_at), updated_at = now()
      where id = e.id;
    else
      insert into public.entitlements (user_id, plan, source, status, starts_at, ends_at, external_id, note)
      values (p_user, 'pro', 'paypal', 'active', now(), p_ends_at, p_subscription, 'PayPal subscription');
    end if;
  elsif had and p_ends_at is not null then
    update public.entitlements
    set ends_at = least(coalesce(e.ends_at, p_ends_at), p_ends_at),
        status = case when least(coalesce(e.ends_at, p_ends_at), p_ends_at) <= now() then 'expired' else e.status end,
        updated_at = now()
    where id = e.id;
  end if;

  if p_event_id is not null then
    update public.payment_events set processed_at = now() where provider = 'paypal' and event_id = left(p_event_id, 100);
  end if;

  select * into e from public.entitlements where external_id = p_subscription;
  return jsonb_build_object(
    'known', e.id is not null,
    'pro', e.id is not null and public.is_pro(e.user_id),
    'until', e.ends_at
  );
end $$;

revoke execute on function public.billing_paypal_sync(uuid, text, boolean, timestamptz, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.billing_paypal_sync(uuid, text, boolean, timestamptz, text, text, jsonb) to service_role;
