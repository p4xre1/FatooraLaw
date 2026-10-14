# INEO (ineo.ma) — full site scan & comparison with FatooraLaw / Fatorati

Scanned 2026-10-14. Sources: `https://www.ineo.ma/`, `/sitemap.xml`,
`/fonctionnalites`, `/tarifs-entreprise`, `/tarifs-comptable`,
`/industries/professions-juridiques`. Our side: `src/lib/routes.ts`,
`src/marketing/Landing.tsx`, `src/modules/*`, `src/lib/planLimits.ts`,
`llms.txt`, `docs/SEO_GEO_AIO_SXO.md`.

---

## 1. Who INEO is

**Positioning:** "INEO, la solution tout-en-un pour gérer, collaborer et
performer" — a French-language SaaS for **Moroccan TPE/PME *and* accounting
firms (cabinets comptables)**, sold as two products in one platform:

- **INEO Connect** — shared client/accountant collaboration space
- **INEO Expert** — advanced firm management, accounting automation, real-time
  steering

Core differentiator: **the company ↔ accountant link**. Documents flow from the
business to its `expert-comptable`, OCR reads them, pre-accounting
(précomptabilité) is automated, and both sides work on the same data.

**Proof of traction:** ~45 partner/firm logos on the homepage
(BMA Partners, Maroc Expertise, Fiduciaire Jurico, Eurex Maghreb, Audifec,
Cegor, Fondatax…), plus a company logo wall (Motherson, Helylios, Electrovogue,
Gold Agency…). Trustpilot "5/5 clients satisfaits" badge, 3 video testimonials.

**Tech footprint (observed):** Strapi headless CMS (`/backend/uploads/...`
asset URLs, `/actualites/<slug>` blog), Next.js/React front, webp imagery, real
native mobile apps on both stores.

---

## 2. INEO site map (72 URLs in sitemap.xml)

| Group | URLs | Count |
|---|---|---|
| Home | `/` | 1 |
| Audience landings | `/entreprise`, `/professionnel-comptable` | 2 |
| Feature pages | `/gestion-entreprise`, `/collaboration-comptable`, `/intelligence-artificielle`, `/pay-by-link`, `/application-mobile` | 5 |
| Feature pages (accountant mirror) | `/professionnel-comptable/{gestion-du-cabinet, collaboration-comptable, intelligence-artificielle, pay-by-link, application-mobile}` | 5 |
| Catalogue | `/fonctionnalites` | 1 |
| Pricing | `/tarifs-entreprise`, `/tarifs-comptable`, `/essai-gratuit` | 3 |
| Partner program | `/partenaire-comptable` | 1 |
| **Industries** | `/industries` + `agences`, `commercants`, `bureaux`, `btp`, `industrie`, `services-b2b`, `transport`, `professions-juridiques` | 9 |
| **Programmatic SEO** | `gestion-de-stock-et-facturation`, `logiciel-de-comptabilite-au-maroc`, `logiciel-de-comptabilite-pour-pme`, `logiciel-de-gestion-commercial-et-comptable`, `logiciel-de-gestion-de-facturation`, `logiciel-de-gestion-dentreprise-pour-pme-au-maroc`, `logiciel-de-gestion-de-tresorerie`, `logiciel-de-saisie-comptable`, `prix-logiciel-comptabilite-pour-entreprise-au-maroc` | 9 |
| Blog | `/actualites` + ~35 articles (Apr 2025 → Jun 2026) | 36 |
| Legal | `/cgu`, `/confidentialite` | 2 |
| Contact | `/contact` | 1 |

**Note the dates:** sitemap `lastmod` for the 9 programmatic-SEO pages is
**2026-10-11** — three days ago. That content layer is actively being pushed.

---

## 3. INEO feature catalogue (from `/fonctionnalites`, 6 tabs, ~28 features)

