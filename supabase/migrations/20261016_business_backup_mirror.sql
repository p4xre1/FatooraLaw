-- Opt-in per-device mirror of the local business workspace.
-- Apply with Supabase migrations / SQL Editor before enabling the client feature.
-- This stores readable business records (including client and financial details);
-- RLS isolates tenant rows but this is NOT end-to-end encryption.

begin;

create table if not exists public.business_backup_mirrors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  snapshot jsonb not null,
  schema_version integer not null default 1 check (schema_version = 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint business_backup_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint business_backup_snapshot_size check (pg_column_size(snapshot) <= 5242880),
  constraint business_backup_user_device_unique unique (user_id, device_id)
);

create index if not exists business_backup_mirrors_enabled_updated_idx
  on public.business_backup_mirrors (user_id, updated_at desc)
  where enabled = true;

alter table public.business_backup_mirrors enable row level security;
alter table public.business_backup_mirrors force row level security;

revoke all on public.business_backup_mirrors from public, anon, authenticated;
grant select, insert, update, delete on public.business_backup_mirrors to authenticated;

drop policy if exists business_backup_mirrors_own_select on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_insert on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_update on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_delete on public.business_backup_mirrors;

create policy business_backup_mirrors_own_select
  on public.business_backup_mirrors for select to authenticated
  using (user_id = (select auth.uid()));

create policy business_backup_mirrors_own_insert
  on public.business_backup_mirrors for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy business_backup_mirrors_own_update
  on public.business_backup_mirrors for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy business_backup_mirrors_own_delete
  on public.business_backup_mirrors for delete to authenticated
  using (user_id = (select auth.uid()));

-- Users can remove only their own mirror rows; auth-user deletion cascades too.

commit;
