# SEO, GEO, AIO and SXO — findings and roadmap

**AITDK GEO score, 13 October 2026 (76 / B, 14 points short of A).** The eight
flagged checks are addressed in the public HTML, not only after JavaScript:

| Check | What the crawler now gets |
| --- | --- |
| Server-rendered words / H1 in the HTML | Every public route is prerendered with exactly one `<h1>`. The build fails if a document has fewer than 450 visible words. Markup is line-broken so a crawler that truncates a single huge line still sees the body. The hero animation no longer starts at `opacity: 0`. |
| Content schema | Each page's JSON-LD graph includes `FAQPage` and `HowTo`. Home and pricing also include `Product`; home and blog include `Article`. |
| sameAs | Organization `sameAs` points at the real GitHub repository. No invented Wikipedia or LinkedIn URL. |
| Citations | Visible `<blockquote>`, `<q>` and `<cite>` link the DGI VAT guide, CGI article 208 and the CNDP page on Law 09-08. A table repeats the figures. Demo numbers are labelled fictional. |
| About and Contact | Both are links in the header and the footer (`/about`, `/contact`). |

**Scope:** the public site (`https://fatorati.tech`) — its public URLs (12 pages
× 3 languages = 36 addressable documents), their metadata, structured data,
crawlability, and what a search engine or an AI assistant can do with them.
Audit date: 13 October 2026; internationalisation added 13 October 2026.

Legend — the four acronyms used here, since they overlap in practice:

| Acronym | Question it answers | Main levers |
| --- | --- | --- |
| **SEO** | Can search engines find, understand and rank our pages? | crawlability, canonical URLs, titles/descriptions, internal links, sitemap, page speed |
| **GEO** | Do AI answer engines *cite* us when someone asks about Moroccan business management? | entity clarity, extractable facts, stats, citations, third-party presence |
| **AIO** | Can assistants parse and reuse our content (and our docs) correctly? | `llms.txt`, clean HTML without JS, structured data, unambiguous facts, no contradictions |
| **SXO** | Does the searcher's experience on the page answer the query and convert? | message-match, above-the-fold answer, mobile UX, trust signals, clear CTA |

---

## 1. What was broken (found in this audit, now fixed)