**Tab 1 — Gestion d'entreprise (9)**
Gestion d'entreprise (dashboards, KPIs, smart alerts) · **CRM** (client records,
sales pipeline, interaction history) · **Ventes et facturation** (quotes,
invoices, custom templates, auto-reminders) · Gestion de projets (progress,
**Kanban**, task assignment) · **Achats et fournisseurs** (supplier invoices,
purchase orders, payment tracking) · **Gestion de stock** (multi-warehouse,
movements, inventories) · **Trésorerie avancée** (**bank synchronisation**,
auto-categorisation, expense tracking) · Suivi des paiements clients &
fournisseurs (due dates both sides, late alerts) · Tableau de bord d'activité

**Tab 2 — IA et automatisation (5)**
**OCR** for invoices & bank statements (auto read/extract/classify) ·
**Assistant IA** (chat, contextual help, recommendations) · **Rapprochement
bancaire automatisé** (auto-match bank ops ↔ invoices, gap detection) ·
**Classement automatique par dossier** (AI files each doc to the right dossier,
flags missing pieces) · **Agent IA via WhatsApp** (collect client docs,
auto-reminders, instant answers)

**Tab 3 — Collaboration (3)**
Collecte centralisée des documents · **Drive / espace documentaire** (secure
storage, controlled sharing, fast search) · **Mode collaboratif** (comments,
tags, annotations)

**Tab 4 — Cabinet & collaboration (10)**
Pilotage du cabinet (missions, staff, profitability) · Tableau de suivi client
(Kanban per dossier) · Espace collaboratif cabinet/clients · **Précomptabilité
automatisée** (auto entry, bank reconciliation, filing) · Suivi des pièces
reçues/manquantes (+ one-click reminders) · **Suivi des déclarations fiscales**
(fiscal calendar, statuses, deadline reminders) · Accès INEO Connect Entreprise
(client portal) · **Abonnements et factures récurrentes** · Suivi des missions
et livrables · **Suivi des débours** (amounts advanced, receipts, re-billing)

**Tab 5 — Paiements et encaissements (3)**
**Pay-by-Link** (payment link, online payment, instant confirmation) · Suivi
des encaissements · Suivi des paiements fournisseurs

**Tab 6 — Application mobile (3)**
Pilotage mobile · Collecte mobile des documents (photo → OCR → classify) ·
Collaboration mobile avec le cabinet

**Native apps shipped:** App Store (`id6744939643`) and Google Play
(`com.generafi.ineo_mobile`).

---

## 4. INEO pricing

### Businesses (`/tarifs-entreprise`) — monthly / annual toggle, **−17 % annual**

| | **INEO GO** | **INEO PRO** | **INEO BOOST** |
|---|---|---|---|
| Price HT/mo | **390 MAD** (440 struck) | **490 MAD** (540 struck) | **590 MAD** (640 struck) |
| Users included | 2 | 3 | 5 |
| OCR quota | 100 docs | 250 docs | **Unlimited** |
| Annual discount | −50 DH HT | −50 DH HT | −50 DH HT |

All three tiers share the same body: dashboard, Agent IA, CRM pipeline, Drive,
accountant collaboration; invoicing (custom invoices, credit notes, auto-send
quotes/invoices/reminders, **multi-currency**, **retenue à la source**,
auto-dunning & recovery, subscriptions); purchases (supplier invoices, payment
tracking, supplier credit notes, payment-term tracking, RAS on supplier
invoices, **import dossier handling**, rentals, débours tracking & billing);
treasury (bank op categorisation, auto bank-statement reading, third-party &
category suggestions, cash tracking); projects (budget tracking, tasks,
**collaborator timesheets**).

**Paid add-ons:** Stock **+100 DH HT/mo** (multi-warehouse, supplier receipts,
client delivery notes, movements, inventory) · Précomptabilité **+150 DH HT/mo**
(accounting entry config & generation, tax return preparation, tax return
processing tracking).

### Accountants (`/tarifs-comptable`)
**No public price.** Lead-capture form only (name, professional email, phone,
city, CGU/privacy consent, "Rappelez-moi"). "Notre tarification est flexible et
personnalisable." Sales-led motion.

