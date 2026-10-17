// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest"

const sql = (name: string) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8")
const alice = "11111111-1111-4111-8111-111111111111"
const bob = "22222222-2222-4222-8222-222222222222"
const device = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}.json`
let db: PGlite
async function asUser<T>(id: string, run: () => Promise<T>) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`)
  try { return await run() } finally { await db.exec("reset role") }
}
async function upload(id: string, i: number, size: number) {
  return asUser(id, () => db.query(`insert into storage.objects(bucket_id,name,metadata)
    values ('business-backups',$1,jsonb_build_object('size',$2::bigint))
    on conflict(bucket_id,name) do update set metadata=excluded.metadata`, [`${id}/${device(i)}`, size]))
}
async function status(id = alice) {
  return asUser(id, async () => (await db.query<{ q: { allowed: boolean; used_bytes: number; limit_bytes: number } }>("select public.cloud_storage_status() as q")).rows[0].q)
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth to authenticated, anon;`)
  await db.exec(sql("schema.sql").replace("create extension if not exists pgcrypto;", ""))
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;`)
  // Re-applying installs the real Storage policies and trigger, and is idempotent.
  await db.exec(sql("migrations/20261022_paid_cloud_storage.sql"))
  await db.exec(sql("migrations/20261022_paid_cloud_storage.sql"))
  await db.exec(`insert into auth.users(id,email) values ('${alice}','alice@example.com'),('${bob}','bob@example.com')`)
})
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec(`delete from storage.objects;
    update public.cloud_storage_config set capacity_bytes=900000000,addons_enabled=false;
    update public.cloud_storage_accounts set extra_gb=0,extra_expires_at=null;
    update public.profiles set deletion_requested_at=null;
    update public.account_subscriptions set plan='pro',status='active',current_period_end=now()+interval '1 month';`)
})
it("grants Pro and Boost 100 MB; rejects free, expired and deletion-pending accounts", async () => {
  expect(await status()).toMatchObject({ allowed: true, limit_bytes: 100_000_000 })
  await db.exec(`update public.account_subscriptions set plan='boost' where user_id='${alice}'`)
  expect(await status()).toMatchObject({ allowed: true, limit_bytes: 100_000_000 })
  for (const change of ["plan='starter'", "plan='pro',current_period_end=now()-interval '1 second'", "plan='pro',status='canceled'"]) {
    await db.exec(`update public.account_subscriptions set ${change} where user_id='${alice}'`)
    expect((await status()).allowed).toBe(false)
    await expect(upload(alice, 1, 10)).rejects.toThrow()
  }
  await db.exec(`update public.account_subscriptions set plan='pro',status='active',current_period_end=now()+interval '1 month';
    update public.profiles set deletion_requested_at=now() where id='${alice}';`)
  expect((await status()).allowed).toBe(false)
  await expect(upload(alice, 1, 10)).rejects.toThrow()
})
it("counts overwrites once, accounts across devices, and deletions accurately", async () => {
  await upload(alice, 1, 1000)
  await upload(alice, 1, 2000)
  await upload(alice, 2, 500)
  expect((await status()).used_bytes).toBe(2500)
  await asUser(alice, () => db.query("delete from storage.objects where name=$1", [`${alice}/${device(1)}`]))
  expect((await status()).used_bytes).toBe(500)
  const { rows } = await db.query<{ object_count: number }>(`select object_count from public.cloud_storage_accounts where user_id='${alice}'`)
  expect(rows[0].object_count).toBe(1)
})
it("blocks account overflow and rolls back counters", async () => {
  for (let i = 0; i < 25; i++) await upload(alice, i, 4_000_000)
  expect((await status()).used_bytes).toBe(100_000_000)
  await expect(upload(alice, 26, 1)).rejects.toThrow("cloud_account_storage_full")
  expect((await status()).used_bytes).toBe(100_000_000)
  await upload(alice, 0, 3_000_000)
  expect((await status()).used_bytes).toBe(99_000_000)
})
it("enforces the shared project cap across accounts", async () => {
  await db.exec("update public.cloud_storage_config set capacity_bytes=2000000")
  await upload(alice, 1, 1400000)
  await expect(upload(bob, 1, 600001)).rejects.toThrow("cloud_project_storage_full")
  expect((await status(bob)).used_bytes).toBe(0)
  await upload(bob, 1, 600000)
})
it("isolates tenants and prevents user-controlled allowance increases", async () => {
  await upload(alice, 1, 10)
  await asUser(bob, async () => {
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0)
    await expect(db.query("insert into storage.objects(bucket_id,name,metadata) values('business-backups',$1,'{\"size\":1}')", [`${alice}/${device(2)}`])).rejects.toThrow()
    await expect(db.exec("update public.cloud_storage_config set capacity_bytes=999999999999")).rejects.toThrow()
    await expect(db.exec("update public.cloud_storage_accounts set extra_gb=10")).rejects.toThrow()
  })
})
it("only honors provisioned, unexpired add-ons after the operator enables them", async () => {
  await upload(alice, 1, 1)
  await db.exec(`update public.cloud_storage_accounts set extra_gb=10,extra_expires_at=now()+interval '1 month' where user_id='${alice}'`)
  expect((await status()).limit_bytes).toBe(100_000_000)
  await db.exec("update public.cloud_storage_config set addons_enabled=true")
  expect((await status()).limit_bytes).toBe(10_100_000_000)
  await db.exec("update public.cloud_storage_accounts set extra_expires_at=now()-interval '1 second'")
  expect((await status()).limit_bytes).toBe(100_000_000)
})
it("allows cleanup after downgrade, rejects oversized/invalid objects and moves", async () => {
  await expect(upload(alice, 1, 4_194_305)).rejects.toThrow("cloud_snapshot_exceeds_4_mb")
  await upload(alice, 1, 10)
  await asUser(alice, async () => {
    await expect(db.query("update storage.objects set name=$1", [`${alice}/${device(3)}`])).rejects.toThrow("cloud_object_move_not_allowed")
  })
  await db.exec("update public.account_subscriptions set plan='starter'")
  await asUser(alice, () => db.exec("delete from storage.objects"))
  expect((await status()).used_bytes).toBe(0)
})
it("stops legacy clients putting snapshot payloads in Postgres", async () => {
  await asUser(alice, async () => {
    await expect(db.query("insert into public.business_backup_mirrors(user_id,device_id,snapshot) values($1,gen_random_uuid(),'{\"sensitive\":true}')", [alice])).rejects.toThrow("permission denied")
    await expect(db.query("insert into public.business_backup_mirrors(user_id,device_id,enabled) values($1,gen_random_uuid(),true)", [alice])).rejects.toThrow("upload_cloud_object_first")
  })
})
it("permits real metadata upserts only for an existing file and immutable identity", async () => {
  await upload(alice, 7, 100)
  await asUser(alice, async () => {
    const params = [alice, device(7).replace(".json", "")]
    const query = `insert into public.business_backup_mirrors(user_id,device_id,enabled,updated_at) values($1,$2,true,now())
      on conflict(user_id,device_id) do update set user_id=excluded.user_id,device_id=excluded.device_id,enabled=excluded.enabled,updated_at=excluded.updated_at`
    await db.query(query, params)
    await db.query(query, params)
    await expect(db.query("update public.business_backup_mirrors set device_id=gen_random_uuid() where device_id=$1", [params[1]])).rejects.toThrow("cloud_mirror_identity_immutable")
  })
})
it("does not count rolled-back Storage permission probes", async () => {
  await db.exec("begin")
  await asUser(alice, () => db.query("insert into storage.objects(bucket_id,name) values('business-backups',$1)", [`${alice}/${device(8)}`]))
  await db.exec("rollback")
  expect((await status()).used_bytes).toBe(0)
  await upload(alice, 8, 500)
  expect((await status()).used_bytes).toBe(500)
})
it("requires Storage API cleanup before irreversible workspace erasure or hard account deletion", async () => {
  await upload(alice, 9, 500)
  await asUser(alice, async () => {
    await expect(db.query("select public.request_account_deletion(true)")).rejects.toThrow("remove_cloud_files_via_storage_api_before_workspace_erase")
  })
  await expect(db.query("delete from auth.users where id=$1", [alice])).rejects.toThrow("remove_cloud_files_via_storage_api_before_account_purge")
  await asUser(alice, async () => {
    await db.exec("delete from storage.objects")
    await db.query("select public.request_account_deletion(true)")
  })
})
it("caps tiny-file metadata growth and releases slots on deletion", async () => {
  for (let i = 0; i < 100; i++) await upload(alice, i, 0)
  await expect(upload(alice, 100, 0)).rejects.toThrow("cloud_account_file_count_limit")
  await asUser(alice, () => db.query("delete from storage.objects where name=$1", [`${alice}/${device(0)}`]))
  await upload(alice, 100, 0)
  expect((await status()).used_bytes).toBe(0)
})
