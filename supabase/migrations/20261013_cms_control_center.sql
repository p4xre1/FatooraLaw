-- CMS control center: localized publishing, subscriptions, privacy-first visits,
-- security audit, operator notifications, and settings used by the publish/tracking rules.

begin;

-- Keep the workspace's existing `public.subscriptions` table for recurring
-- business tools untouched. These separate rows represent Fatorati accounts'
-- platform plans. On installations that already ran schema.sql, every CREATE
-- below is a no-op; on a core-only schema, this supplies the control layer.
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
  ('enterprise','Enterprise',0,1000,100000,10000,102400,'{"reports":true,"audit":true,"priority_support":true,"custom_limits":true}'::jsonb)
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
