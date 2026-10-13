# Fatorati code audit

**Date:** 12 October 2026 · updated 13 October 2026

**Scope:** Repository audit plus a focused bug-fix follow-up; not a penetration test
or a claim that every bug has been found. No production database or deployment
was modified.

## Executive summary

The project builds and type-checks, but its main dashboard is not yet a
production financial system. It combines three different data models:

1. A multilingual marketing site and browser-local business dashboard.
2. Real Supabase authentication, confirmation, recovery, and onboarding.
3. A database-backed, Arabic-first admin CMS with Postgres RLS.

The most serious confirmed vulnerability was **self-service CMS administrator
privilege escalation**. An authenticated user could update their own
`profiles.is_admin` flag because row-level ownership policies did not restrict
columns. This defeated the posts policies that relied on that flag. The fix
is covered by real PostgreSQL grant/RLS tests and an incremental SQL patch.
**An existing hosted database must receive that patch; changing the frontend
alone does not fix it.**

Several runtime/data-handling bugs were reproduced with regression tests.
The repository now has **175 passing tests across 29 files**, plus passing type-check and
production build. Both lockfile advisory scans report zero known issues at
the time of this review. Important unfinished features remain below.

## How the code fits together

| Area | Entry points | Actual behavior |
|---|---|---|
| App bootstrap | `src/main.tsx`, `src/App.tsx` | React 19, Vite, Tailwind; URL routing only owns the `/admin/*` subtree. Business modules use local active-screen state and lazy imports. |
| Marketing | `src/marketing/Landing.tsx` | French/English/Arabic copy, theme toggle, full homepage plus dedicated pages. Homepage navigation uses section anchors; public blog copy is still static. |
| Main auth | `src/components/Auth.tsx`, `src/hooks/useSupabaseAuth.ts` | Supabase sessions bridge to a lightweight in-memory dashboard profile. Roles come from protected profiles. |
| Alternate/admin auth | `src/modules/auth/*`, `src/admin/lib/adminAuth.ts` | Reusable translated forms; admin verification checks Auth and `profiles.is_admin`. |
| Business data | `src/store/useMizan.ts`, `types.ts`, `defaults.ts` | Empty new-account business collections and neutral settings, still stored locally and partitioned by Supabase user ID. Existing saved records remain preserved. |
| Finance | `src/lib/dashboardData.ts`, `Dashboard.tsx`, `Reports.tsx` | Both use recorded totals and actual expense dates. No generated revenue trends, tax/net calculations or bank forecasts; a dated payment/tax ledger is still absent. |
| Legal vault | `src/modules/LegalVault.tsx`, `src/lib/legalData.ts` | Read-only filtering of known examples, user-entered draft metadata, factual previews and explicit manual status tracking. No certified contract text, electronic signatures or email transport. |
| CMS | `src/admin/blogs/*`, `ProtectedRoute.tsx` | Posts CRUD against Supabase. Browser gate is UX; grants and posts RLS are access control. |
| Onboarding | `useOnboarding.ts`, `OnboardingModal.tsx` | Checks for a user-owned response row; retries use upsert. |
| Database | `supabase/schema.sql`, `supabase/migrations/*` | Business tables, per-user RLS, plans/billing groundwork, CMS, onboarding; SQL Editor setup scripts. |
| Delivery | `vite.config.ts`, `public/_headers`, `.github/workflows/deploy.yml` | Static Cloudflare Pages build; production headers, consent-gated analytics, branch-specific deploy command, CI checks. |

## Confirmed issues fixed in this branch

