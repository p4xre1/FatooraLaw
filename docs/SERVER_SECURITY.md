# Server-side security hardening

This is a scoped review of the repository, not a penetration test, certification,
or a claim that the live service is secure. No production settings were changed
from this workspace. There is no application-owned web server: the browser talks
directly to Supabase Auth, PostgREST and Storage; Cloudflare serves the site.

## Deploy these protections

1. Back up the database and review existing administrators.
2. Apply the existing migrations in order, then
   **`supabase/migrations/20261024_server_security.sql`** through a trusted SQL
   connection / Supabase SQL Editor. Fresh setup includes it in `schema.sql`.
3. Deploy the matching frontend. Admin → Security now exposes the existing MFA
   enrollment/challenge panel. Verify an operator can complete MFA before testing
   role management. Keep a securely stored break-glass administration procedure.
4. Test with real Supabase accounts: user A must not read user B's data or attach
   B's contact/equipment/project IDs; a normal client cannot grant a paid plan or
   admin role; AAL1 operators cannot change roles, while AAL2 operators can; normal
   form submissions still succeed. Test anonymous purchase requests too.
5. Apply the **dashboard settings below**. SQL alone does not secure Auth or stop
   traffic before it reaches your database.

Do not paste service-role keys into chat, commit them, put them in `VITE_*`, or
send them to browsers. Only the public anon/publishable key belongs in a client
bundle. Rotate any **secret** that was ever exposed; hiding the frontend cannot
repair an exposed service credential.

## What this migration closes

| Gap | Server-enforced fix |
| --- | --- |
| Cross-tenant foreign-key references could pass PostgreSQL FK checks despite RLS | Triggers reject newly assigned contacts, vendors, projects and equipment UUIDs owned by another account. Ownership changes on these workspace rows are blocked. |
| Client inserts could claim a purchase was already paid or submit a different account ID | Non-operator REST inserts get the authenticated owner (or null for anonymous), `new` status and server timestamps. Oversized messages/company/seats are rejected. Operators need AAL2 to assert billing status. This is NOT a payment-verification endpoint. |
| Public forms and analytics could write without server throttles | Transactional, atomic database budgets apply even to direct REST/RPC calls, including rotated email addresses. |
| Role changes and direct billing edits accepted single-factor operator sessions | Both membership and JWT `aal2` are required to grant/revoke administrator roles and to edit plan/subscription/usage data or change purchase-request status. Restrictive RLS also blocks bypassing the activation-key MFA flow with a direct subscription edit. Last-admin protection and server audit triggers remain. |
| Browser clients could append plausible-looking admin audit events | Direct INSERT/UPDATE/DELETE is revoked; trusted database triggers/RPCs append actual events. |
| Schema/function permissions had excess client surface | Client CREATE in public is revoked; trigger functions and internal budget helpers cannot be invoked as client RPCs. |
| Anonymous purchase policy depended on reading private profiles | Separate anonymous/authenticated policies preserve anonymous intake without exposing profiles. Pending-deletion users cannot bypass their access stop by omitting user_id. |

The SQL budget table is RLS-enabled, with no client policies or table grants.
Scopes and limits are chosen by trusted triggers, never by a request parameter.
The counter updates serialize competing writes; failed writes roll back without
consuming successful-request allowance. Throttling raises `PT429` (HTTP 429 through PostgREST). It is not an IP ban or CAPTCHA.

### Current ingestion budgets

Budgets use rolling fixed windows from the first accepted write. These are shared
project safety limits suitable for initial small traffic, not per-visitor quotas.
Review and tune them when real traffic grows:

- Support: 3 accepted requests per normalized email/hour, 60 project-wide/hour,
  200 project-wide/day.
- Purchases: the same limits, independently of support; messages ≤10,000 chars,
  company ≤200 chars, seats ≤1,000. Email is user-supplied, **not verified identity**.
- Page views: 120/minute, 1,000/hour, 10,000/day, project-wide.
- Interaction events: 60/minute, 1,000/hour, 10,000/day, project-wide.
- Email budget keys are MD5 digests, used only to group submissions, not to hash
  secrets or authenticate. They are pseudonymous, not anonymous. Stale budget rows
  are removed opportunistically on the next accepted request after two days.
  No caller IP/header, raw email, token or password is stored in the budget table.

