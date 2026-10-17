# Google sign-in

The login screen (`/login`) offers **Continuer avec Google** alongside the
email/password form. It uses [Supabase's hosted OAuth flow](https://supabase.com/docs/guides/auth/social-login/auth-google):
the browser leaves the app for Google, comes back to `/login`, and
`supabase-js` turns the callback into a normal Supabase session. Everything
after that — the `profiles` lookup, role assignment, plan gating, onboarding,
idle logout — is the same code path as a password sign-in.

Nothing in this repository can turn Google sign-in on by itself: the Google
client secret belongs in Supabase, not in a `VITE_*` variable. The steps below
are a one-time dashboard setup for the project operator.

## What is already implemented

| Piece | Location |
| --- | --- |
| "Continuer avec Google" button + divider | `src/components/Auth.tsx` (login view) |
| Google mark / shared button | `src/modules/auth/components/GoogleButton.tsx` |
| OAuth start, redirect URL, error mapping, callback errors | `src/modules/auth/lib/googleAuth.ts` |
| Session pickup from the callback URL | `detectSessionInUrl: true` in `src/lib/supabase.ts` |
| Profile + company row for first-time OAuth users | `handle_new_user()` trigger in `supabase/schema.sql` |

No new environment variable is required, and `public/_headers` needs no change:
the flow is a **top-level redirect**, not an embedded Google script or iframe.
(If Google One Tap / the GIS JavaScript library is added later, the CSP must be
opened for `https://accounts.google.com/gsi/…`; that is not part of this
implementation.)

**Privacy copy:** the `/privacy` and `/cookies` pages now describe Google
sign-in as an optional identity provider (name, email address and profile
picture; Google's own cookies on Google's domains). Have that wording reviewed
for your entity before enabling the provider, as you would any policy change.

## 1. Google Cloud Console

1. Open <https://console.cloud.google.com/> and create (or select) a project.
2. In the **Google Auth Platform** console (older projects show it as
   **APIs & Services → OAuth consent screen**):
   - **Audience**: User type **External**.
   - App name, user support email, developer contact email.
   - **Data Access (Scopes)**: only `openid`, `.../auth/userinfo.email` and
     `.../auth/userinfo.profile`. The app does not request Gmail, Drive or any
     other Google API.
   - While the audience is in **Testing**, only listed test users can sign in.
     Add yourself, test the flow, then **Publish app** before launch.
3. **Google Auth Platform → Clients** (older UI: **APIs & Services →
   Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**.
   - **Authorized JavaScript origins** (for the dashboard/consent flow):
     - `https://fatorati.tech`
     - `http://localhost:8443` (the dev server; use the exact origin your
       `npm run dev` prints if it differs)
     - any preview origin you actually use
   - **Authorized redirect URIs** — this is the **Supabase callback**, not the
     app's login page:
     - `https://xithosetdfwoqbxmufvw.supabase.co/auth/v1/callback`
     - If you point a build at another Supabase project
       (`VITE_SUPABASE_URL`), add that project's
       `https://<project-ref>.supabase.co/auth/v1/callback` too.
   - Copy the **Client ID** and **Client secret**.

The redirect URI must match exactly: no trailing slash, `https` (not `http`)
for the hosted project.

## 2. Supabase Dashboard

1. **Authentication → Providers → Google**: enable the provider, paste the
   Client ID and Client secret, save. Leave the optional/native settings at
   their defaults.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://fatorati.tech`
   - **Redirect URLs** — add every origin/path the app can return to. The app
     redirects to `<current origin>/login`:
     - `https://fatorati.tech/login`
     - `http://localhost:8443/login` (or `http://localhost:*/login` while the
       dev port varies)
     - `https://**.pages.dev/login` (Cloudflare Pages previews)
     - `https://**.e2b.app/login` (sandbox previews, if used)
   - The `**` globstar is required here: a single `*` does not match `.` or
     `/` in Supabase's redirect matcher. Missing entries produce the
     "adresse de retour … n'est pas autorisée" message on the login screen
     (and a 400 from Supabase).
3. **Existing email/password accounts**: Supabase Auth automatically links a
   new OAuth identity to an existing account when both report the same
   **verified** email address, so a password user can switch to Google without
   creating a second account. If the addresses differ, the user can still sign
   in with Google and will get a separate account; use
   `supabase.auth.linkIdentity({ provider: "google" })` from a signed-in flow
   if you want to offer manual linking. Never link an identity on the basis of
   an unverified address.

## 3. Verify

1. `npm run dev` (or deploy a preview), open `/login`.
2. Click **Continuer avec Google** → choose an account → Google may ask for
   consent → the browser returns to `/login`.
3. `supabase-js` consumes the callback, `useSupabaseAuth` loads the profile and
   the app opens the dashboard. A first-time Google user gets a `profiles` row
   and a `company_settings` row from `handle_new_user()`, with the `owner`
   role (the same as an email/password signup).
4. Sign out, sign in again: the flow should go through without the consent
   screen the second time (Google remembers the grant).

## Troubleshooting

| What you see | Cause / fix |
| --- | --- |
| "La connexion Google n'est pas encore activée pour ce site." | Provider not enabled in **this** Supabase project, or the bundle points at a different project. Enable it in Authentication → Providers → Google and check `VITE_SUPABASE_URL` / `build-report.json`. |
| "l'adresse de retour de ce site n'est pas autorisée dans Supabase" | Add `<origin>/login` to Authentication → URL Configuration → Redirect URLs. |
| Google shows `Error 400: redirect_uri_mismatch` | The Google OAuth client is missing `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI (exact match, no trailing slash). |
| Google shows "Access blocked" / "app not verified" | The consent screen is in Testing and the account is not a test user, or the app is not published. Add the user or publish the app. |
| A Google sign-in creates a second account instead of using the existing one | The Google email differs from the password account's email, or one of them is unverified, so automatic linking did not apply. Sign in with the original method and link the identity explicitly (see step 2.3), or ask the user to use the same verified address. |
| "Database error saving new user" | The `handle_new_user()` trigger is missing or outdated. Run `supabase/schema.sql`, or the relevant migrations, on the project. |
| The button is absent | The build has no usable Supabase configuration (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`), so hosting OAuth is impossible. The setup notice above the form names the variable to fix. |
| Login returns but the app bounces back to `/login` | The profile row is missing (trigger) or `profiles` RLS denies the read. Check the browser console and the Supabase Auth logs. |

## Security notes

- The Google client secret never reaches the browser: it is stored in Supabase,
  and the public bundle only knows the Supabase project URL and anon key.
- `redirectTo` is built from the current origin plus the fixed `/login` path.
  No user-controlled `next`/`redirect` parameter is forwarded, so the screen
  cannot be used as an open redirect.
- `prompt=select_account` is sent so a shared computer does not silently reuse
  the previous Google account.
- Raw provider error text is mapped to a small set of user-facing messages; the
  app does not render `error_description` verbatim.
- Google sign-in is deliberately **not** enabled on `/admin/login`. Admin
  accounts are provisioned out of band and keep the password + MFA/Turnstile
  path described in `SUPABASE_OPERATIONS.md`.