| # | Severity | Finding | Evidence / fix |
| --- | --- | --- | --- |
| 1 | **Critical** | Every URL served the *same* document with `canonical: https://fatorati.tech/`. `/features`, `/pricing`, `/faq`… were all declared duplicates of the homepage, so only the homepage could rank. | 12 prerendered documents, each with its own canonical, title, description, Open Graph and JSON-LD (`scripts/prerender.mjs`, `src/lib/seo.ts`). |
| 2 | **Critical** | A single-document SPA: the HTML served to a crawler contained `<div id="root"></div>` and nothing else. Crawlers that do not execute JavaScript (GPTBot, ClaudeBot, PerplexityBot, social unfurlers, most SEO tools) saw an empty page. | The landing tree is rendered at build time into every public document and hydrated on load. |
| 3 | **High** | Every unknown path returned `200 OK` with the homepage (`/* → /index.html 200`) — a soft 404 that Google reports as an "indexed, though blocked"/duplicate-quality problem. | A built `404.html` + the generated `_redirects`; a real `noindex` not-found screen (`src/components/NotFound.tsx`). |
| 4 | **High** | `sitemap.xml` listed **one** URL (the homepage), and pointed at the misspelled domain `fatoriti.tech`. | Generated `dist/sitemap.xml` with all 12 public URLs from `src/lib/routes.ts`; `robots.txt` `Sitemap:` line corrected. |
| 5 | **High** | The whole site was one URL: `/`, `/features`, `/pricing`… did not exist as addresses (the header used `#features` fragments), so there was nothing to link to, share, or rank. `#` fragments are never sent to the server and never indexed as pages. | Real paths for every public page, in every language, with a client router that keeps the URL honest (`src/lib/routes.ts`, `src/lib/router.ts`). |
| 6 | **High** | The login screen, the dashboard and the CMS had no URLs at all (local state), and no `noindex`; the private shell was also crawlable through `/*`. | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/dashboard`… each with a `noindex` document, a `noindex` meta tag, and an `X-Robots-Tag` header. |
| 7 | **Medium** | Open Graph image was a **1:1 SVG logo** declared `summary_large_image` with no dimensions — WhatsApp/Facebook/LinkedIn previews were unreliable. | A real 1200×630 JPEG (`public/og/fatorati-og.jpg`) with `og:image:width/height/alt`. |
| 8 | **Medium** | FAQ answers were injected only after a click, so the answer text never reached a crawler — while `FAQPage` schema claimed the answers. | Native `<details>`: every answer is present in the HTML (and stays keyboard-accessible). |
| 9 | **Medium** | Inconsistent entity data: `contact@fatorati.tech` on the page vs `bonjour@fatorati.tech` in the schema; "Tanger" in the contact section vs "Casablanca" in the footer and `addressLocality`; a placeholder phone (`+212 0 20 00 00 00`) published as a real `tel:` link and in the entity graph. | One source (`src/lib/contact.ts` ← `.figma/make/site.json`); placeholder numbers are refused; empty values are dropped from JSON-LD. |
| 10 | **Medium** | `<html lang>` stayed `fr` (and `dir` stayed `ltr`) when the visitor switched to English or Arabic — wrong language for screen readers, wrong signal for crawlers. The switch was also component state: one URL served three languages, so no `hreflang` was possible and a shared link always opened in French. | Each language now has its own URL tree with its own prerendered document, `<html lang dir>`, `Content-Language` header, self-referencing canonical and a full `hreflang` set (§6, *Internationalisation*). |
| 11 | **Low** | In-app browser mockup showed the wrong domain (`fatoriti.tech/tableau`). | Corrected to `fatorati.tech/dashboard`. |
| 12 | **Low** | `robots.txt` allowed AI crawlers but the *shell* they received was empty — an allow directive with nothing to index. | Now meaningful: real HTML per URL (§1.2 above) + `llms.txt` regenerated per build. |

---

## 2. SEO — recommendations

### 2.1 Must do before the next content push

1. **Verify in Search Console.** Add the domain property for `fatorati.tech`
   (DNS verification), submit `https://fatorati.tech/sitemap.xml`, and use *URL
   inspection* on `/`, `/pricing` and `/features` to confirm "Crawled – currently
   indexed" with the correct user-declared canonical. Also connect Bing
   Webmaster Tools (it feeds ChatGPT Search and Copilot).
2. **301 the trailing-slash and `.html` variants** (§ already generated in
   `_redirects`): `/features/`, `/features.html` and `/features/index.html` all
   resolve to one canonical URL. Adding a `trailingSlash` policy at the host is
   the other half; the current setup rewrites both shapes to the same document
   and declares one canonical, which is safe, but a hard 301 is cleaner.
3. **Internal linking with real anchors.** The header now links
   Fonctionnalités / Assistant / Tarifs / FAQ with descriptive labels. Extend
   it: each blog article should link to `/pricing` and `/features`, and the
   footer should link the legal pages (it does) **and** `/about`.
4. **Breadcrumbs on sub-pages.** `BreadcrumbList` JSON-LD plus a visible trail
   on `/features`, `/pricing`, `/blog`, `/privacy`… Costs nothing, improves
   sitelinks and gives assistants a site map inside the answer.
5. **Article-level SEO when blogs become real.** The blog copy is still static
   (`src/marketing/Landing.tsx`); when the CMS is exposed publicly, each post
   needs: its own URL (`/blog/<slug>`), `BlogPosting` schema, `datePublished` /
   `dateModified`, an author with a real byline, canonical tags, and RSS/Atom.
   Until then, keep the static posts clearly dated (they are).
6. **Image SEO.** Product screenshots in the marketing page are DOM mockups
   (excellent for speed, invisible for image search). If image search matters,
   export two or three real screenshots with descriptive `alt` text.
7. **Performance budget.** The main bundle is ~683 kB uncompressed
   (≈200 kB gzip) because the marketing site and the whole dashboard share one
   entry. Split the admin/dashboard behind the route so a marketing visitor
   downloads only the landing chunk: `/admin/*` already imports lazily, but
   `main.tsx` still pulls `App` + `AdminApp`. Target < 120 kB gzip on the first
   view — Core Web Vitals is a ranking input and an SXO one.
