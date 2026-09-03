-- Execute uma vez no SQL Editor do projeto correto.
-- Perfis públicos nunca armazenam senhas; elas permanecem exclusivamente no Supabase Auth.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text,
  registration text not null check (char_length(registration) between 2 and 40),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

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
  insert into public.profiles (id, full_name, email, registration, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
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
insert into public.profiles (id, full_name, email, registration, role)
select
  user_record.id,
  coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'full_name'), ''), split_part(user_record.email, '@', 1)),
  user_record.email,
  coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'registration'), ''), 'Não informada'),
  'student'
from auth.users as user_record
on conflict (id) do nothing;

update public.profiles as profile
set email = user_record.email
from auth.users as user_record
where profile.id = user_record.id and profile.email is distinct from user_record.email;

-- Para promover o primeiro professor, substitua o e-mail e execute separadamente:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'professor@ufpb.br');

-- ---------------------------------------------------------------------------
-- Prontuários clínicos persistentes
-- ---------------------------------------------------------------------------

create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  semester text not null check (char_length(semester) between 3 and 20),
  record_number text not null check (char_length(record_number) between 1 and 40),
  patient_name text not null check (char_length(patient_name) between 2 and 180),
  status text not null default 'Em avaliação' check (status in ('Em avaliação', 'Aguardando exame', 'Aguardando biópsia', 'Em acompanhamento', 'Concluído', 'Alta')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  drive_file_id text,
  drive_backed_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester, record_number)
);

create index if not exists clinical_cases_owner_semester_idx on public.clinical_cases (owner_id, semester, updated_at desc);
create index if not exists clinical_cases_semester_status_idx on public.clinical_cases (semester, status, updated_at desc);

create table if not exists public.clinical_case_revisions (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.clinical_cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'updated')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists clinical_case_revisions_case_created_idx on public.clinical_case_revisions (case_id, created_at desc);
create index if not exists clinical_case_revisions_actor_idx on public.clinical_case_revisions (actor_id) where actor_id is not null;

alter table public.clinical_cases enable row level security;
alter table public.clinical_case_revisions enable row level security;