A bot can exhaust a shared limit and delay legitimate submissions. Rate limiting
reduces storage abuse; it cannot stop request floods, SQL CPU exhaustion, or all
forms of denial of service. Monitor errors and traffic. Configure upstream Auth
and traffic controls. Also schedule retention for support, purchases and analytics:
rate limits bound growth per window but do not bound lifetime database storage.
Use the existing operator-only `purge_site_analytics()` for analytics retention;
review legal/support retention before deleting customer communications.

## Required Supabase settings (manual; NOT enabled by this code)

Use the current Supabase Dashboard labels/settings for your project:

- Require email confirmation for password signups. Enable the provider's leaked-
  password checks and stronger password policies **where your plan supports them**.
- Configure **Auth rate limits and server-validated CAPTCHA** for the auth flows
  supported by Supabase. Setting `VITE_TURNSTILE_SITE_KEY` alone is not server
  protection. Test signup, password login, recovery and Google login separately.
- Enable TOTP MFA for operators, enroll a factor, and verify the session reaches
  AAL2. Protect the Supabase/GitHub/Cloudflare administrative accounts with MFA too.
- For Google OAuth, use the intended Google project/client, only the required
  identity scopes, and the exact Supabase callback. Configure exact production
  Site URL/redirect URLs in Supabase; avoid production wildcard redirect URLs.
- Limit direct Postgres network access to trusted operator/automation networks
  where supported; use TLS and least-privilege database/service credentials.
- Review Security Advisor findings and verify RLS on every private table. Keep
  the backup bucket private and do not add broad storage policies.
- Monitor Auth failures, database errors, storage/egress/database usage and logs.
  Test database backups/restores; Supabase Free does not provide the quoted Pro
  daily-backup retention. Keep a verified external backup before migrations.

## Required hosting controls (manual)

- Keep HTTPS/security headers enabled. Verify the deployed CSP, HSTS, nosniff and
  frame protection; repository files alone do not prove deployed headers.
- Enable the traffic/WAF/bot/rate controls offered by your Cloudflare plan. A WAF
  on the **website's domain does not protect direct requests to the project's
  `*.supabase.co` endpoints**. Do not claim it does; Supabase-side policies and
  Auth controls are still required. A fully gated API architecture requires a
  separately designed backend/proxy with direct-access enforcement.
- Patch dependencies; use restricted deployment credentials and protected review
  workflows. Do not treat disabled right-click, minification, browser input guards,
  or hidden admin URLs as server security boundaries.

## Existing data / scope limitations

This migration does not delete or silently rewrite old cross-tenant relationships.
Audit them with a trusted SQL operator before treating old records as consistent.
For example, a count-only check (does not export client names/emails):

```sql
select count(*) as cross_tenant_project_clients
from public.projects p join public.contacts c on c.id=p.client_id
where p.user_id<>c.user_id;

select count(*) as cross_tenant_expense_vendors
from public.expenses e join public.contacts c on c.id=e.vendor_id
where e.user_id<>c.user_id;
```

Also review contracts.client_id, stock_items.assigned_project_id and
projects.equipment_ids. Existing invalid relationships can be detached or replaced
with an authorized record, but unrelated edits are not automatically blocked.
RLS still controls record access; these triggers are defense in depth.

No end-to-end encryption, automatic incident response, general user login-MFA
flow, Google-account takeover protection, or complete API gateway was added here.
The local business workspace remains unencrypted browser storage. Account/role
protection cannot make a compromised device safe.

## Verification

`tests/serverSecuritySql.test.ts` executes real PostgreSQL policies/triggers via
PGlite for anonymous callers, two separate tenants and AAL1/AAL2 operators. It
covers forged purchases/audits, role escalation, last-admin retention, direct
endpoint budgets, helper permissions, foreign keys and equipment arrays. It does
not validate live Auth configuration, TLS, CAPTCHA, deployed gateway behavior or
Cloudflare settings. Complete the live smoke tests after deployment.
