# Code scan — findings, fixes and open items

**Date:** 13 October 2026 · **Scope:** whole repository (81 source files, 32 test
files, build configuration, deploy configuration, generated artifacts).
**Method:** static reading (grep for known defect patterns, then file-by-file
review of the routing/auth/build/store layers), plus execution: `tsc --noEmit`,
`vitest run` (227 tests) and `pnpm build` including a full prerender of the 12
public routes.

This complements [CODE_AUDIT.md](../CODE_AUDIT.md), which covers the earlier
security audit (privilege escalation, RLS, local storage partitioning). Nothing
here contradicts it; the findings below were still present after that audit.

---

## 1. Fixed in this change

### 1.1 Repository hygiene — committed build output

| Finding | Impact | Fix |
| --- | --- | --- |
| `dist/` was tracked in Git (`dist/index.html`, `dist/_redirects`, `dist/robots.txt`, `dist/_headers`) with **stale** content: an unresolved `<!-- figma:title -->` placeholder, a `/* → /index.html 200` catch-all, and the misspelled `fatoriti.tech` sitemap line. `dist/` is also in `.gitignore`, so the tracked copies were invisible to `git status` for normal work. | Anyone reading the repository (or a tool that serves `dist/` directly) got a build from an unknown date, with SEO defects the source no longer had. | `git rm -r --cached dist`, deleted the files; the build regenerates everything. |
| `node_modules/` was tracked: **6,013 files**, ~1.2 M lines, including platform-specific binaries (`@rolldown/binding-linux-x64-gnu`). | Repository size and clone time; `pnpm install` on another platform had to fight stale Linux binaries; every dependency bump produced an unreviewable diff. | `git rm -r --cached node_modules` (files stay on disk for local work). |
| `htrt` (contents: `hytewe\nfdffs`) committed at the repository root. | Noise; looks like a stray editor artifact. | Deleted. |

### 1.2 Routing, indexing and metadata (detailed in `docs/SEO_GEO_AIO_SXO.md`)

* Every URL served the same document with `canonical: https://fatorati.tech/`
  → per-route documents with their own canonical/title/description/Open
  Graph/JSON-LD.
* Crawlers received an empty `<div id="root"></div>` → the landing tree is
  rendered at build time and hydrated.
* Unknown paths returned `200 OK` with the homepage → real `404.html` plus an
  in-app not-found screen.
* `sitemap.xml` had a single URL (and the wrong domain) → generated from
  `src/lib/routes.ts`.
* Public pages only existed as `#fragments`; the login screen and every
  dashboard module had **no URL at all** → real paths for all of them, with
  redirects that keep the address bar and the rendered screen in sync.

### 1.3 Environment configuration (detailed in `docs/ENVIRONMENT.md`)

* A production build without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  succeeded and deployed, producing a site where nobody could sign in, with no
  signal anywhere except a banner. → the build now reports the verdict and
  **fails** on Cloudflare Pages unless `ALLOW_UNCONFIGURED_SUPABASE=1`;
  `dist/build-report.json` lets anyone check a live deployment.