---

## 5. What WE have (FatooraLaw / Fatorati)

**Positioning:** "Le logiciel simple qui pilote vos **finances**, vos
**abonnements** et vos **risques**." Mobile-first, for **artisans, freelances
and small Moroccan businesses**. Explicitly *not* a certified accounting
package — the FAQ says so, and says it complements the `expert-comptable`
rather than replacing it.

**Marketing routes (12, each × fr/ar/en = 36 prerendered documents):**
`/`, `/features`, `/assistant`, `/about`, `/benefits`, `/pricing`, `/blog`,
`/faq`, `/contact`, `/privacy`, `/terms`, `/cookies` — plus `/blog/:slug`
articles.

**Auth:** `/login`, `/signup`, `/forgot-password`, `/reset-password`
(Supabase GoTrue + RLS, optional Cloudflare Turnstile, dev-only local mode).

**Signed-in modules (13):** `/dashboard`, `/projects`, `/contacts`,
`/procurement`, `/inventory`, `/calendar`, `/risk`, `/tools`, `/legal`,
`/reports`, `/team`, `/audit`, `/settings`.

**Admin CMS (9 areas):** blogs, contact inbox, content, monitor, platform,
security, site, subscriptions, lib. 13 content units: blog/articles, news,
legal dictionary/glossary, colleges/academies, archive/library,
seminars/events, exam bank, comments, trending laws (Google Trends MA),
user management/GDPR, governance/reports, settings, marketing/AI assistant.

**Pricing:** Essentiel **0 MAD** · Pro **199 MAD/mo** · Équipe **499 MAD/mo**.

**Storage reality:** business records live in **localStorage partitioned by
Supabase user ID** — a prototype, documented as such in `SECURITY.md` and
`CODE_AUDIT.md`. Supabase holds auth, profiles and CMS content.

