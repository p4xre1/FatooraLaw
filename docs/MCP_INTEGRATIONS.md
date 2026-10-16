# MCP integrations: YouCan, Google Ads, Meta Ads, WhatsApp, Shopify

Status: **planning document, nothing here is built.** It exists so the five
connectors are decided once, in the right order, instead of five times in a
hurry.

---

## 1. The constraint that shapes everything

This repository is a **static single-page app**. `wrangler.toml` deploys `dist`
to Cloudflare Pages with `pages_build_output_dir`, and the file says it plainly:
*"This site is a static SPA with no Functions."* There is no server directory,
no Worker, no hosted API.

Every one of the five integrations needs something the browser cannot hold:

| Needs | Why it cannot live in the SPA |
| --- | --- |
| OAuth client secrets | `VITE_*` values are inlined into the JavaScript bundle at build time and readable by anyone |
| Refresh / access tokens per customer | Stored in `localStorage`, they belong to whoever opens devtools on that device |
| Webhook endpoints | Meta and YouCan must POST to a public HTTPS URL; a static site has none |
| Provider rate limits and quotas | Must be enforced somewhere that is not the client |

**So the first deliverable is not an MCP server. It is a small backend.** Until
it exists, no amount of frontend work connects anything.

---

## 2. Which direction is "MCP"?

Two different products are both called MCP here, and they are not the same work:

**A. Consume** — Fatorati's own assistant (or you, in Claude/ChatGPT) reads your
ad accounts, WhatsApp threads and store orders through MCP servers.

**B. Expose** — Fatorati publishes an MCP server so a *customer's* AI agent can
ask "what do I owe, what is unpaid, what is due this month" about their own
workspace.

The five names in the request read like **A**. Section 5 is written for A and
§7 is the extra work B would need. Choosing wrong here costs weeks.

---

## 3. What already exists — three of the five are built

This is the most useful finding in this document. Building these three yourself
would be re-implementing something the vendor already ships and maintains.

| Platform | Official MCP? | Reality as of October 2026 |
| --- | --- | --- |
| **Meta Ads** | **Yes — hosted, read + write** | `https://mcp.facebook.com/ads`, open beta since 29 Apr 2026. 29 tools, Meta Business OAuth, free during beta. Every write lands **paused** until a human activates it. A per-account `is_ads_mcp_enabled` gate still blocks many accounts. |
| **Google Ads** | **Yes — open source, read-only** | `googleads/google-ads-mcp`, maintained by the Google Ads API team. Three tools plus four resources; reporting runs on GAQL across 181 resource types. Self-hosted (stdio, or Cloud Run) — there is no hosted endpoint. |
| **Shopify** | **Yes — built into every store** | Every Shopify store has a live storefront MCP endpoint, on by default. Shopify open-sourced its AI Toolkit on 9 Apr 2026. **Caveat:** the always-on endpoint is built for *commerce* — catalog, cart, policies for AI shopping agents — not for order/finance reporting. |
| **WhatsApp** | **No** | Meta has shipped no official WhatsApp MCP. This is the largest gap in the Meta ecosystem. Cloud API only — on-premise stopped delivering after 23 Oct 2025. |
| **YouCan** | **No** | No MCP server, community or official. REST Admin API + OAuth 2 only. |

**Consequence:** Phase 0 is configuration, not code. You can be reading Meta and
Google Ads data through an agent this week, with zero changes to this repository.

---

## 4. The two that must be built, and what they demand

### WhatsApp Business (Cloud API)

Prerequisites, none of them optional and none of them fast:

- Meta Business portfolio, a Meta app, a WhatsApp Business Account, and a phone
  number that is **not** already on WhatsApp or WhatsApp Business.
- **Business Verification** — 2 to 4 business days, and the legal name must
  match the uploaded documents exactly. Not required to start, but without it
  you are capped at **250 unique recipients per rolling 24 hours**.
- A system-user **permanent** token (the temporary one expires in 24 hours).
- An HTTPS webhook with Meta signature verification.
- **Template messages must be pre-approved** (24–48 hours each) for anything
  sent outside the customer service window.
- Messaging limits scale 250 → 2,000 → 10,000 → 100,000 → unlimited. Throughput
  80 msg/s; per-recipient pair rate is 1 message every 6 seconds.