| Severity | Finding | Fix / evidence |
|---|---|---|
| **Critical** | Normal users could promote their own profile to CMS admin, then read drafts or edit posts. | Revoke profile table/column writes, drop self-insert/delete policies, permit only own-name updates. SQL tests cover denial, authorized publication, draft isolation, reruns, and the standalone patch. |
| **High** | Fresh `schema.sql` did not include the CMS or onboarding tables despite instructions saying it did. | Both sections and profile hardening are now part of the single-script setup. Fresh-install PostgreSQL test verifies both tables exist. |
| **High** | Persisted local auth was trusted without Supabase configuration; logout could leave local auth active. | Authentication is not persisted/hydrated. Missing configuration and session failures clear auth; local logout runs even if the provider fails. |
| **High** | Roles came from user-editable Auth metadata and an old cached profile could override a current session. | Query protected `profiles.role`; ignore metadata for permissions. Fresh signup schema sets workspace ownership server-side, not from a submitted role. Public role selection and dead demo-login code removed. |
| **High** | Dashboard records were shared under one storage key across all accounts using the same browser. | Partition by verified Supabase user ID; clear private records from active memory on logout/account switch. Tests verify isolation, restoration, corrupted-cache handling, and no auth hydration. |
| **High** | Out-of-order session/profile/admin responses could reopen UI after sign-out or display another account's old records during verification. | Revision checks invalidate stale work; account changes immediately hide previous records. Auth work is deferred out of the provider callback. Tests cover initial-load, in-flight profile, deferred admin, and account-change races. |
| **High** | Excel HTML exports embedded unescaped field values; CSV/Excel strings could be interpreted as spreadsheet formulas. | Escape headers/cells, neutralize formula-like strings, keep real numeric negatives. Tested with markup, formula, quote, and CR payloads. |
| **Medium** | Tab visibility changes reset inactivity; throttled timers let a first interaction revive an expired session. | Use a wall-clock deadline; visibility only checks time, and activity cannot revive an expired lock. Four timeout/cleanup tests. |
| **Medium** | Unknown non-owner users received every module; inactive members were not denied; fallback always rendered dashboard. | Fail-closed permission map, normalized email matching, active-member checks, first-permitted-module fallback or an explicit no-access screen. |
| **Medium** | Milestone clicks changed the store but the open modal kept a stale project snapshot. | Store the project ID and derive the current project from state. Test clicks twice without closing the modal. |
| **Medium** | Shared Toggle buttons submitted enclosing forms, including the CMS editor. | Shared non-submit controls default to `type="button"`; explicit submit buttons still work. Regression test verifies no submission. |
| **Medium** | Navigating from an existing article to a new draft could retain the old article's fields. | Reset editor state/loading on route changes and ignore canceled errors. Route-level regression test. Initial blog-list failures also stop loading and offer retry. |
| **Medium** | CSV import split quoted multiline records, silently accepted unclosed quotes, and lacked useful failure feedback. | Record-level parser handles BOM/CRLF/commas/escaped quotes/newlines. Import catches errors, limits file/row sizes, and rejects non-finite balances. |
| **Medium** | Deferred export errors escaped the promise and callers could remain busy forever. | `runAsync` rejects failures; dashboard/report callers catch them and clear busy state in `finally`. Tested promise failure. |
| **Medium** | Onboarding was keyed only by signed-in boolean; account changes could reuse stale checks. Inserts were not retry-safe. | Key by user ID, guard stale completions, catch failures, and upsert own response. Four hook tests including account change and interrupted submissions. |
| **Medium** | Thrown authentication requests left main/modular login, signup, or reset-request forms loading. Main password policy also differed from the shared policy. | Catch/finally in all handlers; align new-password minimum and validate the maximum as UTF-8 bytes. Form/network and validation tests. |
| **Medium** | Analytics was injected unconditionally despite the consent banner, and its origins were blocked by the production CSP. | Remove shell injection; load only after acceptance, disable on changed consent, allow only needed GA script/API origins. Consent tests and generated-HTML check. |
| **Low** | Corrupted current-version language values could crash auth/dashboard dictionaries. | Validate current-version persisted language as well as migrations; clamp dashboard locale and handle disabled storage. |
| **Low** | Team activation/deactivation audit messages described the opposite action. | Read the updated active state correctly; regression test verifies both directions. |
| **Low** | Page structured data referred to the misspelled `fatoriti.tech` domain. | Marketing and build now share the configured `fatorati.tech` origin. |
| **Maintenance** | The npm lockfile lacked react-router and disagreed with pnpm; dev dependencies had 22 registry advisories and React did not meet router peer requirements. | Synchronize both locks, update compatible dependencies, meet router peer requirements. Current npm/pnpm audits report zero known issues. Node requirement now reflects actual test-tool minimums. |
| **Maintenance** | Deployment `if` directly referenced unavailable secrets context; builds had no explicit Supabase variable wiring or regression-test step. | Use a job-env credentials-presence flag, add public build variables and tests, and pass the deployment branch explicitly using a safely quoted shell variable. Local pipeline checked; GitHub-hosted execution not run. |

