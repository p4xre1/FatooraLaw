// @vitest-environment node
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * The connector vault, against real SQL.
 *
 * Everything here is about one property: **a customer's platform token must be
 * unreachable from every place except the Worker.** That is not a property a
 * comment can hold, because the failure mode is silent — the app keeps working
 * perfectly while the token is one `select` away from anyone who opens devtools.
 *
 * So the tests are written against the structure itself:
 *
 *   * `mcp_connections` has no column that is a credential, and that is
 *     asserted as an exact column list — adding one has to be a decision.
 *   * `mcp_connection_secrets` denies `authenticated` even for its owner.
 *   * a customer can see their own connection status and no one else's.
 *   * OAuth state is hashed, expires, and is consumed exactly once.
 *   * the event log refuses to store something that looks like a token.
 *
 * The roles mirror Supabase: `authenticated` is a normal signed-in customer,
 * `service_role` has BYPASSRLS and is what the Worker runs as.
 */

const sql = (file: string) => readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8")
const schema = sql("schema.sql").replace("create extension if not exists pgcrypto;", "")

const customer = "11111111-1111-4111-8111-111111111111"
const otherCustomer = "22222222-2222-4222-8222-222222222222"
const operator = "33333333-3333-4333-8333-333333333333"

const ACCESS_TOKEN = "shpat_a_real_looking_token_value"
const REFRESH_TOKEN = "shprt_a_real_looking_refresh_value"

let db: PGlite

async function as<T>(userId: string, work: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`)
  try {
    return await work()
  } finally {
    await db.exec("reset role;")
  }
}

async function asWorker<T>(work: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role;")
  try {
    return await work()
  } finally {
    await db.exec("reset role;")
  }
}

/** The Worker connecting a store: public half and secret half, one transaction. */
async function connectStore(userId: string, provider: string, account: string, token: string) {
  return asWorker(async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.mcp_connections (user_id, provider, external_account_id, external_account_name, scopes)
       values ($1, $2, $3, $3, array['read_orders','read_products']) returning id`,
      [userId, provider, account],
    )
    const id = rows[0].id
    await db.query(
      `insert into public.mcp_connection_secrets (connection_id, access_token, refresh_token)
       values ($1, $2, $3)`,
      [id, token, REFRESH_TOKEN],
    )
    return id
  })
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
      ('${customer}', 'karim@atlasbtp.ma'),
      ('${otherCustomer}', 'samira@example.ma'),
      ('${operator}', 'support@fatorati.tech');
    insert into public.platform_admins(user_id) values ('${operator}');
  `)
})

afterAll(async () => db?.close())

describe("the public half holds no secret", () => {
  it("has an exact column list, so a credential cannot be added by accident", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'mcp_connections'
        order by column_name`,
    )
    expect(rows.map((row) => row.column_name)).toEqual([
      "created_at",
      "external_account_id",
      "external_account_name",
      "has_credentials",
      "id",
      "last_error",
      "last_synced_at",
      "provider",
      "scopes",
      "status",
      "token_expires_at",
      "updated_at",
      "user_id",
    ])
  })

  it("keeps the token in the table RLS is enabled on with no policies", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean; policies: number }>(
      `select c.relrowsecurity,
              (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('mcp_connection_secrets', 'mcp_oauth_states')
        order by c.relname`,
    )
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true)
      expect(Number(row.policies)).toBe(0)
    }
  })
})

