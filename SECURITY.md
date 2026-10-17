# Security policy

Fatorati is a React SPA with Supabase authentication and a database-backed
CMS. Its business dashboard is still a local prototype. This policy describes
the current code, not a certification of the deployed service or Loi 09-08 / CNDP
compliance.

## Reporting vulnerabilities

Report privately to **security@fatorati.tech** (also listed in
[`public/.well-known/security.txt`](public/.well-known/security.txt)).
Include the affected feature, reproduction steps, and impact. Do not publish
client records, credentials, or exploit details in a public issue.

The project maintains one rolling version deployed from `main`; there are no
maintained older releases. The reporting targets remain acknowledgement within
3 business days and a status update at least every 7 days.

## Actual security boundaries

- **Supabase Auth** issues and refreshes real sessions. The dashboard does not
  persist its lightweight name/email/role profile as authentication and clears
  it if Supabase is unavailable or unconfigured.
- Dashboard roles are read from protected `profiles.role`, not user-editable
  `user_metadata`. Self-created accounts own their own workspace; future team
  roles must be assigned by a trusted server.
- **PostgreSQL grants and RLS** protect CMS records. Public readers see
  published posts; only `profiles.is_admin = true` accounts may edit content.
  Normal clients can update only their own profile name, not admin flags,
  roles, emails, or profile ownership, and cannot insert/delete profile rows.
- `platform_admins` / `is_platform_admin()` is a separate billing/operator
  permission, not the content-admin flag.
- Browser routing and module visibility are UX checks, **not access control**.
  They cannot protect financial data stored on a device from someone with
  devtools or access to that browser profile.

### Support access to customer accounts

`supabase/migrations/20261020_support_account_lookup.sql` (also in the fresh
schema) gives every account a shareable reference — `profiles.account_ref`,
format `FT-XXXX-XXXX` — so a client can ask for help without sending an email
address, a password or a document. The boundary is deliberate:

- The reference is an **identifier, not an authenticator**. It is readable by
  its owner, writable by nobody (`update (name)` is the only grant on
  `profiles`), self-service rotatable, and it grants no access to anything.
  Possessing one is not evidence of owning the account.
- `support_lookup_account()` returns a **masked** view and is restricted to
  `platform_admins`, rate limited to 30 resolutions per minute per operator.
- `support_reveal_account_email()` is the only path to a full address and
  additionally requires MFA (AAL2), matching activation-key issuance.
- Both write `admin_audit_events` **before** returning, so a resolution that
  produced data is always recorded. Anything that changes an account remains a
  separate, separately gated operation; a lookup cannot alter state.
- Ownership is verified by replying to the address on file, never to the
  address in a ticket. Tickets filed by signed-out visitors have no account to
  resolve and are reported as such.

Full operator procedure: [docs/SUPPORT_ACCESS.md](docs/SUPPORT_ACCESS.md).

### Required database patch

Apply `supabase/migrations/20261012_harden_profile_permissions.sql` to an
existing CMS installation. The old self-update policy allowed authenticated
users to set their own `is_admin` flag and bypass posts RLS. A frontend deploy
alone does not close that database vulnerability. The patch is also included
in the fresh schema and incremental CMS setup.

Review existing `profiles.is_admin` values against your authorized editor list
and investigate unauthorized changes; restricting future writes cannot undo a
privilege escalation that already occurred. Use a trusted SQL operator or
server-only service role for administrator provisioning. Never expose a
service-role key through the browser or a `VITE_*` variable.

## Server hardening rollout

Apply `supabase/migrations/20261024_server_security.sql` after the existing
migrations. It adds server ingestion budgets, same-tenant relationship checks,
MFA for admin-role/billing changes and protection against forged purchase/audit rows.
The matching Admin → Security page exposes MFA enrollment/verification.
These changes are **not live until applied**. Auth CAPTCHA, Auth rate limits,
OAuth redirects, infrastructure protection, monitoring and credential hygiene
still require deployment configuration. See [the server security runbook](docs/SERVER_SECURITY.md)
for exact boundaries, limits, manual steps and verification.

