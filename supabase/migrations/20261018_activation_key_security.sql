-- Phase 2 of the single-use activation-key rollout. Apply this only after
-- 20261017_single_use_activation_codes.sql has completed and committed.
-- The enum label 'boost' is first used here, in a later transaction.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    JOIN pg_enum AS e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'subscription_plan'
      AND e.enumlabel = 'boost'
  ) THEN
    RAISE EXCEPTION 'Missing subscription_plan enum value boost. Apply and commit 20261017_single_use_activation_codes.sql first.';
  END IF;
END;
$$;

INSERT INTO public.plan_catalog(code, name, monthly_price, max_users, max_contacts, max_projects, max_storage_mb, features)
VALUES ('boost', 'BOOST', 499, 20, 5000, 500, 10240, '{"reports":true,"audit":true,"priority_support":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Create the base ledger here so this migration also repairs installations
-- where the earlier version of migration 20261017 rolled back before creating it.
CREATE TABLE IF NOT EXISTS public.activation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  plan text NOT NULL CHECK (plan IN ('pro', 'boost')),
  period text NOT NULL CHECK (period IN ('1M', '1Y')),
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'redeemed', 'revoked')),
  issued_to text NOT NULL DEFAULT '',
  issued_by uuid NOT NULL REFERENCES auth.users(id),
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  starts_at date,
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_key_redemption_consistency CHECK (
    (status = 'unused' AND redeemed_by IS NULL AND redeemed_at IS NULL)
    OR (status = 'redeemed' AND redeemed_by IS NOT NULL AND redeemed_at IS NOT NULL)
    OR status = 'revoked'
  )
);
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activation_keys FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.activation_keys TO authenticated;

-- Harden activation-key operations: platform-admin MFA gates, audit trail,
-- generic failures, and short-window account/source rate limits.

CREATE TABLE IF NOT EXISTS public.activation_key_attempt_limits (
  scope text not null check (scope in ('account', 'source')),
  scope_hash text not null check (char_length(scope_hash) between 1 and 128),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, scope_hash)
);
alter table public.activation_key_attempt_limits enable row level security;
revoke all on public.activation_key_attempt_limits from public, anon, authenticated;

create or replace function public.activation_admin_mfa()
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select public.is_platform_admin() and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.activation_admin_mfa() from public, anon;
grant execute on function public.activation_admin_mfa() to authenticated;

drop policy if exists activation_keys_admin_read on public.activation_keys;
create policy activation_keys_admin_read on public.activation_keys
  for select to authenticated using (public.activation_admin_mfa());
drop policy if exists activation_keys_admin_insert on public.activation_keys;
create policy activation_keys_admin_insert on public.activation_keys
  for insert to authenticated with check (public.activation_admin_mfa() and issued_by = auth.uid());
drop policy if exists activation_keys_admin_update on public.activation_keys;
create policy activation_keys_admin_update on public.activation_keys
  for update to authenticated using (public.activation_admin_mfa()) with check (public.activation_admin_mfa());

