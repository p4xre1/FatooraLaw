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
    -- A self-created account owns its own workspace. Team roles must be
    -- assigned by a trusted server, never copied from editable user metadata.
    'owner'::public.app_role
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
  create type public.subscription_plan as enum ('starter', 'pro', 'business', 'enterprise', 'boost');
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
-- select id from auth.users where email = 'contact@fatorati.tech'
-- on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CMS: public content module (blog / legal-article posts)
-- `profiles.is_admin` is the content-editor role. The later site-operations
-- migration also lets a platform operator edit shared site/blog content, while
-- keeping platform-only controls (billing, analytics, support and backups)
-- out of the content-admin role. Tenant `app_role` values remain unrelated.

-- Restrict profile writes before exposing the admin-flag check.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

revoke insert, update, delete on public.profiles from public, anon, authenticated;
-- Clear pre-existing column grants too (revoking a table grant alone does
-- not revoke column-level privileges from an older/custom installation).
do $$ declare columns text; begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into columns
    from pg_attribute
   where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s) on public.profiles from public, anon, authenticated', columns, columns);
end $$;

grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
-- Existing profiles_select_own / profiles_update_own policies still restrict
-- reads and permitted name updates to auth.uid(). Admin flags/roles/email
-- remain writable only by trusted SQL operators / the service role.

-- security definer so this can be called from another table's RLS policy
-- without that policy needing its own read access to `profiles` — same
-- pattern already used by `is_platform_admin()` above. `set search_path`
-- pins name resolution and blocks a search_path-hijacking attack against
-- a security definer function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  content text not null default '' check (char_length(content) <= 200000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_slug_unique unique (slug)
);

create index if not exists posts_published_created_idx on public.posts (published, created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

-- Public (including signed-out) visitors only ever see published posts.
-- This policy applies to `anon` too, so a public marketing page can read
-- posts directly with the anon key — no separate "public API" needed.
drop policy if exists posts_public_read_published on public.posts;
create policy posts_public_read_published on public.posts
for select to anon, authenticated
using (published = true);

-- Admins can additionally read drafts. Postgres OR's multiple permissive
-- policies for the same command together, so an admin matches this policy
-- in addition to the one above, on top of whatever `published` already
-- allows.
drop policy if exists posts_admin_read_all on public.posts;
create policy posts_admin_read_all on public.posts
for select to authenticated
using (public.is_admin());

-- Only admins may create, edit, or delete posts. `with check` re-validates
-- is_admin() against every row an insert/update would produce, so this
-- can't be bypassed by a request that only satisfies the `using` clause.
drop policy if exists posts_admin_insert on public.posts;
create policy posts_admin_insert on public.posts
for insert to authenticated
with check (public.is_admin() and user_id = auth.uid());

drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts
for delete to authenticated
using (public.is_admin());

-- Table-level grants are necessary (not redundant with the earlier
-- `grant ... on all tables in schema public to authenticated`), because
-- that statement only covers tables that already existed at the point in
-- this script where it ran — `posts` is created below it. Every other
-- table added after that point (plan_catalog, purchase_requests, etc.)
-- follows the same explicit-grant pattern for the same reason.
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

-- Bootstrap the first CMS content admin after they've created a normal
-- Auth account (sign up once through the app, then run this):
-- update public.profiles set is_admin = true where email = 'editor@fatorati.tech';

-- ---------------------------------------------------------------------------
-- Onboarding: one-time "welcome" questionnaire
--
-- Shown the first time a user reaches the dashboard after creating an
-- account. Three questions: where they heard about Fatorati, what kind
-- of activity they run, and whether they want update notifications.
--
-- Deliberately NOT auto-created by `handle_new_user()` the way `profiles`
-- and `company_settings` are: the presence of a row here is itself the
-- "has this user been onboarded?" flag the frontend checks on sign-in.
-- An auto-inserted default row would defeat that — there would be no way
-- to tell "answered" apart from "never asked".

do $$ begin
  create type public.referral_source as enum (
    'google_search',
    'social_media',
    'word_of_mouth',
    'online_ad',
    'blog_article',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.business_profile as enum (
    'small_company',
    'self_employed',
    'professional',
    'tradesperson',
    'individual'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.onboarding_responses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_source public.referral_source not null,
  referral_source_other text not null default '' check (char_length(referral_source_other) <= 200),
  business_profile public.business_profile not null,
  wants_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_onboarding_responses_updated_at on public.onboarding_responses;
create trigger set_onboarding_responses_updated_at
before update on public.onboarding_responses
for each row execute function public.set_updated_at();

alter table public.onboarding_responses enable row level security;

drop policy if exists onboarding_responses_select_own on public.onboarding_responses;
drop policy if exists onboarding_responses_insert_own on public.onboarding_responses;
drop policy if exists onboarding_responses_update_own on public.onboarding_responses;
drop policy if exists onboarding_responses_delete_own on public.onboarding_responses;
create policy onboarding_responses_select_own on public.onboarding_responses
for select to authenticated using (user_id = auth.uid());
create policy onboarding_responses_insert_own on public.onboarding_responses
for insert to authenticated with check (user_id = auth.uid());
create policy onboarding_responses_update_own on public.onboarding_responses
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onboarding_responses_delete_own on public.onboarding_responses
for delete to authenticated using (user_id = auth.uid());

-- Explicit grant needed: this table is created after the schema's initial
-- blanket `grant ... on all tables in schema public to authenticated`,
-- which only covers tables that already existed at that point — same
-- reasoning as `posts` and the SaaS-control-layer tables above it.
grant select, insert, update, delete on public.onboarding_responses to authenticated;


-- CMS platform control center migration 20261013 (kept in sync with migrations for full-schema setup).
-- CMS control center: localized publishing, subscriptions, privacy-first visits,
-- security audit, operator notifications, and settings used by the publish/tracking rules.

begin;

-- Keep the workspace's existing `public.subscriptions` table for recurring
-- business tools untouched. These separate rows represent Fatorati accounts'
-- platform plans. On installations that already ran schema.sql, every CREATE
-- below is a no-op; on a core-only schema, this supplies the control layer.
do $$ begin
  create type public.subscription_plan as enum ('starter', 'pro', 'business', 'enterprise', 'boost');
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
  monthly_price numeric(14,2) not null default 0 check (monthly_price >= 0),
  max_users integer not null check (max_users > 0),
  max_contacts integer not null check (max_contacts > 0),
  max_projects integer not null check (max_projects > 0),
  max_storage_mb integer not null check (max_storage_mb > 0),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.plan_catalog(code,name,monthly_price,max_users,max_contacts,max_projects,max_storage_mb,features)
values
  ('starter','Starter',0,1,100,10,250,'{"reports":false,"audit":false}'::jsonb),
  ('pro','Pro',199,5,1000,100,2048,'{"reports":true,"audit":true}'::jsonb),
  ('business','Business',499,20,5000,500,10240,'{"reports":true,"audit":true,"priority_support":true}'::jsonb),
  ('enterprise','Enterprise',0,1000,100000,10000,102400,'{"reports":true,"audit":true,"priority_support":true,"custom_limits":true}'::jsonb),
  ('boost','BOOST',499,20,5000,500,10240,'{"reports":true,"audit":true,"priority_support":true}'::jsonb)
on conflict (code) do nothing;

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

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()); $$;
create or replace function public.ensure_account_subscription()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.account_subscriptions(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
insert into public.account_subscriptions(user_id) select id from auth.users on conflict (user_id) do nothing;
drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_subscription_created after insert on auth.users
for each row execute function public.ensure_account_subscription();

do $$ begin
  alter table public.plan_catalog enable row level security;
  alter table public.account_subscriptions enable row level security;
  alter table public.usage_monthly enable row level security;
  alter table public.purchase_requests enable row level security;
  alter table public.platform_admins enable row level security;
end $$;
drop policy if exists plan_catalog_public_read on public.plan_catalog;
create policy plan_catalog_public_read on public.plan_catalog for select to anon, authenticated using (active or public.is_platform_admin());
drop policy if exists plan_catalog_platform_admin_all on public.plan_catalog;
create policy plan_catalog_platform_admin_all on public.plan_catalog for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists account_subscriptions_owner_read on public.account_subscriptions;
create policy account_subscriptions_owner_read on public.account_subscriptions for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists account_subscriptions_admin_all on public.account_subscriptions;
create policy account_subscriptions_admin_all on public.account_subscriptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists usage_monthly_owner_read on public.usage_monthly;
create policy usage_monthly_owner_read on public.usage_monthly for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists usage_monthly_admin_all on public.usage_monthly;
create policy usage_monthly_admin_all on public.usage_monthly for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists purchase_requests_public_insert on public.purchase_requests;
create policy purchase_requests_public_insert on public.purchase_requests for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
drop policy if exists purchase_requests_owner_read on public.purchase_requests;
create policy purchase_requests_owner_read on public.purchase_requests for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists purchase_requests_admin_all on public.purchase_requests;
create policy purchase_requests_admin_all on public.purchase_requests for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists platform_admins_admin_all on public.platform_admins;
create policy platform_admins_admin_all on public.platform_admins for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select on public.plan_catalog to anon, authenticated;
grant select, insert, update, delete on public.plan_catalog, public.account_subscriptions, public.usage_monthly, public.purchase_requests, public.platform_admins to authenticated;
grant insert on public.purchase_requests to anon;

-- Multilingual SEO fields. The original columns remain the French canonical copy.
alter table public.posts
  add column if not exists excerpt text not null default '',
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists author_name text not null default 'Fatorati',
  add column if not exists published_at timestamptz;

-- Editorial section (one per post, shared by translations) + cover image.
-- Keys are URL segments under /blog/ (see src/lib/routes.ts BLOG_CATEGORIES).
alter table public.posts
  add column if not exists category text not null default 'articles'
    check (category in ('tips', 'news', 'articles', 'products', 'guides')),
  add column if not exists image_url text not null default ''
    check (char_length(image_url) <= 1000),
  add column if not exists image_alt text not null default ''
    check (char_length(image_alt) <= 300);

create index if not exists posts_category_idx on public.posts (category, published, published_at desc);

grant select (category, image_url, image_alt) on public.posts to anon, authenticated;
grant update (category, image_url, image_alt) on public.posts to authenticated;

-- Cover-image uploads: one public bucket, CMS admins only may write. The
-- storage schema exists in Supabase but not in embedded Postgres sandboxes,
-- so the whole block is skipped where it cannot apply.
do $$
begin
  if to_regnamespace('storage') is not null then
    insert into storage.buckets (id, name, public)
    values ('blog-media', 'blog-media', true)
    on conflict (id) do nothing;

    drop policy if exists blog_media_public_read on storage.objects;
    create policy blog_media_public_read on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'blog-media');

    drop policy if exists blog_media_admin_write on storage.objects;
    create policy blog_media_admin_write on storage.objects
    for insert to authenticated
    with check (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()));

    drop policy if exists blog_media_admin_update on storage.objects;
    create policy blog_media_admin_update on storage.objects
    for update to authenticated
    using (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()))
    with check (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()));
  end if;
