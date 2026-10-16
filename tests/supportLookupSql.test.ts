// @vitest-environment node
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * The server half of support access, against real SQL.
 *
 * A client's problem is resolved by reading a reference out to an operator, so
 * the two things that must not break are the ones that are easy to get wrong:
 * that an ordinary signed-in account can read *only* its own reference and can
 * never write one, and that resolving an account is restricted, masked, rate
 * limited and always recorded. Each of those is a test here rather than a
 * comment, because a policy that quietly stops matching looks exactly like a
 * policy that works until someone checks.
 *
 * PGlite does not ship pgcrypto, so the generator deliberately uses core
 * PostgreSQL only (`md5`, `gen_random_uuid`, `random`) and runs unmodified —
 * the shipped function is the tested function.
 */

const sql = (file: string) => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8")
const schema = sql("schema.sql").replace("create extension if not exists pgcrypto;", "")

const owner = "11111111-1111-4111-8111-111111111111"
const otherOwner = "22222222-2222-4222-8222-222222222222"
const operator = "33333333-3333-4333-8333-333333333333"
const flooder = "44444444-4444-4444-8444-444444444444"
const outsider = "55555555-5555-4555-8555-555555555555"

const REF_FORMAT = /^FT-[0-9A-HJ-KM-NP-TV-Z]{4}-[0-9A-HJ-KM-NP-TV-Z]{4}$/

let db: PGlite

/** A signed-in request at a given assurance level, exactly as PostgREST sets it. */
async function as<T>(userId: string, aal: "aal1" | "aal2", work: () => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", aal }).replace(/'/g, "''")
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); select set_config('request.jwt.claims','${claims}',false);`,
  )
  try {
    return await work()
  } finally {
    await db.exec("reset role;")
  }
}

/** Run as the bootstrap superuser: no RLS, for arranging fixtures and reading the trail. */
async function asTrusted<T>(work: () => Promise<T>): Promise<T> {
  await db.exec("reset role;")
  return work()
}

const lookup = (userId: string, ref: string | null, requestId: string | null = null, aal: "aal1" | "aal2" = "aal2") =>
  as(userId, aal, () => db.query<{ result: Record<string, unknown> }>("select public.support_lookup_account($1,$2) as result", [ref, requestId]))

const reveal = (userId: string, ref: string | null, aal: "aal1" | "aal2" = "aal2") =>
  as(userId, aal, () => db.query<{ result: Record<string, unknown> }>("select public.support_reveal_account_email($1,null) as result", [ref]))

const refOf = async (userId: string): Promise<string> => {
  const { rows } = await db.query<{ account_ref: string }>("select account_ref from public.profiles where id = $1", [userId])
  return rows[0].account_ref
}

const auditRows = async (actor: string, action: string) => {
  const { rows } = await asTrusted(() =>
    db.query<{ target: string; details: Record<string, unknown> }>(
      "select target, details from public.admin_audit_events where actor_id = $1 and action = $2 order by created_at",
      [actor, action],
    ),
  )
  return rows
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
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;
    grant usage on schema auth to anon, authenticated;
  `)
  await db.exec(schema)
  await db.exec(`
    insert into auth.users(id, email) values
      ('${owner}', 'karim@atlasbtp.ma'),
      ('${otherOwner}', 'samira@example.ma'),
      ('${operator}', 'support@fatorati.tech'),
      ('${flooder}', 'flood@fatorati.tech'),
      ('${outsider}', 'nobody@example.ma');
    insert into public.platform_admins(user_id) values ('${operator}'), ('${flooder}');
  `)
})

afterAll(async () => db?.close())

