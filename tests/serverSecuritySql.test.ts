// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest"
const sql = (file: string) => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8")
const alice = "11111111-1111-4111-8111-111111111111"
const bob = "22222222-2222-4222-8222-222222222222"
const operator = "33333333-3333-4333-8333-333333333333"
let db: PGlite
async function as<T>(id: string | null, work: () => Promise<T>, aal = "aal1") {
  const role = id ? "authenticated" : "anon"
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ""}',false);
    select set_config('request.jwt.claims','${JSON.stringify({ sub: id, role, aal })}',false)`)
  try { return await work() } finally { await db.exec("reset role; reset request.jwt.claim.sub; reset request.jwt.claims") }
}
const support = (email = "visitor@example.com") => as(null, () => db.query(
  "select public.submit_cms_support_request('bug','Visitor',$1,'Broken form','Enough detail about this issue')", [email],
))
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    grant usage on schema auth to anon,authenticated;`)
  await db.exec(sql("schema.sql").replace("create extension if not exists pgcrypto;", ""))
  await db.exec(`insert into auth.users(id,email) values ('${alice}','alice@example.com'),('${bob}','bob@example.com'),('${operator}','operator@example.com');
    insert into public.platform_admins(user_id) values('${operator}');`)
})
afterAll(async () => db?.close())
beforeEach(async () => { await db.exec("delete from public.server_request_budgets") })
it("is safe to reapply and does not let clients create public-schema objects or call budget helpers", async () => {
  await db.exec(sql("migrations/20261024_server_security.sql"))
  await db.exec(sql("migrations/20261024_server_security.sql"))
  for (const id of [null, alice, operator]) await as(id, async () => {
    await expect(db.exec("create table public.attack(id integer)")).rejects.toThrow("permission denied")
    await expect(db.query("select * from public.server_request_budgets")).rejects.toThrow("permission denied")
    await expect(db.query("select public.take_server_request_budget('support:day',999999,interval '1 day')")).rejects.toThrow("permission denied")
  })
})
it("rejects forged audit entries even from an operator", async () => {
  await as(operator, async () => {
    await expect(db.query("insert into public.admin_audit_events(actor_id,action,target) values($1,'fake_action','fake_target')", [operator])).rejects.toThrow("permission denied")
  })
})
it("requires platform membership AND signed-session MFA for both role RPCs", async () => {
  for (const name of ["set_platform_admin", "set_content_admin"]) {
    await as(operator, async () => {
      await expect(db.query(`select public.${name}($1,true)`, [bob])).rejects.toThrow("platform_admin_mfa_required")
    })
    await as(alice, async () => {
      await expect(db.query(`select public.${name}($1,true)`, [bob])).rejects.toThrow("platform_admin_mfa_required")
    }, "aal2")
    await as(operator, () => db.query(`select public.${name}($1,true)`, [bob]), "aal2")
    await as(operator, () => db.query(`select public.${name}($1,false)`, [bob]), "aal2")
  }
  await as(operator, async () => {
    await expect(db.query("select public.set_platform_admin($1,false)", [operator])).rejects.toThrow("cannot_remove_last_platform_admin")
    const { rows } = await db.query("select action from public.admin_audit_events where action like '%platform_admins%' or action like '%profile%'")
    expect(rows.length).toBeGreaterThan(0)
  }, "aal2")
})
it("does not allow a submitted purchase request to assert paid status, another identity, or a forged timestamp", async () => {
  await as(alice, async () => {
    const { rows } = await db.query<{ user_id: string; status: string; created_at: string }>(`insert into public.purchase_requests(user_id,email,plan,status,created_at)
      values($1,'ALICE@example.com','pro','paid','2000-01-01') returning user_id,status,created_at`, [bob])
    expect(rows[0].user_id).toBe(alice)
    expect(rows[0].status).toBe("new")
    expect(new Date(rows[0].created_at).getUTCFullYear()).toBeGreaterThan(2025)
  })
  await as(null, () => db.query("insert into public.purchase_requests(email,plan,status) values('anon@example.com','boost','paid')"))
  const { rows } = await db.query<{ status: string; user_id: null }>("select status,user_id from public.purchase_requests where email='anon@example.com'")
  expect(rows[0]).toEqual({ status: "new", user_id: null })
})
it("bounds purchase message sizes before they reach storage", async () => {
  await as(alice, async () => {
    await expect(db.query("insert into public.purchase_requests(email,plan,message) values('alice@example.com','pro',$1)", ["x".repeat(10_001)])).rejects.toThrow("purchase_request_too_large")
  })
})
it("limits support by normalized email without trusting browser throttles", async () => {
  for (let i = 0; i < 3; i++) await support(i % 2 ? "VISITOR@example.com" : "visitor@example.com")
  await expect(support()).rejects.toThrow("public_request_rate_limited")
  const { rows } = await db.query<{ requests: number }>("select requests from public.server_request_budgets where scope like 'support:email:%'")
  expect(rows).toEqual([{ requests: 3 }])
  await db.exec("update public.server_request_budgets set window_started_at=now()-interval '61 minutes'")
  await support()
})
it("enforces a global support limit even when emails rotate", async () => {
  await db.exec("insert into public.server_request_budgets(scope,requests) values('support:hour',60)")
  await expect(support("rotated@example.com")).rejects.toThrow("public_request_rate_limited")
})
it("enforces shared analytics budgets on direct anonymous RPCs", async () => {
  await db.exec("update public.platform_settings set tracking_enabled=true; insert into public.server_request_budgets(scope,requests) values('pageviews:minute',120),('events:day',10000)")
  await as(null, async () => {
    await expect(db.query("select public.record_site_page_view('/pricing','en','example.com')")).rejects.toThrow("analytics_rate_limited")
    await expect(db.query("select public.record_site_event('purchase_click','/pricing','pro','en','example.com')")).rejects.toThrow("analytics_rate_limited")
  })
})
it("keeps tenant foreign keys and array references within the owner account", async () => {
  const own = (await as(alice, () => db.query<{ id: string }>("insert into public.contacts(user_id,type,name) values($1,'client','Own client') returning id", [alice]))).rows[0].id
  const foreign = (await as(bob, () => db.query<{ id: string }>("insert into public.contacts(user_id,type,name) values($1,'client','Other client') returning id", [bob]))).rows[0].id
  const foreignProject = (await as(bob, () => db.query<{ id: string }>("insert into public.projects(user_id,name) values($1,'Other project') returning id", [bob]))).rows[0].id
  const foreignStock = (await as(bob, () => db.query<{ id: string }>("insert into public.stock_items(user_id,name) values($1,'Other equipment') returning id", [bob]))).rows[0].id
  const ownStock = (await as(alice, () => db.query<{ id: string }>("insert into public.stock_items(user_id,name) values($1,'Own equipment') returning id", [alice]))).rows[0].id
  await as(alice, async () => {
    for (const [query, params] of [
      ["insert into public.projects(user_id,name,client_id) values($1,'Bad',$2)", [alice, foreign]],
      ["insert into public.contracts(user_id,type,title,client_id) values($1,'service','Bad',$2)", [alice, foreign]],
      ["insert into public.expenses(user_id,vendor_id) values($1,$2)", [alice, foreign]],
      ["insert into public.stock_items(user_id,name,assigned_project_id) values($1,'Bad',$2)", [alice, foreignProject]],
      ["insert into public.projects(user_id,name,equipment_ids) values($1,'Bad',array[$2::uuid])", [alice, foreignStock]],
    ] as const) await expect(db.query(query, [...params])).rejects.toThrow("invalid_workspace_reference")
    const { rows } = await db.query<{ id: string }>("insert into public.projects(user_id,name,client_id,equipment_ids) values($1,'Good',$2,array[$3::uuid]) returning id", [alice, own, ownStock])
    await expect(db.query("update public.projects set client_id=$1 where id=$2", [foreign, rows[0].id])).rejects.toThrow("invalid_workspace_reference")
    await db.query("delete from public.contacts where id=$1", [own]) // own FK ON DELETE SET NULL still works
  })
})
it("requires operator MFA for direct billing writes, not just activation-key issuance", async () => {
  await as(operator, async () => {
    await expect(db.query("update public.account_subscriptions set plan='boost',status='active' where user_id=$1", [alice])).rejects.toThrow("row-level security")
    await expect(db.query("update public.plan_catalog set monthly_price=1 where code='pro'")).rejects.toThrow("row-level security")
  })
  await as(operator, async () => {
    await db.query("update public.account_subscriptions set plan='pro',status='active' where user_id=$1", [alice])
    await db.query("update public.plan_catalog set monthly_price=79 where code='pro'")
  }, "aal2")
  await as(alice, async () => {
    const { rows } = await db.query<{ plan: string }>("select plan::text from public.account_subscriptions where user_id=$1", [alice])
    expect(rows[0].plan).toBe("pro")
  })
})
it("does not let deletion-pending accounts submit a purchase under an anonymous owner", async () => {
  await db.query("update public.profiles set deletion_requested_at=now() where id=$1", [alice])
  try {
    await as(alice, async () => {
      await expect(db.query("insert into public.purchase_requests(user_id,email,plan) values(null,'alice@example.com','pro')")).rejects.toThrow("row-level security")
    })
  } finally { await db.query("update public.profiles set deletion_requested_at=null where id=$1", [alice]) }
})
it("returns a PostgREST HTTP-429 SQLSTATE when the budget is exhausted", async () => {
  await db.exec("insert into public.server_request_budgets(scope,requests) values('support:day',200)")
  await expect(support()).rejects.toMatchObject({ code: "PT429" })
})
