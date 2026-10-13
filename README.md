# Fatorati / FatooraLaw

A React dashboard and marketing site for Moroccan small businesses, with
Supabase authentication, a protected blog CMS, and onboarding.

**Business records are still a local prototype, not a production ERP.**
See [SECURITY.md](SECURITY.md) and the [code audit](CODE_AUDIT.md) before
using real financial or client data.

### Documentation

| Document | What it covers |
| --- | --- |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | every source of `VITE_SUPABASE_*`, why a deployed site can still be unconfigured, and how to verify a live bundle |
| [docs/SEO_GEO_AIO_SXO.md](docs/SEO_GEO_AIO_SXO.md) | crawlability, per-page metadata, structured data, AI-answer-engine readiness and conversion/site-experience recommendations and backlog |
| [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) | this release's code scan: fixed defects, verified-correct areas, open findings |
| [CODE_AUDIT.md](CODE_AUDIT.md) | the earlier security/data audit (RLS, local storage partitioning, exports) |
| [SECURITY.md](SECURITY.md) | key handling, CSP, Turnstile, reporting a vulnerability |
| [SUPABASE_OPERATIONS.md](SUPABASE_OPERATIONS.md) | database setup, permissions, migrations |

Every screen has its own URL: the public pages (`/features`, `/assistant`,
`/pricing`, `/blog`, `/faq`, `/contact`, `/privacy`, `/terms`, `/cookies`), the
auth screens (`/login`, `/signup`, `/forgot-password`, `/reset-password`), the
dashboard (`/dashboard`, `/projects`, … `/settings`), the CMS (`/admin/*`) and a
real not-found page. **No URL contains a `#`**: the header/footer links are
pages, not fragments, and every public page is prerendered into its own HTML
document with its own title, canonical URL and structured data at build time
(see `docs/SEO_GEO_AIO_SXO.md`). The routing contract lives in
`src/lib/routes.ts`; the deploy configuration (`sitemap.xml`, `llms.txt`,
`_redirects`, one document per route) is generated from it, so it cannot drift.

The public homepage contains the full landing content: features, assistant,
about, benefits, pricing, resources, FAQ, contact and legal sections, plus the
standalone pages above.
The audience badge above the hero headline has been removed. Sign-up buttons
still open the existing email/password login, including Gmail addresses.

Landing visuals take inspiration from Atlassian's blue/white palette, readable
sans-serif hierarchy, enterprise navigation and restrained motion. Styling is
isolated in `src/marketing/landing.css` under `.landing-atlas`; the dashboard's
shared theme and authentication styling are unchanged. The landing uses a
self-hosted Inter variable font (OFL 1.1), not Atlassian's proprietary Charlie
Sans. Desktop features flyouts, mobile navigation and one-time section reveals
support keyboard use, cleanup and reduced-motion preferences.

## Run locally

Use Node **22.22.2+**, **24.15+**, or **26+** and the pinned pnpm version.

```sh
corepack enable
corepack prepare pnpm@10.34.3 --activate
pnpm install --frozen-lockfile
cp .env.example .env
# Set your Supabase project URL and public anon/publishable key in .env.
pnpm dev
```

The server listens on `0.0.0.0:5173` by default and accepts Arena's `.e2b.app`
preview hosts. Vite environment variables are included in the browser bundle:
**never put a Supabase service-role key in a `VITE_*` variable.**

If the login screen reports that Supabase is not configured, it now names the
exact cause instead of a generic message: a missing variable, swapped values, a
dashboard link pasted instead of the API URL, or a `service_role`/`sb_secret_`
key, which is refused rather than used. That diagnostic lives in
`src/lib/supabaseConfig.ts` (tests in `tests/supabaseConfig.test.ts`). Changing
`.env` requires a Vite restart; `.env.local` overrides `.env` and is ignored by
git.

**`VITE_*` values are inlined at build time**, which is the single most common
cause of "it works locally and the deployed site still says Supabase is not
configured": the deployment was built somewhere without the variables. `pnpm
dev` and `pnpm build` now print the verdict, a Cloudflare Pages build **fails**
instead of shipping an authentication-less site, `dist/build-report.json`
records what a build was configured with, and the setup screen names the
variable to fix. Every case, every source and every fix:
**[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)**.

### Running without Supabase credentials (development only)

Accounts live in Supabase, so with no usable credentials there is nothing to
sign in with. On a dev server only (`pnpm dev`), the login screen therefore
offers **Continuer en mode local (développement)**: an explicitly labelled,
opt-in local workspace backed by the browser-local record store, with no
Supabase account and no network request. It is remembered per tab, cleared on
sign-out, and the top bar keeps showing `Mode local (dev)` so it can never be
mistaken for a real account.

This path cannot reach a deployed site. `src/lib/localDevMode.ts` gates every
entry point on `import.meta.env.DEV`, which Vite replaces with `false` in every
`vite build` (any mode, including Cloudflare deploys), so `signInLocally()`
refuses and the dev-only UI is dropped from the production bundle
(`tests/localDevMode.test.tsx` pins this behaviour).**Never** work around a
Supabase configuration problem by weakening this flag or by shipping a
service-role key: configure the two public variables instead.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm audit
# Or the complete frozen-install/typecheck/test/build pipeline:
pnpm ci
```

Tests use React Testing Library / jsdom and embedded PostgreSQL (PGlite).
They require no real Supabase credentials. SQL tests stub Supabase's `auth`
schema and roles; they do not verify a hosted project's configuration.

