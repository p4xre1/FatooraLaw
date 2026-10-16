// @vitest-environment node
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * The server half of activation-code issuance and redemption, against real SQL.
 *
 * The CMS calls `issue_activation_key` with a SHA-256 digest and the client
 * calls `redeem_activation_key` with the plaintext key; these tests run both
 * through PostgreSQL (PGlite) with the shipped schema and the two activation
 * migrations, so a migration that stops installing the ledger, an RLS policy
 * that starts refusing the owner, or a redemption that stops being single-use
 * fails here rather than in front of a paying client.
 *
 * PGlite does not ship pgcrypto, so `digest(text, text)` is stubbed with a
 * deterministic 64-hex stand-in (md5 ‖ md5(salt‖input)) and the test computes
 * the same value in Node. Everything around the hash — the checks, the RLS
 * gates, the audit trail, the atomic single use — is the shipped SQL.
 */

const sql = (file: string) => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8")
const schema = sql("schema.sql").replace("create extension if not exists pgcrypto;", "")
const enumStage = sql("migrations/20261017_single_use_activation_codes.sql").replace("create extension if not exists pgcrypto;", "")
const keySecurity = sql("migrations/20261018_activation_key_security.sql")

const operator = "22222222-2222-4222-8222-222222222222"
const editor = "33333333-3333-4333-8333-333333333333"
const client = "11111111-1111-4111-8111-111111111111"
const secondClient = "44444444-4444-4444-8444-444444444444"
/** Fresh account for the rate-limit test: its own attempt counter, starting at zero. */
const guesser = "55555555-5555-4555-8555-555555555555"

/** The stubbed `digest()` in SQL, reproduced byte for byte in Node. */
const stubHash = (value: string) =>
  createHash("md5").update(value).digest("hex") + createHash("md5").update(`salt|${value}`).digest("hex")
/** What the browser sends: the key, upper-cased, with every separator removed. */
const digestOf = (key: string) => stubHash(key.trim().toUpperCase().replace(/[\s._-]+/g, ""))

let db: PGlite

async function as<T>(userId: string, aal: "aal1" | "aal2", work: () => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", aal }).replace(/'/g, "''")
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); select set_config('request.jwt.claims','${claims}',false);`)
  try { return await work() } finally { await db.exec("reset role;") }
}

const issue = (userId: string, aal: "aal1" | "aal2", hash: string, plan = "pro", period = "1M", issuedTo = "Karim · Atlas BTP") =>
  as(userId, aal, () => db.query<{ id: string }>("select public.issue_activation_key($1,$2,$3,$4) as id", [hash, plan, period, issuedTo]))

const redeem = (userId: string, key: string) =>
  as(userId, "aal1", () => db.query<{ result: { ok: boolean; plan?: string; period?: string; started_at?: string; ends_at?: string } }>(
    "select public.redeem_activation_key($1) as result", [key],
  ))

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
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;
    grant usage on schema auth to anon, authenticated;
  `)
  await db.exec(schema)
  // pgcrypto stand-in: same shape (`digest(text, text) → bytea`), 64 hex chars
  // once encoded, so the `key_hash` check constraint is exercised for real.
  await db.exec(`create function public.digest(text, text) returns bytea language sql immutable
    as $$ select decode(md5($1),'hex') || decode(md5('salt|' || $1),'hex') $$;`)
  // The enum value must be committed before migration 18 first uses it.
  await db.exec(enumStage)
  await db.exec(keySecurity)
  await db.exec(`insert into auth.users(id,email) values
    ('${operator}','operator@fatorati.ma'), ('${editor}','editor@fatorati.ma'),
    ('${client}','client@fatorati.ma'), ('${secondClient}','second@fatorati.ma'),
    ('${guesser}','guesser@fatorati.ma');`)
  await db.exec(`insert into public.platform_admins(user_id) values ('${operator}');`)
  await db.exec(`update public.profiles set is_admin = true where id = '${editor}';`)
})
afterAll(async () => db?.close())

