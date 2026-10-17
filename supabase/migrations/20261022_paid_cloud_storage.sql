-- Paid, opt-in backups use File Storage, NOT the 500 MB Postgres database.
-- Decimal units match the product allowance: 100 MB = 100,000,000 bytes.
begin;
create table if not exists public.cloud_storage_config (
  id boolean primary key default true check (id),
  capacity_bytes bigint not null default 900000000 check (capacity_bytes >= 0),
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  object_count integer not null default 0 check (object_count >= 0),
  addons_enabled boolean not null default false
);
insert into public.cloud_storage_config(id) values (true) on conflict do nothing;
create table if not exists public.cloud_storage_accounts (
  user_id uuid primary key, -- retained until Storage API cleanup, even after auth deletion
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  object_count integer not null default 0 check (object_count >= 0),
  extra_gb integer not null default 0 check (extra_gb between 0 and 1000),
  extra_expires_at timestamptz
);
alter table public.cloud_storage_config enable row level security;
alter table public.cloud_storage_accounts enable row level security;
revoke all on public.cloud_storage_config, public.cloud_storage_accounts from public, anon, authenticated;
-- Only trusted SQL / service_role may provision paid add-ons or change capacity.
grant all on public.cloud_storage_config, public.cloud_storage_accounts to service_role;

create or replace function public.has_paid_cloud(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.account_subscriptions s
    join public.profiles p on p.id = s.user_id
    where s.user_id = p_user and s.plan::text in ('pro','boost')
      and s.status::text = 'active' and s.current_period_end > now()
      and p.deletion_requested_at is null);
$$;
revoke all on function public.has_paid_cloud(uuid) from public, anon;
grant execute on function public.has_paid_cloud(uuid) to authenticated;

create or replace function public.cloud_storage_status()
returns jsonb language sql stable security definer set search_path = public, pg_catalog as $$
  select jsonb_build_object(
    'allowed', public.has_paid_cloud(auth.uid()),
    'limit_bytes', case when public.has_paid_cloud(auth.uid()) then 100000000::bigint +
      case when c.addons_enabled and a.extra_expires_at > now() then coalesce(a.extra_gb,0)::bigint * 1000000000 else 0 end else 0 end,
    'used_bytes', coalesce(a.used_bytes,0),
    'capacity_bytes', c.capacity_bytes, 'project_used_bytes', c.used_bytes,
    'addons_enabled', c.addons_enabled)
  from public.cloud_storage_config c left join public.cloud_storage_accounts a on a.user_id = auth.uid()
  where c.id and auth.uid() is not null;
$$;
revoke all on function public.cloud_storage_status() from public, anon;
grant execute on function public.cloud_storage_status() to authenticated;

-- Storage API writes metadata.size from the actual uploaded object. Clients
-- cannot write storage.objects through PostgREST. Do not grant them SQL access.
-- A single locked counter serializes ALL backup writes, including overwrites,
-- so concurrent devices/accounts cannot exceed either quota.
create or replace function public.enforce_cloud_storage_quota()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  cfg public.cloud_storage_config%rowtype;
  acct public.cloud_storage_accounts%rowtype;
  uid uuid;
  old_size bigint := 0;
  new_size bigint := 0;
  allowance bigint;
  count_delta integer := 0;