8. **Legal pages are thin.** `/privacy`, `/terms`, `/cookies` are one paragraph
   each, and `terms` is especially short. Google tolerates thin legal pages but
   E-E-A-T reviewers do not; write real, complete policies (they also protect
   you under Loi 09-08).

### 2.2 Technical checklist (state after this change)

| Item | Status |
| --- | --- |
| Unique `<title>` per page (≤ 60 chars visible) | ✅ |
| Unique meta description (120–160 chars) per page | ✅ |
| One canonical per page, absolute, fragment-free | ✅ |
| `<h1>` once per page, logical `h2`/`h3` order | ✅ (verify per page in the visual editor) |
| Open Graph + Twitter cards with a 1200×630 image | ✅ |
| `sitemap.xml` listing every indexable URL | ✅ generated |
| `robots.txt` with `Sitemap:` on the correct domain, private paths disallowed | ✅ |
| `404` returns a not-found status and a helpful page | ✅ |
| No `noindex` on public pages; `noindex` on all private pages | ✅ |
| Structured data valid (Organization, WebSite, WebPage, FAQPage, SoftwareApplication, Offer, ContactPage) | ✅ — re-check in the Rich Results Test after each release |
| HTTPS + HSTS preload | ✅ (`public/_headers`) |
| Language declared (`lang`, `dir`) | ✅ |
| Mobile-first, tap targets, no horizontal scroll | ✅ (landing is mobile-first) |
| Core Web Vitals | ⚠️ measure; bundle size is the main risk |

### 2.3 Content and keywords (French-first, Morocco)

The audience searches in **French**, with a growing share in **Arabic** and some
in English. A realistic starting keyword map:

| Cluster | Primary intent | Published page | Suggested title pattern |
| --- | --- | --- | --- |
| gestion PME maroc | solution | `/` | Fatorati — pilotez finances, abonnements et risques |
| logiciel de facturation Maroc | commercial | *(missing — add)* | « Logiciel de facturation conforme au Maroc (ICE, TVA) » |
| conformité loi 09-08 CNDP | informational | `/faq`, `/privacy` | « Loi 09-08 : ce qu'une TPE doit déclarer (guide) » |
| échéances TVA DGI TPE | informational | `/blog` | « Calendrier TVA Maroc : dates et pénalités » |
| checklist documents entreprise Maroc (RC, ICE, modèle J) | informational | `/blog` | « Électroniques… » |
| suivi abonnements / coûts d'outils | informational | `/features` | « Combien coûtent vos outils ? méthode de suivi » |

Priorities: (a) publish a **facturation/facture conformité** page — it is the
highest-intent query in this market and there is currently no page for it;
(b) `/assistant` should target “modèle de contrat … Maroc” long-tails;
(c) the blog needs three or four genuinely useful articles before it can rank
for anything.

---

## 3. GEO — being cited by AI answer engines

AI overviews and chat assistants increasingly answer before a click happens.
They cite sources that are **easy to extract, unambiguous and verifiable**.

1. **One canonical fact per answer.** "Fatorati coûte X MAD/mois" must appear,
   in the same words, on `/pricing`, in the `Offer` schema, in `llms.txt` and in
   any listing. Today the pricing tiers live in the marketing copy only — mirror
   them into `.figma/make/site.json` so the schema and the page cannot drift.
2. **Answer-first paragraphs.** Each public page should open with a 40–60 word
   paragraph that answers the page's question outright, before any marketing
   adjectives. Assistants lift that paragraph verbatim; make it quotable.
   (Good candidates: `/faq`, `/assistant`, `/pricing`.)
3. **`llms.txt` is generated on every build** (`dist/llms.txt`) and lists all 12
   pages with one-line descriptions, the allowed crawlers, the language and the
   contact address. Keep descriptions in sync with `<meta name="description">` —
   they are already produced from the same data.
4. **Third-party corroboration beats first-party claims.** Get the entity listed
   where Moroccan business content is aggregated: a real LinkedIn page, a Google
   Business Profile (if there is a physical office in Tanger), a Crunchbase-style
   listing, TPE/PME directories, and any startup ecosystem list (Technopark,
   CGEM…). Add those URLs to `organization.sameAs` in
   `.figma/make/site.json` — the field is honoured by the build and is
   deliberately empty until the profiles really exist (inventing them is worse
   than omitting them).