`pnpm build` runs three steps: the client build, an SSR build of
`src/entry-server.tsx`, and `scripts/prerender.mjs`, which writes one real HTML
document per public route (injected content **and** its own head) into `dist/`,
together with the generated `sitemap.xml`, `llms.txt`, `_redirects` and the
`noindex` documents for private routes. The client hydrates over the prerendered
markup, so a crawler that does not execute JavaScript sees the same page a
visitor sees.

## Database and admin setup

Follow [SUPABASE_OPERATIONS.md](SUPABASE_OPERATIONS.md). New installations
use `supabase/schema.sql`; existing CMS installations must apply
`supabase/migrations/20261012_harden_profile_permissions.sql` to close the
profile-based admin privilege escalation. Updating frontend code alone is
not sufficient.

The CMS is at `/admin/login`. `profiles.is_admin` grants content-editing
rights; `platform_admins` controls billing/platform operations. These are
separate permissions.

## Dashboard data (no automatic business demos)

New accounts start with empty projects, contacts, expenses, stock, contracts,
team, subscriptions and audit collections. Company/registration/address/document
notes are blank; MAD and 20% TVA remain editable form defaults. Sign-in and later
user actions produce real local activity events, not sample actors.

The dashboard uses saved project budgets, cumulative entered collections,
approved expense amounts and positive client balances. Monthly expense charts
aggregate approved records by their actual dates, preserve cents and include
years in their labels. Future/out-of-period/invalid dates are not inserted into
historical charts. Empty charts stay empty; fixed growth percentages and invented
monthly income/cash-flow curves have been removed. Project payment totals have
no payment dates, so the dashboard does **not** estimate monthly income or a bank
balance. This is a record summary, not an accounting ledger.

Recognizable unchanged examples in old caches are excluded **only from the
dashboard view**, with an explanatory notice. No stored row is deleted or
rewritten. Edited, copied and uncertain rows remain visible; originals and
backups remain available in the other modules. Existing saved account records
and settings still hydrate normally; missing collections default to empty.
Reports also use recorded amounts and dated approved expenses, without estimated
VAT, net profit, monthly revenue or bank forecasts. These are summaries, not tax
filings or a reconciled ledger. Calendar and Risk still have separate static-demo
limitations. This does not enable cloud business-data synchronization.

## Legal vault and financial reports

The legal vault excludes recognizable unchanged cached sample contracts/clients
without deleting records. Edited/copied/uncertain contracts remain visible.
Creation cards are explicitly draft **metadata** entry forms, not pre-existing
contracts. Previews/PDFs show stored fields only: no fabricated clauses, company
identity, fixed jurisdiction or legal-certification badge. Sent/signed markers
are confirmed manual status changes; they do not send email, create electronic
signatures or record signature evidence. Full contract text is not stored yet.

Reports share the dashboard's real-record aggregation and conservative example
filtering. Exports contain exact monthly approved expense amounts/counts only.
TVA is labelled **non calculée** because invoices, tax bases and collected/input
VAT records are missing. Net profit and bank/cash forecasts are not inferred from
project budgets or contact balances. The old sine/cosine analytics and fixed 85%
forecast generator were removed. Recorded amounts retain cents; empty screens
remain empty. Neither module replaces legal/accounting review or a cloud ledger.

## Local data upgrade

Each authenticated user now has a separate local record store keyed by
Supabase user ID (`mizan.store.v2.<user-id>`). The lightweight dashboard auth
profile is never persisted or trusted as a session. Logout clears private
records from memory without deleting that user's saved records.

The old shared `mizan.store.v1` key is **preserved**, not automatically assigned
to whichever person logs in next. Settings shows a notice and an **Exporter
la sauvegarde ancienne** button when it exists. That JSON backup contains
business records, not the old auth profile. Keep it private; review ownership
before a manual migration. A full JSON restore workflow is not yet implemented.
Clearing browser storage still deletes local records; there is no cloud backup
for dashboard data yet.

Subscriptions now use the same per-account business store, so adding/removing an
item survives page navigation and relogin. Expiry uses the current calendar date;
the chart shows theoretical monthly costs from subscription dates, not payments.

Settings includes **Exporter mes données locales** for a business-only JSON
backup (including subscriptions, excluding auth/session objects). Storage quota
or availability failures show a warning rather than silently reporting a save.
Changes in that case stay in the current tab only: export before logout, idle
logout, reload or closing the tab. Unreadable cached JSON is preserved rather
than replaced with defaults; there is no automatic repair/restore UI yet.

Financial/stock entry rejects non-finite, negative or oversized values; signed
contact balances remain supported. TVA accepts explicit values from 0 to 100%,
not a blank input. Logos are limited to PNG/JPEG/WebP/GIF up to 512 KiB, with
MIME/signature/payload checks. These are client safeguards, not server-side
validation or a compliance certification.

Authentication is still the existing email/password flow (Gmail addresses are
supported); no Google OAuth or local-profile replacement was introduced. APK
download wiring is deferred until an actual file or download URL is available.

## Deployment

GitHub Actions runs install, type-check, tests, and build before deployment.
Set repository Actions variables `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` for authenticated builds, and the existing
Cloudflare deployment secrets in the repository's secure settings.
The workflow passes the source branch explicitly to Cloudflare Pages;
non-production branches should remain preview deployments.

If this repository is deployed by the **Cloudflare Pages Git integration**
instead (which is how `fatorati.tech` is served today), the two `VITE_*`
variables must also be set in the Pages project — *Production **and** Preview* —
and a new deployment must be triggered. The workflow's deploy step stays
skipped until `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` exist, and says so.
Step-by-step: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

The policies in `public/_headers` are applied by Cloudflare Pages, not by
`vite dev`. Analytics loads only after cookie acceptance. Optional Turnstile
requires both Supabase CAPTCHA configuration and the documented CSP changes.
