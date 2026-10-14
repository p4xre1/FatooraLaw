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
  category text not null check (category in ('contact', 'bug', 'feedback', 'feature_request')),
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
  if p_category not in ('contact', 'bug', 'feedback', 'feature_request') then raise exception 'invalid_support_category' using errcode = 'check_violation'; end if;
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

commit;