5. **Freshness signals.** `dateModified` is emitted for the site and the page
   schema; keep `CONTENT_UPDATED` in `src/marketing/Landing.tsx` honest when the
   copy changes, and prefer adding a visible "Mis à jour le …" line on the blog
   and legal pages.
6. **Numbers and specifics get cited.** "15 % de pénalité pour déclaration TVA
   tardive", "TVA 20 %", "Loi 09-08", "ICE", "DGI", "modèle J" — the copy
   already carries these. Keep them factual and add a source link where a rule
   could change (a link to the DGI/CNDP page is a trust signal and a citation
   magnet).
7. **Conversational questions in the FAQ.** The current FAQ answers "is it for
   Moroccan businesses / mobile / is my data safe / can I change plan". Add the
   queries people actually type: *"Fatorati, c'est quoi ?"*, *"Fatorati gratuit
   ou payant ?"*, *"Fatorati est-il conforme au CNDP ?"*, *"Comment exporter mes
   factures ?"*, *"Différence entre Fatorati et un logiciel de comptabilité ?"*.
8. **Don't hide the price.** Assistants refuse to quote hidden pricing and skip
   the site. `/pricing` shows MAD figures — keep them, and put the same figures
   in the schema (already done for the `Offer` nodes).
9. **Brand-name consistency.** "Fatorati" everywhere; the repository name
   (`FatooraLaw`) and the CMS wordmark ("Mizan ERP" in the sidebar) differ.
   Align the product name in the UI (the sidebar footnote still says
   *Mizan ERP · v1.0*) or the entity signals split.

---

## 4. AIO — making the content machine-readable

1. **No-JS rendering is now the default for public pages** — the single most
   important AIO fix. Assistants that fetch HTML without running JavaScript get
   the real page.
2. **Semantic HTML over div soup.** The landing page uses `<header>`, `<main>`,
   `<section id>`, `<footer>`, `<details>`; headings are real `h1`–`h3`. Keep it
   that way: never replace a heading with a styled `<div>`, and keep one `h1`.
3. **Structured data coverage.** `Organization` + `WebSite` (site-wide),
   `WebPage`/`AboutPage`/`ContactPage`/`CollectionPage` (per page), `FAQPage`
   (FAQ), `SoftwareApplication` + `Offer` (home), `ItemList` + `Offer`
   (pricing). Next: `BreadcrumbList` (§2.1.4), `BlogPosting` (§2.1.5),
   `Service` if you publish an implementation offer, and `AggregateRating` only
   when real reviews exist.
4. **Machine-readable facts file.** Beyond `llms.txt`, consider a small
   `/.well-known/fatorati.json` with name, legal name, city, country, email,
   languages, plans and prices — a stable place for an assistant to check a
   claim. Cheap to generate from `site.json` next to the sitemap.
5. **Keep `robots.txt` explicit.** It already names GPTBot, OAI-SearchBot,
   ClaudeBot, PerplexityBot, Google-Extended, CCBot… Keep that list explicit so
   a single crawler can be turned off later without touching the others.
6. **Don't serve contradictory numbers.** The landing dashboard preview shows
   demo figures (`1 720 MAD`, `+12 %`). They are labelled as a product preview
   in context but nothing in the markup says "exemple". Add an explicit
   "Aperçu de démonstration" caption — assistants quote what they find.
7. **Public documentation helps.** `docs/` in this repository is a real,
   citable source of truth for what the product does and does not do (local
   prototype vs production ERP). Keep the honest statements in `README.md` —
   they prevent an assistant from over-promising on your behalf.

---

## 5. SXO — turning a visit into a satisfied visitor

1. **Message match.** Paid/organic entries for "facturation Maroc" land on `/`
   today; the CTA path is *S'inscrire → /login*. Add one dedicated page per
   high-intent ad group and point ads at it (`/facturation` suggested above).
2. **Above-the-fold answer.** The hero states what the product is and for whom
   ("artisans, freelances et petites entreprises marocaines") and shows a
   product preview — good. Add one line of proof (a number, a logo wall, a
   testimonial) once real proof exists.
3. **Friction on the first step.** "S'inscrire" opens `/login` with a sign-up
   link — an extra decision, and a known drop-off. Either make the primary CTA
   go straight to `/signup`, or explain the choice on the login screen (the copy
   "Pas encore de compte ? Créer un compte" exists but is below the form).