begin
  if TG_OP = 'UPDATE' and (old.bucket_id = 'business-backups' or new.bucket_id = 'business-backups')
    and (new.bucket_id <> old.bucket_id or new.name <> old.name) then
    raise exception 'cloud_object_move_not_allowed';
  end if;
  if TG_OP = 'DELETE' then
    if old.bucket_id <> 'business-backups' then return old; end if;
    uid := split_part(old.name, '/', 1)::uuid;
    old_size := coalesce((old.metadata->>'size')::bigint,0);
    count_delta := -1;
  else
    if new.bucket_id <> 'business-backups' then return new; end if;
    if new.name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.json$' then raise exception 'invalid_cloud_object_path'; end if;
    uid := split_part(new.name, '/', 1)::uuid;
    perform split_part(split_part(new.name, '/', 2), '.', 1)::uuid;
    if not public.has_paid_cloud(uid) then raise exception 'cloud_requires_active_pro_or_boost'; end if;
    -- Storage's RLS permission probe is rolled back and may have only
    -- contentLength (older versions have no metadata yet). Final writes use
    -- server-measured size; user-supplied custom metadata is a separate field.
    new_size := coalesce((new.metadata->>'size')::bigint, (new.metadata->>'contentLength')::bigint, 0);
    if new_size < 0 or new_size > 4194304 then raise exception 'cloud_snapshot_exceeds_4_mb'; end if;
    if TG_OP = 'UPDATE' then old_size := coalesce((old.metadata->>'size')::bigint,0);
    else count_delta := 1; end if;
  end if;
  select * into cfg from public.cloud_storage_config where id for update;
  insert into public.cloud_storage_accounts(user_id) values(uid) on conflict do nothing;
  select * into acct from public.cloud_storage_accounts where user_id = uid for update;
  allowance := 100000000 + case when cfg.addons_enabled and acct.extra_expires_at > now()
    then acct.extra_gb::bigint * 1000000000 else 0 end;
  -- Deletion remains possible after subscription expiry; active accounts may
  -- shrink files after an add-on expires or project capacity decreases.
  if new_size > old_size and acct.used_bytes + new_size - old_size > allowance then
    raise exception 'cloud_account_storage_full';
  end if;
  if new_size > old_size and cfg.used_bytes + new_size - old_size > cfg.capacity_bytes then
    raise exception 'cloud_project_storage_full_try_later';
  end if;
  -- Bound small/empty-object metadata growth too. This scales with paid
  -- capacity, so add-on GB can actually be used rather than hitting 50 files.
  if count_delta > 0 and acct.object_count >= allowance / 1000000 then
    raise exception 'cloud_account_file_count_limit';
  end if;
  if count_delta > 0 and cfg.object_count >= cfg.capacity_bytes / 1000000 then
    raise exception 'cloud_project_file_count_limit';
  end if;
  update public.cloud_storage_config set used_bytes = used_bytes + new_size - old_size,
    object_count = object_count + count_delta where id;
  update public.cloud_storage_accounts set used_bytes = used_bytes + new_size - old_size,
    object_count = object_count + count_delta where user_id = uid;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.enforce_cloud_storage_quota() from public, anon, authenticated;

-- Storage is absent in the lightweight schema test harness, present on Supabase.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('business-backups','business-backups',false,4194304,array['application/json'])
      on conflict(id) do update set public=false, file_size_limit=4194304, allowed_mime_types=array['application/json'];
    drop trigger if exists enforce_paid_cloud_quota on storage.objects;
    create trigger enforce_paid_cloud_quota after insert or update or delete on storage.objects
      for each row execute function public.enforce_cloud_storage_quota();
    drop policy if exists paid_cloud_read on storage.objects;
    create policy paid_cloud_read on storage.objects for select to authenticated
      using(bucket_id='business-backups' and split_part(name,'/',1)=auth.uid()::text
        and exists(select 1 from public.profiles p where p.id=auth.uid() and p.deletion_requested_at is null));
    drop policy if exists paid_cloud_insert on storage.objects;
    create policy paid_cloud_insert on storage.objects for insert to authenticated
      with check(bucket_id='business-backups' and split_part(name,'/',1)=auth.uid()::text and public.has_paid_cloud(auth.uid()));
    drop policy if exists paid_cloud_update on storage.objects;
    create policy paid_cloud_update on storage.objects for update to authenticated
      using(bucket_id='business-backups' and split_part(name,'/',1)=auth.uid()::text and public.has_paid_cloud(auth.uid()))
      with check(bucket_id='business-backups' and split_part(name,'/',1)=auth.uid()::text and public.has_paid_cloud(auth.uid()));
    drop policy if exists paid_cloud_delete on storage.objects;
    create policy paid_cloud_delete on storage.objects for delete to authenticated
      using(bucket_id='business-backups' and split_part(name,'/',1)=auth.uid()::text);
  end if;