* `.github/workflows/deploy.yml` skipped its deploy step silently whenever
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` were absent — every run was
  green while nothing was deployed. → the skip is now explained with a
  `notice` annotation, and a missing Supabase pair fails the job on `main`
  (warning only on pull requests).
* `wrangler.toml` advertised `[env.production]` / `[env.preview]` `vars` for a
  project with no Functions — the exact kind of configuration that looks
  correct and never reaches the bundle. → replaced with a comment explaining
  where the variables really must go.
* `VITE_TURNSTILE_SITE_KEY` set without the matching CSP entries in
  `public/_headers` produced a **silent** production failure (script blocked →
  no token → "captcha failed" on the admin login). → build-time warning.

### 1.4 Truthfulness and consistency defects

| Finding | Impact | Fix |
| --- | --- | --- |
| `src/index.css` pulled four families from `fonts.googleapis.com` on **every** page load (including private pages), while `/cookies` and `/privacy` state that "the only third-party tool we use is Google Analytics" — a contradiction in a policy aimed at Loi 09-08/CNDP compliance, and a render-blocking request. | Privacy claim false; extra DNS+TLS+CSS round trip before first paint; CSP had to allow `fonts.googleapis.com` / `fonts.gstatic.com`. | Fonts self-hosted and bundled (`@fontsource-variable/sora`, `@fontsource-variable/jetbrains-mono`, `@fontsource/tajawal`, plus the Inter files already in `public/fonts/landing`). CSP tightened to `style-src 'self' 'unsafe-inline'; font-src 'self'`. |
| Contact data disagreed with itself: `contact@fatorati.tech` on the page vs `bonjour@fatorati.tech` in the `Organization` JSON-LD; `Tanger` in the contact section vs `Casablanca` in the footer, the auth screen and `addressLocality`; a placeholder phone number (`+212 0 20 00 00 00`) published both in the entity graph and as a working `tel:` link. | Name/address/phone inconsistency is a known local-entity (GEO/SEO) problem, and a fake phone number is worse than none. | Single source `src/lib/contact.ts` (`.figma/make/site.json`); placeholders and empty values are refused/dropped; footer, auth screen, contact page and schema all read the same values. |
| FAQ answers were rendered only after a click, while `FAQPage` structured data declared them — the schema said more than the document contained. | Rich-result/schema mismatch, invisible answers for crawlers, and no native keyboard disclosure semantics. | Native `<details>`/`<summary>` (answers always in the HTML, keyboard and screen-reader behaviour from the browser). |
| `<html lang="fr">` (and `dir="ltr"`) stayed put when the visitor switched to English or Arabic. | Screen readers use French pronunciation for Arabic content; crawlers are told the wrong language. | The document language/direction now follows the choice, and is restored when leaving the public site. |
| In-app browser mockup displayed `fatoriti.tech/tableau`. | Published a domain that does not exist. | Corrected to `fatorati.tech/dashboard`. |
| `og:image` was a **1:1 SVG logo** declared `summary_large_image`, with no dimensions. | Unreliable previews on WhatsApp/LinkedIn/Facebook (SVG is not accepted by most unfurlers). | Real 1200×630 JPEG (`public/og/fatorati-og.jpg`) with `og:image:width/height/alt`. |

---

## 2. Reviewed and found correct (no change needed)

Worth recording, so a future scan does not re-litigate them:

* **Auth/session races** — `useSupabaseAuth` revision counter, deferred
  hydration, immediate `signOut()` on account switch: sound.
* **Storage failures** — `businessStorage` (`localSaveStatus.ts`) refuses to
  overwrite an unreadable record, distinguishes quota from unavailable, and
  never claims a failed write succeeded.
* **Sanitisation** — `sanitize()` strips angle brackets and control characters
  before values enter state; nothing in `src/` uses
  `dangerouslySetInnerHTML`.
* **No secrets in the client** — `readSupabaseConfig` detects and *refuses*
  `service_role`/`sb_secret_` keys instead of using them; no other credential is
  read from `import.meta.env`.
* **Consent gating** — analytics is not loaded before a choice, is disabled
  again if the choice changes, and the `ga-disable-*` flag is set on decline.
* **Idle logout** — wall-clock deadline, not a throttled timer; visibility
  changes only check the deadline.
* **Type safety** — `tsc --noEmit` clean under `strict`; no `any`, no
  `@ts-ignore`, no TODO/FIXME markers in `src/`.
* **Test suite** — 227 tests across 34 files pass with no network and no
  Supabase credentials.

---

## 3. Open findings (not fixed here)

Ordered by risk. None of them block the current release.

| # | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| 1 | **High (product)** | The business dashboard still stores records in `localStorage` (`zustand/persist`) while Supabase tables exist. Two users on two devices do not share data, a cleared browser loses it, and the UI can imply a server-side record. `README.md`/`SUPABASE_OPERATIONS.md` say so, but the UI does not. | Server-side persistence with RLS, or an explicit per-screen "enregistré dans ce navigateur" indicator. |
| 2 | **Medium (delivery)** | Production is deployed by the Cloudflare Pages Git integration while `.github/workflows/deploy.yml` builds the same commit but (without secrets) never deploys — two build paths that can drift. | Pick one: either delete the workflow's deploy step, or disable the Pages integration and deploy from Actions with the secrets set. |
| 3 | **Medium (perf)** | One entry chunk (~683 kB raw / ~200 kB gzip) contains the marketing site, the dashboard and the CMS: a marketing visitor downloads the ERP, `/admin` visitors download the landing. | Route-level code splitting in `src/main.tsx` (`lazy(() => import('./admin/AdminApp'))`, and load `App` only on non-admin paths). |
| 4 | **Medium (security)** | `connect-src https://*.supabase.co` allows every Supabase project, not just ours. | Generate `public/_headers` at build time from `.figma/make/site.json` (the project ref is derivable) so the CSP can name the exact origin. |
| 5 | **Medium (a11y)** | The top-bar menus (`Topbar.tsx`) open on click with no `aria-expanded`/`aria-haspopup`, no Escape handling and no focus movement. | Mirror the pattern already used by the landing header flyout (which does it correctly). |
| 6 | **Medium (SEO)** | No web app manifest, no `apple-touch-icon`, no `/favicon.ico` (only `/fatorati-logo.svg`). Some crawlers and browsers request `/favicon.ico` and log a 404. | Add `site.webmanifest` + PNG icons generated from the SVG. |
| 7 | **Low (SEO)** | `organization.sameAs` is empty and no third-party profile exists. | Create the real profiles, then add the URLs to `.figma/make/site.json` (deliberately not invented). |
| 8 | **Low (i18n)** | English and Arabic are served from the same URLs as French; `hreflang` is therefore impossible. | Per-language path trees (`/ar/…`) — see the backlog in `docs/SEO_GEO_AIO_SXO.md`. |
| 9 | **Low (cosmetic)** | `package.json` still says `"name": "figma-make-app"`; the sidebar footer says "Mizan ERP · v1.0" while the product is Fatorati. | Rename the package; align the product name (also matters for entity clarity, i.e. GEO). |
| 10 | **Low (robustness)** | `loadTurnstileScript()` caches a rejected promise, so a transient network failure leaves the CAPTCHA dead until a full reload. | Clear `scriptPromise` on error so the next mount retries. |
| 11 | **Low (content)** | `/privacy`, `/terms`, `/cookies` are one paragraph each; the blog cards are static copy. | Write real policies (sub-processors, retention table) and publish real articles before promoting the blog. |
| 12 | **Low (build)** | `vite.config.ts` imports application modules (`src/lib/routes.ts`, `src/lib/seo.ts`) — which is what makes the deploy config impossible to drift, but it also means a syntax error in a source file breaks the config load. | Keep it (the trade-off is deliberate); the CI type-check runs before the build. |

---

## 4. How to re-run this scan

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit                 # types
pnpm test                              # 227 tests, no credentials, no network
ALLOW_UNCONFIGURED_SUPABASE=1 pnpm build   # + 12 prerendered routes
git status --short                     # should show no dist/ or node_modules/ noise
grep -rn "http://" src/ vite.config.ts # no cleartext origins
grep -rn "console\.log" src/           # no debug output
```

Then the two focused checks:

```sh
# Every navigable URL is fragment-free
grep -rn 'href="#\|href={`#' src/ && echo "FOUND a #fragment link"

# Every screen has a URL and every private screen is noindex
curl -sI https://fatorati.tech/login | grep -i x-robots-tag
curl -sI https://fatorati.tech/pricing | head -1     # 200
curl -sI https://fatorati.tech/nope | head -1        # 404
```