describe("a customer and their token", () => {
  it("is refused the secrets table even for their own connection", async () => {
    const connectionId = await connectStore(customer, "shopify", "atlasbtp.myshopify.com", ACCESS_TOKEN)
    await expect(
      as(customer, () => db.query("select access_token from public.mcp_connection_secrets where connection_id = $1", [connectionId])),
    ).rejects.toThrowError(/permission denied/i)
  })

  it("cannot reach another customer's token either", async () => {
    await expect(
      as(otherCustomer, () => db.query("select * from public.mcp_connection_secrets")),
    ).rejects.toThrowError(/permission denied/i)
  })

  it("sees their own connection through the status view, and the token only as a boolean", async () => {
    const { rows } = await as(customer, () =>
      db.query<{ external_account_id: string; has_credentials: boolean; status: string }>(
        "select external_account_id, has_credentials, status from public.mcp_connection_status",
      ),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].external_account_id).toBe("atlasbtp.myshopify.com")
    expect(rows[0].has_credentials).toBe(true)
    // Nothing in the row is the token, under any name.
    expect(JSON.stringify(rows[0])).not.toContain(ACCESS_TOKEN)
  })

  it("cannot see a connection belonging to somebody else", async () => {
    await connectStore(otherCustomer, "shopify", "samira.myshopify.com", "shpat_other_customer_token")
    const { rows } = await as(customer, () =>
      db.query<{ external_account_id: string }>("select external_account_id from public.mcp_connection_status"),
    )
    expect(rows.map((row) => row.external_account_id)).toEqual(["atlasbtp.myshopify.com"])
  })

  it("cannot write a connection, a status or a token from the browser", async () => {
    await expect(
      as(customer, () =>
        db.exec("insert into public.mcp_connections (user_id, provider, external_account_id) values ('11111111-1111-4111-8111-111111111111', 'shopify', 'forged.myshopify.com')"),
      ),
    ).rejects.toThrowError(/permission denied/i)

    await expect(
      as(customer, () => db.exec("update public.mcp_connections set status = 'active' where user_id = '11111111-1111-4111-8111-111111111111'")),
    ).rejects.toThrowError(/permission denied/i)

    // RLS would allow the delete as a row matter; the grant is what refuses it,
    // because a connection row is the record that the connection existed.
    await expect(
      as(customer, () => db.exec("delete from public.mcp_connections where user_id = '11111111-1111-4111-8111-111111111111'")),
    ).rejects.toThrowError(/permission denied/i)
  })

  it("lets a platform operator see connection health without seeing a token", async () => {
    const { rows } = await as(operator, () =>
      db.query<{ external_account_id: string }>("select external_account_id from public.mcp_connection_status order by external_account_id"),
    )
    expect(rows.map((row) => row.external_account_id)).toEqual(["atlasbtp.myshopify.com", "samira.myshopify.com"])
    // The operator's own access to the secrets table is denied as well.
    await expect(
      as(operator, () => db.query("select * from public.mcp_connection_secrets")),
    ).rejects.toThrowError(/permission denied/i)
  })
})

describe("disconnecting", () => {
  it("destroys the token rather than only flagging the row", async () => {
    const connectionId = await connectStore(customer, "youcan", "store-42", "youcan_live_token")

    const { rows } = await as(customer, () =>
      db.query<{ disconnected: boolean }>("select public.disconnect_mcp_connection($1) as disconnected", [connectionId]),
    )
    expect(rows[0].disconnected).toBe(true)

    const secret = await asWorker(() =>
      db.query("select 1 from public.mcp_connection_secrets where connection_id = $1", [connectionId]),
    )
    expect(secret.rows).toHaveLength(0)

    const connection = await asWorker(() =>
      db.query<{ status: string }>("select status from public.mcp_connections where id = $1", [connectionId]),
    )
    expect(connection.rows[0].status).toBe("revoked")

    // The status view reports the absence, so the customer is never told a
    // revoked connection is still ready.
    const view = await as(customer, () =>
      db.query<{ has_credentials: boolean; status: string }>(
        "select has_credentials, status from public.mcp_connection_status where id = $1",
        [connectionId],
      ),
    )
    expect(view.rows[0]).toEqual({ has_credentials: false, status: "revoked" })
  })

  it("is refused for a connection that belongs to somebody else", async () => {
    const mine = await connectStore(customer, "shopify", "another.myshopify.com", "shpat_third")
    await expect(
      as(otherCustomer, () => db.query("select public.disconnect_mcp_connection($1)", [mine])),
    ).rejects.toThrowError(/connector_connection_not_found/)
  })

  it("records who disconnected what", async () => {
    const { rows } = await db.query<{ event: string; actor_kind: string; details: Record<string, unknown> }>(
      "select event, actor_kind, details from public.mcp_connection_events where actor_kind = 'user'",
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].event).toBe("disconnect")
    expect(rows[0].details).toHaveProperty("provider")
  })
})

