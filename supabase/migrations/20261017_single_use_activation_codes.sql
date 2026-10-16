-- Server-authoritative, single-use plan keys. The browser only receives a
-- random bearer key; the database stores its SHA-256 digest, and redemption is
-- serialized under a row lock so two accounts cannot redeem the same key.
create extension if not exists pgcrypto;
-- PostgreSQL needs this enum change committed before the new value is used.
alter type public.subscription_plan add value if not exists 'boost';
begin;

insert into public.plan_catalog(code,name,monthly_price,max_users,max_contacts,max_projects,max_storage_mb,features)
values ('boost','BOOST',499,20,5000,500,10240,'{"reports":true,"audit":true,"priority_support":true}'::jsonb)
on conflict (code) do nothing;

create table if not exists public.activation_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  plan text not null check (plan in ('pro', 'boost')),
  period text not null check (period in ('1M', '1Y')),
  status text not null default 'unused' check (status in ('unused', 'redeemed', 'revoked')),
  issued_to text not null default '',
  issued_by uuid not null references auth.users(id),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  constraint activation_key_redemption_consistency check (
    (status = 'unused' and redeemed_by is null and redeemed_at is null)
    or (status = 'redeemed' and redeemed_by is not null and redeemed_at is not null)
    or status = 'revoked'
  )
);

alter table public.activation_keys enable row level security;
drop policy if exists activation_keys_admin_read on public.activation_keys;
create policy activation_keys_admin_read on public.activation_keys
  for select to authenticated using (public.is_platform_admin());
drop policy if exists activation_keys_admin_insert on public.activation_keys;
create policy activation_keys_admin_insert on public.activation_keys
  for insert to authenticated with check (public.is_platform_admin() and issued_by = auth.uid());
drop policy if exists activation_keys_admin_update on public.activation_keys;
create policy activation_keys_admin_update on public.activation_keys
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.activation_keys from anon, public;
grant select, insert, update on public.activation_keys to authenticated;

create or replace function public.redeem_activation_key(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_key public.activation_keys%rowtype;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_start date := v_today;
  v_end date;
  v_current_plan text;
  v_current_end timestamptz;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if p_key is null or length(p_key) > 100 then raise exception 'invalid_activation_key' using errcode = '22023'; end if;

  select * into v_key from public.activation_keys
    where key_hash = encode(digest(upper(regexp_replace(trim(p_key), '[[:space:]._-]', '', 'g')), 'sha256'), 'hex')
    for update;
  if not found then raise exception 'invalid_activation_key' using errcode = '22023'; end if;
  if v_key.status = 'revoked' then raise exception 'activation_key_revoked' using errcode = '22023'; end if;
  if v_key.status = 'redeemed' then
    if v_key.redeemed_by = v_user then raise exception 'activation_key_already_used_by_this_account' using errcode = '22023';
    else raise exception 'activation_key_already_used' using errcode = '22023'; end if;
  end if;

  select plan::text, current_period_end into v_current_plan, v_current_end
    from public.account_subscriptions where user_id = v_user for update;
  if v_current_plan = v_key.plan and v_current_end is not null
    and v_current_end > now() then
    v_start := greatest(v_today, (v_current_end at time zone 'Africa/Casablanca')::date);
  end if;
  v_end := case when v_key.period = '1Y' then (v_start + interval '1 year')::date else (v_start + interval '1 month')::date end;
  update public.activation_keys set status = 'redeemed', redeemed_by = v_user,
    redeemed_at = now(), starts_at = v_start, ends_at = v_end where id = v_key.id;
  insert into public.account_subscriptions(user_id, plan, status, current_period_end, updated_at)
  values (v_user, v_key.plan::public.subscription_plan, 'active', (v_end + 1)::timestamp at time zone 'Africa/Casablanca', now())
  on conflict (user_id) do update set plan = excluded.plan, status = 'active',
    current_period_end = excluded.current_period_end, updated_at = now();

  return jsonb_build_object('ok', true, 'plan', v_key.plan, 'period', v_key.period,
    'started_at', v_today, 'ends_at', v_end, 'serial', v_key.id);
end;
$$;
revoke all on function public.redeem_activation_key(text) from public, anon;
grant execute on function public.redeem_activation_key(text) to authenticated;

commit;