describe("issuing activation keys", () => {
  it("installs the ledger and both RPCs", async () => {
    const { rows } = await db.query<{ keys: string | null; issue_fn: string | null; redeem_fn: string | null }>(`
      select to_regclass('public.activation_keys')::text as keys,
             to_regprocedure('public.issue_activation_key(text,text,text,text)')::text as issue_fn,
             to_regprocedure('public.redeem_activation_key(text)')::text as redeem_fn
    `)
    expect(rows[0]).toEqual({
      keys: "activation_keys",
      issue_fn: "issue_activation_key(text,text,text,text)",
      redeem_fn: "redeem_activation_key(text)",
    })
  })

  it("issues for a platform operator at AAL2 and stores only the digest", async () => {
    const key = "PRO-1M-ABCDEFGHJKMNPQRSTVWX"
    const { rows } = await issue(operator, "aal2", digestOf(key))
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/)

    const stored = await db.query<{ key_hash: string; plan: string; period: string; status: string; issued_to: string; issued_by: string }>(
      "select key_hash, plan, period, status, issued_to, issued_by::text from public.activation_keys",
    )
    expect(stored.rows[0]).toEqual({
      key_hash: digestOf(key), plan: "pro", period: "1M", status: "unused",
      issued_to: "Karim · Atlas BTP", issued_by: operator,
    })
    // The plaintext bearer key never reaches the database.
    const dump = await db.query<{ row: string }>("select key_row::text as row from public.activation_keys key_row")
    expect(dump.rows[0].row).not.toContain(key)

    const audit = await db.query<{ action: string }>(
      "select action from public.admin_audit_events where action = 'activation_key_issued'",
    )
    expect(audit.rows).toHaveLength(1)
  })

  it("refuses the same call one MFA step down, and from a content editor at AAL2", async () => {
    await expect(issue(operator, "aal1", digestOf("PRO-1M-NOTISSUED00000000AA")))
      .rejects.toThrow("platform_admin_mfa_required")
    await expect(issue(editor, "aal2", digestOf("PRO-1M-NOTISSUED00000000BB")))
      .rejects.toThrow("platform_admin_mfa_required")
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.activation_keys")
    expect(rows[0].n).toBe(1)
  })

  it("refuses a malformed issue request instead of storing it", async () => {
    await expect(issue(operator, "aal2", "not-a-digest")).rejects.toThrow("invalid_activation_key_request")
    await expect(issue(operator, "aal2", digestOf("PRO-1M-AAAAAAAAAAAAAAAAAAAA"), "enterprise")).rejects.toThrow("invalid_activation_key_request")
    await expect(issue(operator, "aal2", digestOf("PRO-1M-AAAAAAAAAAAAAAAAAAAB"), "pro", "6M")).rejects.toThrow("invalid_activation_key_request")
  })

  it("keeps the ledger readable only for an operator who completed MFA", async () => {
    const read = "select id from public.activation_keys"
    await as(operator, "aal2", async () => {
      const { rows } = await db.query(read)
      expect(rows).toHaveLength(1)
    })
    await as(operator, "aal1", async () => {
      const { rows } = await db.query(read)
      expect(rows).toHaveLength(0)
    })
    await as(client, "aal1", async () => {
      const { rows } = await db.query(read)
      expect(rows).toHaveLength(0)
    })
  })
})