describe("oauth state", () => {
  const stateHash = createHash("sha256").update("a-one-time-state-value").digest("hex")

  it("is stored as a hash, and consumed exactly once", async () => {
    await asWorker(() =>
      db.query(
        `insert into public.mcp_oauth_states (state_hash, user_id, provider, payload)
         values ($1, $2, 'shopify', '{"shop":"atlasbtp.myshopify.com"}'::jsonb)`,
        [stateHash, customer],
      ),
    )

    const first = await asWorker(() =>
      db.query<{ user_id: string; provider: string; payload: Record<string, unknown> }>(
        "select * from public.mcp_consume_oauth_state($1)",
        [stateHash],
      ),
    )
    expect(first.rows).toHaveLength(1)
    expect(first.rows[0].user_id).toBe(customer)
    expect(first.rows[0].payload.shop).toBe("atlasbtp.myshopify.com")

    // Replaying the same callback must not open a second connection.
    const second = await asWorker(() => db.query("select * from public.mcp_consume_oauth_state($1)", [stateHash]))
    expect(second.rows).toHaveLength(0)
  })

  it("is refused when it has expired", async () => {
    const expired = createHash("sha256").update("stale-state").digest("hex")
    await asWorker(() =>
      db.query(
        `insert into public.mcp_oauth_states (state_hash, user_id, provider, created_at, expires_at)
         values ($1, $2, 'youcan', now() - interval '3 hours', now() - interval '2 hours')`,
        [expired, customer],
      ),
    )
    const { rows } = await asWorker(() => db.query("select * from public.mcp_consume_oauth_state($1)", [expired]))
    expect(rows).toHaveLength(0)
  })

  it("outlives its expiry briefly, so a failed callback can still be diagnosed", async () => {
    const recent = createHash("sha256").update("just-expired").digest("hex")
    await asWorker(() =>
      db.query(
        `insert into public.mcp_oauth_states (state_hash, user_id, provider, created_at, expires_at)
         values ($1, $2, 'youcan', now() - interval '20 minutes', now() - interval '10 minutes')`,
        [recent, customer],
      ),
    )
    // The purge runs; what matters is that it does not take this row with it.
    await asWorker(() => db.query("select public.mcp_purge_expired_oauth_states()"))
    const kept = await asWorker(() => db.query("select 1 from public.mcp_oauth_states where state_hash = $1", [recent]))
    expect(kept.rows).toHaveLength(1)
  })

  it("is unreachable from a customer session and from an operator", async () => {
    await expect(
      as(customer, () => db.query("select * from public.mcp_oauth_states")),
    ).rejects.toThrowError(/permission denied/i)
    await expect(
      as(customer, () => db.query("select public.mcp_consume_oauth_state($1)", [stateHash])),
    ).rejects.toThrowError(/permission denied/i)
    await expect(
      as(operator, () => db.query("select public.mcp_consume_oauth_state($1)", [stateHash])),
    ).rejects.toThrowError(/permission denied/i)
  })

  it("is cleaned up once abandoned", async () => {
    const abandoned = createHash("sha256").update("abandoned-state").digest("hex")
    await asWorker(() =>
      db.query(
        `insert into public.mcp_oauth_states (state_hash, user_id, provider, created_at, expires_at)
         values ($1, $2, 'shopify', now() - interval '4 hours', now() - interval '3 hours')`,
        [abandoned, customer],
      ),
    )
    const { rows } = await asWorker(() => db.query<{ purged: number }>("select public.mcp_purge_expired_oauth_states() as purged"))
    expect(Number(rows[0].purged)).toBeGreaterThanOrEqual(1)
    const gone = await asWorker(() => db.query("select 1 from public.mcp_oauth_states where state_hash = $1", [abandoned]))
    expect(gone.rows).toHaveLength(0)
  })
})

describe("the connector event log", () => {
  it("refuses a payload whose keys name a credential", async () => {
    await expect(
      asWorker(() =>
        db.query(
          `insert into public.mcp_connection_events (user_id, actor_kind, event, details)
           values ($1, 'worker', 'sync', '{"access_token":"shpat_leaked"}'::jsonb)`,
          [customer],
        ),
      ),
    ).rejects.toThrowError(/mcp_connection_events_no_secret_keys/)
  })

  it("accepts the same event once the credential is out of it", async () => {
    await asWorker(() =>
      db.query(
        `insert into public.mcp_connection_events (user_id, actor_kind, event, details)
         values ($1, 'worker', 'sync', '{"orders":42,"cursor":"abc"}'::jsonb)`,
        [customer],
      ),
    )
    const { rows } = await as(customer, () =>
      db.query<{ event: string }>("select event from public.mcp_connection_events where event = 'sync'"),
    )
    expect(rows).toHaveLength(1)
  })

  it("is readable by the customer whose connection it describes, and by nobody else", async () => {
    const { rows } = await as(otherCustomer, () =>
      db.query("select * from public.mcp_connection_events where user_id = $1", [customer]),
    )
    expect(rows).toHaveLength(0)
  })
})
