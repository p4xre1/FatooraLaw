-- Server-side boundaries: applies to direct REST/RPC calls, not just the UI.
-- Apply after the existing migrations. This does not configure Auth/WAF settings.
begin;

revoke create on schema public from public, anon, authenticated;

-- Clients must not forge security/audit records. Trusted trigger/RPC owners
-- still append real changes; operators retain their existing read access.
drop policy if exists admin_audit_events_admin_insert on public.admin_audit_events;
revoke insert, update, delete on public.admin_audit_events from public, anon, authenticated;

-- One bounded row per server-chosen scope, not one row per attacker request.
create table if not exists public.server_request_budgets (
  scope text primary key check (char_length(scope) between 1 and 120),
  window_started_at timestamptz not null default now(),
  requests integer not null check (requests > 0)
);
alter table public.server_request_budgets enable row level security;
revoke all on public.server_request_budgets from public, anon, authenticated;

create or replace function public.take_server_request_budget(p_scope text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare accepted integer;
begin
  if p_limit <= 0 or p_window <= interval '0 seconds' then raise exception 'invalid_server_budget'; end if;
  delete from public.server_request_budgets where window_started_at < now() - interval '2 days';
  insert into public.server_request_budgets(scope,window_started_at,requests)
  values(p_scope,now(),1)
  on conflict(scope) do update set
    window_started_at = case when public.server_request_budgets.window_started_at <= now()-p_window then now() else public.server_request_budgets.window_started_at end,
    requests = case when public.server_request_budgets.window_started_at <= now()-p_window then 1 else public.server_request_budgets.requests+1 end
  where public.server_request_budgets.window_started_at <= now()-p_window or public.server_request_budgets.requests < p_limit
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.take_server_request_budget(text,integer,interval) from public, anon, authenticated;

-- Global budgets are intentional: request headers/email can be spoofed and
-- must never be treated as proof of a client's IP or identity. Global limits
-- protect storage even when an attacker rotates addresses/anonymous sessions.
create or replace function public.guard_public_ingestion()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  family text;
  email_hash text;
  minute_limit integer;
begin
  if TG_TABLE_NAME in ('cms_support_requests','purchase_requests') then
    family := case when TG_TABLE_NAME='cms_support_requests' then 'support' else 'purchase' end;
    if new.email is null or char_length(new.email)>254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'invalid_request_email' using errcode='23514';
    end if;
    new.email := lower(btrim(new.email));
    email_hash := md5(new.email); -- short-lived dedup/rate key, NOT authentication
    if TG_TABLE_NAME='purchase_requests' then
      if char_length(new.company)>200 or char_length(new.message)>10000 or new.seats>1000 then
        raise exception 'purchase_request_too_large' using errcode='23514';
      end if;
      if current_setting('role',true) in ('anon','authenticated') and not public.activation_admin_mfa() then
        -- Identity/status/timestamps cannot be asserted by the caller.
        new.user_id := auth.uid();
        new.status := 'new';
        new.created_at := now();
        new.updated_at := now();
      end if;
    end if;
    if not public.take_server_request_budget(family||':day',200,interval '1 day') or
       not public.take_server_request_budget(family||':hour',60,interval '1 hour') or
       not public.take_server_request_budget(family||':email:'||email_hash,3,interval '1 hour') then
      raise exception 'public_request_rate_limited_try_later' using errcode='PT429';
    end if;
  elsif TG_TABLE_NAME in ('site_page_views','site_analytics_events') then
    family := case when TG_TABLE_NAME='site_page_views' then 'pageviews' else 'events' end;
    minute_limit := case when TG_TABLE_NAME='site_page_views' then 120 else 60 end;
    if not public.take_server_request_budget(family||':day',10000,interval '1 day') or
       not public.take_server_request_budget(family||':hour',1000,interval '1 hour') or
       not public.take_server_request_budget(family||':minute',minute_limit,interval '1 minute') then
      raise exception 'analytics_rate_limited' using errcode='PT429';
    end if;
  else
    raise exception 'unsupported_public_ingestion_table';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_public_ingestion() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['cms_support_requests','purchase_requests','site_page_views','site_analytics_events'] loop
    execute format('drop trigger if exists guard_public_ingestion on public.%I',t);
    execute format('create trigger guard_public_ingestion before insert on public.%I for each row execute function public.guard_public_ingestion()',t);
  end loop;
end $$;

-- Separate anonymous and signed-in policies: an anonymous caller must not
-- need SELECT access to profiles just to submit a request. Pending accounts
-- cannot bypass their access stop by sending user_id=null.
drop policy if exists purchase_requests_public_insert on public.purchase_requests;
drop policy if exists purchase_requests_authenticated_insert on public.purchase_requests;
create policy purchase_requests_public_insert on public.purchase_requests for insert to anon
  with check(user_id is null);
create policy purchase_requests_authenticated_insert on public.purchase_requests for insert to authenticated
  with check(user_id=auth.uid() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.deletion_requested_at is not null));