create or replace function public.issue_activation_key(
  p_key_hash text, p_plan text, p_period text, p_issued_to text default ''
) returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.activation_admin_mfa() then
    raise exception 'platform_admin_mfa_required' using errcode = '42501';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_plan not in ('pro','boost')
    or p_period not in ('1M','1Y') or char_length(coalesce(p_issued_to,'')) > 240 then
    raise exception 'invalid_activation_key_request' using errcode = '22023';
  end if;
  insert into public.activation_keys(key_hash,plan,period,issued_to,issued_by)
  values (p_key_hash,p_plan,p_period,coalesce(p_issued_to,''),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.issue_activation_key(text,text,text,text) from public, anon;
grant execute on function public.issue_activation_key(text,text,text,text) to authenticated;

create or replace function public.audit_activation_key_change()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare v_actor uuid := auth.uid(); v_action text;
begin
  if v_actor is null then
    if tg_op = 'INSERT' then v_actor := new.issued_by; else v_actor := coalesce(new.redeemed_by, old.redeemed_by, new.issued_by); end if;
  end if;
  if tg_op = 'INSERT' then v_action := 'activation_key_issued';
  elsif old.status is distinct from new.status and new.status = 'redeemed' then v_action := 'activation_key_redeemed';
  elsif old.status is distinct from new.status and new.status = 'revoked' then v_action := 'activation_key_revoked';
  else return new; end if;
  insert into public.admin_audit_events(actor_id,action,target,details)
  values (v_actor,v_action,new.id::text,jsonb_build_object('plan',new.plan,'period',new.period,'status',new.status,'redeemed_by',new.redeemed_by));
  return new;
end;
$$;
drop trigger if exists activation_key_audit on public.activation_keys;
create trigger activation_key_audit after insert or update on public.activation_keys
for each row execute function public.audit_activation_key_change();

create or replace function public.audit_account_plan_change()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare v_actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and (old.plan is distinct from new.plan or old.status is distinct from new.status or old.current_period_end is distinct from new.current_period_end) then
    if v_actor is not null then
      insert into public.admin_audit_events(actor_id,action,target,details)
      values (v_actor,'account_plan_changed',new.user_id::text,jsonb_build_object(
        'from_plan',old.plan,'to_plan',new.plan,'from_status',old.status,'to_status',new.status,
        'current_period_end',new.current_period_end));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists account_plan_audit on public.account_subscriptions;
create trigger account_plan_audit after update on public.account_subscriptions
for each row execute function public.audit_account_plan_change();

create or replace function public.redeem_activation_key(p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions, auth
as $$
declare
  v_user uuid := auth.uid();
  v_key public.activation_keys%rowtype;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_start date := (now() at time zone 'Africa/Casablanca')::date;
  v_end date;
  v_current_plan text;
  v_current_end timestamptz;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
  v_ip text;
  v_source_hash text;
  v_bucket timestamptz := date_trunc('minute',now()) - (extract(minute from now())::integer % 15) * interval '1 minute';
  v_account_attempts integer;
  v_source_attempts integer;
  v_account_hash text;
begin
  if v_user is null then return jsonb_build_object('ok',false); end if;
  -- Use only a short-lived digest of the gateway-provided client address. Never
  -- persist the raw address or the submitted activation key.
  v_ip := coalesce(v_headers->>'cf-connecting-ip',split_part(coalesce(v_headers->>'x-forwarded-for','unknown'),',',1),'unknown');
  v_source_hash := encode(digest(trim(v_ip)||':'||to_char(v_bucket,'YYYYMMDDHH24MI'),'sha256'),'hex');
  v_account_hash := v_user::text;

  delete from public.activation_key_attempt_limits where updated_at < now() - interval '1 day';
  insert into public.activation_key_attempt_limits(scope,scope_hash,window_started_at,attempts,updated_at)
  values ('account',v_account_hash,now(),1,now())
  on conflict (scope,scope_hash) do update set
    attempts = case when public.activation_key_attempt_limits.window_started_at <= now()-interval '15 minutes' then 1 else public.activation_key_attempt_limits.attempts+1 end,
    window_started_at = case when public.activation_key_attempt_limits.window_started_at <= now()-interval '15 minutes' then now() else public.activation_key_attempt_limits.window_started_at end,
    updated_at = now()
  returning attempts into v_account_attempts;
  insert into public.activation_key_attempt_limits(scope,scope_hash,window_started_at,attempts,updated_at)
  values ('source',v_source_hash,now(),1,now())
  on conflict (scope,scope_hash) do update set attempts = public.activation_key_attempt_limits.attempts+1, updated_at=now()
  returning attempts into v_source_attempts;

  if v_account_attempts >= 8 or v_source_attempts >= 20 then
    if v_account_attempts = 8 or v_source_attempts = 20 then
      insert into public.admin_audit_events(actor_id,action,target,details)
      values (v_user,'activation_key_attempt_threshold',v_user::text,jsonb_build_object('account_attempts',v_account_attempts,'source_attempts',v_source_attempts));
      insert into public.system_notifications(severity,title,message,created_by)
      values ('warning','Repeated activation-code failures','An account or source reached the activation-code failure threshold. Review the platform audit log.',v_user);
    end if;
    return jsonb_build_object('ok',false);
  end if;
  if p_key is null or length(p_key) > 100 then return jsonb_build_object('ok',false); end if;

  select * into v_key from public.activation_keys
    where key_hash = encode(digest(upper(regexp_replace(trim(p_key), '[[:space:]._-]', '', 'g')), 'sha256'), 'hex')
    for update;
  if not found or v_key.status <> 'unused' then return jsonb_build_object('ok',false); end if;

  select plan::text,current_period_end into v_current_plan,v_current_end
    from public.account_subscriptions where user_id=v_user for update;
  if v_current_plan=v_key.plan and v_current_end is not null and v_current_end>now() then
    v_start := greatest(v_today,(v_current_end at time zone 'Africa/Casablanca')::date);
  end if;
  v_end := case when v_key.period='1Y' then (v_start+interval '1 year')::date else (v_start+interval '1 month')::date end;
  update public.activation_keys set status='redeemed',redeemed_by=v_user,redeemed_at=now(),starts_at=v_start,ends_at=v_end where id=v_key.id;
  insert into public.account_subscriptions(user_id,plan,status,current_period_end,updated_at)
  values (v_user,v_key.plan::public.subscription_plan,'active',(v_end+1)::timestamp at time zone 'Africa/Casablanca',now())
  on conflict (user_id) do update set plan=excluded.plan,status='active',current_period_end=excluded.current_period_end,updated_at=now();
  return jsonb_build_object('ok',true,'plan',v_key.plan,'period',v_key.period,'started_at',v_start,'ends_at',v_end,'serial',v_key.id);
end;
$$;
revoke all on function public.redeem_activation_key(text) from public, anon;
grant execute on function public.redeem_activation_key(text) to authenticated;