describe("redeeming activation keys", () => {
  const key = "BOOST-1Y-ZZZZ9999AAAA8888BBBB"

  it("activates the plan for the window the key buys, once only", async () => {
    await issue(operator, "aal2", digestOf(key), "boost", "1Y", "Second client")

    const first = await redeem(client, key)
    expect(first.rows[0].result.ok).toBe(true)
    expect(first.rows[0].result.plan).toBe("boost")
    expect(first.rows[0].result.period).toBe("1Y")

    const subscription = await db.query<{ plan: string; status: string; current_period_end: Date }>(
      `select plan::text, status::text, current_period_end from public.account_subscriptions where user_id = '${client}'`,
    )
    expect(subscription.rows[0].plan).toBe("boost")
    expect(subscription.rows[0].status).toBe("active")
    // A year from today, and the app-facing period end is the day after that.
    const endsAt = new Date(`${first.rows[0].result.ends_at}T12:00:00Z`)
    expect(endsAt.getTime() - Date.now()).toBeGreaterThan(360 * 86_400_000)
    expect(subscription.rows[0].current_period_end.getTime()).toBeGreaterThan(endsAt.getTime())

    // A second account cannot reuse it, and the first cannot redeem it twice.
    expect((await redeem(secondClient, key)).rows[0].result).toEqual({ ok: false })
    expect((await redeem(client, key)).rows[0].result).toEqual({ ok: false })

    const used = await db.query<{ status: string; redeemed_by: string }>(
      `select status, redeemed_by::text from public.activation_keys where redeemed_by = '${client}'`,
    )
    expect(used.rows).toEqual([{ status: "redeemed", redeemed_by: client }])
  })

  it("accepts the key however the client pastes it", async () => {
    // The browser digests `key.trim().toUpperCase().replace(/[\s._-]+/g, "")`;
    // the RPC must normalise the submitted text the same way or the digest the
    // owner stored never matches what the client sends from a phone.
    const printed = "PRO-1M-PASTEDKEY00000000AA"
    await issue(operator, "aal2", digestOf(printed), "pro", "1M", "Pasted key")
    const { rows } = await redeem(secondClient, `  ${printed.toLowerCase().replace(/-/g, " ")} `)
    expect(rows[0].result.ok).toBe(true)
    expect(rows[0].result.plan).toBe("pro")
  })

  it("returns one generic failure for unknown, revoked and malformed keys", async () => {
    await expect(redeem(secondClient, "PRO-1M-NEVERISSUED0000000").then((r) => r.rows[0].result)).resolves.toEqual({ ok: false })
    await expect(redeem(secondClient, "").then((r) => r.rows[0].result)).resolves.toEqual({ ok: false })
    await expect(redeem(secondClient, "x".repeat(200)).then((r) => r.rows[0].result)).resolves.toEqual({ ok: false })

    const revoked = "PRO-1M-REVOKED0000000000AAA"
    const { rows } = await issue(operator, "aal2", digestOf(revoked), "pro", "1M", "Revoked")
    await as(operator, "aal2", () => db.exec(`update public.activation_keys set status = 'revoked' where id = '${rows[0].id}'`))
    await expect(redeem(secondClient, revoked).then((r) => r.rows[0].result)).resolves.toEqual({ ok: false })
  })

  it("stops guessing after the per-account threshold and says so in the audit log", async () => {
    const valid = "PRO-1M-RATELIMITED0000000AA"
    await issue(operator, "aal2", digestOf(valid), "pro", "1M", "Rate limited")

    // Eight wrong keys in one 15-minute window lock the account out.
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await redeem(guesser, "PRO-1M-WRONGKEY0000000000AA")
      expect(rows[0].result).toEqual({ ok: false })
    }
    // Locked out: even the key that was issued for it is refused now.
    await expect(redeem(guesser, valid).then((r) => r.rows[0].result)).resolves.toEqual({ ok: false })

    const warned = await db.query<{ action: string }>(
      "select action from public.admin_audit_events where action = 'activation_key_attempt_threshold'",
    )
    expect(warned.rows.length).toBeGreaterThan(0)
    const notice = await db.query<{ n: number }>(
      "select count(*)::int as n from public.system_notifications where title = 'Repeated activation-code failures'",
    )
    expect(notice.rows[0].n).toBeGreaterThan(0)
  })
})