**Security/AI-readiness stack (genuinely ahead of INEO's public site):** strict
CSP, HSTS, X-Frame-Options DENY, Permissions-Policy, COOP; `inputGuard`,
`xssShield`, CSRF tokens, AES-GCM client encryption, rate limiter, CMS audit
log with encrypted export and anomaly detection; `llms.txt`, `llms-full.txt`,
`ai.txt`, `ai-sitemap.xml`, `.well-known/ai-plugin.json` + `openapi.json`;
per-route JSON-LD (Organization, FAQ, Article, WebPage), canonical + hreflang,
sitemap with `xhtml:link` alternates.

---

## 6. OVERLAP — what we both have

| Capability | INEO | Us | Verdict |
|---|---|---|---|
| Moroccan-market French SaaS | ✅ | ✅ | **Same** |
| Dashboard + KPIs | ✅ Tableau de bord d'activité | ✅ `/dashboard` | **Same** |
| Projects & task/budget tracking | ✅ Kanban, progress, budget | ✅ `/projects` (status, budget, cost, margin, milestones, progress) | **Same — ours has margin & milestones** |
| Clients & suppliers directory | ✅ CRM fiches clients | ✅ `/contacts` (type, ICE, phone, balance ±) | **Partial — theirs has pipeline & interaction history** |
| Purchases / supplier invoices | ✅ Achats et fournisseurs | ✅ `/procurement` (vendor, category, method, approval, receipt) | **Same** |
| Stock / inventory | ✅ multi-warehouse (add-on 100 DH) | ✅ `/inventory` (SKU, qty, minQty, unit, material/equipment, project assignment) | **Same — ours assigns stock to projects** |
| Calendar & deadlines | ✅ fiscal calendar, deadline reminders | ✅ `/calendar` (renewals, payments, legal deadlines, time-blocking) | **Same** |
| Contracts / documents | ✅ Drive, doc space | ✅ `/legal` LegalVault (construction/service/rental, draft/sent/signed) | **Partial — theirs stores files, ours tracks contract state** |
| Reports & exports | ✅ payment reports | ✅ `/reports` (CSV/XLS with formula neutralisation) | **Same — ours neutralises CSV injection** |
| Team & roles | ✅ 2/3/5 users per tier | ✅ `/team` (owner/accountant/supervisor/assistant, per-module permissions) | **Same** |
| Audit trail | ⚠️ not marketed | ✅ `/audit` + CMS audit log, encrypted export, anomaly detection | **We're ahead** |
| AI assistant | ✅ Assistant IA + Agent IA + WhatsApp agent | ✅ `/assistant` (Moroccan legal rules, DOC art. 723, Loi 09-08 clauses, invoice templates ICE + TVA 20 %) | **Different domain — theirs operational, ours legal** |
| Blog / content marketing | ✅ `/actualites`, ~35 posts | ✅ `/blog` + CMS, 17 slug entries | **Same shape, they have ~2× volume** |
| FAQ, contact, legal pages | ✅ `/cgu`, `/confidentialite`, FAQ | ✅ `/faq`, `/contact`, `/privacy`, `/terms`, `/cookies` | **Same — ours adds a cookies page** |
| Multi-language | ❌ French only | ✅ fr / ar / en, prerendered per locale with hreflang | **We're ahead** |
| AI-answer-engine readiness | ❌ no `llms.txt` observed | ✅ `llms.txt`, `llms-full.txt`, `ai.txt`, `.well-known/ai-plugin.json`, `openapi.json` | **We're ahead** |
| Free entry tier | ❌ cheapest is 390 MAD | ✅ Essentiel at 0 MAD | **We're ahead** |

---

## 7. GAPS — what they have and we don't

### 🔴 Critical (product-level, decide deliberately)

1. **Invoicing / facturation.** They have quotes, invoices, credit notes, custom
   templates, auto-send, auto-dunning, multi-currency, RAS. We have `facture`
   mentioned in 6 files but **no invoice module** — no `/invoices` route, no
   invoice type in `src/store/types.ts`. This is the single biggest gap: the
   product is named *Fatoora*Law and it cannot produce a facture.
2. **Server-side business data.** Their data is in a real backend. Ours is
   localStorage — our own `SECURITY.md` says "NOT a certified production ERP".
   Multi-device, multi-user and backup are impossible today. This blocks
   everything below.
3. **Payments.** They have **Pay-by-Link** (a whole product page, a blog post,
   a feature tab) + secure-payment partners messaging. We have **zero**
   payment surface — `Pay-by-Link` appears in 0 files.
4. **OCR / document intelligence.** They read invoices and bank statements,
   with per-tier quotas (100/250/unlimited) used as a pricing lever. We have
   `OCR` in 1 file only, no pipeline.
5. **Bank synchronisation + auto bank reconciliation.** They sync banks,
   auto-categorise operations, auto-match to invoices, detect gaps. We have
   `bancaire` in 5 files, all copy, no integration. Morocco's open-banking
   project is even one of their blog topics.
6. **Native mobile apps.** They ship on App Store and Google Play, with a
   dedicated `/application-mobile` page mirrored for both audiences. We are a
   responsive web app; `mobile-app` appears in 0 files.

### 🟠 Strategic (go-to-market)

7. **The accountant as a second buyer.** Their whole architecture serves two
   audiences with mirrored URL trees (`/entreprise` vs
   `/professionnel-comptable`, each with 5 sub-pages), separate pricing pages,
   and a **partner program** (`/partenaire-comptable`) that has produced ~45
   firm logos. `cabinet` appears in **0 files** in our repo. We mention the
   `expert-comptable` twice, as someone we do *not* replace. They turned that
   person into a distribution channel.
8. **Précomptabilité automatisée** — auto accounting entries, tax-return
   preparation and processing tracking, sold as a 150 DH/mo add-on.
9. **Suivi des déclarations fiscales** with a fiscal calendar, statuses and
   validation tracking. Our `/risk` module has TVA/IS/CNSS/RC alerts — same
   *spirit*, but ours is an alert list, not a declaration workflow.
10. **Industry pages (9).** Agences, commerçants, bureaux d'études, **BTP**,
    industrie, services B2B, transport, **professions juridiques**. We have
    *no* vertical segmentation at all (`industrie` in 1 file).
    ⚠️ **Direct hit on our niche:** `/industries/professions-juridiques` targets
    *cabinets d'avocats, notaires, huissiers* with honoraires/provisions,
    **débours** re-billing, RAS, TVA, per-dossier tracking, 30/60/90-day cash
    projection. Our name is FatooraLaw. They are selling into our named market
    and we have no page for it. `débours` and `retenue à la source` appear in
    **0 files** on our side.
11. **Programmatic SEO layer (9 pages)**, all `lastmod` **2026-10-11**,
    targeting exact commercial queries: "logiciel de comptabilité au maroc",
    "logiciel de gestion de facturation", "prix logiciel comptabilité pour
    entreprise au maroc", "logiciel de gestion de trésorerie", "logiciel de
    saisie comptable"… We have 12 marketing pages; they have 72 URLs.
12. **Social proof.** Logo walls (~45 firms + ~14 companies), Trustpilot 5/5,
    3 video testimonials, "100+ clients", "jusqu'à 70 % de temps gagné". We have
    **no testimonials, no logos, no review badge, no quantified claim**.
13. **Lead capture with a phone number.** Their form collects name, professional
    email, **phone**, city + "Rappelez-moi". Our `/contact` has a support
    request form; there is no callback/sales path and no `/essai-gratuit`.
14. **Annual billing toggle with −17 %.** We price monthly only.
15. **Paid add-on model** (Stock +100, Précompta +150) — modular revenue on top
    of the tier. Our `PLAN_FEATURES` gate is all-or-nothing per tier.

---

## 8. What we have that they DON'T

1. **Arabic + English, fully prerendered** with hreflang clusters and per-locale
   canonicals. They are French-only. For a Moroccan TPE audience this is a real
   wedge, and it is already built (`src/lib/locales.ts`, `scripts/prerender.mjs`).
2. **AI answer-engine infrastructure.** `llms.txt`, `llms-full.txt`, `ai.txt`,
   `ai-sitemap.xml`, `.well-known/ai-plugin.json`, `.well-known/openapi.json`.
   None of that is visible on ineo.ma. As ChatGPT/Perplexity/Gemini become a
   discovery channel for "meilleur logiciel de gestion au maroc", we are
   structurally ready and they are not.
3. **A legal/compliance content engine.** Legal dictionary/glossary, trending
   Moroccan laws (Google Trends MA), seminars/events, exam bank, archive,
   colleges/academies, contract templates grounded in **DOC art. 723** and
   **Loi 09-08 / CNDP**. Their AI is operational (OCR, reconciliation); ours is
   *juridique*. Nobody else in this comparison serves Moroccan legal knowledge.
4. **A 0 MAD tier.** Their floor is 390 MAD HT/mo. We can acquire the artisan /
   freelance / auto-entrepreneur segment they have priced out.
5. **Documented security posture.** Published `SECURITY.md`, `CODE_AUDIT.md`,
   `SECURITY_HARDENING.md`, RLS + a hardening migration that closes a self-admin
   escalation, CSP/HSTS/COOP, CSRF, rate limiting, AES-GCM, CMS audit log with
   encrypted export and anomaly detection, CSV formula neutralisation. INEO's
   public claim is one paragraph: "les dernières technologies de chiffrement".
6. **Honest scope statements.** Our FAQ explicitly says we are not a certified
   accounting package and do not télé-déclarer. Their marketing blurs that line
   ("précomptabilité", "préparation des déclarations fiscales") without a
   comparable disclaimer.
7. **Granular per-module permissions** across 4 roles, and **stock assigned to
   projects** (materials/equipment per chantier) — closer to BTP reality than
   their generic multi-warehouse stock.
8. **Build-time configuration verification** (`dist/build-report.json`, a build
   that *fails* rather than shipping an auth-less site, precise diagnostics in
   `src/lib/supabaseConfig.ts`). Not a customer feature, but it is why our
   deploys don't silently break.

---

## 9. Recommended actions, ordered by impact ÷ effort

**Do now (marketing only, no product risk)**

1. **Ship a `/legal-professions` (cabinets d'avocats, notaires, huissiers)
   industry page.** They are ranking for our namesake audience. We already have
   LegalVault, contract templates, DOC/Loi 09-08 grounding, `/risk` with TVA,
   IS, CNSS, RC alerts and a legal glossary. Frame it as *"your legal
   back-office + compliance, without replacing your métier software"* — the exact
   sentence they use ("Vous gardez votre logiciel métier, INEO prend le relais").
   Add **débours** and **honoraires/provisions** vocabulary, which we currently
   have zero coverage of.
2. **Add a programmatic-SEO layer** using the existing prerender + locale
   machinery. Target the queries they just published (2026-10-11) from our
   angle: "logiciel de gestion des échéances fiscales maroc", "suivi des
   abonnements entreprise maroc", "logiciel gestion risques conformité CNDP",
   "gérer les débours d'un cabinet d'avocat au maroc", "modèle contrat
   prestation maroc DOC 723". Each page already gets its own document,
   canonical, hreflang and JSON-LD for free.
3. **Add social proof slots.** Even 3 named testimonials + a few client logos +
   one quantified claim would close the biggest credibility gap on our homepage.
   We have none; they have ~60 logos and video.
4. **Add an annual-billing toggle** to `/pricing` (−17 % is their number; pick
   our own) and publish a `/essai-gratuit`-equivalent that lands on our real
   0 MAD Essentiel tier — a genuine advantage we are not merchandising.

**Decide next (product)**

5. **Build an invoice module** (`/invoices`, an `Invoice` type in
   `src/store/types.ts`, ICE + TVA 20 % compliant output, PDF export, credit
   notes, reminder states). The product is called Fatoora and cannot issue a
   facture — this is the gap a visitor will notice first, and our `/assistant`
   already promises "Facture conforme ICE + TVA 20 %".
6. **Move business records from localStorage to Supabase** behind RLS, reusing
   the migration pattern in `supabase/migrations/`. This is the precondition for
   multi-user, multi-device, the accountant space, payments and any real
   invoicing. Our own `SECURITY.md` lists it as the first requirement before
   real client data.
7. **Then, and only then, pick ONE of:** (a) **accountant collaboration space**
   — their moat, highest strategic value, needs a second role and a shared
   dossier model; (b) **OCR on invoices/receipts** — reuses the mobile-first
   promise and gives a natural quota-based pricing lever; (c) **Pay-by-Link** —
   fastest visible revenue feature, needs a PSP contract in Morocco.

**Deliberately decline**

8. Do **not** chase bank synchronisation, native apps, or full précomptabilité
   yet. All three are expensive, all three are where INEO has 45 partner firms
   of head start, and none of them is our differentiator. Our wedge is
   **Arabic/English + legal-compliance intelligence + AI-engine readiness + a
   free tier** for the micro-business they have priced out. Win that segment
   first.

---

## 10. One-line summary

INEO is a funded, French-only, accountant-networked **ERP + précomptabilité +
payments** play at 390–590 MAD/mo with 72 URLs, native apps and ~45 partner
firms. We are a trilingual, AI-readable, legally-grounded **compliance &
operations cockpit** with a free tier, 36 prerendered documents, a real security
posture and a localStorage prototype underneath. **They have the product depth
and the distribution; we have the language coverage, the legal domain, the
machine-readability and the entry price.** The urgent threat is not their
invoicing — it is that they published a `professions-juridiques` page and nine
programmatic-SEO pages three days ago, and are taking the search ground our
name claims.