4. **Trust on the legal side.** The privacy screen mentions Loi 09-08 and RLS;
   `/privacy`, `/terms`, `/cookies` are thin. For a product that asks for
   business financial data, a real sub-processor list (Supabase, Cloudflare,
   Google Analytics) and a data-retention table convert better than a paragraph.
5. **Mobile experience.** The landing is mobile-first, tap targets are ≥ 40 px,
   the mobile menu traps scroll correctly, and the cookie banner is dismissible.
   Verify on a real 360 px viewport that the two hero CTAs stack in the right
   order and the sticky header does not cover anchors.
6. **Accessibility = SXO.** The FAQ is now `<details>`, the language switch has
   `aria-expanded`, the theme toggle is labelled, skip-links are available via
   `accessibility.addBypassLinks` (currently `false` — turn it on). Run axe on
   `/`, `/pricing` and `/faq` after the next copy change.
7. **Consent without dark patterns.** Analytics only loads after "Accepter", and
   "Refuser" is the same size — keep it; an honest banner is a trust signal and
   a GDPR/Loi 09-08 requirement.
8. **Measure the funnel.** Google Analytics is consent-gated. Add posthog/Plausible
   only if you need conversion paths; otherwise define three GA events
   (`signup_start`, `signup_complete`, `pricing_cta_click`) — you cannot improve
   SXO without knowing where people leave.

---

## 6. Backlog, ordered by impact ÷ effort

