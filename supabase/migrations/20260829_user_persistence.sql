-- OpenSource Mentor user persistence schema
-- Run this in the Supabase SQL Editor.
-- It is intentionally idempotent: existing data is preserved.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint not null,
  github_username text not null,
  github_avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users
  add column if not exists github_id bigint,
  add column if not exists github_username text,
  add column if not exists github_avatar text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_users_github_id_key
  on public.app_users (github_id);

create table if not exists public.developer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  profile_setup_status text not null default 'not_started',
  profile_confirmed boolean not null default false,
  github_profile jsonb,
  developer_profile jsonb,
  open_source_goal text,
  preferred_tech_stack text[],
  contribution_time_budget text,
  guidance_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.developer_profiles
  add column if not exists user_id uuid references public.app_users(id) on delete cascade,
  add column if not exists profile_setup_status text not null default 'not_started',
  add column if not exists profile_confirmed boolean not null default false,
  add column if not exists github_profile jsonb,
  add column if not exists developer_profile jsonb,
  add column if not exists open_source_goal text,
  add column if not exists preferred_tech_stack text[],
  add column if not exists contribution_time_budget text,
  add column if not exists guidance_preference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists developer_profiles_user_id_key
  on public.developer_profiles (user_id)
  where user_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'developer_profiles_profile_setup_status_check'
  ) then
    alter table public.developer_profiles
      add constraint developer_profiles_profile_setup_status_check
      check (profile_setup_status in ('not_started', 'completed', 'skipped'));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists developer_profiles_set_updated_at on public.developer_profiles;
create trigger developer_profiles_set_updated_at
before update on public.developer_profiles
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.developer_profiles enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.app_users to service_role;
grant select, insert, update, delete on table public.developer_profiles to service_role;

-- No public client policies are added on purpose.
-- The Cloudflare Worker must use SUPABASE_SECRET_KEY with the Supabase service_role key.
-- Do not expose that key to the browser.
