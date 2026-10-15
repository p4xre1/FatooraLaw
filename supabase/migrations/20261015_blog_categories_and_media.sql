-- Blog sections (categories) + cover images, for the upgraded CMS editor and
-- the /blog/<section> pages. Standalone copy of the blog block appended to
-- supabase/schema.sql — run this one against a database that already has the
-- rest of schema.sql applied (see SUPABASE_OPERATIONS.md).

-- One editorial section per post, shared by every translation. Existing rows
-- (and any insert that omits the column) default to `articles`.
alter table public.posts
  add column if not exists category text not null default 'articles'
    check (category in ('tips', 'news', 'articles', 'products', 'guides')),
  add column if not exists image_url text not null default ''
    check (char_length(image_url) <= 1000),
  add column if not exists image_alt text not null default ''
    check (char_length(image_alt) <= 300);

create index if not exists posts_category_idx on public.posts (category, published, published_at desc);

-- Column grants for the new fields (table-level grants alone do not cover
-- columns added after the original grant ran).
grant select (category, image_url, image_alt) on public.posts to anon, authenticated;
grant update (category, image_url, image_alt) on public.posts to authenticated;

-- Cover-image uploads: one public bucket, admins only may write. If the
-- bucket already exists this is a no-op.
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

-- Public read of published cover images.
drop policy if exists blog_media_public_read on storage.objects;
create policy blog_media_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'blog-media');

-- Only CMS content admins (or platform operators) may upload/replace images.
drop policy if exists blog_media_admin_write on storage.objects;
create policy blog_media_admin_write on storage.objects
for insert to authenticated
with check (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()));

drop policy if exists blog_media_admin_update on storage.objects;
create policy blog_media_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()))
with check (bucket_id = 'blog-media' and (public.is_admin() or public.is_platform_admin()));
