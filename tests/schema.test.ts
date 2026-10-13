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
const user = "11111111-1111-4111-8111-111111111111"
const admin = "22222222-2222-4222-8222-222222222222"
let db: PGlite

async function asUser<T>(id: string, work: () => Promise<T>) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`)
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
  const { rows } = await db.query<{ posts: string | null; onboarding: string | null }>(
    "select to_regclass('public.posts')::text as posts, to_regclass('public.onboarding_responses')::text as onboarding",
  )
  expect(rows[0]).toEqual({ posts: "posts", onboarding: "onboarding_responses" })
})

describe("CMS access control", () => {
  beforeAll(async () => {
    // Existing installations also use these incremental scripts.
    await db.exec(cms)
    await db.exec(onboarding)
    await db.exec(`insert into auth.users(id, email) values ('${user}', 'user@example.com'), ('${admin}', 'admin@example.com');`)
    await db.exec(`update public.profiles set is_admin = true where id = '${admin}';`)
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
      await db.exec(`insert into public.posts(user_id,title,slug,published) values
        ('${admin}', 'Public', 'public-post', true), ('${admin}', 'Draft', 'draft-post', false);`)
    })
    await asUser(user, async () => {
      const { rows } = await db.query("select title from public.posts order by title")
      expect(rows).toEqual([{ title: "Public" }])
      await expect(db.exec(`insert into public.posts(user_id,title,slug) values ('${user}', 'Bad', 'bad-post')`)).rejects.toThrow()
    })
  })

  it("does not reopen privilege escalation when schema and migrations are rerun", async () => {
    await db.exec(schema)
    await db.exec(cms)
    await asUser(user, async () => {
      await expect(db.exec(`update public.profiles set is_admin = true where id = '${user}'`)).rejects.toThrow()
    })
  })
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
