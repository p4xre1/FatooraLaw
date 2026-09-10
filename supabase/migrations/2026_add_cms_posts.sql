-- Standalone copy of the CMS section already appended to
-- supabase/schema.sql — this project doesn't use the Supabase CLI
-- migration workflow (see SUPABASE_OPERATIONS.md: the whole schema.sql
-- is pasted into the Supabase SQL Editor as one script). This file
-- exists purely so you can run *just* the new CMS piece against a
-- database that already has the rest of schema.sql applied, without
-- re-running the whole thing.

-- ---------------------------------------------------------------------------
-- CMS: public content module (blog / legal-article posts)
--
-- Note on `platform_admins`: this schema already has a `platform_admins`
-- table + `is_platform_admin()` function, and SUPABASE_OPERATIONS.md
-- documents it as being for "protected CMS operators" — i.e. this may be
-- what was originally intended for exactly this feature. The brief for
-- this module asked specifically for admin privileges to be verified
-- against the `profiles` table, so that's what's implemented below
-- (`profiles.is_admin`, not `platform_admins`), to follow that literally
-- rather than assume. If you'd rather consolidate on the pre-existing
-- mechanism instead, it's a two-line swap: drop the `is_admin` column
-- below and make `public.is_admin()` call `public.is_platform_admin()`
-- (or just reference `is_platform_admin()` directly in the policies and
-- in src/admin/lib/adminAuth.ts) — nothing else here depends on which one
-- you pick.
--
-- A boolean flag on `profiles`, rather than adding a value to the
-- existing `app_role` enum (owner/accountant/supervisor/assistant): that
-- enum models per-tenant business roles inside a single company's
-- Fatorati account and has nothing to do with who may publish site
-- content, so overloading it would conflate two unrelated permission
-- systems. `posts` also isn't scoped by user_id the way the tenant
-- tables above are — this is one shared site's content, edited
-- collaboratively by any admin, not per-tenant data.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

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
