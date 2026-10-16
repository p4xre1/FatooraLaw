# Fatorati database and operations

## New installation

1. Review and run **`supabase/schema.sql`** in Supabase's SQL Editor. It now
   includes the business schema, plans/billing tables, CMS, onboarding, and
   restricted profile-write grants.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in local/build
   configuration. Use only a public anon/publishable key, never a service role.
3. Configure Supabase's Site URL and allowed confirmation/recovery redirect
   URLs for your real domain and any trusted preview origins.
4. Create administrator accounts through Supabase Auth, then provision the
   required permissions from trusted SQL, as described below.

## Existing installation: security patch first

Run **`supabase/migrations/20261012_harden_profile_permissions.sql`** as a trusted
SQL operator. This restricts browser clients to updating their own profile name
and prevents self-promotion through `profiles.is_admin`. It clears both table
and pre-existing column-level write grants. It is safe to rerun.

For an existing installation, apply the incremental SQL Editor scripts in
this order:

1. `supabase/migrations/20261012_harden_profile_permissions.sql`
2. `supabase/migrations/2026_add_cms_posts.sql` if `public.posts` is absent
3. `supabase/migrations/20261013_cms_control_center.sql`
4. `supabase/migrations/20261014_cms_site_operations.sql`
5. `supabase/migrations/2026_add_onboarding_responses.sql` only if that feature
   is not already installed
6. `supabase/migrations/20261016_business_backup_mirror.sql` to enable the
   explicitly opt-in, RLS-protected local-workspace mirror in Settings

`20261013_cms_control_center.sql` creates or reuses the platform-control
foundation (`platform_admins`, `plan_catalog`, `account_subscriptions`,
`purchase_requests`, `usage_monthly`, and `is_platform_admin()`) before adding
CMS controls. The SQL excerpt you shared shows the workspace's
`public.subscriptions` table; that table is deliberately left untouched and is
not used for account billing. The incremental upgrade was smoke-tested against
a core-only schema with that table present.

These are SQL Editor upgrade scripts, not a complete Supabase CLI migration
history. The fresh schema includes the posts, platform and CMS sections and
reapplies profile hardening after its initial broad grants; rerunning the fresh
schema must not reopen admin-flag writes.

Inspect existing admin flags against the legitimate editor list. The patch
stops future unauthorized writes but does not automatically revoke already
compromised flags or repair edited posts.

## Two different administrator permissions

**Content editors** use `profiles.is_admin` for blog and website editing. After
creating the editor's Auth account, a trusted SQL operator can grant that role:

```sql
update public.profiles
set is_admin = true
where email = 'editor@example.com';
```