describe("the account reference", () => {
  it("is generated for every account, once, in the format the docs promise", async () => {
    const { rows } = await db.query<{ account_ref: string }>("select account_ref from public.profiles")
    expect(rows.length).toBe(5)
    for (const row of rows) expect(row.account_ref).toMatch(REF_FORMAT)
    expect(new Set(rows.map((row) => row.account_ref)).size).toBe(rows.length)
  })

  it("is readable by its owner and invisible to everybody else", async () => {
    const mine = await as(owner, "aal1", () =>
      db.query<{ account_ref: string | null }>("select account_ref from public.profiles where id = $1", [owner]),
    )
    expect(mine.rows[0].account_ref).toBe(await refOf(owner))

    const theirs = await as(owner, "aal1", () =>
      db.query<{ account_ref: string }>("select account_ref from public.profiles where id = $1", [otherOwner]),
    )
    expect(theirs.rows).toHaveLength(0)
  })

  it("cannot be written by its own owner, even though the row is theirs", async () => {
    await expect(
      as(owner, "aal1", () =>
        db.exec("update public.profiles set account_ref = 'FT-AAAA-BBBB' where id = '11111111-1111-4111-8111-111111111111'"),
      ),
    ).rejects.toThrowError(/permission denied|row-level security/i)
    expect(await refOf(owner)).not.toBe("FT-AAAA-BBBB")
  })

  it("rotates on request, keeps its shape, and retires the old reference", async () => {
    const before = await refOf(owner)
    const rotated = await as(owner, "aal1", () =>
      db.query<{ account_ref: string }>("select public.rotate_account_ref() as account_ref"),
    )
    const after = rotated.rows[0].account_ref
    expect(after).toMatch(REF_FORMAT)
    expect(after).not.toBe(before)
    expect(await refOf(owner)).toBe(after)

    // The retired reference resolves to nothing, so an old screenshot in a
    // support thread stops being a way to reach the account.
    await expect(lookup(operator, before)).rejects.toThrowError(/support_account_not_found/)
  })

  it("accepts what a human dictates: lowercase, spaces, no dashes", async () => {
    const ref = await refOf(owner)
    const messy = ref.toLowerCase().replace(/-/g, " ")
    const { rows } = await lookup(operator, messy)
    expect(rows[0].result.account_ref).toBe(ref)
  })

  it("rejects a misread reference instead of guessing at it", async () => {
    // I, L, O and U are never produced by the generator, so their presence is a
    // transcription error and the operator is told so rather than shown nothing.
    await expect(lookup(operator, "FT-IIII-OOOO")).rejects.toThrowError(/support_account_ref_malformed/)
  })
})

describe("operator lookup", () => {
  it("is refused to every account that is not a platform operator", async () => {
    const ref = await refOf(owner)
    await expect(lookup(owner, ref)).rejects.toThrowError(/support_lookup_forbidden/)
    await expect(lookup(outsider, ref)).rejects.toThrowError(/support_lookup_forbidden/)
  })

  it("returns a masked view: plan, status and usage, no plaintext address", async () => {
    const ref = await refOf(owner)
    const { rows } = await lookup(operator, ref)
    const result = rows[0].result

    expect(result.account_ref).toBe(ref)
    expect(result.email_masked).toBe("k•••••@atlasbtp.ma")
    expect(result.email_domain).toBe("atlasbtp.ma")
    expect(result.plan).toBe("starter")
    expect(result.is_platform_operator).toBe(false)
    // Nothing in the payload may contain the address it stands for.
    expect(JSON.stringify(result)).not.toContain("karim@atlasbtp.ma")
  })

  it("resolves a ticket to the account that filed it, and says whether the addresses agree", async () => {
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    await asTrusted(() =>
      db.exec(`insert into public.cms_support_requests(id, category, name, email, subject, message, user_id)
               values ('${requestId}', 'bug', 'Karim', 'karim@atlasbtp.ma', 'Facture bloquée', 'La facture ne se génère pas.', '${owner}')`),
    )

    const { rows } = await lookup(operator, null, requestId)
    const result = rows[0].result
    expect(result.account_ref).toBe(await refOf(owner))
    expect((result.request as { email_matches_account: boolean }).email_matches_account).toBe(true)
    expect(result.support_request_count).toBe(1)

    // A ticket claiming an address that is not the account's is the case the
    // operator must see: it is the difference between helping and being social
    // engineered into helping.
    await asTrusted(() =>
      db.exec(`update public.cms_support_requests set email = 'attacker@example.com' where id = '${requestId}'`),
    )
    const second = await lookup(operator, null, requestId)
    expect((second.rows[0].result.request as { email_matches_account: boolean }).email_matches_account).toBe(false)
  })

  it("refuses to answer when the reference and the ticket name different accounts", async () => {
    const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    await asTrusted(() =>
      db.exec(`insert into public.cms_support_requests(id, category, name, email, subject, message, user_id)
               values ('${requestId}', 'bug', 'Samira', 'samira@example.ma', 'Souci', 'Message assez long.', '${otherOwner}')`),
    )
    await expect(lookup(operator, await refOf(owner), requestId)).rejects.toThrowError(/support_account_ref_conflict/)
  })

  it("says so when a ticket came from a visitor with no account", async () => {
    const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    await asTrusted(() =>
      db.exec(`insert into public.cms_support_requests(id, category, name, email, subject, message)
               values ('${requestId}', 'contact', 'Visiteur', 'visiteur@example.ma', 'Question', 'Bonjour, une question.')`),
    )
    await expect(lookup(operator, null, requestId)).rejects.toThrowError(/support_request_has_no_account/)
  })

  it("records every resolution, with the reference it resolved", async () => {
    const ref = await refOf(owner)
    const rows = await auditRows(operator, "support_account_lookup")
    expect(rows.length).toBeGreaterThan(0)
    const last = rows[rows.length - 1]
    expect(last.details.masked_view).toBe(true)
    expect(last.target).toMatch(REF_FORMAT)
    expect(ref).toMatch(REF_FORMAT)
  })
})