end
$$;

update public.posts set published_at = created_at where published and published_at is null;

create table if not exists public.post_translations (
  post_id uuid not null references public.posts(id) on delete cascade,
  locale text not null check (locale in ('ar', 'en')),
  title text not null default '' check (char_length(title) <= 200),
  slug text not null default '' check (slug = '' or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200)),
  content text not null default '' check (char_length(content) <= 200000),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  seo_title text not null default '' check (char_length(seo_title) <= 80),
  seo_description text not null default '' check (char_length(seo_description) <= 320),
  keywords text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (post_id, locale)
);

create unique index if not exists post_translations_locale_slug_unique on public.post_translations(locale, slug) where slug <> '';
create index if not exists post_translations_slug_idx on public.post_translations(locale, slug);
drop trigger if exists set_post_translations_updated_at on public.post_translations;
create trigger set_post_translations_updated_at
before update on public.post_translations
for each row execute function public.set_updated_at();

-- Runtime controls are deliberately narrow: consent-gated visit measurement
-- and publication checks actually consume these switches.
create table if not exists public.platform_settings (
  singleton boolean primary key default true check (singleton),
  tracking_enabled boolean not null default true,
  require_translations boolean not null default true,
  require_seo_metadata boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(singleton) values (true)
on conflict (singleton) do nothing;
create or replace function public.visit_tracking_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select tracking_enabled from public.platform_settings where singleton = true), false);
$$;
revoke all on function public.visit_tracking_is_enabled() from public;
grant execute on function public.visit_tracking_is_enabled() to anon, authenticated;

create or replace function public.record_site_page_view(p_path text, p_locale text, p_referrer_host text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select tracking_enabled from public.platform_settings where singleton = true), false) then
    return false;
  end if;
  if p_path is null or char_length(p_path) < 1 or char_length(p_path) > 240 or p_path not like '/%' or p_path ~ '[?#]' or p_path ~ '^/admin(/|$)' then
    raise exception 'invalid_page_view_path' using errcode = 'check_violation';
  end if;
  if p_locale not in ('fr', 'ar', 'en') then
    raise exception 'invalid_page_view_locale' using errcode = 'check_violation';
  end if;
  insert into public.site_page_views(path, locale, referrer_host)
  values (p_path, p_locale, left(coalesce(p_referrer_host, ''), 255));
  return true;
end;
$$;
revoke all on function public.record_site_page_view(text, text, text) from public;
grant execute on function public.record_site_page_view(text, text, text) to anon, authenticated;

create or replace function public.blog_publish_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'require_translations', coalesce((select require_translations from public.platform_settings where singleton = true), true),
    'require_seo_metadata', coalesce((select require_seo_metadata from public.platform_settings where singleton = true), true)
  );
$$;
revoke all on function public.blog_publish_rules() from public;
grant execute on function public.blog_publish_rules() to authenticated;
drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

create or replace function public.validate_published_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  require_translations boolean := true;
  require_seo boolean := true;
begin
  if not new.published then return new; end if;

  select coalesce(s.require_translations, true), coalesce(s.require_seo_metadata, true)
    into require_translations, require_seo
    from public.platform_settings s where s.singleton = true;

  if length(btrim(new.content)) = 0 then
    raise exception 'cms_content_required: add French article text before publishing'
      using errcode = 'check_violation';
  end if;

  if require_translations and (
    not exists (
      select 1 from public.post_translations t
      where t.post_id = new.id and t.locale = 'ar'
        and length(btrim(t.title)) > 0 and length(btrim(t.slug)) > 0 and length(btrim(t.content)) > 0
    ) or not exists (
      select 1 from public.post_translations t
      where t.post_id = new.id and t.locale = 'en'
        and length(btrim(t.title)) > 0 and length(btrim(t.slug)) > 0 and length(btrim(t.content)) > 0
    )
  ) then
    raise exception 'cms_translation_required: add Arabic and English title, slug, and article text before publishing'
      using errcode = 'check_violation';
  end if;

  if require_seo and (
    length(btrim(new.seo_title)) < 5 or length(btrim(new.seo_description)) < 30 or
    (require_translations and (
      not exists (select 1 from public.post_translations t where t.post_id = new.id and t.locale = 'ar' and length(btrim(t.seo_title)) >= 5 and length(btrim(t.seo_description)) >= 30) or
      not exists (select 1 from public.post_translations t where t.post_id = new.id and t.locale = 'en' and length(btrim(t.seo_title)) >= 5 and length(btrim(t.seo_description)) >= 30)
    ))
  ) then
    raise exception 'cms_seo_required: add a useful title and description for every published language'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.published_at := coalesce(new.published_at, now());
  elsif not old.published then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists validate_published_post on public.posts;
create trigger validate_published_post
before insert or update on public.posts
for each row execute function public.validate_published_post();

create or replace function public.validate_published_translation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_published boolean := false;
  require_translations boolean := true;
  require_seo boolean := true;
  target_post_id uuid;
begin
  if tg_op = 'DELETE' then
    target_post_id := old.post_id;
  else
    target_post_id := new.post_id;
  end if;
  select published into parent_published from public.posts where id = target_post_id;
  if not coalesce(parent_published, false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(s.require_translations, true), coalesce(s.require_seo_metadata, true)
    into require_translations, require_seo
    from public.platform_settings s where s.singleton = true;

  if tg_op = 'DELETE' then
    if require_translations then
      raise exception 'cms_translation_required: unpublish the article before removing a language'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if require_translations and (
    length(btrim(new.title)) = 0 or length(btrim(new.slug)) = 0 or length(btrim(new.content)) = 0
  ) then
    raise exception 'cms_translation_required: published translations require a title, slug, and article text'
      using errcode = 'check_violation';
  end if;
  if require_seo and (
    require_translations or length(btrim(new.title)) > 0 or length(btrim(new.slug)) > 0 or length(btrim(new.content)) > 0
  ) and (
    length(btrim(new.seo_title)) < 5 or length(btrim(new.seo_description)) < 30
  ) then
    raise exception 'cms_seo_required: published translations require a title and description'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_published_translation on public.post_translations;
create trigger validate_published_translation
before insert or update or delete on public.post_translations
for each row execute function public.validate_published_translation();

-- Page views deliberately retain no IP, account id, cookie/session id, or full referrer.
create table if not exists public.site_page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null check (char_length(path) between 1 and 240 and path like '/%' and path !~ '[?#]'),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  referrer_host text not null default '' check (char_length(referrer_host) <= 255),
  created_at timestamptz not null default now()
);
create index if not exists site_page_views_created_at_idx on public.site_page_views(created_at desc);
create index if not exists site_page_views_path_created_idx on public.site_page_views(path, created_at desc);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 100),
  target text not null default '' check (char_length(target) <= 240),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_events_created_at_idx on public.admin_audit_events(created_at desc);

create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 2000),
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists system_notifications_active_idx on public.system_notifications(active, created_at desc);

-- Role separation remains explicit: content admins can edit posts; platform
-- admins can manage subscribers, tracking, controls, notifications and audit.
alter table public.post_translations enable row level security;
alter table public.platform_settings enable row level security;
alter table public.site_page_views enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.system_notifications enable row level security;