end $$;

-- Keep the operator's base catalog consistent with the new paid allowance.
update public.plan_catalog set max_storage_mb=100 where code::text in ('pro','boost');

-- Keep legacy snapshots intact for recovery, but stop clients storing new JSON
-- payloads in Postgres. New rows contain only an empty compatibility snapshot.
alter table public.business_backup_mirrors alter column snapshot set default '{}'::jsonb;
revoke insert, update on public.business_backup_mirrors from authenticated;
grant insert(user_id,device_id,enabled,updated_at), update(user_id,device_id,enabled,updated_at) on public.business_backup_mirrors to authenticated;
drop policy if exists business_backup_mirrors_own_insert on public.business_backup_mirrors;
create policy business_backup_mirrors_own_insert on public.business_backup_mirrors for insert to authenticated
  with check(user_id=auth.uid() and public.has_paid_cloud(auth.uid()));
drop policy if exists business_backup_mirrors_own_update on public.business_backup_mirrors;
create policy business_backup_mirrors_own_update on public.business_backup_mirrors for update to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid() and (not enabled or public.has_paid_cloud(auth.uid())));
create or replace function public.validate_cloud_mirror_metadata()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if TG_OP='UPDATE' and (new.user_id <> old.user_id or new.device_id <> old.device_id) then
    raise exception 'cloud_mirror_identity_immutable';
  end if;
  if TG_OP = 'INSERT' or (new.enabled and not old.enabled) then
    if to_regclass('storage.objects') is null then raise exception 'cloud_storage_not_installed'; end if;
    if not exists(select 1 from storage.objects where bucket_id='business-backups'
      and name=new.user_id::text || '/' || new.device_id::text || '.json') then
      raise exception 'upload_cloud_object_first';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_cloud_mirror_metadata() from public, anon, authenticated;
drop trigger if exists validate_cloud_mirror_metadata on public.business_backup_mirrors;
create trigger validate_cloud_mirror_metadata before insert or update on public.business_backup_mirrors
  for each row execute function public.validate_cloud_mirror_metadata();

-- Never orphan Storage files by deleting their auth owner through SQL. Storage
-- API removal must happen first (SQL deletion of storage.objects leaks blobs).
create or replace function public.require_cloud_cleanup_before_user_delete()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if exists(select 1 from public.cloud_storage_accounts where user_id=old.id and object_count>0) then
    raise exception 'remove_cloud_files_via_storage_api_before_account_purge';
  end if;
  delete from public.cloud_storage_accounts where user_id=old.id;
  return old;
end;
$$;
revoke all on function public.require_cloud_cleanup_before_user_delete() from public, anon, authenticated;
drop trigger if exists require_cloud_cleanup on auth.users;
create trigger require_cloud_cleanup before delete on auth.users
  for each row execute function public.require_cloud_cleanup_before_user_delete();
create or replace function public.require_cloud_cleanup_before_workspace_erase()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.workspace_erased_at is distinct from old.workspace_erased_at
    and new.workspace_erased_at is not null
    and exists(select 1 from public.cloud_storage_accounts where user_id=new.id and object_count>0) then
    raise exception 'remove_cloud_files_via_storage_api_before_workspace_erase';
  end if;
  return new;
end;
$$;
revoke all on function public.require_cloud_cleanup_before_workspace_erase() from public, anon, authenticated;
drop trigger if exists require_cloud_cleanup_before_erase on public.profiles;
create trigger require_cloud_cleanup_before_erase before update of workspace_erased_at on public.profiles
  for each row execute function public.require_cloud_cleanup_before_workspace_erase();

create or replace function public.cloud_cleanup_candidates()
returns table(user_id uuid) language sql stable security definer set search_path = public, pg_catalog as $$
  select p.id from public.profiles p
  where p.deletion_requested_at <= now() - interval '30 days'
    and exists(select 1 from public.cloud_storage_accounts a where a.user_id=p.id and a.object_count>0);
$$;
revoke all on function public.cloud_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.cloud_cleanup_candidates() to service_role;
commit;