describe("revealing the address", () => {
  it("is refused without MFA, even to a platform operator", async () => {
    const ref = await refOf(owner)
    await expect(reveal(operator, ref, "aal1")).rejects.toThrowError(/support_reveal_mfa_required/)
  })

  it("returns the address on file once AAL2 is reached, and logs the disclosure", async () => {
    const ref = await refOf(owner)
    const { rows } = await reveal(operator, ref, "aal2")
    expect(rows[0].result.email).toBe("karim@atlasbtp.ma")
    expect(rows[0].result.account_ref).toBe(ref)

    const audit = await auditRows(operator, "support_account_reveal_email")
    expect(audit.at(-1)?.details.masked_view).toBe(false)
  })

  it("is never reachable by the account being looked at", async () => {
    await expect(reveal(owner, await refOf(owner), "aal2")).rejects.toThrowError(/support_lookup_forbidden/)
  })
})

describe("abuse limits", () => {
  it("stops a burst of resolutions rather than allowing enumeration", async () => {
    const ref = await refOf(owner)
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const { rows } = await lookup(flooder, ref)
      expect(rows[0].result.account_ref).toBe(ref)
    }
    await expect(lookup(flooder, ref)).rejects.toThrowError(/support_lookup_rate_limited/)

    // The limit is per operator: one account exhausting it leaves the others alone.
    const other = await lookup(operator, ref)
    expect(other.rows[0].result.account_ref).toBe(ref)
  })
})

describe("the operator inbox", () => {
  it("joins each ticket to its account's reference and masked address", async () => {
    const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    await asTrusted(() =>
      db.exec(`insert into public.cms_support_requests(id, category, name, email, subject, message, user_id)
               values ('${requestId}', 'bug', 'Samira', 'samira@example.ma', 'Souci', 'Message assez long.', '${otherOwner}')`),
    )

    const { rows } = await as(operator, "aal2", () =>
      db.query<{ email: string; account_ref: string | null; account_email_masked: string | null; email_matches_account: boolean | null }>(
        "select email, account_ref, account_email_masked, email_matches_account from public.support_inbox()",
      ),
    )
    const matched = rows.find((row) => row.email === "samira@example.ma")
    expect(matched?.account_ref).toBe(await refOf(otherOwner))
    expect(matched?.account_email_masked).toBe("s•••••@example.ma")
    expect(matched?.email_matches_account).toBe(true)

    // A ticket filed by a signed-out visitor has no account to join to, and the
    // inbox says so instead of implying the free-text address was verified.
    const visitor = rows.find((row) => row.account_ref === null)
    expect(visitor).toBeDefined()
    expect(visitor?.account_email_masked).toBe("—")
  })

  it("is refused to a signed-in account that is not an operator", async () => {
    await expect(
      as(owner, "aal2", () => db.query("select * from public.support_inbox()")),
    ).rejects.toThrowError(/support_lookup_forbidden/)
  })

  it("is refused to anonymous callers outright", async () => {
    await db.exec("set role anon; reset request.jwt.claim.sub;")
    try {
      await expect(db.query("select * from public.support_inbox()")).rejects.toThrowError(/permission denied/i)
    } finally {
      await db.exec("reset role;")
    }
  })
})
