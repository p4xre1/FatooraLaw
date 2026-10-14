# SECURITY / ENCRYPTION INVENTORY — FatooraLaw (Task 1: Find what we have / don't have)

## WHAT WE HAVE NOW (verified in repo)
- Supabase Auth (GoTrue) + RLS on `profiles` / `posts`
- Database patch: `supabase/migrations/20261012_harden_profile_permissions.sql`
- CSP + HSTS + X-Frame-Options + nosniff + Permissions-Policy in `public/_headers`
- Client-side input guards (`src/lib/security/`) + auth validation (`src/modules/auth/lib/validation.ts`)
- CMS content sanitization (`src/admin/lib/security.ts`) — strips control chars, `<>
- Anti-reverse script (`public/anti-reverse-engineering.js`) + build minification (`terser`)
- Cookie consent + gated analytics
- Idle/logout timer (`useIdleLogout`)
- LocalStorage partitioned by user ID (not encrypted, just partitioned)
- CSV/XLS export with formula-neutralization
- Turnstile CAPTCHA option (`VITE_TURNSTILE_SITE_KEY`)
- No `dangerouslySetInnerHTML`, no `eval`, no `new Function`
- Lockfiles synchronized; Dependabot configured

## WHAT WE DON'T HAVE / GAPS (missing / weak)
- NO server-side encryption at rest for localStorage / exported files
- NO end-to-end encryption for CMS content / posts
- NO audit / monitoring dashboard inside CMS (who edited what, when, from which IP/session)
- NO rate limiting on CMS / auth endpoints (client-only check)
- NO CSRF token protection on CMS mutations
- NO IP logging / geolocation tracking for admin actions
- NO role-based access control beyond `is_admin` boolean (no granular permissions: read-only editor, moderator, etc.)
- NO image upload / asset management inside CMS (blogs are text-only now; no R2/Supabase image links)
- NO viral SEO standards module (open graphs, structured data, canonical, hreflang, headline formulas, keyword density checker, share-card generator)
- NO encryption of exported CSV/JSON files (they contain raw business data)
- NO content backup / version history for CMS posts (edit = overwrite)
- NO intrusion detection / brute-force monitoring
- NO HTTPS-only cookie flags (`Secure`, `HttpOnly`, `SameSite=Strict`) configured in code (deployed via hosting)
- NO database-level encryption (PostgreSQL pgcrypto / TDE not mentioned)
- NO secret-scanning / key-rotation workflow
- NO two-factor / MFA for CMS admin
- NO session invalidation server-side on logout (only local)

## RANKED BY RISK / IMPACT
1. CMS audit/monitoring missing = can't detect breach / insider abuse
2. No encryption at rest for exports = data leak if device stolen
3. No granular CMS roles = any admin can delete all posts
4. No image/link freedom in blogs = content is weak for viral traffic
5. No viral SEO standards = no organic growth pathway
6. No CSRF / rate limit = easier brute-force / replay
7. No MFA = admin account takeover risk
