// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const sql = (file: string) => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8")
// pgcrypto itself is supplied by Supabase; gen_random_uuid() is built into
// PostgreSQL. PGlite doesn't ship that optional extension.
const schema = sql("schema.sql").replace("create extension if not exists pgcrypto;", "")
const cms = sql("migrations/2026_add_cms_posts.sql")
const onboarding = sql("migrations/2026_add_onboarding_responses.sql")
const controlCenter = sql("migrations/20261013_cms_control_center.sql")
const siteOperations = sql("migrations/20261014_cms_site_operations.sql")
const user = "11111111-1111-4111-8111-111111111111"
const admin = "22222222-2222-4222-8222-222222222222"
const operator = "33333333-3333-4333-8333-333333333333"
let db: PGlite

async function asUser<T>(id: string, work: () => Promise<T>) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`)
  try { return await work() }
  finally { await db.exec("reset role; reset request.jwt.claim.sub;") }
}

async function asAnon<T>(work: () => Promise<T>) {
  await db.exec("set role anon; reset request.jwt.claim.sub;")
  try { return await work() }
  finally { await db.exec("reset role; reset request.jwt.claim.sub;") }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
  `)
  await db.exec(schema)
})
afterAll(async () => db?.close())

it("creates CMS and onboarding tables with the documented single-script setup", async () => {
  const { rows } = await db.query<{ posts: string | null; onboarding: string | null; cms_pages: string | null; cms_products: string | null; site_events: string | null }>(
    "select to_regclass('public.posts')::text as posts, to_regclass('public.onboarding_responses')::text as onboarding, to_regclass('public.cms_pages')::text as cms_pages, to_regclass('public.cms_products')::text as cms_products, to_regclass('public.site_analytics_events')::text as site_events",
  )
  expect(rows[0]).toEqual({ posts: "posts", onboarding: "onboarding_responses", cms_pages: "cms_pages", cms_products: "cms_products", site_events: "site_analytics_events" })
})