## Browser hardening

- Cloudflare Pages headers in `public/_headers` specify CSP, HSTS,
  clickjacking protection, `nosniff`, and restricted browser capabilities.
  These are deployment policies; Vite's development server does not enforce
  them. Preview-host support is limited to `.e2b.app`, not a blanket host allow.
- React renders text without `dangerouslySetInnerHTML`, `eval`, or
  `new Function`. Selected store/CMS fields are bounded/sanitized; that does
  **not** mean every input has complete validation or that sanitization
  provides database access control.
- CSV/XLS exports escape headers and cells; formula-like string values are
  neutralized. XLS output is an HTML table, not a binary Excel workbook.
- A wall-clock-based inactivity lock closes the local dashboard after
  20 minutes, including when background timers have been throttled.
- Local logout happens even if the Supabase request fails. A failed provider
  sign-out is not proof that server tokens were revoked; secure devices and
  server session policies are still required.
- Google Analytics is loaded only after cookie acceptance. No tracking script
  is injected into the initial HTML shell. Advertising permissions are denied;
  changed choices disable analytics in the current page.
- Optional Turnstile requires `VITE_TURNSTILE_SITE_KEY`, matching CAPTCHA
  settings in Supabase, and `https://challenges.cloudflare.com` added to
  `script-src` and `frame-src` in `public/_headers`. Test all configured auth
  and recovery forms before enabling it; see the audit's remaining limitations.

## Data storage and current limitations

**Do not use this as a production financial system yet.**

- The local workspace remains the app's primary source: projects, contacts,
  expenses, stock, contracts, subscriptions, team, settings and audit entries
  are partitioned in browser `localStorage` by Supabase user ID. This is not
  encryption or a device access boundary. An owner may explicitly opt in to a
  second Supabase mirror from Settings on an active PRO/BOOST plan; new
  backups are private File Storage JSON files, with RLS and server-enforced
  account/project quotas. Legacy JSONB mirrors are retained for recovery.
  Neither format is end-to-end encrypted. It is a backup copy, not live cross-device sync or a restore path.
  The mirror includes business contact/financial data; no auth session, ad
  platform credentials, tokens or passwords are included.
- Logout removes private records from active memory but keeps the account's
  saved local records. Legacy shared data is preserved for explicit backup
  and ownership review, not automatically reassigned to a new login.
- Business storage failures are surfaced with an export option; RAM-only changes
  are still lost on logout, idle logout, reload or tab/device loss. Settings and
  warning exports omit auth/session objects but include sensitive business data.
  Keep exported files private. There is no full JSON restore workflow yet.
- Numeric mutation bounds and logo size/type/signature checks are browser
  safeguards, not protection from a device user or substitutes for server-side
  record validation. Existing record arrays are not fully schema-validated.
- A local audit log is editable by a browser user. It is not an immutable
  compliance record.
- Team invitations do not send email, and local module permissions are not
  server-enforced shared-workspace permissions.
- Billing/pricing integration, transactional quota enforcement, tenant-scoped
  foreign keys, financial calculations, and some date-based modules need
  further work; see [CODE_AUDIT.md](CODE_AUDIT.md).
- Marketing assertions about encryption, secure hosting of all business
  records, multi-user access, and regulatory compliance must not be treated
  as verified guarantees.

Before real client data: implement tenant-aware server storage and permission
checks, server-side input validation, trustworthy audit logs, tested backups
and restore, reliable payment webhooks/quotas, hosted authentication and
recovery tests, and an actual privacy/legal review.

## Supply-chain checks

Both lockfiles are synchronized. CI includes type-checking, React/SQL regression
tests, and a production build; Dependabot remains configured for dependencies
and GitHub Actions. Registry advisory scans are a useful check, **not proof that
all dependencies or application code are vulnerability-free**.