drop policy if exists "clinical_cases_select_owner_or_admin" on public.clinical_cases;
create policy "clinical_cases_select_owner_or_admin"
on public.clinical_cases for select to authenticated
using (owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "clinical_cases_insert_owner" on public.clinical_cases;
create policy "clinical_cases_insert_owner"
on public.clinical_cases for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "clinical_cases_update_owner_or_admin" on public.clinical_cases;
create policy "clinical_cases_update_owner_or_admin"
on public.clinical_cases for update to authenticated
using (owner_id = (select auth.uid()) or (select private.is_admin()))
with check (owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "clinical_cases_delete_admin" on public.clinical_cases;
drop policy if exists "clinical_cases_delete_admin_or_empty_owner" on public.clinical_cases;
create policy "clinical_cases_delete_admin_or_empty_owner"
on public.clinical_cases for delete to authenticated
using (
  (select private.is_admin())
  or (owner_id = (select auth.uid()) and payload = '{}'::jsonb)
);

drop policy if exists "clinical_case_revisions_select_owner_or_admin" on public.clinical_case_revisions;
create policy "clinical_case_revisions_select_owner_or_admin"
on public.clinical_case_revisions for select to authenticated
using (
  exists (
    select 1 from public.clinical_cases clinical_case
    where clinical_case.id = clinical_case_revisions.case_id
  )
);

create or replace function private.record_clinical_case_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.clinical_case_revisions (case_id, actor_id, action, payload)
    values (new.id, (select auth.uid()), 'created', new.payload);
  elsif old.payload is distinct from new.payload then
    insert into public.clinical_case_revisions (case_id, actor_id, action, payload)
    values (new.id, (select auth.uid()), 'updated', new.payload);
  end if;
  return new;
end;
$$;

revoke all on function private.record_clinical_case_revision() from public, anon, authenticated;

drop trigger if exists clinical_cases_revision_trigger on public.clinical_cases;
create trigger clinical_cases_revision_trigger
after insert or update of payload on public.clinical_cases
for each row execute function private.record_clinical_case_revision();

create or replace function private.signed_evolution_map(case_payload jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(evolution ->> 'id', evolution), '{}'::jsonb)
  from jsonb_array_elements(coalesce(case_payload -> 'timeline', '[]'::jsonb)) evolution
  where evolution -> 'professorSignature' is not null
    and evolution -> 'professorSignature' <> 'null'::jsonb;
$$;

revoke all on function private.signed_evolution_map(jsonb) from public, anon, authenticated;

create or replace function private.protect_professor_signatures()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_registration_signature jsonb;
  new_registration_signature jsonb;
begin
  if exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  ) then
    return new;
  end if;

  new_registration_signature := nullif(new.payload #> '{signatures,registration,professor}', 'null'::jsonb);
  if tg_op = 'INSERT' then
    if new_registration_signature is not null and new_registration_signature <> 'null'::jsonb then
      raise exception 'Somente professores podem registrar assinatura de supervisão.' using errcode = '42501';
    end if;
    if private.signed_evolution_map(new.payload) <> '{}'::jsonb then
      raise exception 'Somente professores podem assinar evoluções.' using errcode = '42501';
    end if;
    return new;
  end if;

  old_registration_signature := nullif(old.payload #> '{signatures,registration,professor}', 'null'::jsonb);
  if old_registration_signature is distinct from new_registration_signature then
    raise exception 'Somente professores podem alterar a assinatura de supervisão.' using errcode = '42501';
  end if;
  if not (private.signed_evolution_map(old.payload) <@ private.signed_evolution_map(new.payload)) then
    raise exception 'Uma evolução assinada pelo professor não pode ser alterada pelo aluno.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_professor_signatures() from public, anon, authenticated;

drop trigger if exists clinical_cases_protect_professor_signatures on public.clinical_cases;
create trigger clinical_cases_protect_professor_signatures
before insert or update of payload on public.clinical_cases
for each row execute function private.protect_professor_signatures();

create or replace function private.can_access_clinical_case(case_id_text text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  parsed_case_id uuid;
begin
  if (select auth.uid()) is null then return false; end if;
  begin
    parsed_case_id := case_id_text::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return exists (
    select 1
    from public.clinical_cases clinical_case
    where clinical_case.id = parsed_case_id
      and (
        clinical_case.owner_id = (select auth.uid())
        or exists (
          select 1 from public.profiles profile
          where profile.id = (select auth.uid()) and profile.role = 'admin'
        )
      )
  );
end;
$$;

revoke all on function private.can_access_clinical_case(text) from public, anon;
grant execute on function private.can_access_clinical_case(text) to authenticated;

grant select, insert, update, delete on public.clinical_cases to authenticated;
grant select on public.clinical_case_revisions to authenticated;
grant select, insert, update, delete on public.clinical_cases to service_role;
grant select, insert on public.clinical_case_revisions to service_role;
grant usage, select on sequence public.clinical_case_revisions_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-files',
  'clinical-files',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinical_files_select_authorized_case" on storage.objects;
create policy "clinical_files_select_authorized_case"
on storage.objects for select to authenticated
using (
  bucket_id = 'clinical-files'
  and (select private.can_access_clinical_case((storage.foldername(name))[1]))
);

drop policy if exists "clinical_files_insert_authorized_case" on storage.objects;
create policy "clinical_files_insert_authorized_case"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinical-files'
  and (select private.can_access_clinical_case((storage.foldername(name))[1]))
);

drop policy if exists "clinical_files_update_authorized_case" on storage.objects;
create policy "clinical_files_update_authorized_case"
on storage.objects for update to authenticated
using (
  bucket_id = 'clinical-files'
  and (select private.can_access_clinical_case((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'clinical-files'
  and (select private.can_access_clinical_case((storage.foldername(name))[1]))
);

drop policy if exists "clinical_files_delete_authorized_case" on storage.objects;
create policy "clinical_files_delete_authorized_case"
on storage.objects for delete to authenticated
using (
  bucket_id = 'clinical-files'
  and (select private.can_access_clinical_case((storage.foldername(name))[1]))
);
