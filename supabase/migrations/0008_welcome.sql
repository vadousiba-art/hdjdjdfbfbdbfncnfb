-- ============================================================================
-- YORU — welcome film preference. docs/welcome.md
--
-- Remembers which version of the welcome film a member has seen, on their
-- profile, so it is not shown again on another device or after clearing the
-- browser. A new version (a future major release) shows once more.
--
-- Additive and backward-compatible:
--   * one nullable column; existing rows keep NULL ("not seen yet")
--   * two functions; nothing else changes
-- Safe to run more than once.
-- ============================================================================

alter table public.profiles add column if not exists welcome_seen text;

do $$ begin
  alter table public.profiles add constraint profiles_welcome_seen_check
    check (welcome_seen is null or welcome_seen ~ '^[0-9]{1,4}(\.[0-9]{1,3})?$');
exception when duplicate_object then null; end $$;

-- What the client needs to choose the full film or the short update.
create or replace function public.get_welcome_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  p public.profiles;
begin
  select * into p from public.profiles where id = v;
  return jsonb_build_object(
    'seen', p.welcome_seen,
    'account_age_hours', floor(extract(epoch from (now() - p.created_at)) / 3600)
  );
end $$;

create or replace function public.mark_welcome_seen(p_version text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  if p_version is null or p_version !~ '^[0-9]{1,4}(\.[0-9]{1,3})?$' then
    raise exception 'INVALID|Unknown welcome version.';
  end if;
  perform public.enforce_rate_limit('welcome', 30, 3600);
  update public.profiles set welcome_seen = p_version where id = v;
end $$;

revoke execute on function public.get_welcome_state() from public, anon;
revoke execute on function public.mark_welcome_seen(text) from public, anon;
grant execute on function public.get_welcome_state() to authenticated, service_role;
grant execute on function public.mark_welcome_seen(text) to authenticated, service_role;