-- Platform operators need account contact details to administer subscriptions.
drop policy if exists profiles_platform_admin_read on public.profiles;
create policy profiles_platform_admin_read on public.profiles
for select to authenticated using (public.is_platform_admin());

drop policy if exists plan_catalog_platform_admin_all on public.plan_catalog;
create policy plan_catalog_platform_admin_all on public.plan_catalog
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists post_translations_public_read_published on public.post_translations;
drop policy if exists post_translations_admin_all on public.post_translations;
create policy post_translations_public_read_published on public.post_translations
for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and p.published = true)
);
create policy post_translations_admin_all on public.post_translations
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists platform_settings_public_read on public.platform_settings;
drop policy if exists platform_settings_admin_all on public.platform_settings;
create policy platform_settings_admin_all on public.platform_settings
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists site_page_views_public_insert on public.site_page_views;
drop policy if exists site_page_views_platform_read on public.site_page_views;
drop policy if exists site_page_views_platform_delete on public.site_page_views;
create policy site_page_views_platform_read on public.site_page_views
for select to authenticated using (public.is_platform_admin());
create policy site_page_views_platform_delete on public.site_page_views
for delete to authenticated using (public.is_platform_admin());

drop policy if exists admin_audit_events_platform_read on public.admin_audit_events;
drop policy if exists admin_audit_events_admin_insert on public.admin_audit_events;
create policy admin_audit_events_platform_read on public.admin_audit_events
for select to authenticated using (public.is_platform_admin());
create policy admin_audit_events_admin_insert on public.admin_audit_events
for insert to authenticated with check (
  actor_id = auth.uid() and (public.is_admin() or public.is_platform_admin())
);

drop policy if exists system_notifications_platform_all on public.system_notifications;
create policy system_notifications_platform_all on public.system_notifications
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Role membership is changed only through audited, platform-admin-gated RPCs.
-- This also prevents the UI from deleting the final break-glass operator.
drop policy if exists platform_admins_admin_all on public.platform_admins;
revoke insert, update, delete on public.platform_admins from public, anon, authenticated;

create or replace function public.set_platform_admin(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id is null or p_enabled is null then
    raise exception 'user_id_and_enabled_are_required' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(724613032);
  if p_enabled then
    insert into public.platform_admins(user_id) values (p_user_id) on conflict (user_id) do nothing;
  else
    if not exists (select 1 from public.platform_admins where user_id = p_user_id) then return; end if;
    if (select count(*) from public.platform_admins) <= 1 then
      raise exception 'cannot_remove_last_platform_admin' using errcode = 'check_violation';
    end if;
    delete from public.platform_admins where user_id = p_user_id;
  end if;
end;
$$;
revoke all on function public.set_platform_admin(uuid, boolean) from public;
grant execute on function public.set_platform_admin(uuid, boolean) to authenticated;

create or replace function public.set_content_admin(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id is null or p_enabled is null then
    raise exception 'user_id_and_enabled_are_required' using errcode = 'invalid_parameter_value';
  end if;
  update public.profiles set is_admin = p_enabled where id = p_user_id;
  if not found then
    raise exception 'profile_not_found' using errcode = 'no_data_found';
  end if;
end;
$$;
revoke all on function public.set_content_admin(uuid, boolean) from public;
grant execute on function public.set_content_admin(uuid, boolean) to authenticated;

-- Existing SaaS tables were created after the first blanket grants in schema.sql.
grant select, insert, update, delete on public.plan_catalog, public.account_subscriptions,
  public.purchase_requests, public.usage_monthly, public.platform_admins to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.post_translations to authenticated;
grant select on public.post_translations to anon;
grant select, insert, update, delete on public.platform_settings to authenticated;
revoke insert on public.site_page_views from public, anon, authenticated;
grant select, delete on public.site_page_views to authenticated;
grant select, insert on public.admin_audit_events to authenticated;
grant select, insert, update, delete on public.system_notifications to authenticated;

commit;


-- CMS website operations migration 20261014 (kept in sync with migrations for full-schema setup).
-- Extend the CMS from blog/control-center primitives to the website operations
-- requested for homepage/pages/SEO/assets/features/releases/downloads/support,
-- public announcements, funnel analytics and rollback/backups.
begin;

create table if not exists public.cms_homepage_content (
  locale text primary key check (locale in ('fr', 'ar', 'en')),
  headline text not null default '' check (char_length(headline) <= 240),
  subheadline text not null default '' check (char_length(subheadline) <= 1200),
  primary_cta text not null default '' check (char_length(primary_cta) <= 80),
  feature_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(feature_cards) = 'array'),
  hero_image_url text not null default '' check (char_length(hero_image_url) <= 1000),
  published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug in ('about', 'faq', 'contact', 'terms', 'privacy')),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  title text not null default '' check (char_length(title) <= 200),
  excerpt text not null default '' check (char_length(excerpt) <= 1000),
  body text not null default '' check (char_length(body) <= 200000),
  seo_title text not null default '' check (char_length(seo_title) <= 80),
  seo_description text not null default '' check (char_length(seo_description) <= 320),
  canonical_url text not null default '' check (canonical_url = '' or (canonical_url ~ '^https?://' and char_length(canonical_url) <= 1000)),
  noindex boolean not null default false,
  published boolean not null default false,
  published_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);
create index if not exists cms_pages_public_idx on public.cms_pages(slug, locale) where published;

create table if not exists public.cms_seo_settings (
  route_path text not null check (route_path ~ '^(/[a-z0-9-]+)*$' and char_length(route_path) <= 240),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  canonical_url text not null default '' check (canonical_url = '' or (canonical_url ~ '^https?://' and char_length(canonical_url) <= 1000)),
  indexable boolean not null default true,
  published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (route_path, locale)
);

create table if not exists public.cms_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (char_length(storage_path) <= 500),
  public_url text not null check (char_length(public_url) <= 2000),
  file_name text not null default '' check (char_length(file_name) <= 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(alt_by_locale) = 'object'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_features (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null check (feature_key ~ '^[a-z0-9-]{1,80}$'),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  details text not null default '' check (char_length(details) <= 10000),
  icon text not null default '' check (char_length(icon) <= 80),
  image_url text not null default '' check (char_length(image_url) <= 2000),
  sort_order integer not null default 0,
  published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (feature_key, locale)
);

create table if not exists public.cms_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null check (version ~ '^[0-9]+[.][0-9]+[.][0-9]+([+-][a-zA-Z0-9.-]+)?$'),
  channel text not null default 'stable' check (channel in ('stable', 'beta', 'preview')),
  title_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(title_by_locale) = 'object'),
  notes_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(notes_by_locale) = 'object'),
  fixes jsonb not null default '[]'::jsonb check (jsonb_typeof(fixes) = 'array'),
  compatibility text not null default '' check (char_length(compatibility) <= 1000),
  release_date date not null default current_date,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version, channel)
);

create table if not exists public.cms_downloads (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('web', 'windows', 'macos', 'linux', 'android', 'ios', 'other')),
  version text not null default '' check (char_length(version) <= 40),
  label_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(label_by_locale) = 'object'),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  instructions_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(instructions_by_locale) = 'object'),
  active boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null check (product_key ~ '^[a-z0-9-]{1,80}$'),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  purchase_url text not null default '' check (purchase_url = '' or (purchase_url ~ '^https?://' and char_length(purchase_url) <= 2000)),
  active boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (product_key, locale)
);

create table if not exists public.cms_support_requests (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('contact', 'bug', 'feedback', 'feature_request', 'investor', 'partner')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 1 and 180),
  message text not null check (char_length(message) between 10 and 10000),
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'closed')),
  internal_note text not null default '' check (char_length(internal_note) <= 4000),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cms_support_requests_inbox_idx on public.cms_support_requests(status, created_at desc);

create table if not exists public.cms_announcements (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(title_by_locale) = 'object'),
  body_by_locale jsonb not null default '{}'::jsonb check (jsonb_typeof(body_by_locale) = 'object'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cms_announcements_public_idx on public.cms_announcements(active, starts_at, ends_at);

create table if not exists public.cms_content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text not null check (char_length(entity_id) <= 240),
  locale text not null default '',
  snapshot jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cms_content_revisions_target_idx on public.cms_content_revisions(entity_type, entity_id, locale, created_at desc);

create table if not exists public.cms_backups (
  id uuid primary key default gen_random_uuid(),
  label text not null default '' check (char_length(label) <= 160),
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists cms_backups_created_idx on public.cms_backups(created_at desc);

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('download_click', 'purchase_click')),
  path text not null check (char_length(path) between 1 and 240 and path like '/%' and path !~ '[?#]'),
  target text not null default '' check (char_length(target) <= 240),
  locale text not null check (locale in ('fr', 'ar', 'en')),
  referrer_host text not null default '' check (char_length(referrer_host) <= 255),
  created_at timestamptz not null default now()
);
create index if not exists site_analytics_events_created_idx on public.site_analytics_events(created_at desc);
create index if not exists site_analytics_events_type_created_idx on public.site_analytics_events(event_type, created_at desc);

