# Fatorati operations and package control

## What the schema controls

`supabase/schema.sql` adds:

- `plan_catalog`: Starter, Pro, Business, and Enterprise limits.
- `account_subscriptions`: the current package and billing-provider IDs.
- `usage_monthly`: monthly counters for users, records, storage, and API requests.
- `purchase_requests`: leads from the pricing/contact flow before payment is connected.
- `platform_admins`: protected CMS operators.
- Database triggers that stop new contacts, projects, and team members when a package limit is reached.

## First setup

1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Create the admin user in Supabase Authentication.
3. Replace the email in the commented bootstrap query at the bottom of the schema and run it.
4. Never expose a service-role key in the browser.

## Purchase flow

The pricing page can create a row in `purchase_requests`. An admin reviews the request and completes payment in the selected provider. After payment confirmation, update `account_subscriptions` from a trusted server or webhook, never from the browser.

Recommended provider fields are already available:

- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `current_period_end`

## Availability strategy

- Keep all customer data behind RLS and `auth.uid()`.
- Enforce package limits in Postgres, not only in React.
- Add provider webhooks for paid, past-due, paused, and canceled states.
- Increment `usage_monthly.api_requests` in an Edge Function or API gateway and reject abusive traffic with a 429 response.
- Apply rate limits at the edge for auth, purchase requests, uploads, and public endpoints.
- Monitor database size, storage, slow queries, failed logins, and error rates.
- Keep daily backups and test restoring them before launch.
- Use a maintenance/fallback page before migrations that may interrupt service.

The current React dashboard still uses Zustand for its business records. The next integration step is replacing each local store action with Supabase queries and handling the `plan_limit_reached` database error in the UI.