describe("CMS access control", () => {
  beforeAll(async () => {
    // Existing installations also use these incremental scripts.
    await db.exec(cms)
    await db.exec(onboarding)
    await db.exec(`insert into auth.users(id, email) values ('${user}', 'user@example.com'), ('${admin}', 'admin@example.com'), ('${operator}', 'operator@example.com');`)
    await db.exec(`update public.profiles set is_admin = true where id = '${admin}'; insert into public.platform_admins(user_id) values ('${operator}');`)
    await db.exec(controlCenter)
    await db.exec(siteOperations)
  })

  it("rejects a regular user's attempt to promote their own profile to admin", async () => {
    await asUser(user, async () => {
      await expect(db.exec(`update public.profiles set is_admin = true where id = '${user}'`)).rejects.toThrow()
      const { rows } = await db.query<{ admin: boolean }>("select public.is_admin() as admin")
      expect(rows[0].admin).toBe(false)
    })
  })

  it("permits editing a display name but rejects role changes and profile replacement", async () => {
    await asUser(user, async () => {
      await db.exec(`update public.profiles set name = 'Atlas' where id = '${user}'`)
      await expect(db.exec(`update public.profiles set role = 'owner' where id = '${user}'`)).rejects.toThrow()
      await expect(db.exec(`delete from public.profiles where id = '${user}'`)).rejects.toThrow()
      await expect(db.exec(`insert into public.profiles (id, is_admin) values ('${user}', true)`)).rejects.toThrow()
    })
  })

  it("allows admins to publish posts and ordinary users to read published posts only", async () => {
    await asUser(admin, async () => {
      await db.exec(`insert into public.posts(user_id,title,slug,content,excerpt,seo_title,seo_description,published) values
        ('${admin}', 'Public', 'public-post', 'Published article body', 'Public excerpt', 'Public SEO title', 'A sufficiently descriptive SEO summary for this published article.', false),
        ('${admin}', 'Draft', 'draft-post', 'Draft article body', '', '', '', false);`)
      await db.exec(`insert into public.post_translations(post_id,locale,title,slug,content,seo_title,seo_description) select id,'ar','عنوان عام','public-post-ar','نص المقال المنشور','عنوان تحسين البحث','وصف بحثي مفصل للمقال المنشور باللغة العربية.' from public.posts where slug='public-post';`)
      await db.exec(`insert into public.post_translations(post_id,locale,title,slug,content,seo_title,seo_description) select id,'en','Public title','public-post-en','Published article text','SEO title public','A complete and useful summary of this published article in English.' from public.posts where slug='public-post';`)
      await db.exec(`update public.posts set published=true where slug='public-post';`)
    })
    await asUser(user, async () => {
      const { rows } = await db.query("select title from public.posts order by title")
      expect(rows).toEqual([{ title: "Public" }])
      await expect(db.exec(`insert into public.posts(user_id,title,slug) values ('${user}', 'Bad', 'bad-post')`)).rejects.toThrow()
    })
  })

  it("allows a platform-only operator to manage published multilingual blog posts", async () => {
    await asUser(operator, async () => {
      await db.exec(`insert into public.posts(user_id,title,slug,content,excerpt,seo_title,seo_description) values ('${operator}','Operator article','operator-post','Article text from a platform operator','A multilingual operator article','Operator article SEO title','An informative SEO summary for the operator-authored article.')`)
      await db.exec(`insert into public.post_translations(post_id,locale,title,slug,content,seo_title,seo_description) select id,'ar','مقال المشغل','operator-post-ar','نص المقال باللغة العربية','عنوان تحسين محركات البحث','هذا وصف مفصل لمحركات البحث لهذا المقال باللغة العربية.' from public.posts where slug='operator-post';`)
      await db.exec(`insert into public.post_translations(post_id,locale,title,slug,content,seo_title,seo_description) select id,'en','Operator article in English','operator-post-en','The English translation of the operator article','Operator English SEO','A useful English-language summary for search engines and readers.' from public.posts where slug='operator-post';`)
      await db.exec(`update public.posts set published=true where slug='operator-post';`)
    })
    await asAnon(async () => {
      const { rows } = await db.query("select title from public.posts where slug='operator-post'")
      expect(rows).toEqual([{ title: "Operator article" }])
      const { rows: translationRows } = await db.query("select locale from public.post_translations where slug='operator-post-ar'")
      expect(translationRows).toEqual([{ locale: "ar" }])
    })
  })

  it("does not reopen privilege escalation when schema and migrations are rerun", async () => {
    await db.exec(schema)
    await db.exec(cms)
    await asUser(user, async () => {
      await expect(db.exec(`update public.profiles set is_admin = true where id = '${user}'`)).rejects.toThrow()
    })
  })

  it("exposes published site pages publicly but keeps drafts and support data role-gated", async () => {
    await asUser(admin, async () => {
      await db.exec(`insert into public.cms_pages(slug,locale,title,excerpt,body,published) values
        ('about','fr','Page publique','Extrait public','Contenu public',true),
        ('faq','fr','Brouillon','Extrait interne','Contenu interne',false);`)
      const { rows } = await db.query<{ title: string }>("select title from public.cms_pages order by title")
      expect(rows.map((row) => row.title)).toEqual(["Brouillon", "Page publique"])
      await expect(db.exec(`select * from public.cms_support_requests`)).resolves.toBeDefined()
      await expect(db.exec(`insert into public.cms_support_requests(category,name,email,subject,message) values ('bug','Test','test@example.com','Issue','Long enough report text')`)).rejects.toThrow()
    })
    await asAnon(async () => {
      const { rows } = await db.query<{ title: string }>("select title from public.cms_pages order by title")
      expect(rows).toEqual([{ title: "Page publique" }])
      await expect(db.query("select * from public.cms_support_requests")).rejects.toThrow()
    })
  })

  it("accepts public support and click events only through validated RPCs", async () => {
    await asAnon(async () => {
      const { rows } = await db.query<{ id: string }>(`select public.submit_cms_support_request('bug','Visitor','visitor@example.com','Broken form','The contact form fails on mobile.') as id`)
      expect(rows[0].id).toMatch(/[0-9a-f-]{36}/)
      const { rows: eventRows } = await db.query<{ accepted: boolean }>(`select public.record_site_event('download_click','/pricing','windows:1.2.3','fr','example.com') as accepted`)
      expect(eventRows[0].accepted).toBe(true)
      await expect(db.query(`select public.record_site_event('purchase_click','/admin','fake','fr','')`)).rejects.toThrow()
      await expect(db.exec(`insert into public.site_analytics_events(event_type,path,locale) values ('download_click','/','fr')`)).rejects.toThrow()
    })
    await asUser(admin, async () => {
      const { rows } = await db.query<{ count: number }>("select count(*)::int as count from public.cms_support_requests")
      expect(rows[0].count).toBe(0)
    })
    await asUser(operator, async () => {
      const { rows: requests } = await db.query<{ category: string }>("select category from public.cms_support_requests")
      expect(requests).toEqual([{ category: "bug" }])
      const { rows: events } = await db.query<{ event_type: string; target: string }>("select event_type,target from public.site_analytics_events")
      expect(events).toEqual([{ event_type: "download_click", target: "windows:1.2.3" }])
    })
  })

  it("audits CMS writes, versions content, and restores a complete CMS backup", async () => {
    let backupId = ""
    await asUser(operator, async () => {
      await db.exec(`insert into public.cms_pages(slug,locale,title,body,published) values ('privacy','en','Privacy copy','Original snapshot text',true);`)
      const { rows } = await db.query<{ backup: { id: string } }>("select public.create_cms_backup('before restore') as backup")
      backupId = rows[0].backup.id
      await db.exec(`update public.cms_pages set body='Changed after backup' where slug='privacy' and locale='en';`)
      const { rows: revisions } = await db.query<{ count: number }>(`select count(*)::int as count from public.cms_content_revisions where entity_type='cms_pages'`)
      expect(revisions[0].count).toBeGreaterThan(0)
      await db.exec(`select public.restore_cms_backup('${backupId}'::uuid);`)
      const { rows: restored } = await db.query<{ body: string }>(`select body from public.cms_pages where slug='privacy' and locale='en'`)
      expect(restored[0].body).toBe("Original snapshot text")
      await expect(db.exec(`insert into public.admin_audit_events(actor_id,action) values ('${operator}','forged.audit')`)).rejects.toThrow()
      const { rows: audit } = await db.query<{ count: number }>(`select count(*)::int as count from public.admin_audit_events where actor_id='${operator}'`)
      expect(audit[0].count).toBeGreaterThan(0)
    })
  })
})