-- RLS on a row alone does not secure its foreign keys: PostgreSQL's FK checks
-- intentionally bypass RLS. Verify that referenced business records belong to
-- the SAME tenant, including UUID-array references not covered by normal FKs.
create or replace function public.guard_workspace_references()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare data jsonb := to_jsonb(new); reference_id uuid; equipment uuid[];
begin
  -- Unrelated updates/deletions of old bad references must remain possible.
  -- Any newly assigned reference or ownership change is checked uniformly.
  if TG_OP='UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'workspace_owner_immutable' using errcode='23514';
  end if;
  if TG_TABLE_NAME in ('projects','contracts','expenses') then
    reference_id := coalesce(nullif(data->>'client_id',''),nullif(data->>'vendor_id',''))::uuid;
    if reference_id is not null and (TG_OP='INSERT' or
      (data->>'client_id') is distinct from (to_jsonb(old)->>'client_id') or
      (data->>'vendor_id') is distinct from (to_jsonb(old)->>'vendor_id')) then
      if not exists(select 1 from public.contacts where id=reference_id and user_id=new.user_id) then
        raise exception 'invalid_workspace_reference' using errcode='23514';
      end if;
    end if;
  end if;
  if TG_TABLE_NAME='stock_items' then
    reference_id := nullif(data->>'assigned_project_id','')::uuid;
    if reference_id is not null and (TG_OP='INSERT' or new.assigned_project_id is distinct from old.assigned_project_id) then
      if not exists(select 1 from public.projects where id=reference_id and user_id=new.user_id) then
        raise exception 'invalid_workspace_reference' using errcode='23514';
      end if;
    end if;
  end if;
  if TG_TABLE_NAME='projects' then
    if TG_OP='INSERT' or new.equipment_ids is distinct from old.equipment_ids then
    equipment := new.equipment_ids;
    if exists(select 1 from unnest(equipment) as u(equipment_id) where not exists(
      select 1 from public.stock_items s where s.id=u.equipment_id and s.user_id=new.user_id)) then
      raise exception 'invalid_workspace_reference' using errcode='23514';
    end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workspace_references() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['projects','contracts','expenses','stock_items'] loop
    execute format('drop trigger if exists guard_workspace_references on public.%I',t);
    execute format('create trigger guard_workspace_references before insert or update on public.%I for each row execute function public.guard_workspace_references()',t);
  end loop;
end $$;

-- Require signed JWT AAL2, not a client-supplied flag, before granting/revoking
-- platform/content administrator access. Preserve last-admin protection + audit.
create or replace function public.set_platform_admin(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.activation_admin_mfa() then raise exception 'platform_admin_mfa_required' using errcode='42501'; end if;
  if p_user_id is null or p_enabled is null then raise exception 'user_id_and_enabled_are_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(724613032);
  if p_enabled then
    insert into public.platform_admins(user_id) values(p_user_id) on conflict(user_id) do nothing;
  else
    if not exists(select 1 from public.platform_admins where user_id=p_user_id) then return; end if;
    if (select count(*) from public.platform_admins)<=1 then raise exception 'cannot_remove_last_platform_admin' using errcode='23514'; end if;
    delete from public.platform_admins where user_id=p_user_id;
  end if;
end;
$$;
create or replace function public.set_content_admin(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.activation_admin_mfa() then raise exception 'platform_admin_mfa_required' using errcode='42501'; end if;
  if p_user_id is null or p_enabled is null then raise exception 'user_id_and_enabled_are_required' using errcode='22023'; end if;
  update public.profiles set is_admin=p_enabled where id=p_user_id;
  if not found then raise exception 'profile_not_found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.set_platform_admin(uuid,boolean), public.set_content_admin(uuid,boolean) from public, anon;
grant execute on function public.set_platform_admin(uuid,boolean), public.set_content_admin(uuid,boolean) to authenticated;

-- An AAL1 operator must not bypass MFA-protected activation keys by editing
-- account_subscriptions directly. Restrictive policies compose with (rather
-- than replace) the existing platform-admin policies. Reads are unchanged;
-- trusted SECURITY DEFINER redemption/auth triggers continue to work.
do $$ declare t text; begin
  foreach t in array array['plan_catalog','account_subscriptions','usage_monthly','purchase_requests'] loop
    if t <> 'purchase_requests' then
      execute format('drop policy if exists billing_mfa_insert on public.%I',t);
      execute format('create policy billing_mfa_insert on public.%I as restrictive for insert to authenticated with check (public.activation_admin_mfa())',t);
    end if;
    execute format('drop policy if exists billing_mfa_update on public.%I',t);
    execute format('create policy billing_mfa_update on public.%I as restrictive for update to authenticated using (true) with check (public.activation_admin_mfa())',t);
    execute format('drop policy if exists billing_mfa_delete on public.%I',t);
    execute format('create policy billing_mfa_delete on public.%I as restrictive for delete to authenticated using (public.activation_admin_mfa())',t);
  end loop;
end $$;

-- Trigger functions run by attached triggers, never through client RPC calls.
-- No blanket revocation of normal helper RPCs: RLS depends on their grants.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
  end loop;
end $$;
commit;