-- Mark the exact editorial/operational roles allowed to manage each CMS data family.
create or replace function public.is_cms_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_platform_admin();
$$;
revoke all on function public.is_cms_operator() from public;
grant execute on function public.is_cms_operator() to anon, authenticated;

-- A platform operator can use the website/blog editors even without also
-- holding the narrower content-admin flag. Inserts still bind ownership to
-- the authenticated actor, and ordinary visitors retain published-only reads.
drop policy if exists posts_admin_read_all on public.posts;
create policy posts_admin_read_all on public.posts for select to authenticated using (public.is_cms_operator());
drop policy if exists posts_admin_insert on public.posts;
create policy posts_admin_insert on public.posts for insert to authenticated with check (public.is_cms_operator() and user_id = auth.uid());
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts for update to authenticated using (public.is_cms_operator()) with check (public.is_cms_operator());
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts for delete to authenticated using (public.is_cms_operator());
drop policy if exists post_translations_admin_all on public.post_translations;
create policy post_translations_admin_all on public.post_translations for all to authenticated using (public.is_cms_operator()) with check (public.is_cms_operator());

create or replace function public.capture_cms_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_row jsonb;
  revision_id text;
  revision_locale text := '';
begin
  if tg_op = 'INSERT' then
    previous_row := to_jsonb(new);
  else
    previous_row := to_jsonb(old);
  end if;
  revision_id := coalesce(previous_row ->> 'id', previous_row ->> 'slug', previous_row ->> 'route_path', previous_row ->> 'feature_key', previous_row ->> 'locale', '');
  revision_locale := coalesce(previous_row ->> 'locale', '');
  if revision_id <> '' then
    insert into public.cms_content_revisions(entity_type, entity_id, locale, snapshot, actor_id)
    values (tg_table_name, revision_id, revision_locale, previous_row, auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Version the pre-change row. Restores are ordinary authenticated updates and
-- therefore create another revision rather than destroying history.
do $$ declare table_name text; begin
  foreach table_name in array array['cms_homepage_content', 'cms_pages', 'cms_seo_settings', 'cms_assets', 'cms_features', 'cms_releases', 'cms_downloads', 'cms_products', 'cms_announcements', 'posts', 'post_translations'] loop
    execute format('drop trigger if exists capture_%I_revision on public.%I', table_name, table_name);
    execute format('create trigger capture_%I_revision after insert or update or delete on public.%I for each row execute function public.capture_cms_revision()', table_name, table_name);
  end loop;
end $$;

create or replace function public.record_site_event(p_event_type text, p_path text, p_target text, p_locale text, p_referrer_host text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select tracking_enabled from public.platform_settings where singleton = true), false) then return false; end if;
  if p_event_type not in ('download_click', 'purchase_click') then raise exception 'invalid_event_type' using errcode = 'check_violation'; end if;
  if p_path is null or char_length(p_path) < 1 or char_length(p_path) > 240 or p_path not like '/%' or p_path ~ '[?#]' or p_path ~ '^/admin(/|$)' then
    raise exception 'invalid_event_path' using errcode = 'check_violation';
  end if;
  if p_locale is null or p_locale not in ('fr', 'ar', 'en') then raise exception 'invalid_event_locale' using errcode = 'check_violation'; end if;
  insert into public.site_analytics_events(event_type, path, target, locale, referrer_host)
  values (p_event_type, p_path, left(coalesce(p_target, ''), 240), p_locale, left(coalesce(p_referrer_host, ''), 255));
  return true;
end;
$$;
revoke all on function public.record_site_event(text, text, text, text, text) from public;
grant execute on function public.record_site_event(text, text, text, text, text) to anon, authenticated;

create or replace function public.submit_cms_support_request(
  p_category text, p_name text, p_email text, p_subject text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare request_id uuid;
begin
  if p_category not in ('contact', 'bug', 'feedback', 'feature_request', 'investor', 'partner') then raise exception 'invalid_support_category' using errcode = 'check_violation'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 120 or length(btrim(coalesce(p_email, ''))) not between 3 and 254 or
     length(btrim(coalesce(p_subject, ''))) not between 1 and 180 or length(btrim(coalesce(p_message, ''))) not between 10 and 10000 then
    raise exception 'invalid_support_request' using errcode = 'check_violation';
  end if;
  insert into public.cms_support_requests(category, name, email, subject, message, user_id)
  values (p_category, btrim(p_name), lower(btrim(p_email)), btrim(p_subject), btrim(p_message), auth.uid())
  returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.submit_cms_support_request(text, text, text, text, text) from public;
grant execute on function public.submit_cms_support_request(text, text, text, text, text) to anon, authenticated;

create or replace function public.create_cms_backup(p_label text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare backup_id uuid; snapshot_data jsonb;
begin
  if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode = 'insufficient_privilege'; end if;
  snapshot_data := jsonb_build_object(
    'format_version', 1,
    'created_at', now(),
    'homepage', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_homepage_content t), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_pages t), '[]'::jsonb),
    'seo_settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_seo_settings t), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_assets t), '[]'::jsonb),
    'features', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_features t), '[]'::jsonb),
    'releases', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_releases t), '[]'::jsonb),
    'downloads', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_downloads t), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_products t), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_announcements t), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(t)) from public.posts t), '[]'::jsonb),
    'post_translations', coalesce((select jsonb_agg(to_jsonb(t)) from public.post_translations t), '[]'::jsonb)
  );
  insert into public.cms_backups(label, snapshot, created_by)
  values (left(coalesce(p_label, ''), 160), snapshot_data, auth.uid())
  returning id into backup_id;
  insert into public.admin_audit_events(actor_id, action, target, details)
  values (auth.uid(), 'cms.backup.created', backup_id::text, jsonb_build_object('label', left(coalesce(p_label, ''), 160)));
  return jsonb_build_object('id', backup_id, 'label', left(coalesce(p_label, ''), 160), 'created_at', now());
end;
$$;
revoke all on function public.create_cms_backup(text) from public;
grant execute on function public.create_cms_backup(text) to authenticated;