### Follow-up: retain login, fix remaining data/UI bugs

The existing **email + password authentication remains**, including Gmail email
addresses. No local-profile login or Google OAuth was added. An APK download is
deferred until an actual APK file or download URL is supplied.

- **Invalid numeric mutations:** reject negative, non-finite and oversized
  financial/stock values before mutating state. Validate partial project/contact
  updates and the whole contact import atomically. Signed contact balances remain
  valid. Monetary/quantity limits match the ranges of `numeric(14,2)` and
  `numeric(14,3)`; this is not decimal-precision accounting or server validation.
- **Tax/settings feedback:** retain the tax draft as text so blank cannot silently
  become zero; allow valid zero and rates through 100%. Disable invalid saves,
  catch errors, reset stale success messages, and clean up the feedback timer.
  Document notes retain their text and line breaks.
- **Logo uploads:** cap raw images at 512 KiB and validate the saved data URI,
  declared raster type and PNG/JPEG/WebP/GIF signature. Reject empty, unsupported
  or oversized uploads before reading. Ignore canceled results, handle reader
  errors, and abort reads on replacement/removal/unmount. These checks are not a
  full image decoder or malware scan.
- **Lost subscriptions and incorrect expiry:** store tools in the existing
  business-only per-account cache, restoring additions/removals after navigation
  and relogin. Older account caches without `tools` now use an empty default;
  an explicitly empty list stays empty. Use calendar dates and refresh at local
  midnight/tab resume. Expired/future subscriptions are not counted as active.
  Replace the fixed trend/+12% with date-derived *theoretical monthly costs*,
  explicitly not bank-payment history or prorated invoices.
- **Stale supplier search:** recompute expense matches when contact names change,
  without requiring the user to change their search text.
- **Account/import races:** cancel stale CSV completions on navigation, newer
  imports and account changes; they cannot mutate another account's records.
  Remount business views on account changes so drafts/modals cannot retain the
  prior account's fields. CSV/spreadsheet export errors now have UI feedback.
- **Local storage failures:** quota/unavailable writes retain in-memory changes
  and show an account-specific warning with business-only backup export and an
  unload warning. Settings never claims a failed write was saved. Unreadable JSON
  originals are preserved instead of overwritten with seeds; writes to that key
  stay blocked until a readable hydration succeeds. Export while the tab is open:
  logout, idle logout, reload or device/browser loss can still discard RAM-only
  changes. Backup export is not a complete restore workflow.

The initial follow-up regression run reproduced **16 failures**; a separate
pending-import run reproduced **two account/navigation races**. The final full
suite, including the earlier auth and PostgreSQL regressions, passes.

### Clarified landing-page update

The public landing page is retained. Only the audience badge above the hero
headline was removed (in all three languages); no marketing page was deleted.
The homepage now includes all existing feature, assistant, about, benefit,
pricing, resource, FAQ, contact and legal sections. Desktop/mobile navigation
uses section anchors, with spacing below the sticky header and support for
bookmarked/cross-page targets. Standalone public pages still render normally.
Explore scrolls to features, while sign-up still opens the original email/password
login. Previous auth, account-isolation, canonical and consent fixes are retained.
React/SSR regressions cover the complete content, removed badge, language switch,
mobile/desktop links, login round-trip and absence of private account fields.

### Landing-only visual restyle