| # | Item | Effort | Impact |
| --- | --- | --- | --- |
| 1 | Verify the domain in Search Console + Bing, submit the sitemap | 1 h | ★★★★★ |
| 2 | Code-split the dashboard out of the marketing entry (< 120 kB gzip) | 2–4 h | ★★★★☆ |
| 3 | `/facturation` page (highest-intent, missing today) | 1 day | ★★★★★ |
| 4 | `BreadcrumbList` + visible breadcrumbs on sub-pages | 2 h | ★★★☆☆ |
| 5 | Real policies for `/privacy`, `/terms`, `/cookies` + sub-processor list | 1 day | ★★★★☆ |
| 6 | 3–4 genuinely useful blog articles (TVA, ICE/RC, coûts d'outils) with `BlogPosting` | 1–2 weeks | ★★★★★ |
| 7 | `sameAs` profiles (LinkedIn, Google Business Profile) + listings | 1 day | ★★★★☆ |
| 8 | Mirror pricing into `site.json` → schema + `llms.txt` + a `/.well-known/fatorati.json` | 3 h | ★★★☆☆ |
| 9 | ~~`/en/` and `/ar/` URL trees with `hreflang`~~ — **done 13 Oct 2026** (§ below) | 2–3 days | ★★★☆☆ |
| 10 | Enable `accessibility.addBypassLinks`, axe pass on the three main pages | 2 h | ★★☆☆☆ |
| 11 | GA events for the signup funnel | 3 h | ★★★☆☆ |
| 12 | Real product screenshots with descriptive `alt` | half day | ★★☆☆☆ |

### Internationalisation (item 9) — shipped 13 October 2026

The language used to be component state, so one URL served French, Arabic and
English and `hreflang` was impossible (an alternate that points at its own URL is
not an alternate). Every public page now exists as three documents, one per
language, and the language is read from the URL:

| | Default (French) | Arabic | English |
| --- | --- | --- | --- |
| URL | `/pricing` (unprefixed) | `/ar/pricing` | `/en/pricing` |
| `hreflang` | `fr-MA` | `ar-MA` | `en` |
| `og:locale` | `fr_MA` | `ar_MA` | `en` |
| `<html>` | `lang="fr" dir="ltr"` | `lang="ar" dir="rtl"` | `lang="en" dir="ltr"` |
| `Content-Language` | (default, omitted) | `ar-MA` | `en` |
| `x-default` | ✅ the unprefixed URL | → French | → French |

What the implementation guarantees, and where each part lives:

- **One source of truth for the codes** — `src/lib/locales.ts` holds the
  language + region pairs (`fr-MA`, `ar-MA`, `en`), the URL prefix, the text
  direction and the Open Graph locale. Routes, head tags, the sitemap, the
  generated `_redirects` and `public/_headers` are all derived from it.
- **36 prerendered documents** — `src/entry-server.tsx` + `scripts/prerender.mjs`
  write `/pricing/index.html`, `/ar/pricing/index.html` and
  `/en/pricing/index.html` (plus the `.html` mirrors the host may resolve).
  Each carries its own `<title>`, description, canonical, `hreflang` set,
  Open Graph locale and JSON-LD `inLanguage`.
- **Symmetric `hreflang`** — every document lists all three languages *and*
  `x-default`, and the sitemap repeats the same set as `xhtml:link` on all 36
  URLs. Search engines discard alternate pairs they cannot verify in both
  directions, so the symmetry is tested (`tests/i18n.test.tsx`,
  `tests/routes.test.ts`).
- **Self-referencing canonicals** — `/ar/pricing` is canonical for itself, not
  for `/pricing`; the French pages keep the exact URLs they always had, so no
  existing link, ranking or Search Console record moves.
- **The switcher navigates** — choosing a language pushes the same page in the
  other tree, so the choice survives a reload, can be shared and is undone by
  the back button. Internal links inside a tree stay in that tree
  (`useLocaleHref`), which is also what the build assertion checks: an Arabic
  document that links to the French `/about` is a broken cluster even when
  every tag is present.
- **`/fr/…` redirects** to the unprefixed URL (`_redirects`), so the French
  pages never exist at two addresses.
- **Auth and the signed-in app stay French and unprefixed** — they are
  `noindex` private screens with a single URL each; `/ar/login` is a 404, not a
  second URL for `/login`.

Still open on this item:

1. Confirm in Search Console that each language is indexed under its own URL
   (*International targeting* → check for "no return tags" / "different
   canonical" errors after the first crawl).
2. Re-check the `x-default` choice with real traffic: today it points at the
   French page. If the English tree turns out to convert better for
   non-Moroccan visitors, switching `x-default` to `/en` is a one-line change
   in `hreflangAlternates()` — never a reason to break the symmetry.
3. Arabic and English `hreflang` are declared for Morocco (`ar-MA`) and
   internationally (`en`, region-less on purpose: there is no English *Morocco*
   audience to target). If a `fr-FR` audience becomes material, add one entry
   to `src/lib/locales.ts` — nothing else needs to change.

---

## 7. How to verify all of this

```sh
# 1. Build and inspect the generated documents
pnpm build
ls dist/*/index.html dist/ar/*/index.html dist/en/*/index.html   # 36 documents
grep -c canonical dist/pricing/index.html          # exactly 1
grep -c 'rel="alternate"' dist/ar/pricing/index.html   # 4 (fr-MA, ar-MA, en, x-default)
grep -o '<title>[^<]*' dist/faq/index.html         # its own title
grep -o '<title>[^<]*' dist/ar/faq/index.html      # …its own title in Arabic
grep -c 'noindex' dist/login/index.html            # 1 (private)

# 1b. The hreflang cluster must be symmetric and self-referencing
grep -c 'hreflang="ar-MA"' dist/sitemap.xml        # 36 (one per URL)
grep -c '<xhtml:link' dist/sitemap.xml             # 144 = 36 URLs × 4 alternates
grep -o 'hreflang="[a-z-]*"' dist/en/pricing/index.html | sort -u   # en, ar-MA, fr-MA, x-default
grep -o 'hreflang="[a-z-]*"' dist/ar/pricing/index.html | sort -u   # same set (symmetry)

# 2. The machine files
curl -s https://fatorati.tech/sitemap.xml | head
curl -s https://fatorati.tech/llms.txt
curl -s https://fatorati.tech/build-report.json    # which build is live, and is it configured

# 3. The routing contract
curl -sI https://fatorati.tech/features | head -1        # 200
curl -sI https://fatorati.tech/features.html | head -1   # 301 → /features
curl -sI https://fatorati.tech/unknown-page | head -1    # 404
curl -s https://fatorati.tech/robots.txt | tail -3
```

Then the external validators, in this order:
[Rich Results Test](https://search.google.com/test/rich-results),
[Schema Markup Validator](https://validator.schema.org),
[PageSpeed Insights](https://pagespeed.web.dev),
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) for the
social card, and Search Console → *Pages* weekly for the first month to catch
soft 404s or "Duplicate, Google chose a different canonical".