The 24-hour window is the design constraint. A customer messaging you opens it,
and inside it you may reply freely. Outside it, the only thing Meta accepts is a
pre-approved template. An invoice reminder sent three days after a due date is a
template, approved in advance, not a free-text message.

**Pricing changed two weeks ago and it matters.** From **1 October 2026**,
free-form replies *inside* the 24-hour window are billable, after the first
1,000 service messages per month per business number. Utility templates sent
inside the window were already moving from free to charged. A "remind customers
about overdue invoices over WhatsApp" feature is now a per-message cost, not a
free channel — price it into the plan tiers before building it.

### YouCan

Better documented than expected, and the flow is standard:

```
Authorize  https://seller-area.youcan.shop/admin/oauth/authorize
             ?client_id=…&redirect_uri=…&response_type=code
             &scope[]=read-orders&scope[]=read-products
Token      POST https://api.youcan.shop/oauth/token
             grant_type=authorization_code&client_id=…&client_secret=…
             &redirect_uri=…&code=…
API base   https://api.youcan.shop
```

Details that will cost an afternoon each if missed:

- The authorization path must include `/admin/oauth`. `/oauth/authorize` is not
  valid.
- Building and testing requires a **YouCan Partner Account**, which provides
  development stores and OAuth credentials. Plan for that approval before
  writing code.
- Scopes are per-resource (`read-orders`, `read-products`, `read-customers`).
  Ask for the minimum; a store owner granting an invoicing tool `read-customers`
  deserves an explanation.
- Apps come in two shapes: **embedded** (inside the Seller Area, Qantra session
  token) and **external** (independent tab, authorization code flow). Fatorati
  is external.
- Webhooks ("resthooks") exist for new orders — that is how an order becomes an
  invoice without polling.

---

## 5. Architecture for the two we build

```
Browser (SPA, no secrets)
   │  HTTPS + Supabase JWT
   ▼
Fatorati Worker  ──────────────►  YouCan API   /  Meta Graph (WhatsApp)
   │  Cloudflare, own subdomain
   │  holds: client secrets, per-tenant tokens, signature verification
   ▼
Supabase: mcp_connections (RLS, no client SELECT on token columns)
          admin_audit_events (every outbound action)
```

**A separate Worker, not Pages Functions.** The SPA stays a static deploy with
no runtime; the connector gets its own origin, its own secrets and its own
deploy cadence. A bug in the connector cannot take the marketing site down, and
the site's build cannot accidentally inline a token.

**Token storage is the security decision.** Rules, in order of importance:

1. Client secrets live as Worker secrets — never in `VITE_*`, never in this
   repo, never in `wrangler.toml` `[vars]`, which the file already warns never
   reaches the bundle and which is not a secret store either way.
2. Tokens are per tenant and per provider. One customer's YouCan token must be
   unreachable from another customer's session, which means the RLS policy on
   the connection table denies `SELECT` on the token columns to `authenticated`
   entirely. The customer sees "YouCan connected ✓"; only the Worker sees the
   token.
3. Encryption at rest in addition to RLS — RLS is tenant isolation, not
   encryption, exactly as `docs/BACKUP_AUTOMATION_ROADMAP.md` already says about
   the backup mirror.
4. Refresh rotation is logged. A refresh that fails is a connection a human must
   see, not a silent retry loop.
5. Webhook payloads are verified by signature **before** anything is parsed,
   and the verification failing is an audit event.

**Order of work.** YouCan read-only first: it is the smallest complete loop
(connect a store → pull orders → produce an invoice), it exercises every piece
of the Worker, the vault and the audit trail, and it can be tested against a
Partner development store. WhatsApp second, because it is the one with external
approval gates and per-message cost.

---

## 6. Security and legal notes specific to Morocco

- **Loi 09-08 / CNDP.** Customer phone numbers, store customer records and ad
  account data are personal data. Pulling them into a new server-side store is a
  new processing activity that needs a purpose, a retention period and a
  deletion path — the repository already documents its local-only posture, and
  this is the change that breaks it.
- **The existing promise.** `src/i18n/settings.ts` tells customers, in three
  languages, that *"ad-platform passwords, tokens and credentials are never
  included"* in the Supabase backup mirror. A connector that stores ad-platform
  tokens server-side keeps that promise (the mirror is a different store) — but
  the sentence must be re-read and deliberately kept true, not left to drift.