At the user's request, the public landing adopts an Atlassian-inspired light
blue/white palette, navy headings, self-hosted Inter typography, a sticky
responsive navbar with a features flyout, and restrained reveal/hover motion.
Branding and all existing content remain Fatorati's; the removed badge stays
removed. The proprietary Atlassian brand font is not included. Inter's OFL
license and provenance are stored with the public font files.

New styles are confined to `.landing-atlas` in `src/marketing/landing.css`;
`useLandingMotion.ts` affects only that page. Reduced-motion preferences are
respected and content has no opacity-hidden base state. Escape/ArrowDown,
outside dismissal, responsive menu closure and observer/scroll-lock cleanup
have regression coverage. SHA-256 comparison confirmed all 82 non-landing
application/config files were unchanged during this restyle, including the real
dashboard, shared CSS, auth, store, SQL and private Supabase configuration.

Headless Chromium verified eight widths from 320 to 1440 px without horizontal
overflow; self-hosted font loading, sticky anchors, desktop/mobile menu behavior,
normal/reduced motion and zero page errors. Opening the existing login confirmed
its original font/button theme remains intact outside the landing scope. These
checks do not independently verify a live Supabase account sign-in.

### Dashboard demo-data removal

At the user's subsequent request, Dashboard now uses `dashboardData.ts` instead
of the synthetic analytics series. The invented +8.2%/+3.1% chips, budget-as-revenue,
unmeasured bank liquidity and manufactured income/cash-flow plots were removed.
Cards explicitly describe project budgets, cumulative entered collections,
approved entered expenses and positive client balances. Expense charts and CSV/
Excel exports use dated approved records in the selected period, excluding
future/out-of-period/invalid dates; labels include years and amounts retain cents.
Project budget/collection comparisons have no inferred payment dates. Empty
states, real local activity and zero-height zero bars replace fake content.

New-account collections are empty and business identity/settings are neutral.
MAD and 20% TVA are editable defaults, not proof of a business's registration/tax
status. Existing account arrays/settings, legacy caches and unreadable originals
are still preserved by the same safe persistence layer. Dashboard filtering of
known original examples is read-only: reserved IDs/unchanged fingerprints and
coherent historical dates/audit batches are used conservatively. Edited/copied
or uncertain rows stay visible; no saved record is deleted or rewritten. Older
examples may remain in the other modules and backups. This is not a full schema
migration, ownership certification, restore workflow or cloud ledger.

Regressions cover empty accounts, exact dates/status/range behavior, year/locale
boundaries, minor units, invalid input, historical/edited/uncertain sample rows,
cache preservation, real audit ordering, export availability and zero bars.
Existing fixture-based tests now load fixtures explicitly. Isolated browser-only
component QA verified empty/reactive real-entry states at four viewport widths
with zero page errors; no QA route was added to the app and no hosted account
was used. All 17 protected landing/auth/environment/style/dependency files were
unchanged in this task; the landing-page restyle is retained.

### Legal vault and financial-report example removal

At the user's follow-up request, legal documents/clients now use a conservative
read-only example filter. It recognises original reserved IDs/unchanged fields
with coherent historical contract dates or audit evidence; modified/copied and
uncertain rows remain available. Stored arrays/settings/backups are not deleted,
rewritten or assigned new ownership. The original placeholder business identity
is not presented as the user's company in a legal preview.

The template cards are explicitly metadata-entry structures, not saved examples
or certified contracts. Factual previews show stored title/type/client/date/value
and manually declared status. Fake boilerplate clauses, fixed Casablanca court
jurisdiction and compliance badges were removed. Date-only display uses UTC to
avoid previous-day shifts; amounts retain minor units. Confirmation is required
before manual sent/signed status changes, and audit messages describe marking a
status—not actual mail delivery or signing. No contract body, signature proof,
email transport or electronic-signature workflow is implemented.

Reports now uses the same recorded totals/date/status filters as Dashboard.
There is no VAT-from-margin, net-profit formula, fixed 85% cash forecast or
synthetic monthly income. Tax status is explicitly unknown/not calculated,
rather than a zero tax bill. Expense exports show exact monthly approved values
and entry counts; empty states and exporter failures are handled honestly.
The unused synthetic finance generators were removed from `analytics.ts`.

