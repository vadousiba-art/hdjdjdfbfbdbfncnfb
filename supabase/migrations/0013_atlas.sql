-- ============================================================================
-- YORU — Atlas, the co-founder's AI assistant. docs/atlas.md
--
-- Atlas lives in its own section (/atlas). The server routes each request to
-- Google Gemini (voice, audio, images) or the member's chosen free OpenRouter
-- text model; the keys never leave the server. This migration only stores
-- what Atlas needs between visits:
--   * atlas_messages  the member's own conversation (text only: images and
--                     voice clips are never stored, just noted as attached),
--                     capped at the latest 200 messages, clearable any time.
--   * atlas_prefs     the member's chosen model and whether replies are read
--                     aloud.
-- Both are private to their owner (RLS), reached through the functions below.
--
-- Additive: two new tables and five functions. Nothing existing changes.
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.atlas_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  model text check (char_length(model) <= 120),
  attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists atlas_messages_user_time on public.atlas_messages (user_id, created_at desc);

create table if not exists public.atlas_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  model text not null default 'gemini' check (char_length(model) between 1 and 120),
  speak boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.atlas_messages enable row level security;
alter table public.atlas_prefs enable row level security;
drop policy if exists atlas_messages_own on public.atlas_messages;
create policy atlas_messages_own on public.atlas_messages for select to authenticated using (user_id = auth.uid());
drop policy if exists atlas_prefs_own on public.atlas_prefs;
create policy atlas_prefs_own on public.atlas_prefs for select to authenticated using (user_id = auth.uid());
-- Members read only their own rows (policies above); all writes go through
-- the functions below; visitors get nothing.
revoke all on public.atlas_messages, public.atlas_prefs from anon;
revoke insert, update, delete, truncate on public.atlas_messages, public.atlas_prefs from authenticated;
grant select on public.atlas_messages, public.atlas_prefs to authenticated;

-- Everything the Atlas page needs in one call: recent history and prefs.
create or replace function public.get_atlas(p_limit int default 40) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  p public.atlas_prefs;
begin
  select * into p from public.atlas_prefs where user_id = v;
  return jsonb_build_object(
    'model', coalesce(p.model, 'gemini'),
    'speak', coalesce(p.speak, false),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'role', role, 'content', content, 'model', model,
                                          'attachments', to_jsonb(attachments), 'created_at', created_at) order by created_at)
      from (select * from public.atlas_messages where user_id = v
            order by created_at desc limit least(greatest(coalesce(p_limit, 40), 1), 200)) m
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.atlas_save_exchange(p_user_text text, p_ai_text text, p_model text, p_attachments text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  kinds text[] := coalesce((select array_agg(distinct k) from unnest(coalesce(p_attachments, '{}')) k where k in ('image', 'audio', 'voice')), '{}');
begin
  insert into public.atlas_messages (user_id, role, content, model, attachments, created_at) values
    (v, 'user', left(coalesce(p_user_text, ''), 8000), null, kinds, now()),
    (v, 'assistant', left(coalesce(p_ai_text, ''), 8000), left(p_model, 120), '{}', now() + interval '1 millisecond');
  -- Keep only the latest 200 messages.
  delete from public.atlas_messages
  where user_id = v and id in (
    select id from public.atlas_messages where user_id = v order by created_at desc offset 200
  );
end $$;

create or replace function public.atlas_set_prefs(p_model text default null, p_speak boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.require_member();
  p public.atlas_prefs;
begin
  if p_model is not null and (char_length(p_model) not between 1 and 120 or p_model !~ '^[A-Za-z0-9._:/-]+$') then
    raise exception 'INVALID|That model name isn''t valid.';
  end if;
  insert into public.atlas_prefs (user_id, model, speak) values (v, coalesce(p_model, 'gemini'), coalesce(p_speak, false))
  on conflict (user_id) do update set
    model = coalesce(p_model, atlas_prefs.model),
    speak = coalesce(p_speak, atlas_prefs.speak),
    updated_at = now()
  returning * into p;
  return jsonb_build_object('model', p.model, 'speak', p.speak);
end $$;

create or replace function public.atlas_clear() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.atlas_messages where user_id = public.require_member();
end $$;

-- What Atlas may know about the member asking (their own profile, nothing else).
create or replace function public.get_atlas_context() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid := public.require_member();
begin
  return (select jsonb_build_object('username', username, 'display_name', display_name, 'bio', coalesce(bio, ''),
                                    'status', coalesce(status, ''), 'role', role)
          from public.profiles where id = v);
end $$;

revoke execute on function public.get_atlas(int) from public, anon;
revoke execute on function public.atlas_save_exchange(text, text, text, text[]) from public, anon;
revoke execute on function public.atlas_set_prefs(text, boolean) from public, anon;
revoke execute on function public.atlas_clear() from public, anon;
revoke execute on function public.get_atlas_context() from public, anon;
grant execute on function public.get_atlas(int) to authenticated, service_role;
grant execute on function public.atlas_save_exchange(text, text, text, text[]) to authenticated, service_role;
grant execute on function public.atlas_set_prefs(text, boolean) to authenticated, service_role;
grant execute on function public.atlas_clear() to authenticated, service_role;
grant execute on function public.get_atlas_context() to authenticated, service_role;
