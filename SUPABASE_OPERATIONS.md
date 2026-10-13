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

If these features are not yet installed, also run:

- `supabase/migrations/2026_add_cms_posts.sql`
- `supabase/migrations/2026_add_onboarding_responses.sql`

These are SQL Editor upgrade scripts, not a complete Supabase CLI migration
history. The fresh schema includes both sections and reapplies profile
hardening after its initial broad grants; rerunning the fresh schema must not
reopen admin-flag writes.

Inspect existing admin flags against the legitimate editor list. The patch
stops future unauthorized writes but does not automatically revoke already
compromised flags or repair edited posts.

## Two different administrator permissions

**Content editors** at `/admin` use `profiles.is_admin`. After creating the
editor's Auth account, run from trusted SQL (replace the email):

```sql
update public.profiles
set is_admin = true
where email = 'editor@example.com';
```

**Platform/billing operators** use `platform_admins`. The bootstrap query at
`schema.sql`'s platform-control section provisions this separate permission.
Adding an operator there alone does not grant CMS editor access.

Normal browser clients cannot modify either privilege. Do not put a
service-role key into frontend code to work around a permission error.

## What works against Supabase today

- Authentication, email confirmation, password-recovery sessions.
- Admin verification and CMS post create/read/update/delete with posts RLS.
- One-time onboarding checks and retry-safe response upserts.

The business dashboard still uses account-partitioned Zustand/localStorage
records. SQL tables for projects, expenses, contacts, and so on are **not yet
connected** to those store actions. Changing a plan in SQL does not currently
limit locally created dashboard records.

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
Supabase roles/`auth.uid()`. It covers fresh setup, incremental CMS setup,
profile-hardening reapplication, administrator publication, and draft isolation.
It does **not** apply anything to your live Supabase project or verify Auth,
redirect allowlists, CAPTCHA, Cloudflare headers, backups, or billing in that
hosted environment.