Regression tests cover old-runtime/contract-only example batches, edited/uncertain
and invalid records, unchanged storage, identity placeholders, dates/cents,
creation/status confirmation, truthful previews and report exports/errors.
Isolated browser component QA verified empty and entered-data states at four
widths per screen with zero page errors; no test route or real hosted account
was added/used. All 18 protected landing/dashboard/auth/style/environment/lock
files remained unchanged; the existing landing design and Dashboard UI remain.

### Legacy-data safety

The old `mizan.store.v1` data is **not deleted or automatically reassigned**.
Settings provides a notice and a JSON-backup export when it exists. The export
omits the old auth profile. There is no complete JSON restore/migration UI yet;
review the rightful account before importing old records. Per-account local
storage is not encryption or a security boundary against device access.

## Important remaining issues — not fixed in this pass

### P1 — blockers before real financial/customer data

1. **Business modules still have no server persistence or shared tenant model.**
   - `src/store/useMizan.ts`, `supabase/schema.sql`.
   - No cloud backup, multi-device state, trustworthy audit, or server-enforced
     team permissions. `inviteMember()` only adds a local row; no invitation
     email is sent. New accounts now initialize empty; existing account records are preserved.
   - Next: explicit workspaces/memberships, server CRUD/RLS, validated mutations,
     backup/restore, and real invitation handling.

2. **Financial charts/report calculations are not real accounting.**
   - The dashboard no longer uses synthetic trends, estimated bank balances or
     revenue inferred from budgets. It displays recorded project totals and dated
     approved expenses, with empty states and preserved currency minor units.
     Cumulative project collections still have no dated payment history.
   - Reports now shares the recorded-data aggregation. Generated monthly
     revenue allocation, margin-based VAT, net-result subtraction and the fixed
     85% collection forecast have been removed; the shared analytics module
     contains locale month labels only.
   - VAT is explicitly not calculated: invoice dates, HT/TTC bases, exemptions,
     output/input VAT, dated payments and a reconciled ledger are not available.
     Recorded summaries are not filing-ready financial statements.
   - `src/components/charts.tsx`: zero values no longer draw a fake two-pixel
     bar. Current charts use nonnegative recorded amounts; a future signed/net
     ledger would still require a signed scale and additional rounding tests.
   - Next: dated invoices/payments/expense ledger, explicit HT/TTC/input/output
     tax treatment, rounding/reconciliation tests, truthful demo labels, and a
     qualified accounting review. Do not make business decisions from the
     existing report numbers.

3. **Record schemas, restoration and server validation are still incomplete.**
   - The follow-up fixes numeric mutation bounds, tax/logo limits, stale work,
     and visible local-save failures. Existing malformed/tampered record arrays
     are not fully schema-validated or automatically repaired.
   - There is no decimal-precision ledger, uniform domain/foreign-key validation,
     cross-tab synchronization, cloud backup or complete JSON restore workflow.
     Local quotas can still be exhausted; a warning/export is recovery assistance,
     not guaranteed persistence.
   - Next: shared versioned record schemas, ownership-aware restore, validated
     tenant/server mutations, decimal/rounding rules, and recovery tests.

4. **SQL tenant relationships and quotas need production hardening.**
   - `supabase/schema.sql`: foreign keys link record IDs without enforcing
     matching `user_id` on both sides. RLS on a referenced table does not itself
     validate that the referenced row belongs to the requesting tenant.
   - Quotas use `count(*)` at INSERT time with no transactional serialization.
     Team reactivation bypasses the active-member quota because UPDATE is not
     covered. Purchase-request INSERT can submit status values other than `new`.
   - Usage counters and payment-provider webhooks are not maintained. Pricing
     buttons call `onEnter`, not purchase-request/subscription creation.
   - Next: tenant-scoped composite relationships, transactional quota/counter
     design, activation/ownership-update coverage, locked lead status, trusted
     billing mutations/webhooks, and concurrency tests on hosted PostgreSQL.