it("upgrades the core workspace schema without replacing its recurring subscriptions table", async () => {
  const legacy = new PGlite()
  try {
    await legacy.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to anon, authenticated;
      create type public.app_role as enum ('owner', 'accountant', 'supervisor', 'assistant');
      create table public.profiles (id uuid primary key references auth.users(id), name text not null default '', email text not null default '', role public.app_role not null default 'owner', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
      create table public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text not null, monthly_cost numeric not null default 0, active boolean not null default true);
      insert into auth.users values ('${operator}', 'operator@example.com');
      insert into public.profiles(id,email) values ('${operator}','operator@example.com');
      insert into public.subscriptions(user_id,name,monthly_cost) values ('${operator}','Workspace tool subscription',149);
    `)
    await legacy.exec(cms)
    await legacy.exec(controlCenter)
    await legacy.exec(siteOperations)
    const { rows: tables } = await legacy.query<{ account_subscriptions: string | null; platform_admins: string | null }>(
      "select to_regclass('public.account_subscriptions')::text as account_subscriptions, to_regclass('public.platform_admins')::text as platform_admins",
    )
    expect(tables[0]).toEqual({ account_subscriptions: "account_subscriptions", platform_admins: "platform_admins" })
    const { rows: workspaceSubscriptions } = await legacy.query<{ name: string; monthly_cost: number }>("select name,monthly_cost from public.subscriptions")
    expect(workspaceSubscriptions).toEqual([{ name: "Workspace tool subscription", monthly_cost: "149" }])
    const { rows: plans } = await legacy.query<{ count: number }>("select count(*)::int as count from public.plan_catalog")
    expect(plans[0].count).toBe(4)
  } finally {
    await legacy.close()
  }
})

it("hardens an existing CMS installation, including pre-existing column grants", async () => {
  await db.exec("grant update on public.profiles to authenticated; grant update (is_admin) on public.profiles to authenticated;")
  await db.exec(sql("migrations/20261012_harden_profile_permissions.sql"))
  await db.exec(sql("migrations/20261012_harden_profile_permissions.sql"))
  await asUser(user, async () => {
    await expect(db.exec(`update public.profiles set is_admin = true where id = '${user}'`)).rejects.toThrow()
    await db.exec(`update public.profiles set name = 'Still editable' where id = '${user}'`)
  })
})