**Platform operators** use `platform_admins`. Bootstrap the first one only
from trusted SQL after their Auth account exists:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'operator@example.com'
on conflict do nothing;
```

A platform operator can also edit blog and website content. Content editors
cannot access billing/subscription administration, support requests, analytics,
security controls or backups. Normal browser clients cannot modify either
privilege; role changes use operator-gated, audited RPCs. Do not put a
service-role key into frontend code to work around a permission error.

## What the CMS control center provides

- Localized blog/page editors with server/static-rendered public article routes,
  canonical/SEO metadata, sitemap selection, previews and revision history.
- Website content and image assets, feature/release/download/product records,
  announcements, support inbox, analytics, admin audit and CMS JSON backups.
- Role-gated plan/subscription records, platform settings, notifications and
  account access administration.

The business dashboard still uses account-partitioned Zustand/localStorage
records as its primary source. The optional `business_backup_mirrors` table is a
secondary JSON snapshot mirror—not normalized live database records and not a
restore workflow. It is opt-in, per user and device, RLS-protected, and does not
store auth sessions, ad-platform credentials or tokens. Its JSONB payload is
readable to trusted project operators and is not end-to-end encrypted. SQL
business tables for projects, expenses, contacts, and the workspace's own
`subscriptions` remain **unconnected** to store actions. Editing the platform
plan catalog does not currently limit locally stored dashboard data.
No payment-provider integration or webhook is configured; purchase and download
analytics are intent/click events, not confirmed orders or payments.

## Plans, purchases, and availability

The schema defines `plan_catalog`, `account_subscriptions`, `usage_monthly`,
`purchase_requests`, and insert-time limits for contacts, projects, and team
members. These are groundwork, not a finished billing system:

- Pricing buttons currently open authentication, not purchase-request creation.
- Payment-provider webhooks and trusted subscription updates are not wired.
- Usage counters are not maintained by dashboard actions or an API gateway.
- Quota triggers need transactional/concurrency handling and must cover team
  reactivation, not only INSERT. See the audit before depending on them.

Before launch: enforce tenant relationships and role permissions in Postgres,
implement trusted provider webhooks, rate-limit auth/public endpoints/uploads,
handle `plan_limit_reached` in the UI, monitor errors/slow queries/storage,
keep tested daily backups, and rehearse restores and migrations.

## Validation scope

`pnpm test` exercises SQL grants/RLS using embedded PostgreSQL and stubbed
Supabase roles/`auth.uid()`. It covers fresh setup, migration reapplication,
platform-only blog publishing, published-versus-draft reads, support/event RPCs,
audit/revisions, backup restore and profile-hardening reapplication. It does
**not** apply anything to your live Supabase project or verify Auth, redirect
allowlists, CAPTCHA/rate limits, Cloudflare headers, Storage behavior, backups,
or billing in that hosted environment. Run the migrations against a staging
project first and rehearse a restore before production.

### Single-use plan activation keys

Apply `supabase/migrations/20261017_single_use_activation_codes.sql` after the
CMS control-center migration. It adds the BOOST plan enum value, the
`activation_keys` ledger, admin-only RLS, and the authenticated
`redeem_activation_key` RPC. CMS-generated keys are random and only their
SHA-256 digests are stored. Redemption is atomic and records the first
account UUID; a second account cannot reuse the key. The RPC also updates the
account's server-side `account_subscriptions` plan and period. Do not enable
key sales or advertise server-enforced entitlements until this migration is
applied to the production Supabase project.

### Activation-key security hardening

Apply `supabase/migrations/20261018_activation_key_security.sql` after the
single-use key migration. It requires Supabase MFA AAL2 for activation-key
issuance, listing, and revocation; the CMS subscription editor includes a TOTP
enrollment/challenge panel. Issue via the `issue_activation_key` RPC only.

The redemption RPC returns the same generic failure for malformed, unknown,
revoked, already-used, and rate-limited keys. It counts attempts per account
(8 per 15-minute window) and per gateway source digest (20 per 15-minute
window), stores no raw key or raw IP, and creates an audit event/admin warning
when the threshold is reached. The source digest is short-lived and old limit
rows are purged by subsequent attempts. Issuance, redemption, revocation, and
account plan changes are written to `admin_audit_events` without storing the
plaintext key or its hash in audit details.

The source rate-limit uses the Supabase/PostgREST request headers
`cf-connecting-ip` or `x-forwarded-for`; deploy only behind the trusted Supabase
edge that supplies those headers. If your proxy does not provide a trustworthy
client address, configure an edge-level rate limiter as well. An audit warning
is stored for repeated failures; configure operational monitoring to notify an
operator from `system_notifications`/`admin_audit_events`.

### Account deletion and recovery (30 days)

Apply `supabase/migrations/20261019_account_deletion_recovery.sql` **after** the
core schema and `20261016_business_backup_mirror.sql`. The settings action calls
`request_account_deletion`; this blocks workspace-table and optional-mirror RLS
access immediately, preserves the auth identity for 30 days, and permits a
successful sign-in during that window to reactivate through `reactivate_account`.
The immediate-erasure option removes the user's server-side workspace rows and
Supabase mirror as part of the same transaction. The browser also removes its
current account's local persisted workspace. Local copies on other devices are
not remotely addressable and must be erased on those devices separately.

The migration schedules a `pg_cron` job every 15 minutes to redact matching
support-inbox contact details and delete expired `auth.users` identities, which
cascades through user-owned server records and frees the email for a new signup.
Check `cron.job` for `fatorati-purge-deleted-accounts` after deployment. If
`pg_cron` is not enabled, enable it in Supabase Database Extensions and rerun
the final scheduling `DO` block in that migration; **without a functioning job,
permanent deletion is not automatic**. Monitor job run details and failed runs.
Validate sign-in/reactivation, cross-device RLS denial, immediate cloud mirror
erasure, and the scheduled hard purge in a non-production project first. Existing
sessions on other devices are denied database access by RLS, but local-only
records remain on those devices until erased there.

Monthly backend CSV exports and Gmail delivery are not implemented: no mail
provider, export job, or delivery monitoring is configured in this repository.
Do not tell users that monthly exports or update emails are already being sent.