5. **Hosted security/privacy promises are not verified.**
   - Some landing/sidebar/legal copy still claims secure hosting/encryption,
     authorized multi-user access or compliance while business records remain local.
     Settings now explicitly describes local, non-encrypted business storage.
   - Optional Turnstile requires production CSP/auth settings; its widget/token
     lifecycle across forgot-password navigation and failed attempts needs work.
     Do not assume enabling the site key alone protects all auth forms.
   - Validate Supabase redirect lists, confirmation/recovery, rate limits,
     service-role protection, Pages headers, admin provisioning, and backups
     against the actual hosted environment. Review existing admin flags after
     applying the patch. No such live access was available during this audit.

### P2 — functional completeness and maintenance

- **Calendar/risk modules are demo data.** Calendar is permanently September
  2026 and previous/next buttons have no handlers; risk statuses/dates are
  static rather than derived from account records or the current date.
- **Publishing does not update the public blog.** The marketing blog displays
  translated static cards; it does not call the CMS posts client or provide
  public article routes. The admin CMS writes a different source of truth.
- **Prerendering is not connected.** `pnpm build` does not create the SSR bundle
  or invoke `scripts/prerender.mjs`. Wiring it directly would also need matching
  initial auth/hydration output and per-page routing; current ready/loading UI
  differs from `entry-server.tsx`'s Landing-only markup.
- **Deployment hygiene/performance.** `node_modules/` and `dist/` are ignored but
  already tracked in Git. Clean these up separately rather than mixing thousands
  of generated-file changes into this audit. The initial JS chunk remains about
  669 kB minified / 197 kB gzip; consider lazy-loading admin/auth/marketing areas.
- **Accessibility and narrower UI cases.** Shared dialogs lack focus trapping
  and full dialog labeling; many icon-only controls need accessible names.
  The supplier-search dependency is now fixed; more
  browser/mobile/RTL/keyboard checks are still needed.

## Validation performed

- Restored a frozen-lockfile toolchain in an ignored temporary location; avoided
  modifying tracked vendor files.
- Ran TypeScript checking across app, test, and configuration files.
- **175 automated tests across 29 files**: React forms/hooks/routes, account storage, permissions,
  CSV/Excel exports, consent, idle lock, and embedded PostgreSQL grants/RLS;
  plus numeric bounds/atomicity, subscriptions, calendar dates, logo reader races,
  storage failures/backup, and account-specific drafts/pending imports.
- Fresh schema, standalone CMS/onboarding setup, rerun behavior, and incremental
  profile-hardening migration checked in PGlite with stubbed Supabase roles.
  `pgcrypto` extension installation is excluded from the embedded fixture;
  PostgreSQL's built-in `gen_random_uuid()` supplies test IDs.
- Production Vite build and generated-HTML check: no GA script before consent.
- npm and pnpm registry advisory scans: **0 known vulnerabilities** after updates.
- Frozen pnpm lockfile install and shell-script syntax checks.
- Arena-host HTTP smoke checks: `/`, `/admin/login`, `/pricing/`, and the client
  entry module return 200; the updated Settings/Tools modules also return 200.
  An untrusted host is rejected with 403.
- Patch whitespace check (`git diff --check`).

Not performed: live Supabase migrations, hosted Auth/CAPTCHA/payment tests,
Cloudflare deployment, GitHub-hosted workflow execution, multi-user concurrency
load tests, full real-browser/mobile accessibility checks, or legal certification.

## Recommended next order

1. Apply the profile security patch to any existing CMS database and review
   administrator flags.
2. Replace browser-local financial storage with tenant-aware Supabase data and a
   validated ledger; correct reports before adding more finance features.
3. Connect real team invitations, transactional quotas, usage, and billing.
4. Make calendar/risk use persisted dated records and wire public CMS posts;
   integrate subscriptions with the eventual real billing/payment ledger.
5. Finish deployment/restore/security smoke tests, accessibility, and bundle work.