- **Minimum scopes, always.** An invoicing tool that asks a shop owner for
  `ads_management` or `read-customers` when it needs `ads_read` and
  `read-orders` is asking for permission it cannot justify.
- **Read before write.** Every integration lands read-only. Meta's own server
  already does this — writes arrive paused — and it is the right default for a
  product whose blast radius is somebody's ad budget.

---

## 7. Explicitly not in scope yet

**Fatorati as an MCP server (§2B)** needs, in addition to everything above:
OAuth 2.1 authorization-server behaviour, per-tenant token issuance and
revocation, scope mapping onto the existing RLS model, and a public
conformance-facing endpoint. It is a product decision with its own design, and
it should follow a working backend rather than precede it.

---

## 8. Phases

| Phase | Work | Blocked by | Repo changes |
| --- | --- | --- | --- |
| **0** | Connect Meta's hosted Ads MCP and run `google-ads-mcp` for your own accounts; use Shopify's storefront endpoint for catalog questions | Meta account eligibility for the beta; a Google Cloud project with Explorer+ access | **None** |
| **1** | Worker skeleton + token vault + one provider connected end to end | Cloudflare Worker deploy; YouCan Partner account | `worker/` (new), one migration, one Settings card |
| **2** | YouCan read-only: orders → invoices | Phase 1 | Connector modules, order mapping |
| **3** | WhatsApp Cloud API: order confirmations, payment reminders | Meta Business Verification, template approval | Worker routes, template registry, per-message cost tracking |
| **4** | Shopify Admin API (GraphQL) for orders | Phase 1 | Connector module |
| **5** | Fatorati as an MCP server | Phase 1, and a decision | Separate design |

---

## 9. What only you can supply

Nothing in the list below is discoverable from this repository. Each one blocks
a phase completely.

| Need | Blocks | Lead time |
| --- | --- | --- |
| Meta app + Business portfolio, and whether your ad accounts are eligible for the MCP beta | Phase 0 (Meta) | hours to days |
| Google Cloud project with the Ads API enabled and **Explorer or Basic** access | Phase 0 (Google) | Explorer is often automatic; Basic needs brand verification |
| Which Google Cloud project holds the access level — OAuth credentials must come from the **same** project, or calls silently fall back to Test level and fail on real accounts | Phase 0 (Google) | — |
| YouCan Partner Account | Phase 1 | approval |
| Meta Business Verification (legal documents matching the registered name exactly) | Phase 3 | 2–4 business days |
| WhatsApp Business Account + a phone number not already on WhatsApp | Phase 3 | days |
| Cloudflare Worker domain decision (e.g. `mcp.fatorati.tech`) | Phase 1 | minutes |

### Two traps worth repeating

**Google Ads.** Developer tokens were sunset on 9 September 2026. API access now
belongs to the Google Cloud project that issued the OAuth credentials. A Test
level project calling a real account returns
`CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` on API v25 and later. If credentials
and access level live in different Cloud projects, you land in Test level with
no error explaining why.

**Meta.** If Fatorati ever connects **other businesses'** ad accounts, that is
Live mode + Advanced Access per permission (App Review) + Business Verification,
with a Full access tier requiring at least 500 successful Marketing API calls in
15 days at under 15% error rate. Reading **your own** accounts needs none of
that. Know which one you are building before you promise it to a customer.

---

## 10. Decisions taken (16 October 2026)

Three answers, and what each one changes.

### Direction: customers, inside Fatorati — not internal tooling

This is the consequential one. It means **Fatorati is a multi-tenant application
asking other people for access to their accounts**, and every "it works for my
own store" shortcut closes:

- Each customer authorizes their own store. Tokens are per tenant.
- Meta and Google stop being configuration problems and become **app review
  problems**: connecting *other businesses'* ad accounts requires Live mode,
  Advanced Access per permission (App Review) and Business Verification, with a
  Full access tier needing ≥500 successful Marketing API calls in 15 days at
  <15% error rate.
- Google OAuth verification becomes a prerequisite, because "read this
  customer's ad performance" is a sensitive scope.
- The data pulled in (store orders, customer records, ad account metrics) is
  personal data under Loi 09-08, held server-side rather than in the customer's
  own browser — a different legal posture from today's.

### First: Shopify

A good choice, and worth being precise about *which* Shopify. The always-on
storefront MCP endpoint is built for catalog/cart/policies — AI shopping agents,
not accounting. Order and finance data comes from the **GraphQL Admin API** with
`read_orders`. That is what §11 builds.

