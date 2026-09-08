-- Fatorati / Supabase database schema
-- Paste this file into Supabase Dashboard -> SQL Editor -> New query.
-- This creates the structure only. The current frontend still uses its local Zustand store.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('owner', 'accountant', 'supervisor', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_type as enum ('client', 'supplier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum ('planning', 'active', 'on_hold', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('transfer', 'check', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_status as enum ('pending', 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_type as enum ('material', 'equipment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_type as enum ('construction', 'service', 'rental');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum ('draft', 'sent', 'signed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.calendar_event_type as enum ('renew', 'pay', 'legal');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role public.app_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company text not null default '',
  ice text not null default '',
  tax_id text not null default '',
  rc text not null default '',
  address text not null default '',
  city text not null default '',
  currency text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  tax_rate numeric(5, 2) not null default 20 check (tax_rate >= 0 and tax_rate <= 100),
  logo text,
  header_note text not null default '',
  footer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.contact_type not null,
  name text not null,
  ice text not null default '',
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_id uuid references public.contacts(id) on delete set null,
  budget numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  status public.project_status not null default 'planning',
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date,
  end_date date,
  milestones jsonb not null default '[]'::jsonb,
  equipment_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null default current_date,
  vendor_id uuid references public.contacts(id) on delete set null,
  category text not null default '',
  method public.payment_method not null default 'transfer',
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  status public.expense_status not null default 'pending',
  receipt boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text not null default '',
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  min_quantity numeric(14, 3) not null default 0 check (min_quantity >= 0),
  unit text not null default 'unit',
  assigned_project_id uuid references public.projects(id) on delete set null,
  type public.stock_type not null default 'material',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.contract_type not null,
  title text not null,
  client_id uuid references public.contacts(id) on delete set null,
  value numeric(14, 2) not null default 0 check (value >= 0),
  contract_date date not null default current_date,
  status public.contract_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  member_auth_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role public.app_role not null default 'assistant',
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null default '',
  action text not null default '',
  target text not null default '',
  module text not null default '',
  severity public.audit_severity not null default 'info',
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_cost numeric(14, 2) not null default 0 check (monthly_cost >= 0),
  start_date date,
  expiry_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  type public.calendar_event_type not null,
  label text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists expenses_user_date_idx on public.expenses(user_id, expense_date desc);
create index if not exists stock_items_user_id_idx on public.stock_items(user_id);
create index if not exists contracts_user_date_idx on public.contracts(user_id, contract_date desc);
create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists audit_events_user_created_idx on public.audit_events(user_id, created_at desc);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles', 'company_settings', 'contacts', 'projects', 'expenses', 'stock_items', 'contracts', 'team_members', 'subscriptions', 'calendar_events'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('owner', 'accountant', 'supervisor', 'assistant')
        then (new.raw_user_meta_data ->> 'role')::public.app_role
      else 'owner'::public.app_role
    end
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.company_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_items enable row level security;
alter table public.contracts enable row level security;
alter table public.team_members enable row level security;
alter table public.audit_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.calendar_events enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['company_settings', 'contacts', 'projects', 'expenses', 'stock_items', 'contracts', 'team_members', 'audit_events', 'subscriptions', 'calendar_events'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', table_name || '_delete_own', table_name);
  end loop;
end $$;

-- profiles uses id instead of user_id, so replace the generated policies.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles for delete to authenticated using (id = auth.uid());

-- Keep audit rows append-only for normal users.
drop policy if exists audit_events_update_own on public.audit_events;
drop policy if exists audit_events_delete_own on public.audit_events;

-- Optional grants for Supabase client roles.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- SaaS control layer: plans, quotas, billing requests, and platform admins.
-- These tables let you cap resource usage before traffic can affect availability.

do $$ begin
  create type public.subscription_plan as enum ('starter', 'pro', 'business', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.purchase_request_status as enum ('new', 'contacted', 'paid', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.plan_catalog (
  code public.subscription_plan primary key,
  name text not null,
  monthly_price numeric(14, 2) not null default 0 check (monthly_price >= 0),
  max_users integer not null check (max_users > 0),
  max_contacts integer not null check (max_contacts > 0),
  max_projects integer not null check (max_projects > 0),
  max_storage_mb integer not null check (max_storage_mb > 0),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_catalog (code, name, monthly_price, max_users, max_contacts, max_projects, max_storage_mb, features)
values
  ('starter', 'Starter', 0, 1, 100, 10, 250, '{"reports": false, "audit": false}'::jsonb),
  ('pro', 'Pro', 199, 5, 1000, 100, 2048, '{"reports": true, "audit": true}'::jsonb),
  ('business', 'Business', 499, 20, 5000, 500, 10240, '{"reports": true, "audit": true, "priority_support": true}'::jsonb),
  ('enterprise', 'Enterprise', 0, 1000, 100000, 10000, 102400, '{"reports": true, "audit": true, "priority_support": true, "custom_limits": true}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  max_users = excluded.max_users,
  max_contacts = excluded.max_contacts,
  max_projects = excluded.max_projects,
  max_storage_mb = excluded.max_storage_mb,
  features = excluded.features;

create table if not exists public.account_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'starter' references public.plan_catalog(code),
  status public.subscription_status not null default 'trialing',
  seats integer not null default 1 check (seats > 0),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  active_users integer not null default 0 check (active_users >= 0),
  contacts_count integer not null default 0 check (contacts_count >= 0),
  projects_count integer not null default 0 check (projects_count >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  api_requests bigint not null default 0 check (api_requests >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  plan public.subscription_plan not null,
  company text not null default '',
  seats integer not null default 1 check (seats > 0),
  message text not null default '',
  status public.purchase_request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.account_subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.ensure_account_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_subscription_created
after insert on auth.users
for each row execute function public.ensure_account_subscription();

alter table public.plan_catalog enable row level security;
alter table public.account_subscriptions enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists plan_catalog_public_read on public.plan_catalog;
create policy plan_catalog_public_read on public.plan_catalog
for select to anon, authenticated using (active = true or public.is_platform_admin());

drop policy if exists account_subscriptions_owner_read on public.account_subscriptions;
drop policy if exists account_subscriptions_admin_all on public.account_subscriptions;
create policy account_subscriptions_owner_read on public.account_subscriptions
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy account_subscriptions_admin_all on public.account_subscriptions
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists usage_monthly_owner_read on public.usage_monthly;
drop policy if exists usage_monthly_admin_all on public.usage_monthly;
create policy usage_monthly_owner_read on public.usage_monthly
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy usage_monthly_admin_all on public.usage_monthly
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists purchase_requests_public_insert on public.purchase_requests;
drop policy if exists purchase_requests_owner_read on public.purchase_requests;
drop policy if exists purchase_requests_admin_all on public.purchase_requests;
create policy purchase_requests_public_insert on public.purchase_requests
for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy purchase_requests_owner_read on public.purchase_requests
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy purchase_requests_admin_all on public.purchase_requests
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists platform_admins_self_read on public.platform_admins;
drop policy if exists platform_admins_admin_all on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy platform_admins_admin_all on public.platform_admins
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select on public.plan_catalog to anon, authenticated;
grant select on public.account_subscriptions, public.usage_monthly to authenticated;
grant insert on public.purchase_requests to anon, authenticated;

create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_plan public.subscription_plan;
  allowed integer;
  used integer;
begin
  select coalesce(s.plan, 'starter'::public.subscription_plan)
    into account_plan
    from public.account_subscriptions s
   where s.user_id = new.user_id
     and s.status in ('trialing', 'active');

  if account_plan is null then account_plan := 'starter'; end if;

  if tg_table_name = 'contacts' then
    select max_contacts into allowed from public.plan_catalog where code = account_plan;
    select count(*) into used from public.contacts where user_id = new.user_id;
  elsif tg_table_name = 'projects' then
    select max_projects into allowed from public.plan_catalog where code = account_plan;
    select count(*) into used from public.projects where user_id = new.user_id;
  elsif tg_table_name = 'team_members' then
    select max_users into allowed from public.plan_catalog where code = account_plan;
    select count(*) into used from public.team_members where user_id = new.user_id and active;
  else
    return new;
  end if;

  if used >= allowed then
    raise exception 'plan_limit_reached: % allows % records for %', account_plan, allowed, tg_table_name
      using errcode = 'check_violation', hint = 'Upgrade the account plan or remove unused records.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_contacts_plan_limit on public.contacts;
create trigger enforce_contacts_plan_limit before insert on public.contacts
for each row execute function public.enforce_plan_limit();

drop trigger if exists enforce_projects_plan_limit on public.projects;
create trigger enforce_projects_plan_limit before insert on public.projects
for each row execute function public.enforce_plan_limit();

drop trigger if exists enforce_team_members_plan_limit on public.team_members;
create trigger enforce_team_members_plan_limit before insert on public.team_members
for each row execute function public.enforce_plan_limit();

-- Bootstrap the first CMS/platform administrator after creating their Auth user:
-- insert into public.platform_admins (user_id)
-- select id from auth.users where email = 'admin@fatorati.tech'
-- on conflict do nothing;
