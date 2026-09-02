-- Execute uma vez no SQL Editor do projeto correto.
-- Perfis públicos nunca armazenam senhas; elas permanecem exclusivamente no Supabase Auth.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  registration text not null check (char_length(registration) between 2 and 40),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, registration, updated_at) on public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, registration, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'registration'), ''), 'Não informada'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Cria perfis para contas que já existiam antes da instalação deste gatilho.
insert into public.profiles (id, full_name, registration, role)
select
  user_record.id,
  coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'full_name'), ''), split_part(user_record.email, '@', 1)),
  coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'registration'), ''), 'Não informada'),
  'student'
from auth.users as user_record
on conflict (id) do nothing;

-- Para promover o primeiro professor, substitua o e-mail e execute separadamente:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'professor@ufpb.br');