### Where the backend lives: a separate Cloudflare Worker

`worker/` in this repository, deployed on its own to `api.fatorati.tech`.

**Why not Vite/Pages:** the Worker holds the Shopify app secret, the Meta system
user token and every customer's access token. `wrangler.toml` already warns that
`[vars]` never reaches the Vite bundle and that `VITE_*` is inlined at **build**
time — a secret that reaches a build is a secret in a public JavaScript file.
The connector must run somewhere the SPA's build cannot see.

**Why a Worker and not Supabase Edge Functions** (the runner-up, and not a bad
one — you already pay for Supabase, and `supabase secrets set` is a real secret
store):

| | Cloudflare Worker | Supabase Edge Function |
| --- | --- | --- |
| New vendor | none — `wrangler` is already a devDependency and you already deploy to Cloudflare | none |
| Scheduled work | cron triggers are first-class (nightly order pull, `mcp_purge_expired_oauth_states`) | needs an external scheduler or `pg_cron` calling out |
| Webhook latency | no cold-start tax on the path Shopify and Meta hit | cold starts land on the webhook path |
| Deploy isolation | independent of the site's build and deploy | independent, but shares the Supabase project's limits |
| Database access | service-role key as a Worker secret | native, no network hop |

The tie-breaker is the cron and the webhook path: this connector's job is
"pull orders every night, receive order webhooks all day", and the Worker is
built for exactly that shape. The token vault stays in Postgres either way,
because that is where RLS, the audit trail and your backup story already live.

**Layout.** `worker/` gets its own `wrangler.toml`, its own deploy script and its
own secrets. It imports the pure connector logic from `src/lib/connectors/` so
the same tested functions run in the Worker — and so the code the SPA bundles
never contains a secret, only the argument-passing skeletons.

## 11. Built so far

### `supabase/migrations/20261021_connector_vault.sql` — the token boundary

The piece that must be right before any connector exists.

| Object | Purpose |
| --- | --- |
| `mcp_connections` | The **public half**: store domain, scopes, status, last error. No credential is a column of this table, so one cannot be added to it by accident. |
| `mcp_connection_secrets` | The **secret half**. RLS enabled with **zero policies**; every role revoked. Only the Worker's service role reaches a token. |
| `mcp_oauth_states` | OAuth `state`, stored **hashed** and consumed exactly once by an atomic `update ... where consumed_at is null`. |
| `mcp_connection_events` | Who connected, synced, failed or disconnected — with a constraint that **refuses** payload keys named `access_token`, `secret`, `password` and friends. |
| `disconnect_mcp_connection()` | The customer's own action. Destroys the token rather than flagging the row. |
| `mcp_connection_status` | What Settings reads: one table, no join, `security_invoker` so RLS still decides. |

19 tests in `tests/connectorVaultSql.test.ts` pin the boundary, including that
`mcp_connections` has an **exact** column list — adding a field to it has to be a
deliberate act, because that is the only way a credential could ever leak into
the half the browser reads.

### `src/lib/connectors/shopify.ts` — the Shopify primitives

Shop-domain allowlist (an unchecked `shop` parameter is an open redirect and an
SSRF), the OAuth authorize URL with mandatory `state`, callback HMAC over the
sorted re-serialised query, and webhook HMAC over the **raw body** in base64.
16 tests in `tests/shopifyConnector.test.ts`, including the replayed-callback
case where a genuine signature is reused against an attacker's store.

### Still to build (in order)

1. `worker/` — `wrangler.toml`, OAuth start/callback routes, webhook route with
   raw-body HMAC verification, cron for order pulls and state cleanup.
2. A Settings card reading `mcp_connection_status`, with a Connect/Disconnect
   button calling `disconnect_mcp_connection`.
3. Order → invoice mapping, and the import ledger that makes a re-run idempotent
   (a webhook and a nightly pull will both see the same order).

### What Shopify needs from you

- A **Shopify Partner account** and an app; a **development store** to test
  against, which is free.
- The app's client secret and the redirect URI registered as
  `https://api.fatorati.tech/connectors/shopify/callback`.
- A decision on `api.fatorati.tech`: create the subdomain, or use
  `fatorati-connectors.<account>.workers.dev` for development.
- Scope confirmation: `read_orders` + `read_products`. Nothing else is requested,
  and nothing writes to a customer's store.
