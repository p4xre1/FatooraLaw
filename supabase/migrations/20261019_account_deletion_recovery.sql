-- 30-day account recovery window. Workspace deletion is an explicit, irreversible choice.
alter table public.profiles add column if not exists deletion_requested_at timestamptz;
alter table public.profiles add column if not exists workspace_erased_at timestamptz;

alter table public.cms_support_requests drop constraint if exists cms_support_requests_category_check;
alter table public.cms_support_requests add constraint cms_support_requests_category_check
  check (category in ('contact', 'bug', 'feedback', 'feature_request', 'investor', 'partner'));

create or replace function public.request_account_deletion(p_erase_workspace boolean default false)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare due_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  update public.profiles set deletion_requested_at = coalesce(deletion_requested_at, now())
    where id = auth.uid() returning deletion_requested_at + interval '30 days' into due_at;
  if due_at is null then raise exception 'account_profile_missing' using errcode = 'P0002'; end if;
  if p_erase_workspace then
    delete from public.business_backup_mirrors where user_id = auth.uid();
    delete from public.company_settings where user_id = auth.uid();
    delete from public.contacts where user_id = auth.uid();
    delete from public.projects where user_id = auth.uid();
    delete from public.expenses where user_id = auth.uid();
    delete from public.stock_items where user_id = auth.uid();
    delete from public.contracts where user_id = auth.uid();
    delete from public.team_members where user_id = auth.uid();
    delete from public.audit_events where user_id = auth.uid();
    delete from public.subscriptions where user_id = auth.uid();
    delete from public.calendar_events where user_id = auth.uid();
    update public.profiles set workspace_erased_at = now() where id = auth.uid();
  end if;
  return due_at;
end; $$;
revoke all on function public.request_account_deletion(boolean) from public, anon;
grant execute on function public.request_account_deletion(boolean) to authenticated;

create or replace function public.reactivate_account()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  update public.profiles set deletion_requested_at = null where id = auth.uid()
    and deletion_requested_at > now() - interval '30 days';
  return found;
end; $$;
revoke all on function public.reactivate_account() from public, anon;
grant execute on function public.reactivate_account() to authenticated;

-- Remove workspace access for pending accounts while preserving profile access for recovery.
do $$ declare table_name text; begin
  foreach table_name in array array['company_settings','contacts','projects','expenses','stock_items','contracts','team_members','audit_events','subscriptions','calendar_events'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null))', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null))', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null)) with check (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null))', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null))', table_name || '_delete_own', table_name);
  end loop;
end $$;

-- Close remaining self-service billing/usage reads and prohibit new authenticated
-- purchase requests while an account is pending deletion.
drop policy if exists account_subscriptions_owner_read on public.account_subscriptions;
create policy account_subscriptions_owner_read on public.account_subscriptions for select to authenticated
  using ((user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null)) or public.is_platform_admin());
drop policy if exists usage_monthly_owner_read on public.usage_monthly;
create policy usage_monthly_owner_read on public.usage_monthly for select to authenticated
  using ((user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null)) or public.is_platform_admin());
drop policy if exists purchase_requests_public_insert on public.purchase_requests;
create policy purchase_requests_public_insert on public.purchase_requests for insert to anon, authenticated
  with check (user_id is null or (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null)));
drop policy if exists purchase_requests_owner_read on public.purchase_requests;
create policy purchase_requests_owner_read on public.purchase_requests for select to authenticated
  using ((user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null)) or public.is_platform_admin());

-- Pending accounts also lose access to the optional JSON workspace mirror.
drop policy if exists business_backup_mirrors_own_select on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_insert on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_update on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_delete on public.business_backup_mirrors;
create policy business_backup_mirrors_own_select on public.business_backup_mirrors for select to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null));
create policy business_backup_mirrors_own_insert on public.business_backup_mirrors for insert to authenticated
  with check (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null));
create policy business_backup_mirrors_own_update on public.business_backup_mirrors for update to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null))
  with check (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null));
create policy business_backup_mirrors_own_delete on public.business_backup_mirrors for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.deletion_requested_at is not null));

-- Hard purge/redact function used by the trusted daily cron job.
create or replace function public.purge_deleted_accounts()
returns integer language plpgsql security definer set search_path = public, auth as $$
declare expired record; purged integer := 0;
begin
  for expired in
    select u.id, u.email from auth.users u join public.profiles p on p.id = u.id
    where p.deletion_requested_at <= now() - interval '30 days'
  loop
    update public.cms_support_requests set name = 'Deleted user',
      email = 'deleted+' || id::text || '@example.invalid', subject = 'Deleted account request', message = '[redacted]'
      where lower(email) = lower(expired.email);
    delete from auth.users where id = expired.id;
    purged := purged + 1;
  end loop;
  return purged;
end; $$;
revoke all on function public.purge_deleted_accounts() from public, anon, authenticated;

-- Schedule the hard purge where Supabase's pg_cron extension is enabled.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'fatorati-purge-deleted-accounts';
    perform cron.schedule('fatorati-purge-deleted-accounts', '*/15 * * * *', 'select public.purge_deleted_accounts()');
  end if;
end $$;