create or replace function public.restore_cms_backup(p_backup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare backup_snapshot jsonb;
begin
  if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode = 'insufficient_privilege'; end if;
  select snapshot into backup_snapshot from public.cms_backups where id = p_backup_id;
  if backup_snapshot is null then raise exception 'backup_not_found' using errcode = 'no_data_found'; end if;
  if coalesce((backup_snapshot ->> 'format_version')::integer, 0) <> 1 then raise exception 'unsupported_backup_version' using errcode = 'check_violation'; end if;

  -- Replace the full CMS snapshot (not just upsert it). Content revisions and
  -- audit triggers retain a record of the rows changed by this restore.
  delete from public.cms_homepage_content;
  delete from public.cms_pages;
  delete from public.cms_seo_settings;
  delete from public.cms_assets;
  delete from public.cms_features;
  delete from public.cms_releases;
  delete from public.cms_downloads;
  delete from public.cms_products;
  delete from public.cms_announcements;
  update public.posts set published = false where published;
  delete from public.posts;

  insert into public.cms_homepage_content(locale, headline, subheadline, primary_cta, feature_cards, hero_image_url, published, updated_by, updated_at)
  select locale, headline, subheadline, primary_cta, feature_cards, hero_image_url, published, auth.uid(), now()
  from jsonb_populate_recordset(null::public.cms_homepage_content, backup_snapshot -> 'homepage');

  insert into public.cms_pages(id, slug, locale, title, excerpt, body, seo_title, seo_description, canonical_url, noindex, published, published_at, updated_by, created_at, updated_at)
  select id, slug, locale, title, excerpt, body, seo_title, seo_description, canonical_url, noindex, published, published_at, auth.uid(), created_at, now()
  from jsonb_populate_recordset(null::public.cms_pages, backup_snapshot -> 'pages');

  insert into public.cms_seo_settings(route_path, locale, title, description, canonical_url, indexable, published, updated_by, updated_at)
  select route_path, locale, title, description, canonical_url, indexable, published, auth.uid(), now()
  from jsonb_populate_recordset(null::public.cms_seo_settings, backup_snapshot -> 'seo_settings');

  insert into public.cms_assets(id, storage_path, public_url, file_name, mime_type, byte_size, width, height, alt_by_locale, active, created_by, created_at)
  select id, storage_path, public_url, file_name, mime_type, byte_size, width, height, alt_by_locale, active, auth.uid(), created_at
  from jsonb_populate_recordset(null::public.cms_assets, backup_snapshot -> 'assets');

  insert into public.cms_features(id, feature_key, locale, title, description, details, icon, image_url, sort_order, published, updated_by, updated_at)
  select id, feature_key, locale, title, description, details, icon, image_url, sort_order, published, auth.uid(), now()
  from jsonb_populate_recordset(null::public.cms_features, backup_snapshot -> 'features');

  insert into public.cms_releases(id, version, channel, title_by_locale, notes_by_locale, fixes, compatibility, release_date, published, created_by, created_at, updated_at)
  select id, version, channel, title_by_locale, notes_by_locale, fixes, compatibility, release_date, published, auth.uid(), created_at, now()
  from jsonb_populate_recordset(null::public.cms_releases, backup_snapshot -> 'releases');

  insert into public.cms_downloads(id, platform, version, label_by_locale, url, instructions_by_locale, active, sort_order, updated_by, updated_at)
  select id, platform, version, label_by_locale, url, instructions_by_locale, active, sort_order, auth.uid(), now()
  from jsonb_populate_recordset(null::public.cms_downloads, backup_snapshot -> 'downloads');

  insert into public.cms_products(id, product_key, locale, name, description, price_amount, currency, purchase_url, active, sort_order, updated_by, updated_at)
  select id, product_key, locale, name, description, price_amount, currency, purchase_url, active, sort_order, auth.uid(), now()
  from jsonb_populate_recordset(null::public.cms_products, backup_snapshot -> 'products');

  insert into public.cms_announcements(id, severity, title_by_locale, body_by_locale, starts_at, ends_at, active, created_by, created_at, updated_at)
  select id, severity, title_by_locale, body_by_locale, starts_at, ends_at, active, auth.uid(), created_at, now()
  from jsonb_populate_recordset(null::public.cms_announcements, backup_snapshot -> 'announcements');

  -- Restore blog rows as drafts, restore all translations, then republish. If
  -- the original author account has since been removed, use the restoring admin.
  insert into public.posts(id, user_id, title, slug, content, published, created_at, updated_at, excerpt, seo_title, seo_description, keywords, author_name, published_at)
  select b.id,
    case when exists (select 1 from auth.users u where u.id = b.user_id) then b.user_id else auth.uid() end,
    b.title, b.slug, b.content, false, b.created_at, now(), b.excerpt, b.seo_title, b.seo_description, b.keywords, b.author_name, b.published_at
  from jsonb_populate_recordset(null::public.posts, backup_snapshot -> 'posts') b;

  insert into public.post_translations(post_id, locale, title, slug, content, excerpt, seo_title, seo_description, keywords, updated_at)
  select post_id, locale, title, slug, content, excerpt, seo_title, seo_description, keywords, now()
  from jsonb_populate_recordset(null::public.post_translations, backup_snapshot -> 'post_translations');

  update public.posts p set published = b.published, updated_at = now()
  from jsonb_populate_recordset(null::public.posts, backup_snapshot -> 'posts') b
  where p.id = b.id;

  insert into public.admin_audit_events(actor_id, action, target, details)
  values (auth.uid(), 'cms.backup.restored', p_backup_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.restore_cms_backup(uuid) from public;
grant execute on function public.restore_cms_backup(uuid) to authenticated;

create or replace function public.purge_site_analytics(p_before timestamptz)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare removed_page_views bigint := 0; removed_events bigint := 0;
begin
  if not public.is_platform_admin() then raise exception 'platform_admin_required' using errcode = 'insufficient_privilege'; end if;
  if p_before is null or p_before > now() then raise exception 'invalid_retention_cutoff' using errcode = 'check_violation'; end if;
  delete from public.site_page_views where created_at < p_before;
  get diagnostics removed_page_views = row_count;
  delete from public.site_analytics_events where created_at < p_before;
  get diagnostics removed_events = row_count;
  insert into public.admin_audit_events(actor_id, action, target, details)
  values (auth.uid(), 'analytics.retention.purged', 'site_analytics', jsonb_build_object('before', p_before, 'page_views', removed_page_views, 'events', removed_events));
  return removed_page_views + removed_events;
end;
$$;
revoke all on function public.purge_site_analytics(timestamptz) from public;
grant execute on function public.purge_site_analytics(timestamptz) to authenticated;
revoke delete on public.site_page_views, public.site_analytics_events from public, anon, authenticated;

create or replace function public.audit_cms_data_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row_data jsonb;
  target text;
  action_name text;
begin
  if actor is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  target := coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'code', row_data ->> 'slug', row_data ->> 'route_path', row_data ->> 'feature_key', '');
  action_name := 'cms.' || tg_table_name || '.' || lower(tg_op);
  insert into public.admin_audit_events(actor_id, action, target, details)
  values (actor, left(action_name, 100), left(target, 240), jsonb_build_object('locale', coalesce(row_data ->> 'locale', ''), 'published', row_data -> 'published'));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['cms_homepage_content','cms_pages','cms_seo_settings','cms_assets','cms_features','cms_releases','cms_downloads','cms_products','cms_support_requests','cms_announcements','posts','post_translations','platform_settings','plan_catalog','account_subscriptions','purchase_requests','system_notifications','platform_admins'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop trigger if exists audit_%I_change on public.%I', table_name, table_name);
      execute format('create trigger audit_%I_change after insert or update or delete on public.%I for each row execute function public.audit_cms_data_change()', table_name, table_name);
    end if;
  end loop;
end $$;

create or replace function public.audit_profile_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.is_admin is distinct from old.is_admin then
    insert into public.admin_audit_events(actor_id, action, target, details)
    values (auth.uid(), 'content.admin.role.changed', new.id::text, jsonb_build_object('enabled', new.is_admin));
  end if;
  return new;
end;
$$;
drop trigger if exists audit_profile_admin_role_change on public.profiles;
create trigger audit_profile_admin_role_change after update of is_admin on public.profiles for each row execute function public.audit_profile_admin_change();

-- CMS pages need the standard updated_at trigger.
do $$ declare table_name text; begin
  foreach table_name in array array['cms_pages','cms_seo_settings','cms_features','cms_releases','cms_downloads','cms_products','cms_support_requests','cms_announcements'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Public reads are limited to published copy and active assets/downloads.
do $$ declare table_name text; policy_expression text; begin
  for table_name, policy_expression in select * from (values
    ('cms_homepage_content', 'published'),
    ('cms_pages', 'published'),
    ('cms_seo_settings', 'published'),
    ('cms_features', 'published'),
    ('cms_assets', 'active'),
    ('cms_downloads', 'active'),
    ('cms_products', 'active'),
    ('cms_releases', 'published'),
    ('cms_announcements', 'active and starts_at <= now() and (ends_at is null or ends_at > now())')
  ) as policies(table_name, policy_expression) loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_public_read', table_name);
    execute format('create policy %I on public.%I for select to anon, authenticated using (%s)', table_name || '_public_read', table_name, policy_expression);
    execute format('drop policy if exists %I on public.%I', table_name || '_operator_all', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_cms_operator()) with check (public.is_cms_operator())', table_name || '_operator_all', table_name);
  end loop;
end $$;

alter table public.cms_support_requests enable row level security;
alter table public.cms_content_revisions enable row level security;
alter table public.cms_backups enable row level security;
alter table public.site_analytics_events enable row level security;
drop policy if exists cms_support_requests_platform_all on public.cms_support_requests;
create policy cms_support_requests_platform_all on public.cms_support_requests for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists cms_content_revisions_cms_read on public.cms_content_revisions;
create policy cms_content_revisions_cms_read on public.cms_content_revisions for select to authenticated using (public.is_cms_operator());
drop policy if exists cms_backups_platform_all on public.cms_backups;
create policy cms_backups_platform_all on public.cms_backups for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists site_analytics_events_platform_read on public.site_analytics_events;
create policy site_analytics_events_platform_read on public.site_analytics_events for select to authenticated using (public.is_platform_admin());

-- Role and grant boundaries: content editors never see customer support or backups.
grant select, insert, update, delete on public.cms_homepage_content, public.cms_pages, public.cms_seo_settings,
  public.cms_assets, public.cms_features to authenticated;
grant select on public.cms_homepage_content, public.cms_pages, public.cms_seo_settings,
  public.cms_assets, public.cms_features, public.cms_releases, public.cms_downloads, public.cms_products, public.cms_announcements to anon;
grant select, insert, update, delete on public.cms_releases, public.cms_downloads, public.cms_products, public.cms_announcements to authenticated;
grant select, update on public.cms_support_requests to authenticated;
grant select on public.cms_content_revisions to authenticated;
grant select, insert, delete on public.cms_backups to authenticated;
grant select, delete on public.site_analytics_events to authenticated;
revoke insert, update, delete on public.site_analytics_events from public, anon, authenticated;
revoke insert on public.cms_support_requests from public, anon, authenticated;
revoke insert, update, delete on public.admin_audit_events from public, anon, authenticated;
grant select on public.admin_audit_events to authenticated;

-- Use a public Storage bucket for screenshots/illustrations; writes remain CMS-admin only.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('cms-assets', 'cms-assets', true, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml'])
    on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists cms_assets_operator_insert on storage.objects';
    execute 'create policy cms_assets_operator_insert on storage.objects for insert to authenticated with check (bucket_id = ''cms-assets'' and public.is_cms_operator())';
    execute 'drop policy if exists cms_assets_operator_update on storage.objects';
    execute 'create policy cms_assets_operator_update on storage.objects for update to authenticated using (bucket_id = ''cms-assets'' and public.is_cms_operator()) with check (bucket_id = ''cms-assets'' and public.is_cms_operator())';
    execute 'drop policy if exists cms_assets_operator_delete on storage.objects';
    execute 'create policy cms_assets_operator_delete on storage.objects for delete to authenticated using (bucket_id = ''cms-assets'' and public.is_cms_operator())';
  end if;
end $$;


-- Optional, account-owned second copy of each local business workspace.
-- This table stores readable records protected by RLS (not end-to-end encrypted).
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
  on public.business_backup_mirrors (user_id, updated_at desc) where enabled = true;
alter table public.business_backup_mirrors enable row level security;
alter table public.business_backup_mirrors force row level security;
drop policy if exists business_backup_mirrors_own_select on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_insert on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_update on public.business_backup_mirrors;
drop policy if exists business_backup_mirrors_own_delete on public.business_backup_mirrors;
create policy business_backup_mirrors_own_select on public.business_backup_mirrors for select to authenticated using (user_id = (select auth.uid()));
create policy business_backup_mirrors_own_insert on public.business_backup_mirrors for insert to authenticated with check (user_id = (select auth.uid()));
create policy business_backup_mirrors_own_update on public.business_backup_mirrors for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy business_backup_mirrors_own_delete on public.business_backup_mirrors for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.business_backup_mirrors from public, anon, authenticated;
grant select, insert, update, delete on public.business_backup_mirrors to authenticated;

commit;


-- Single-use plan activation codes; see migration 20261017 for full rationale.
-- Server-authoritative single-use activation codes (also in incremental migration).

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

-- Activation key and plan-management security hardening (20261018).
-- Harden activation-key operations: platform-admin MFA gates, audit trail,
-- generic failures, and short-window account/source rate limits.

create table if not exists public.activation_key_attempt_limits (
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

-- ---------------------------------------------------------------------------
-- Support access: shareable account references and the audited operator lookup
-- (migration 20261020_support_account_lookup.sql, folded in here so the
-- single-script setup installs the same server objects as the incremental one).
-- ---------------------------------------------------------------------------

-- Support access: a shareable account reference, and an audited lookup for the CMS.
--
-- A client who needs help should not have to send an email address, a password,
-- a document scan or a screenshot of their invoice in a WhatsApp thread. They
-- read out `FT-7K4M-92QD` — an account reference that authorises nothing — and
-- an operator resolves it from the CMS.
--
-- Three separate things, deliberately not one:
--
--   1. `profiles.account_ref` is an *identifier*, never an authenticator. Its
--      owner can read it; nobody can write it (migration 20261012 grants
--      `update (name)` only, and the grant below is repeated explicitly). It can
--      be rotated by its owner at any time, and rotating it changes no access.
--   2. `support_lookup_account()` returns a *masked* view — first letter of the
--      local part, real domain — plus plan, status, usage and the account's own
--      support history. Restricted to `platform_admins`, rate limited, and it
--      writes an `admin_audit_events` row before returning.
--   3. `support_reveal_account_email()` is the only path to a full address and
--      additionally requires MFA (AAL2) in the current session, exactly like
--      issuing an activation key (see 20261018).
--
-- A reference proves nothing: it is a search hint for a human. Ownership is
-- verified by replying to the address *on file*, never to the address written
-- in a ticket.

-- ----------------------------------------------------------- the reference --

-- Same alphabet as the activation codes: no I, L, O or U, so a reference read
-- aloud or copied from a screenshot cannot become a different reference.
create or replace function public.account_ref_alphabet()
returns text language sql immutable set search_path = public
as $$ select '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; $$;

-- 8 characters from a 32-symbol alphabet = 40 bits. This is not a secret and
-- does not need to be, but it must not be enumerable by a curious client, and
-- at 40 bits guessing one is not a realistic path to anything.
--
-- Only core PostgreSQL is used (`md5`, `gen_random_uuid`, `random`,
-- `clock_timestamp`), so the same function runs under the PGlite schema tests
-- where pgcrypto is unavailable.
create or replace function public.generate_account_ref()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  seed text;
  body text := '';
  i integer;
  octet integer;
begin
  seed := md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
  for i in 1..8 loop
    octet := ('x' || substr(seed, (i * 2) - 1, 2))::bit(8)::int;
    body := body || substr(alphabet, (octet % 32) + 1, 1);
  end loop;
  return 'FT-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

alter table public.profiles add column if not exists account_ref text;

-- Existing installations: every account gets one before the column becomes
-- NOT NULL.
update public.profiles set account_ref = public.generate_account_ref()
 where account_ref is null or account_ref = '';

alter table public.profiles alter column account_ref set default public.generate_account_ref();
alter table public.profiles alter column account_ref set not null;

alter table public.profiles drop constraint if exists profiles_account_ref_format;
alter table public.profiles add constraint profiles_account_ref_format
  check (account_ref ~ '^FT-[0-9A-HJ-KM-NP-TV-Z]{4}-[0-9A-HJ-KM-NP-TV-Z]{4}$');

create unique index if not exists profiles_account_ref_key on public.profiles(account_ref);

-- The reference is read-only for its owner. `grant update (name)` from
-- 20261012 already excludes it; saying so here means a later grant of
-- `update on public.profiles` cannot silently make it writable.
revoke update (account_ref) on public.profiles from public, anon, authenticated;

-- Accepts what a human actually types or dictates: lowercase, spaces, missing
-- or extra dashes. Returns the canonical form, or NULL when the input contains
-- a character the generator never produces (I, L, O, U — usually a misread).
create or replace function public.normalize_account_ref(p_input text)
returns text language plpgsql immutable set search_path = public as $$
declare
  raw text;
begin
  raw := upper(regexp_replace(coalesce(p_input, ''), '[^0-9A-Za-z]', '', 'g'));
  if raw like 'FT%' then
    raw := substr(raw, 3);
  end if;
  if raw !~ '^[0-9A-HJ-KM-NP-TV-Z]{8}$' then
    return null;
  end if;
  return 'FT-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end;
$$;

-- Enough of an address to confirm the operator found the right account, not
-- enough to contact the person or to be worth leaking: `k•••••@gmail.com`.
create or replace function public.mask_email(p_email text)
returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(p_email, '') = '' then '—'
    when position('@' in p_email) <= 1 then '•••'
    else substr(p_email, 1, 1) || repeat('•', 5) || substr(p_email, position('@' in p_email))
  end;
$$;

-- The account's own view of its reference, and a fresh one on request. Both are
-- self-service: no admin, no audit noise, no effect on access.
create or replace function public.my_account_ref()
returns text language plpgsql security definer set search_path = public as $$
declare current_ref text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  select account_ref into current_ref from public.profiles where id = auth.uid();
  if current_ref is null then raise exception 'account_profile_missing' using errcode = 'P0002'; end if;
  return current_ref;
end;
$$;
revoke all on function public.my_account_ref() from public, anon;
grant execute on function public.my_account_ref() to authenticated;

create or replace function public.rotate_account_ref()
returns text language plpgsql security definer set search_path = public as $$
declare fresh text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  fresh := public.generate_account_ref();
  update public.profiles set account_ref = fresh where id = auth.uid();
  if not found then raise exception 'account_profile_missing' using errcode = 'P0002'; end if;
  return fresh;
end;
$$;
revoke all on function public.rotate_account_ref() from public, anon;
grant execute on function public.rotate_account_ref() to authenticated;

-- ------------------------------------------------------------- operator gate --

-- Restated per migration rather than assumed, so this file is safe to apply to
-- an installation that never ran 20261018.
create or replace function public.support_admin_mfa()
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select public.is_platform_admin()
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.support_admin_mfa() from public, anon;
grant execute on function public.support_admin_mfa() to authenticated;

-- ---------------------------------------------------------------- resolution --

-- Shared by the masked lookup and the reveal so they cannot disagree about which
-- account a ticket refers to.
--
--   * a reference resolves to the profile carrying it;
--   * a request id resolves to the signed-in account that filed it;
--   * both together must agree, otherwise the operator is looking at the wrong
--     account and gets a conflict instead of an answer.
--
-- Internal: revoked from every role. Only the two audited wrappers call it.
create or replace function public.support_resolve_account_id(
  p_ref text,
  p_request_id uuid
)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_ref text;
  v_request_user uuid;
  v_found boolean;
  v_account_id uuid;
begin
  if p_request_id is null and coalesce(btrim(p_ref), '') = '' then
    raise exception 'support_lookup_input_required' using errcode = '22023';
  end if;

  if p_request_id is not null then
    select user_id into v_request_user from public.cms_support_requests where id = p_request_id;
    if not found then
      raise exception 'support_request_not_found' using errcode = 'P0002';
    end if;
  end if;

  if coalesce(btrim(p_ref), '') <> '' then
    v_ref := public.normalize_account_ref(p_ref);
    if v_ref is null then
      raise exception 'support_account_ref_malformed' using errcode = '22023';
    end if;
    select p.id into v_account_id from public.profiles p where p.account_ref = v_ref;
    v_found := v_account_id is not null;
    if not v_found then
      raise exception 'support_account_not_found' using errcode = 'P0002';
    end if;
    if p_request_id is not null and v_request_user is not null and v_request_user <> v_account_id then
      raise exception 'support_account_ref_conflict' using errcode = '22023';
    end if;
    return v_account_id;
  end if;

  -- Reference absent: the ticket has to carry the account, and a ticket filed
  -- by a signed-out visitor carries none.
  if v_request_user is null then
    raise exception 'support_request_has_no_account' using errcode = 'P0002';
  end if;
  return v_request_user;
end;
$$;
revoke all on function public.support_resolve_account_id(text, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------- lookup --

create or replace function public.support_lookup_account(
  p_ref text default null,
  p_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  -- Well above what a human operator resolving tickets needs, well below what
  -- enumerating 40-bit references would take.
  c_rate_limit constant integer := 30;
  v_actor uuid := auth.uid();
  v_recent integer;
  v_account_id uuid;
  v_profile public.profiles%rowtype;
  v_email text;
  v_auth_email text;
  v_sub public.account_subscriptions%rowtype;
  v_usage public.usage_monthly%rowtype;
  v_request public.cms_support_requests%rowtype;
  v_devices integer := 0;
  v_request_count integer := 0;
  v_is_operator boolean := false;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;

  select count(*) into v_recent from public.admin_audit_events
   where actor_id = v_actor
     and action in ('support_account_lookup', 'support_account_reveal_email')
     and created_at > now() - interval '1 minute';
  if v_recent >= c_rate_limit then
    raise exception 'support_lookup_rate_limited' using errcode = '54000';
  end if;

  v_account_id := public.support_resolve_account_id(p_ref, p_request_id);

  select * into v_profile from public.profiles where id = v_account_id;
  if v_profile.id is null then
    raise exception 'support_account_not_found' using errcode = 'P0002';
  end if;

  -- `auth.users.email` is authoritative; `profiles.email` is a copy that can
  -- lag behind an address change. Which one answered is reported, so an
  -- operator never has to guess why the two disagree.
  select u.email into v_auth_email from auth.users u where u.id = v_account_id;
  v_email := coalesce(nullif(v_auth_email, ''), nullif(v_profile.email, ''));

  select * into v_sub from public.account_subscriptions where user_id = v_account_id;
  select * into v_usage from public.usage_monthly where user_id = v_account_id
   order by month_start desc limit 1;
  select count(*) into v_devices from public.business_backup_mirrors where user_id = v_account_id;
  select count(*) into v_request_count from public.cms_support_requests where user_id = v_account_id;
  select true into v_is_operator from public.platform_admins where user_id = v_account_id;

  if p_request_id is not null then
    select * into v_request from public.cms_support_requests where id = p_request_id;
  end if;

  -- Written before the payload leaves the function, so a resolution that
  -- returned data is never absent from the trail.
  insert into public.admin_audit_events (actor_id, action, target, details)
  values (
    v_actor,
    'support_account_lookup',
    v_profile.account_ref,
    jsonb_build_object(
      'account_id', v_account_id,
      'request_id', p_request_id,
      'matched_via', case when coalesce(btrim(p_ref), '') <> '' then 'reference' else 'request' end,
      'masked_view', true
    )
  );

  return jsonb_build_object(
    'account_ref', v_profile.account_ref,
    'name', v_profile.name,
    'email_masked', public.mask_email(v_email),
    'email_domain', nullif(split_part(v_email, '@', 2), ''),
    'email_source', case when nullif(v_auth_email, '') is not null then 'auth' else 'profile' end,
    'profile_email_stale', (
      nullif(v_auth_email, '') is not null
      and nullif(v_profile.email, '') is not null
      and lower(v_auth_email) <> lower(v_profile.email)
    ),
    'plan', coalesce(v_sub.plan::text, 'starter'),
    'plan_status', coalesce(v_sub.status::text, 'trialing'),
    'seats', coalesce(v_sub.seats, 1),
    'current_period_end', v_sub.current_period_end,
    'account_created_at', v_profile.created_at,
    'deletion_requested_at', v_profile.deletion_requested_at,
    'workspace_erased_at', v_profile.workspace_erased_at,
    'is_content_admin', coalesce(v_profile.is_admin, false),
    'is_platform_operator', coalesce(v_is_operator, false),
    'usage', case when v_usage.user_id is null then null else jsonb_build_object(
      'month_start', v_usage.month_start,
      'contacts_count', v_usage.contacts_count,
      'projects_count', v_usage.projects_count,
      'active_users', v_usage.active_users,
      'storage_bytes', v_usage.storage_bytes
    ) end,
    'cloud_backup_devices', v_devices,
    'support_request_count', v_request_count,
    'request', case when v_request.id is null then null else jsonb_build_object(
      'id', v_request.id,
      'name', v_request.name,
      'email', v_request.email,
      'subject', v_request.subject,
      'status', v_request.status,
      'category', v_request.category,
      'created_at', v_request.created_at,
      -- The verification step, computed rather than left to the eye: does the
      -- address in the ticket match the address the account actually uses?
      'email_matches_account', (
        nullif(v_email, '') is not null
        and lower(btrim(v_request.email)) = lower(v_email)
      )
    ) end
  );
end;
$$;
revoke all on function public.support_lookup_account(text, uuid) from public, anon;
grant execute on function public.support_lookup_account(text, uuid) to authenticated;

-- ------------------------------------------------------------------- reveal --

-- The single path to a full address, and the reason it is separate: the masked
-- view answers almost every support question, so the audit trail shows a full
-- address being disclosed far less often than the operator looks accounts up.
create or replace function public.support_reveal_account_email(
  p_ref text default null,
  p_request_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_recent integer;
  v_account_id uuid;
  v_profile public.profiles%rowtype;
  v_email text;
  v_request_email text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;
  if not public.support_admin_mfa() then
    raise exception 'support_reveal_mfa_required' using errcode = '42501';
  end if;

  select count(*) into v_recent from public.admin_audit_events
   where actor_id = v_actor
     and action in ('support_account_lookup', 'support_account_reveal_email')
     and created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'support_lookup_rate_limited' using errcode = '54000';
  end if;

  v_account_id := public.support_resolve_account_id(p_ref, p_request_id);

  select * into v_profile from public.profiles where id = v_account_id;
  if v_profile.id is null then
    raise exception 'support_account_not_found' using errcode = 'P0002';
  end if;

  select u.email into v_email from auth.users u where u.id = v_account_id;
  if nullif(v_email, '') is null then
    v_email := nullif(v_profile.email, '');
  end if;

  insert into public.admin_audit_events (actor_id, action, target, details)
  values (
    v_actor,
    'support_account_reveal_email',
    v_profile.account_ref,
    jsonb_build_object(
      'account_id', v_account_id,
      'request_id', p_request_id,
      'matched_via', case when coalesce(btrim(p_ref), '') <> '' then 'reference' else 'request' end,
      'masked_view', false
    )
  );

  if p_request_id is not null then
    select s.email into v_request_email from public.cms_support_requests s where s.id = p_request_id;
  end if;

  return jsonb_build_object(
    'account_ref', v_profile.account_ref,
    'email', v_email,
    'request_email', v_request_email,
    'email_matches_request', (
      v_email is not null
      and v_request_email is not null
      and lower(btrim(v_request_email)) = lower(v_email)
    )
  );
end;
$$;
revoke all on function public.support_reveal_account_email(text, uuid) from public, anon;
grant execute on function public.support_reveal_account_email(text, uuid) to authenticated;

-- ------------------------------------------------------------- operator view --

-- What an operator may see of the support trail itself. `platform_admins` can
-- already read `cms_support_requests`; this adds the join an operator actually
-- needs — the reference and the masked address behind each ticket — without
-- widening access to anything else.
create or replace function public.support_inbox()
returns table (
  id uuid,
  category text,
  name text,
  email text,
  subject text,
  status text,
  created_at timestamptz,
  account_ref text,
  account_email_masked text,
  email_matches_account boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'support_lookup_forbidden' using errcode = '42501';
  end if;

  return query
  select s.id, s.category, s.name, s.email, s.subject, s.status, s.created_at,
         p.account_ref,
         public.mask_email(coalesce(nullif(u.email, ''), nullif(p.email, ''))),
         (
           coalesce(nullif(u.email, ''), nullif(p.email, '')) is not null
           and lower(btrim(s.email)) = lower(coalesce(nullif(u.email, ''), nullif(p.email, '')))
         )
    from public.cms_support_requests s
    left join public.profiles p on p.id = s.user_id
    left join auth.users u on u.id = s.user_id
   order by s.created_at desc
   limit 500;
end;
$$;
revoke all on function public.support_inbox() from public, anon;
grant execute on function public.support_inbox() to authenticated;

-- ---------------------------------------------------------------------------
-- Connector vault: the public half, the secret half, single-use OAuth state and
-- the connector event log (migration 20261021_connector_vault.sql, folded in
-- here so the single-script setup installs the same server objects).
-- ---------------------------------------------------------------------------

-- Connector vault: where a customer's Shopify / YouCan / Meta / Google / WhatsApp
-- credentials live, and the structure that keeps them away from everybody else.
--
-- Every connector needs the same two things from the database, and they are the
-- two things that are dangerous to get wrong:
--
--   1. A **public half** — which store is connected, under which scopes, when it
--      last synced, and why it stopped. The customer sees this in Settings; a
--      support operator can see it too. It contains no secret **by
--      construction**: the access token is not a column of this table, so the
--      day somebody adds a field to `mcp_connections` they cannot accidentally
--      add a credential to it.
--
--   2. A **secret half** — `mcp_connection_secrets`, which RLS is enabled on
--      with **zero policies**. Nobody reaches it: not the customer, not a
--      platform operator, not another tenant. Only the Worker, which holds the
--      service role, reads a token, and only inside the request that needs it.
--
-- A third table holds OAuth `state` values, stored **hashed** and consumed
-- exactly once, so an intercepted callback cannot be replayed into a second
-- connection. It mirrors the key_hash design in 20261017.
--
-- Nothing here stores a Shopify/Meta/Google secret belonging to Fatorati. Those
-- are Worker secrets. This migration is only about what customers own.

-- ------------------------------------------------------------- public half --

create table if not exists public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('shopify', 'youcan', 'meta_ads', 'google_ads', 'whatsapp')),
  -- The provider's own identifier: a Shopify shop domain, a YouCan store id, a
  -- Meta ad account id, a WhatsApp phone number id.
  external_account_id text not null check (char_length(external_account_id) between 1 and 200),
  external_account_name text not null default '' check (char_length(external_account_name) <= 200),
  scopes text[] not null default '{}',
  -- `needs_reauth` is a state a human must see and clear, not a retry loop.
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked', 'error')),
  -- Derived, never asserted by a caller: the trigger on the secrets table below
  -- keeps this in step with whether a token actually exists. It is what the
  -- customer's Settings screen reads, because "connected" and "the credential
  -- is gone" are different states and only one of them can be acted on.
  has_credentials boolean not null default false,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One live connection per store per customer. Reconnecting the same store
  -- updates the row instead of accumulating duplicates.
  unique (user_id, provider, external_account_id)
);
create index if not exists mcp_connections_user_provider_idx on public.mcp_connections(user_id, provider);

alter table public.mcp_connections enable row level security;

drop policy if exists mcp_connections_select_own on public.mcp_connections;
create policy mcp_connections_select_own on public.mcp_connections
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

-- Deliberately no insert, update or delete policy: connections are written by
-- the Worker after the provider has confirmed consent, and are never edited
-- from the browser. A customer disconnects through the RPC below, which leaves
-- the row behind as the record that the connection existed.

grant select on public.mcp_connections to authenticated;
grant select, insert, update, delete on public.mcp_connections to service_role;

-- ------------------------------------------------------------- secret half --

create table if not exists public.mcp_connection_secrets (
  connection_id uuid primary key references public.mcp_connections(id) on delete cascade,
  access_token text not null default '',
  refresh_token text not null default '',
  -- Provider extras that are also secrets or that only the Worker needs:
  -- a Shopify app-installation id, a WABA id, a Google customer id.
  metadata jsonb not null default '{}'::jsonb,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mcp_connection_secrets enable row level security;
-- RLS on with no policy denies every non-owner by itself. The revoke is the
-- second lock on the same door, so a later `create policy ... using (true)` on
-- this table is not the only thing standing between a token and a browser.
revoke all on public.mcp_connection_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_connection_secrets to service_role;

-- `mcp_connections.has_credentials` is not maintained by hand. A caller that
-- had to remember to set it would eventually forget, and the Settings screen
-- would claim a connection was ready when its token had already been destroyed.
-- Deriving it from the row that actually holds the secret makes the two
-- impossible to disagree.
create or replace function public.sync_mcp_connection_credentials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.mcp_connections set has_credentials = true, updated_at = now() where id = new.connection_id;
    return new;
  end if;
  update public.mcp_connections set has_credentials = false, updated_at = now() where id = old.connection_id;
  return old;
end;
$$;
drop trigger if exists mcp_connection_secrets_sync on public.mcp_connection_secrets;
create trigger mcp_connection_secrets_sync
  after insert or delete on public.mcp_connection_secrets
  for each row execute function public.sync_mcp_connection_credentials();
revoke all on function public.sync_mcp_connection_credentials() from public, anon, authenticated;

-- ------------------------------------------------------------ oauth state --

create table if not exists public.mcp_oauth_states (
  -- The SHA-256 of the state value, never the value. A reader of this table
  -- cannot complete somebody's half-finished authorization.
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('shopify', 'youcan', 'meta_ads', 'google_ads', 'whatsapp')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);
create index if not exists mcp_oauth_states_expiry_idx on public.mcp_oauth_states(expires_at);

alter table public.mcp_oauth_states enable row level security;
revoke all on public.mcp_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_oauth_states to service_role;

-- Single use, enforced by the WHERE clause of the UPDATE rather than by a read
-- followed by a write: two concurrent callbacks with the same state cannot both
-- match `consumed_at is null`, so exactly one of them connects a store.
create or replace function public.mcp_consume_oauth_state(p_state_hash text)
returns table (user_id uuid, provider text, payload jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.mcp_oauth_states s
     set consumed_at = now()
   where s.state_hash = p_state_hash
     and s.consumed_at is null
     and s.expires_at > now()
  returning s.user_id, s.provider, s.payload;
end;
$$;
revoke all on function public.mcp_consume_oauth_state(text) from public, anon, authenticated;
grant execute on function public.mcp_consume_oauth_state(text) to service_role;

-- Abandoned authorizations are debris, not data. The Worker's cron calls this;
-- nothing else may.
create or replace function public.mcp_purge_expired_oauth_states()
returns integer language plpgsql security definer set search_path = public as $$
declare purged integer;
begin
  delete from public.mcp_oauth_states where expires_at < now() - interval '1 hour';
  get diagnostics purged = row_count;
  return purged;
end;
$$;
revoke all on function public.mcp_purge_expired_oauth_states() from public, anon, authenticated;
grant execute on function public.mcp_purge_expired_oauth_states() to service_role;

-- -------------------------------------------------------------- event log --

create table if not exists public.mcp_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.mcp_connections(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  -- A background sync has no signed-in user behind it, so events cannot reuse
  -- `admin_audit_events`, whose actor is required to be a real account.
  actor_kind text not null check (actor_kind in ('user', 'worker', 'webhook', 'system')),
  actor_id uuid,
  event text not null check (char_length(event) between 1 and 80),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- A connector log is exactly where a token gets written "just for debugging".
  -- This refuses the obvious names at the database, so the mistake fails in a
  -- test run instead of quietly persisting a credential in an auditable table.
  constraint mcp_connection_events_no_secret_keys check (
    not (details ?| array['access_token', 'refresh_token', 'token', 'secret', 'client_secret', 'password', 'authorization'])
  )
);
create index if not exists mcp_connection_events_connection_idx on public.mcp_connection_events(connection_id, created_at desc);
create index if not exists mcp_connection_events_user_idx on public.mcp_connection_events(user_id, created_at desc);

alter table public.mcp_connection_events enable row level security;

drop policy if exists mcp_connection_events_select_own on public.mcp_connection_events;
create policy mcp_connection_events_select_own on public.mcp_connection_events
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

grant select on public.mcp_connection_events to authenticated;
grant select, insert, update, delete on public.mcp_connection_events to service_role;

-- ------------------------------------------------------------- disconnect --

-- The customer's own action, and the only one the browser may take on a
-- connection. It destroys the token immediately: a row marked `revoked` that
-- still holds a usable credential is revoked in name only.
create or replace function public.disconnect_mcp_connection(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_provider text;
  v_account text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '28000'; end if;

  select provider, external_account_id into v_provider, v_account
    from public.mcp_connections
   where id = p_connection_id and user_id = v_user;
  if not found then
    raise exception 'connector_connection_not_found' using errcode = 'P0002';
  end if;

  update public.mcp_connections
     set status = 'revoked', last_error = '', updated_at = now()
   where id = p_connection_id and user_id = v_user;

  delete from public.mcp_connection_secrets where connection_id = p_connection_id;

  insert into public.mcp_connection_events (connection_id, user_id, actor_kind, actor_id, event, details)
  values (
    p_connection_id, v_user, 'user', v_user, 'disconnect',
    jsonb_build_object('provider', v_provider, 'account', v_account)
  );

  return true;
end;
$$;
revoke all on function public.disconnect_mcp_connection(uuid) from public, anon;
grant execute on function public.disconnect_mcp_connection(uuid) to authenticated;

-- What the Settings screen reads: one table, no join.
--
-- `security_invoker = true` means the RLS policy on `mcp_connections` — not the
-- view — is what decides who sees which row, which is the property worth
-- keeping. That is also why `has_credentials` is a derived column above rather
-- than a join: a security-invoker view that reached into the secrets table
-- would need its reader to hold a grant on that table, which is precisely the
-- grant this migration exists to withhold.
create or replace view public.mcp_connection_status
with (security_invoker = true) as
select
  id, user_id, provider, external_account_id, external_account_name,
  scopes, status, has_credentials, token_expires_at, last_synced_at, last_error,
  created_at, updated_at
from public.mcp_connections;

grant select on public.mcp_connection_status to authenticated;
grant select on public.mcp_connection_status to service_role;
