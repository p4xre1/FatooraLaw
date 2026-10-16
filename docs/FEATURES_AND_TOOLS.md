# Features & Tools — what every tool does and how it works

Complete functional reference for FatooraLaw / Fatorati. Every entry below was
read out of the source on **2026-10-14**, not from marketing copy.

**Status legend used throughout**

| Mark | Meaning |
|---|---|
| ✅ **LIVE** | Reads/writes real records the user entered; persists across reloads |
| 🎬 **DEMO** | Hardcoded sample content in the component; ignores the user's data |
| 🖥️ **LOCAL** | Stored in this browser's `localStorage`, partitioned per account |
| ☁️ **SERVER** | Stored in Supabase (Postgres + RLS), shared across devices |
| ⚠️ **GAP** | Documented limitation, or a UI label that overstates what happens |

Companion documents: [SECURITY.md](../SECURITY.md) (threat model),
[CODE_AUDIT.md](../CODE_AUDIT.md) (data audit),
[ENVIRONMENT.md](ENVIRONMENT.md) (Supabase configuration),
[SEO_GEO_AIO_SXO.md](SEO_GEO_AIO_SXO.md) (crawlability),
[COMPETITOR_INEO.md](COMPETITOR_INEO.md) (market comparison).

---

## 1. The three applications in one repository

This repo ships **three distinct surfaces** behind one Vite build. They share
components and the Supabase client, but they have different data stores and
different audiences.

```
                       ┌──────────────────────────────────────────────┐
                       │            src/App.tsx  (router)             │
                       └──────────────────────────────────────────────┘
                            │                    │                  │
          public path       │      /login …      │     /admin/*     │
                            ▼                    ▼                  ▼
   ┌────────────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐
   │  A. MARKETING SITE         │  │  B. SIGNED-IN APP    │  │  C. ADMIN CMS     │
   │  src/marketing/Landing.tsx │  │  src/modules/*.tsx   │  │  src/admin/**     │
   │                            │  │                      │  │                   │
   │  12 pages × 3 locales      │  │  13 tools            │  │  18 routes        │
   │  prerendered to real HTML  │  │  4 auth screens      │  │  2 admin roles    │
   │                            │  │                      │  │                   │
   │  data: ☁️ Supabase CMS     │  │  data: 🖥️ localStorage│  │ data: ☁️ Supabase │
   │  read-only, published      │  │  + ☁️ Supabase auth  │  │  RLS-protected    │
   └────────────────────────────┘  └──────────────────────┘  └───────────────────┘
```

| Surface | Who uses it | Auth needed | Where its data lives |
|---|---|---|---|
| **A. Marketing site** | Visitors, crawlers, AI answer engines | No | ☁️ Supabase CMS tables, read at build time and prerendered |
| **B. Signed-in app** | The business owner and their team | Yes — Supabase session | 🖥️ `localStorage` primary; optional opt-in ☁️ RLS mirror per account/device + Supabase identity |
| **C. Admin CMS** | Content editors and platform operators | Yes — Supabase + a CMS role | ☁️ Supabase, protected by Row Level Security |

⚠️ **The single most important fact about this product:** surface **B** still
uses browser storage as its primary source and is a prototype. Settings now
offers an explicit opt-in Supabase JSON snapshot mirror, protected by RLS per
user/device. That second copy is readable by the authenticated account and
trusted project operators; it is not end-to-end encrypted, live multi-device
sync, or a restore workflow. Read `SECURITY.md` and §4 before trusting any
figure.

---

## 2. Tool map — signed-in application (13 tools)

Sidebar labels come from `src/components/nav.tsx`, grouped into five sections.

| # | Group | Sidebar label | Route | File | Status |
|---|---|---|---|---|---|
| 1 | Pilotage | Tableau de bord | `/dashboard` | `modules/Dashboard.tsx` | ✅ LIVE 🖥️ |
| 2 | Opérations | Projets | `/projects` | `modules/Projects.tsx` | ✅ LIVE 🖥️ |
| 3 | Opérations | Clients & Fournisseurs | `/contacts` | `modules/Contacts.tsx` | ✅ LIVE 🖥️ |
| 4 | Opérations | Achats & Dépenses | `/procurement` | `modules/Procurement.tsx` | ✅ LIVE 🖥️ |
| 5 | Opérations | Stock & Matériel | `/inventory` | `modules/Inventory.tsx` | ✅ LIVE 🖥️ |
| 6 | Suivi & Échéances | Calendrier | `/calendar` | `modules/Calendar.tsx` | 🎬 **DEMO** |
| 7 | Suivi & Échéances | Gestion des Risques | `/risk` | `modules/Risk.tsx` | 🎬 **DEMO** |
| 8 | Suivi & Échéances | Abonnements & Outils | `/tools` | `modules/Tools.tsx` | ✅ LIVE 🖥️ |
| 9 | Conformité | Coffre juridique | `/legal` | `modules/LegalVault.tsx` | ✅ LIVE 🖥️ |
| 10 | Conformité | Rapports & Fiscalité | `/reports` | `modules/Reports.tsx` | ✅ LIVE 🖥️ |
| 11 | Administration | Équipe & Rôles | `/team` | `modules/Team.tsx` | ✅ LIVE 🖥️ ⚠️ |
| 12 | Administration | Journal d'audit | `/audit` | `modules/AuditLog.tsx` | ✅ LIVE 🖥️ ⚠️ |
| 13 | Administration | Paramètres | `/settings` | `modules/Settings.tsx` | ✅ LIVE 🖥️ |

---

## 3. Tool-by-tool reference

### 3.1 Tableau de bord — `/dashboard`
**File:** `src/modules/Dashboard.tsx` (148 lines) · **Data:** `src/lib/dashboardData.ts`

**What it does.** Four summary cards, three charts, a recent-activity feed and
three quick-action buttons.

**The four cards** (all totals, all periods):

| Card | Source | What it actually sums |
|---|---|---|
| Budgets des projets | `Σ project.budget` | Budgets you typed — **not** invoiced revenue |
| Encaissements saisis | `Σ project.paid` | Cumulative amounts you typed — **no dated payment history** |
| Dépenses approuvées | `Σ expense.amount where status = approved` | Excludes `pending` expenses |
| Soldes clients à recouvrer | `Σ max(0, contact.balance)` for clients | Only positive balances; negative (we owe them) is ignored |

**The three charts**, each toggleable from a "Widgets" customise panel:
- **Dépenses mensuelles** — area chart, approved expenses bucketed by calendar
  month over a selectable window of **6 / 8 / 12 months** (default 8).
- **Répartition** — donut of approved expenses by category for the window,
  top categories first, zero-value categories dropped.
- **Budgets et encaissements** — grouped bars, top **8 projects** by budget.

**How it works.**
1. `dashboardData()` first calls `dashboardRecords()`, which runs
   `legacySampleOrigins()` — a **provenance detector** that identifies rows
   left over from older demo seeds and *hides them from the view without
   deleting them*. It matches on reserved seed IDs plus an unchanged field
   fingerprint, corroborated by coherent date offsets and audit timestamps.
   A single ambiguous row is never hidden; it needs a full matching batch.
   The count is reported as *"N exemple(s) préchargé(s) exclu(s) de cette vue."*
2. Surviving rows are re-validated (finite amounts within `MAX_AMOUNT`, known
   status enums, parseable dates). Rejected rows are counted and reported as
   *"N entrée(s) invalide(s) non représentée(s)."*
3. Money is summed in **integer cents** (`cents()` → `sum()`) to avoid float
   drift, then divided back. Future-dated expenses are excluded from monthly
   buckets.
4. Formatting uses `dashboardMoney()` — `Intl.NumberFormat` with
   **2 decimals**, deliberately different from the app-wide `money()` formatter
   which rounds to whole units. Locale follows the currency: `fr-MA` for MAD,
   `fr-FR` for EUR, `en-US` for USD.

**Bilingual.** A **FR ⇄ العربية** toggle in the header re-renders the whole
dashboard in Arabic with `dir="rtl"`, including translated month names
(`MONTHS_AR`) and expense categories (`categoryAr`). The choice persists in
`localStorage` under `mizan.dashboard.lang`. This is a per-module language
switch, separate from the marketing site's locale routing.

**Exports.** CSV and XLS of the monthly approved-expense series, plus `PDF`
which calls `window.print()`. Both are disabled when there is no dated data.

**Empty state.** With no records it says *"Aucune donnée financière enregistrée"*
and explains that totals will use only your data, "sans exemples préchargés".
It never fabricates a number to fill the screen.

**Honesty note rendered in the UI:** *"Les encaissements sont les montants
cumulés saisis dans les projets, pas un solde bancaire. Sans historique daté des
paiements, aucun revenu mensuel ni flux de trésorerie n'est estimé."*

---

### 3.2 Projets — `/projects`
**File:** `src/modules/Projects.tsx` (157 lines)

**What it does.** A table of projects with computed financial columns, a
milestone checklist per project, and stock assignment to a project.

**Record** (`Project` in `src/store/types.ts`): `name`, `clientId`, `budget`,
`paid`, `cost`, `status`, `progress`, `start`, `end`, `milestones[]`,
`equipmentIds[]`.

**Derived columns — computed in the component, not stored:**
- **Créances** = `budget − paid`
- **Marge** = `budget − cost`, displayed as a percentage of budget
  (`margin / budget × 100`, 0 when budget is 0)
- **Avancement** = `progress` as a progress bar; turns green at 100 %

**Statuses:** `planning` (Planification) · `active` (En cours) ·
`on_hold` (En pause) · `done` (Terminé).

**Milestones.** Each project holds `{ id, label, done }[]`. Clicking a milestone
row toggles `done` via `toggleMilestone()` and strikes the label through. The
milestone modal also shows Budget / Coût réel / Marge as three stats.

**Stock assignment.** The 📦 button opens an assignment dialog; `assignStock()`
sets `assignedProjectId` on stock items, which is why Inventory can show which
chantier a piece of equipment is on.

**Validation on write** (`addProject` / `updateProject` in the store):
`budget`, `paid` and `cost` must all pass `requireAmount()` (finite, ≥ 0,
≤ `MAX_AMOUNT` = 999 999 999 999.99). `progress` must be an **integer 0–100**.
`name` goes through `sanitize()`. The update path re-validates the *merged*
object, so a partial patch cannot sneak an invalid value in. `id` is pinned to
the existing record's id and cannot be overwritten by a patch.

---

### 3.3 Clients & Fournisseurs — `/contacts`
**File:** `src/modules/Contacts.tsx` (169 lines)

**What it does.** A searchable directory of clients and suppliers with a
per-contact ledger, plus CSV import and export.

**Record** (`Contact`): `type` (`client` | `supplier`), `name`, `ice`, `phone`,
`email`, `city`, `balance`.

**The `balance` sign convention** — this is the one field people get wrong:
> **positive = they owe us** (receivable) · **negative = we owe them**

It is validated by `requireBalance()`, which allows negatives but requires a
finite number within ±`MAX_AMOUNT`.

**Filters.** Free-text search across `name`, `ice`, `phone`, `email`, `city`,
plus a three-way facet: Tout / Clients / Fournisseurs.

**Per-contact ledger.** Opening a contact builds a combined history from two
other collections — projects where `clientId` matches (labelled *Projet*,
amount = budget) and contracts where `clientId` matches (labelled *Contrat*,
amount = value) — merged and sorted newest-first. Row actions include WhatsApp
and Email deep links built from the stored phone/email.

**CSV export.** Writes `Nom, Type, ICE, Téléphone, Email, Ville, Solde` for the
*currently filtered* set to `fatorati-contacts.csv`.

**CSV import** — the strictest input path in the app:

| Rule | Limit | Error shown |
|---|---|---|
| File size | ≤ **2 MB** | "Le fichier CSV ne doit pas dépasser 2 Mo." |
| Row count | ≤ **10 000** | "Import limité à 10 000 contacts par fichier." |
| Columns | exactly **7**, header row skipped | "Le CSV doit contenir 7 colonnes : Nom, Type, ICE, Téléphone, Email, Ville, Solde." |
| Balance | must parse to a finite number | "Le CSV contient un solde invalide." |

Parsing uses `parseCSV()` (quote-aware). Any column value that is not exactly
`supplier` becomes `client`. **All rows are validated before any state is
mutated** — `importContacts()` calls `requireBalance()` on every row first, so
a bad row 9 000 aborts the whole import rather than half-applying it.

**Race protection.** The import tracks a `revision` counter and the owner's
`auth.id`; both are re-checked after the async file read, and the counter resets
whenever the signed-in user changes. A slow import cannot land in a different
account's data.

---

**The one-form rule** (`components/PartyPicker.tsx`): no dashboard form
may demand a party that does not exist yet, and no client is typed twice.
Wherever a form picks a client — a project, a contract, an order/lead —
the select ends with "＋ Nouveau client…" and unfolds name / phone /
city inline; expenses do the same for suppliers. Submitting creates the
contact and saves with its id in the same gesture (`addContact` returns
the new id), so the party is registered in Clients & Fournisseurs —
ranked, mapped, verified and analysed like any other — from the single
form. Contracts keep their explicit "Client non renseigné" choice.

**Classement des clients** (`lib/clientRank.ts`, clients only): every client
carries a score out of 100 — collected money 50 (log-scaled), projects 15,
clear balance 15, age 10 from the birth year — and a tier (VIP ≥ 75, Or ≥ 55,
Argent ≥ 35, Bronze below), relative to the client base. City, acquisition
source ("nous a connus via"), sales channel ("achète via") and item keywords
are *segments* that slice the ranked list, never points. The keyword profile
of a client is inherited from the stock their projects consumed. The ledger
detail shows the point-by-point breakdown, spend vs contracted, and the
client's product words.

### 3.4 Achats & Dépenses — `/procurement`

**Détail d'une dépense** (`lib/expenseCalc.ts`): an expense can be itemised —
articles with quantities and unit prices (the "number of items" is their sum),
a TVA rate of its own (defaulted from Paramètres, basis of the TVA
récupérable), and the receipt photo itself stored with the record (image,
512 KB max, validated like the logo). `amount` remains what was paid (TTC)
everywhere; HT/TVA are derived — from the lines when itemised, from the TTC
and rate otherwise, and `null` (shown as unknown) for legacy expenses with no
rate, never invented. The list underlines the split and the item count, the
receipt thumbnail opens the photo, and the Excel export carries items, rate
and HT alongside the TTC.

**File:** `src/modules/Procurement.tsx` (156 lines)

**What it does.** An expense register with a two-state approval workflow.

**Record** (`Expense`): `date`, `vendorId`, `category`, `method`, `amount`,
`status`, `receipt`, `note`.

**Categories** (fixed list): Matériaux · Quincaillerie · Location · Carburant ·
Main d'œuvre · Transport · Autre.

**Payment methods**, each with its own icon: `transfer` (Virement) ·
`check` (Chèque) · `cash` (Espèces).

**Approval workflow.** New expenses are always created with
`status: "pending"` and the modal warns *"Enregistrée « en attente » —
approbation requise."* Only `approved` expenses reach the dashboard totals and
the monthly charts. You can approve one row, or hit **Tout approuver** to
approve every pending expense at once. Approval is logged at `warning`
severity; deletion at `critical`.

**Three summary tiles:** Total filtré (respects the current search + filters) ·
En attente d'approbation (money value, always all pending, ignores filters) ·
À approuver (count).

**Vendor picker** lists only contacts with `type === "supplier"`. The table
resolves `vendorId` → name at render time, so renaming a supplier updates every
expense row.

**The `receipt` toggle** stores a boolean and renders a paperclip. Its label
reads *"Reçu / facture joint (prêt OCR)"*.
⚠️ **GAP:** there is no file attached and no OCR. The field records that a
receipt exists; it does not store or read one.

**Export.** XLS of the filtered rows to `fatorati-depenses.xls`, with the
status translated to Approuvé / En attente.

---

Expense lines and stock articles both carry free **keywords**
(`lib/keywords.ts`) — the vocabulary the client ranking analyses by.

### 3.5 Stock & Matériel — `/inventory`
**File:** `src/modules/Inventory.tsx` (130 lines)**File:** `src/modules/Inventory.tsx` (130 lines)

**Scanner de codes-barres** (`components/StockScanner.tsx`, `lib/scanCamera.ts`,
`lib/barcode.ts`, PRO/BOOST): one code — phone camera (platform
`BarcodeDetector`, ZXing elsewhere, lazy-loaded), hardware reader, or typing —
finds the article by SKU (exact after normalization: a near-miss creates,
never moves the wrong stock). Found: Entrée/Sortie in place, live level and
status. Unknown: the create form opens with the code already filled, which is
how a delivery gets stocked. Every move lands in the audit journal via
`adjustStock`. The lock page names the scanner when Stock is the module a
FREE account is looking at.


**What it does.** Stock levels with low-stock alerts and per-project assignment.

**Record** (`StockItem`): `name`, `sku`, `qty`, `minQty`, `unit`,
`assignedProjectId`, `type` (`material` | `equipment`).

**Two item types**, filtered by a segmented control: **Matériaux** (consumables,
package icon) and **Matériel** (equipment, wrench icon).

**Level display.** A progress bar scaled against `minQty × 1.5` — so the bar
reads "full" at 150 % of the threshold and goes amber below the threshold. The
numeric readout `{qty} {unit}` is always shown next to it.

**Low-stock alert.** Any item where `qty < minQty` is counted in the header
subtitle and listed by name in an amber banner.

**Adjustment.** ±1 buttons per row. `adjustStock()` clamps the result at 0
(`Math.max(0, qty + delta)`) and re-validates against
`MAX_QUANTITY` = 99 999 999 999.999. The **+** button is disabled at the ceiling
and **−** at zero.

**Assignment.** Unassigned items show a project dropdown; assigned items show
the project name with a *retirer* link. `assignStock()` writes
`assignedProjectId` (or `null`).

⚠️ **GAP:** there are no stock *movements* — no goods-in/goods-out ledger, no
supplier receipts, no delivery notes, no multi-warehouse, no inventory counts.
The quantity is a single number you nudge by hand. Each ±1 writes one audit
entry, so the log is the closest thing to a movement history.

---

### 3.6 Calendrier — `/calendar`
**File:** `src/modules/Calendar.tsx` (135 lines)

🎬 **THIS TOOL IS ENTIRELY HARDCODED DEMO CONTENT.** It does **not** import
`useMizan` and reads **none** of your data.

**What is on screen.** A Monday-first month grid for **"Septembre 2026"**
(`MONTH_LABEL`), laid out with a hardcoded `LEAD = 1` blank cell and
`DAYS = 30`. The source comment says so plainly:
*"September 2026 — starts Tuesday (Mon-first grid → 1 leading blank), 30 days."*

**The seven fixed events** (`const EVENTS`):

| Day | Type | Label | Detail |
|---|---|---|---|
| 3 | pay | Hébergement OVH | Prélèvement mensuel — 89 MAD (carte ****4021) |
| 8 | pay | Adobe Creative Cloud | Paiement récurrent — 299 MAD |
| 12 | renew | Microsoft 365 Business | Fin de période le 12/09 — 129 MAD/mois |
| 15 | legal | Acompte IS — 1er versement | DGI, base : résultat fiscal N-1 |
| 20 | pay | Assurance RC Pro | Échéance trimestrielle — 640 MAD |
| 23 | legal | Déclaration TVA — T3 2026 | Dépôt avant le 30/09, pénalité 15 % |
| 27 | renew | Fin abonnement Sage Compta | — |

**Event types** render with distinct dot colours and icons: `renew`
(Renouvellement, brand blue, RefreshCw) · `pay` (Paiement, amber, CreditCard) ·
`legal` (Échéance légale, red, Scale). Clicking a day shows that day's events in
a side panel; an "upcoming" list sorts all events by day.

⚠️ **The chevron arrows do not change month** — there is only one month of data.
The card mentions a real card number suffix (`****4021`) that belongs to nobody.

**Why this matters.** The marketing homepage sells this exact tool as *feature
one* — "Un calendrier de time-blocking épuré pour ne jamais manquer une date
clé" — and `/pricing` gates `calendar` and `calendar_deadlines` behind the
Essentiel plan. A paying user would land on a fixed September 2026 grid.
This is the highest-priority honesty gap in the product.

**What would make it live:** `src/lib/calendarDates.ts` already provides
`calendarDay()`, `dateFromDay()`, `addCalendarDays()`, `daysUntil()` and
`validDateRange()`, and `useToday()` already refreshes at local midnight. The
date arithmetic is built and tested; only the binding to real records is
missing. Subscription expiry dates from `/tools` and contract dates from
`/legal` are the natural event sources.

---

### 3.7 Gestion des Risques — `/risk`
**File:** `src/modules/Risk.tsx` (115 lines)

🎬 **ALSO ENTIRELY HARDCODED.** No `useMizan` import; the list is a module-level
`const RISKS`.

**The seven fixed risks**, with level, category and due date:

| Label | Category | Due | Level |
|---|---|---|---|
| Déclaration TVA — T3 2026 | Fiscalité | 30/09/2026 | 🔴 high |
| Acompte IS — 1er versement | Fiscalité | 15/09/2026 | 🔴 high |
| Contrat client — PME locale | Contrats | 22/09/2026 | 🟠 medium |
| Registre du commerce — Modèle J | Registre commercial | — | 🟢 ok |
| Assurance RC Professionnelle | Contrats | 20/09/2026 | 🟠 medium |
| CNSS — déclaration mensuelle | Social | — | 🟢 ok |
| Conformité RGPD / Loi 09-08 | Données personnelles | — | 🟢 ok |

Each card carries a coloured left rail, a level badge, a category chip and a
`desc` paragraph citing real Moroccan law — the TVA entry quotes a **15 %
majoration plus 0.5 % per month**, and the contract entry cites **art. 264 DOC**
on late-payment penalty clauses.

**Interactions that do work:** three count tiles (high / medium / ok), a
four-way level filter (Tout / Élevé / Moyen / OK) and a search box matching
`label + category + desc`. These operate over the fixed array, so the UI is
fully responsive — it just cannot show *your* risks, and nothing can be added,
edited or dismissed.

⚠️ **Note the legal-content value here is real even though the data is not.**
The citations (DGI, TGR, DAMANCOM, CNDP, DOC art. 264, Modèle J) are accurate
and are the same substance the `/assistant` page promises. Turning this into a
user-editable register with the same seeded catalogue as *defaults* would be a
small change with a large payoff.

---

### 3.8 Abonnements & Outils — `/tools`
**File:** `src/modules/Tools.tsx` (105 lines) · **Logic:** `src/lib/subscriptions.ts`

✅ The most complete "real data" tool after the dashboard — and the one the
product is named for.

**Record** (`SubscriptionTool`): `name`, `cost` (planned monthly cost, **not** a
recorded payment), `start` (ISO date, empty = unknown), `expiry` (ISO date,
empty = no known expiry).

**Status machine** — `subscriptionStatus(tool, today)`:

| Status | Condition | Badge |
|---|---|---|
| `unknown` | either date unparsable, or expiry before start | "Dates à vérifier" (neutral) |
| `expired` | `expiry` is in the past | "Expiré" (red) |
| `scheduled` | `start` is in the future | "À venir" (blue) |
| `active` | otherwise | "Actif" (green), or **"Expire dans N j"** (amber) when ≤ 30 days remain |

**Three tiles:** Coût mensuel actif (`Σ cost` over *active only* — expired and
scheduled are excluded, and the tile says so) · Outils actifs (n of total) ·
Expire sous 30 jours.

**Trend chart.** `monthlySubscriptionCosts()` builds the last **7 months** of
labels (`Intl.DateTimeFormat` `fr-MA`, short month + 2-digit year, UTC) and, for
each month, sums the cost of every subscription whose `[start, expiry]` range
**overlaps** that month. Subscriptions with an empty start or expiry are treated
as open-ended on that side.

⚠️ **Read the chart's own disclaimer:** *"Montants théoriques des abonnements
couvrant chaque mois, **sans prorata**. Ce graphique n'est pas un historique des
paiements."* A subscription that starts on the 28th counts for the whole month.
The source comment in `subscriptions.ts` repeats it: *"Not payment history,
prorating, or a forecast of confirmed debits."*

**Date handling.** All arithmetic goes through `calendarDay()`, which converts
to **UTC day numbers** rather than elapsed milliseconds — the source comment
explains why: *"Date-only arithmetic uses UTC day numbers, not elapsed hours
across DST."* `calendarDay()` accepts both `YYYY-MM-DD` and `DD/MM/YYYY`,
validates the year range 1000–9999, and **round-trips through `Date.UTC` to
reject impossible dates** like 31 February.

**On write** (`addTool`): cost passes `requireAmount()`, the range passes
`validDateRange()`, the name is `sanitize()`d and must be non-empty, and both
dates are **normalised to ISO** (`dateFromDay(calendarDay(x))`) before storage —
so a `DD/MM/YYYY` input is stored consistently as `YYYY-MM-DD`.

---

### 3.9 Coffre juridique — `/legal`
**File:** `src/modules/LegalVault.tsx` (106 lines) · **Logic:** `src/lib/legalData.ts`

**What it does.** A register of contract *records* — not a contract generator.

**Record** (`Contract`): `type` (`construction` | `service` | `rental`),
`title`, `clientId`, `value`, `date`, `status` (`draft` | `sent` | `signed`).

**Three templates** create a blank record of the matching type:
**Marché de travaux (BTP)** · **Contrat de prestation** · **Location de matériel**.

**Status labels are deliberately qualified:** `sent` renders as
**"Envoyé (suivi manuel)"** and `signed` as **"Signé (suivi manuel)"**.

**The confirmation modal is the key honesty mechanism.** Marking a contract sent
or signed opens a dialog stating:
> *"Cette action change uniquement le statut enregistré. Elle ne crée aucune
> signature électronique et n'envoie aucun e-mail. Confirmez seulement si vous
> avez effectué cette démarche en dehors de l'application."*

A permanent banner at the top of the page repeats it: *"Les structures
ci-dessous ne sont pas des contrats certifiés. Aucun contenu juridique complet,
envoi par e-mail ou signature électronique n'est fourni."*

**The preview modal** shows a definition list — company (from Settings), client,
type, recorded date, amount, declared status — and then an explicit section
titled **"Contenu du contrat non enregistré"**:
> *"Seuls les champs de cette fiche sont stockés. Le texte du contrat, les
> clauses négociées, la juridiction et les preuves de signature ne sont pas
> enregistrés ici."*

The amount field is labelled *"Montant saisi (**base HT/TTC non précisée**)"* —
the app does not know whether you entered a pre-tax or post-tax figure.
**Imprimer la fiche / PDF** calls `window.print()` against a `print-clean`
styled block.

**Data hygiene.** `legalData()` runs the same seed-provenance filter as the
dashboard and additionally validates every contract: known `type`, known
`status`, finite `value` in `[0, MAX_AMOUNT]`, parseable `date`. Invalid rows
are hidden and counted (*"N fiche(s) invalide(s) non affichée(s)"*).
`legalCompany()` returns an empty string when the Settings identity is still the
untouched default, so the preview shows *"Entreprise non renseignée"* instead of
a placeholder company name.

⚠️ **GAP:** no document storage, no clause library, no e-signature, no email
dispatch, no deadline computation from contract dates. This is a tracking
register with a printable summary card.

---

### 3.9b Livraisons & Vérification clients — `/delivery`, `/verification`

The ad-to-delivery pipeline (PRO/BOOST, in the **Gestion** group). An
**order** (`DeliveryOrder`) is the unit everything hangs on: its client,
its campaign, its items (stock lines carry their purchase cost), and its
recorded costs — delivery, packaging, other fees. **Campaigns**
(`AdCampaign`) record platform and spend; `lib/deliveryAnalytics.ts` turns
them into a cost per verified client (spend ÷ distinct verified clients),
charged once per client on their first verified order — a refused lead is
never charged product or delivery costs in the per-client totals, and a
repeat order is never charged the acquisition twice.

**Vérification clients** is the call queue: Nouveau → Appelé → Sans
réponse → Vérifié / Refusé, then payment (derived from the amount paid).
The store stamps `firstCallAt` / `verifiedAt` / `paidAt` when a stage
changes, so the page measures — never asks — how long a client waited for
the first call and how long they took to convince (first call →
verified). Its second table is the per-client cost ledger: products,
delivery, packaging, other fees, ads, total, profit.

**Livraisons** runs fulfilment (En attente → Préparation → Expédiée →
Livrée / Retournée / Annulée): marking delivered takes the quantities out
of stock once, a return puts them back. It also shows stock on hand vs
reserved by verified orders vs available, the campaigns table, and a
compact verified-buyer audience. The same audience is reported in depth
in Rapports (§3.10): spend, buyers, average CAC, conversion, campaign
table, and segments by city, source, channel, age band and product
keywords — always computed from verified buyers, never estimated.

### 3.10 Rapports & Fiscalité — `/reports`

**L'argent — la vue complète** (`lib/moneyOverview.ts`): every money
figure the application reads — project budgets and collections, approved
expenses and their recoverable VAT, order revenue / product / delivery /
packaging costs and profit, campaign spend, client balances, stock value
at purchase price, signed contracts, planned monthly subscriptions —
consolidated once and shown three ways: a **diagram** (in vs out per
source), a **financial score** out of 100 (collections 40, order
profitability 30, cost coverage 30; parts shown, dataless parts drop out
and the rest rescale), and an **infographic** (the in → out → remains
flow, a donut of where the money goes, and the position figures).
Subscriptions stay labelled planned-per-month and are never folded into
the totals; the stock value counts only articles with a known purchase
price and names the rest.

**Clients par ville — Maroc**: a Morocco map (`lib/cities.ts`,
`components/MoroccoMap.tsx`) with one dot per city — 75 cities covering all
twelve regions — sized by client count or collected money (projects plus
verified orders). The outline is the real boundary (Natural Earth 50 m
admin-0, Morocco + southern provinces dissolved into one silhouette,
simplified to 134 points with a ~3 km seaward buffer), the projection box
keeps the true 1 574 km × 1 683 km proportions, and a geometry test keeps
every city strictly inside (no tiles, no fetch — the app stays
offline-capable). City names are matched by
normalization plus FR/EN/AR aliases; a place the map does not know is listed
beside it, never dropped. Selecting a city names its best clients (score
order) with their product keywords.

**File:** `src/modules/Reports.tsx` (57 lines)

**What it does.** The same `dashboardData()` engine as the dashboard, presented
as an accountable statement rather than a cockpit.

**Four summary cards**, each with its **source printed underneath**:

| Poste | Source du montant (verbatim) |
|---|---|
| Budgets des projets | "Budgets saisis, pas un chiffre d'affaires facturé" |
| Encaissements saisis | "Cumuls saisis dans les projets, sans historique des dates de paiement" |
| Dépenses approuvées | "Montants enregistrés et approuvés, pas une preuve de paiement bancaire" |
| Soldes clients à recouvrer | "Soldes positifs enregistrés dans les fiches clients" |

Then the monthly approved-expense bar chart (6/8/12-month selector, same as the
dashboard) and a "Totaux enregistrés (toutes périodes)" table repeating the four
postes with their sources.

**The amber "TVA non calculée" panel** is the most important text in the app:
> *"Le taux configuré ne suffit pas à calculer une déclaration. Les factures de
> vente et d'achat, bases HT/TTC, opérations exonérées et montants de TVA
> collectée/déductible ne sont pas enregistrés dans un grand livre fiscal ici.
> Aucun résultat net, revenu mensuel, solde bancaire ou prévision à 30 jours
> n'est estimé. Ce récapitulatif ne constitue pas un compte de résultat ni une
> déclaration fiscale."*

So the **TVA rate in Settings is stored but never applied to anything.** There
is no tax computation anywhere in the product.

**Exports.** CSV of the monthly series (`fatorati-rapport-depenses-approuvees.csv`)
and print-to-PDF. Both disabled without dated data.

---

### 3.11 Équipe & Rôles — `/team`
**File:** `src/modules/Team.tsx` (87 lines) · **Gating:** `src/lib/permissions.ts`

**Record** (`TeamMember`): `name`, `email`, `role`, `active`,
`permissions: Record<ModuleKey, boolean>` — a **per-module boolean for all 13
modules**.

**Four roles** with preset permission bundles (`rolePresets`):

| Role | Modules granted |
|---|---|
| `owner` | **all 13** |
| `accountant` | dashboard, procurement, reports, contacts |
| `supervisor` | dashboard, projects, inventory |
| `assistant` | dashboard, contacts |

**Inviting.** The modal collects name, email and role (owner is not offered),
applies the preset for that role, and appends the member. The button reads
*"Envoyer l'invitation"* and the field hint says *"Une invitation sera envoyée à
cette adresse."*

⚠️ **GAP — no email is sent.** `inviteMember()` writes a local record and one
audit entry. There is no mail transport, no invite token, no link. `SECURITY.md`
states this: *"Team invitations do not send email; local permissions not
server-shared."*

**Owner protection.** The role selector and the Désactiver/Réactiver button are
both `disabled` when `role === "owner"`, so an account cannot lock itself out.

**How visibility is enforced.** `allowedModules(auth, team)`:
1. No session → **nothing** visible.
2. Match a team member by **case-insensitive trimmed email**.
3. That member exists but `active === false` → **nothing** visible.
4. `auth.role === "owner"` → **everything** visible, regardless of the member row.
5. Otherwise → exactly that member's permission booleans.

The Sidebar filters `NAV` through this map, so a disallowed module is not
rendered at all.

⚠️ **This is UX, not security.** The function's own doc comment says it plainly:
*"Module visibility only. Database RLS, not this function, is access control."*
Because the team array lives in `localStorage`, a user can edit their own
permissions in devtools. The same caveat applies to plan codes (§6.2).

---

### 3.12 Journal d'audit — `/audit`
**File:** `src/modules/AuditLog.tsx` (81 lines)

**Record** (`AuditEvent`): `ts`, `actor`, `action`, `target`, `module`,
`severity` (`info` | `warning` | `critical`).

**How entries are created.** Only through the store's `log()` action, called
from inside each mutation. Every entry is **prepended** (newest first) and the
array is capped at **500** by `.slice(0, 500)` — old events fall off silently.
`actor` is the signed-in user's name, or `"Système"` when there is no session.

**What is logged, and at which severity:**

| Severity | Events |
|---|---|
| `info` | sign-in · project created · contact added · expense recorded · stock adjusted · stock assigned · tool added · contract marked sent |
| `warning` | CSV import (with row count) · expense approved · contract created · contract marked signed · member invited · tool removed · settings changed |
| `critical` | contact deleted · expense deleted · member activated/deactivated · sign-out |

Note the deliberate weighting: **deletions and privilege changes are
`critical`**, money approvals and contract signatures are `warning`, ordinary
creation is `info`.

**Three tiles:** total events · events in the last 24 h · `critical` events in
the last 24 h. **Filters:** four-way severity segmented control plus free-text
search across `actor`, `action`, `target` and the *resolved module label*
(`moduleLabel()` maps the `ModuleKey` back to its French sidebar name via `NAV`,
so searching "Stock" finds inventory events).

**Export.** CSV to `fatorati-journal-audit.csv` with columns Horodatage, Acteur,
Action, Cible, Module, Sévérité — exporting the **filtered** set, not
everything.

⚠️ **GAP — the subtitle overstates this.** The header reads
*"Traçabilité **immuable** des événements système"*. The log is a
`localStorage` array: the browser owner can read, edit or delete it, and the
500-entry cap means it is not a complete history. `SECURITY.md` says so
directly: *"Audit log is editable by browser user — not immutable compliance."*
The separate **CMS** audit log (§7.4) is a different, stronger mechanism with
encrypted export and anomaly detection.

---

### 3.13 Paramètres — `/settings`
**File:** `src/modules/Settings.tsx` (181 lines)

**Record** (`Settings`): `company`, `ice`, `taxId`, `rc`, `address`, `city`,
`currency`, `taxRate`, `logo`, `headerNote`, `footerNote`.

**Four cards:**

1. **Local data & backups.** Explains that business data is stored per-account in
   this browser and urges a regular export. **Exporter mes données locales**
   calls `exportCurrentBackup()`. If `hasLegacyData()` finds pre-partitioning
   data on the device, a second button appears — **Exporter la sauvegarde
   ancienne** — with the note that legacy data is *not* auto-assigned to an
   account "pour éviter de partager les données d'un autre utilisateur".
2. **Identité de l'entreprise.** Logo upload plus Raison sociale, ICE,
   Identifiant fiscal, Registre de commerce, Ville, Adresse.
3. **Fiscalité & devise.** Currency select (**MAD / EUR / USD**) and TVA rate.
   ⚠️ The rate is validated and stored but **never used in a calculation** —
   see §3.10.
4. **En-tête & pied de document.** Two free-text areas for document header and
   footer notes.

**Logo pipeline** (`src/lib/logoValidation.ts`) — validated twice, before and
after reading:

| Check | Limit |
|---|---|
| MIME type | `image/png`, `image/jpeg`, `image/webp`, `image/gif` only |
| File size | > 0 and ≤ **512 KB** (`MAX_LOGO_BYTES`) |
| Data-URL length | ≤ `4 × ceil(512 KB / 3) + 64` characters |
| Data-URL shape | must match `data:<mime>;base64,<body>`, body length ≡ 0 mod 4 |
| **Decoded size** | base64 is decoded and the real byte count re-checked against 512 KB |
| **Magic bytes** | the decoded content must match the *claimed* image format |

The magic-byte check is what stops a polyglot file being stored as an image.
Reading uses `FileReader.readAsDataURL`, with a `readerRef` guard so a stale
read cannot overwrite a newer one, `abort()` on unmount, and `onerror`/`onabort`
handlers that report *"Lecture du logo impossible."* The file input's value is
cleared on every change so the same file can be retried after an error.

**Save behaviour.** Validation runs on submit, not per keystroke; the TVA field
keeps its raw string in separate state so `"20,"` is not mangled while typing.
After a successful save, the form re-syncs from the store and shows a 2-second
"Enregistré" confirmation. **It then checks whether the write actually
persisted**:

```ts
if (useLocalSaveStatus.getState().issue?.key === useMizan.persist.getOptions().name) {
  setSaveError("La sauvegarde locale a échoué. Exportez vos données avant de quitter cet onglet.")
}
```

This is the app's most important defensive detail — it refuses to claim success
when `localStorage` rejected the write.

⚠️ Document notes are **not** sanitised or truncated on purpose. The store
comment explains: *"Preserve document text/newlines; React escapes display text.
Numeric/logo validation is not a reason to silently truncate or rewrite existing
notes."*

---

## 4. The storage engine — how saving actually works

**File:** `src/store/useMizan.ts` (296 lines) — a Zustand store with the
`persist` middleware.

### 4.1 Per-account partitioning

```ts
const SIGNED_OUT_STORAGE = "mizan.store.v2.signed-out"
export const accountStorageKey = (userId: string) => `mizan.store.v2.${encodeURIComponent(userId)}`
```

Each Supabase user gets their **own `localStorage` key**. On `signIn`, if the
incoming `userId` differs from the current one, the store:
1. repoints `persist` at the signed-out key,
2. **resets state to `emptyBusinessData()`** — so a new account can never
   inherit another account's or the demo's records,
3. repoints at `accountStorageKey(userId)`,
4. calls `rehydrate()` to load *that* account's data.

On `signOut` it logs the event, repoints to the signed-out key and clears
memory — **the account's saved records stay on disk** but are no longer written
to. The source comment: *"Keep the account's saved records, but remove them from
memory and stop writing into that account's storage after logout."*

`skipHydration: true` means nothing is read from disk until an explicit
`rehydrate()`, which is what makes the swap above safe.

### 4.2 What is persisted

`partialize: businessSnapshot` selects exactly nine collections —
`settings, projects, contacts, expenses, stock, contracts, team, tools, audit`.
**`auth` is never persisted.**

### 4.3 Tamper-resistant rehydration

The custom `merge` function rebuilds state from `defaults` and only accepts each
collection **if it is actually an array**:

```ts
projects: Array.isArray(saved?.projects) ? saved.projects : defaults.projects,
```

and it always forces `auth: null`. The comment: *"Never hydrate auth or action
functions, even from tampered storage."* Hand-editing `localStorage` to inject
`{"auth": {...}}` or to replace an array with an object therefore has no effect.

### 4.4 Input sanitisation

`sanitize()` runs on **every user-supplied string** entering the store — names,
titles, notes, emails, phone numbers, ICE, SKUs, cities, units:

```ts
export function sanitize(input: string): string {
  let out = ""
  for (const ch of String(input).replace(/[<>]/g, "")) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) out += ch
  }
  return out.trim().slice(0, 400)
}
```

It strips `<` and `>`, drops all control characters (C0 range and DEL), trims,
and caps at **400 characters**. This is defence-in-depth on top of React's own
escaping.

### 4.5 Write-time validation

Every mutating action validates **before** touching state and **throws** with a
French, field-named message on failure — which the UI catches and shows inline:

| Helper | Rule | Used for |
|---|---|---|
| `requireAmount(v, label, max?)` | finite, ≥ 0, ≤ `MAX_AMOUNT` | budget, paid, cost, amount, value, cost/month |
| `requireBalance(v)` | finite, abs ≤ `MAX_AMOUNT` (**negatives allowed**) | contact balance, stock delta |
| `isTaxRate(v)` | finite, 0–100 | TVA rate, project `progress` (plus integer check) |
| `validDateRange(start, expiry)` | both parse, and `start ≤ expiry` | subscriptions |
| `validateLogoDataURL` / `validateLogoFile` | see §3.13 | logo |

The maxima mirror the planned SQL column types — the source comment says
*"Match the practical ranges of the planned `numeric(14,2)`/`numeric(14,3)` SQL
columns."*

### 4.6 Failed-write detection

**File:** `src/lib/localSaveStatus.ts` — a custom `StateStorage` wrapper.

`businessStorage.setItem` catches quota and privacy-mode failures and records
`{ key, kind: "quota" | "unavailable" }` in a small Zustand store. `getItem`
**parses the value before returning it** so corrupt JSON is detected rather than
passed on, and adds the key to an `unreadableKeys` set — after which `setItem`
**refuses to write to that key at all**, so a failed hydration can never
overwrite unreadable original data with seed defaults.

`LocalSaveNotice` subscribes to this and, when the affected key is the signed-in
account's, renders a persistent amber alert and registers a `beforeunload`
handler to warn on tab close. Its rule: *"never claim a failed write succeeded."*

---

## 5. Exports & imports — how files are produced safely

**File:** `src/lib/mizan.ts`

| Function | Output | Mechanism |
|---|---|---|
| `toCSV(rows, filename)` | `.csv` | BOM (`\uFEFF`) prefix for Excel, RFC-style quoting (fields containing `"`, `,`, CR or LF are quoted, inner quotes doubled) |
| `toExcel(rows, filename)` | `.xls` | An HTML `<table>` served as `application/vnd.ms-excel`, every cell passed through `escapeHtml()` |
| `toJSON(data, filename)` | `.json` | `JSON.stringify(data, null, 2)` — used for backups |
| `parseCSV(text)` | `string[][]` | Quote-aware parser used by the Contacts import |
| `runAsync(work, ms = 650)` | `Promise<T>` | Defers work behind a minimum delay so the spinner is visible and the click is not swallowed |

**Formula-injection neutralisation** — `spreadsheetText()` guards both CSV and
XLS:

```ts
return typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text
```

A string cell beginning with `=`, `+`, `-` or `@` (after any whitespace or
control characters) is prefixed with an apostrophe so Excel/LibreOffice treat it
as text instead of executing it. The comment: *"Spreadsheet applications execute
formula-looking strings, even in quoted CSV."* Real numbers — including negative
balances — are left numeric, so the guard cannot corrupt data.

**Download mechanics.** `triggerDownload()` builds a Blob, creates an object URL,
clicks a detached `<a download>`, then revokes the URL inside
`setTimeout(..., 0)` — the comment notes Firefox can cancel the download if the
URL is revoked synchronously.

**Every export path is wrapped in try/catch** and surfaces a specific French
error into a `role="alert"` paragraph, rather than failing silently.

**There is no import path for anything except Contacts CSV.** No JSON restore
workflow exists — `SECURITY.md` lists this as a known gap, and the Settings card
says *"L'export ne remplace pas une procédure de restauration."*

---

## 6. Cross-cutting tools

### 6.1 Authentication — `/login`, `/signup`, `/forgot-password`, `/reset-password`
**Files:** `src/components/Auth.tsx` (421 lines), `src/hooks/useSupabaseAuth.ts`

Each screen has its **own URL**, so it can be linked, bookmarked and reached with
the back button — a deliberate design decision recorded in `src/lib/routes.ts`.

| Action | Supabase call |
|---|---|
| Login | `supabase.auth.signInWithPassword({ email, password })` |
| Sign-up | `supabase.auth.signUp({ ... })` — creates a workspace, **not** an admin |
| Forgot | `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })` |
| Reset | signs out locally (`scope: "local"`) then applies the new password |

`friendlyError()` translates Supabase error strings into French user-facing
messages. `validateNewPassword()` checks the password and its confirmation
before the network call. `PasswordInput` is a reveal-toggle field; `Notice`
carries `role="alert"`/`role="status"` semantics for screen readers.

☁️ **Supabase is authoritative for identity.** `useSupabaseAuth()` hydrates the
session, resolves the profile (role, `is_admin`), calls the store's `signIn()`
with the real Supabase `userId` — which is what selects the `localStorage`
partition — and tears everything down on logout with a `request` counter to
discard stale async results.

**Configuration diagnostics.** When Supabase is not configured, the login screen
names the *exact* cause rather than a generic message: a missing variable,
swapped URL/key values, a dashboard link pasted instead of the API URL, or a
`service_role` / `sb_secret_` key — which is **refused rather than used**.
That logic lives in `src/lib/supabaseConfig.ts` with tests in
`tests/supabaseConfig.test.ts`.

🖥️ **Dev-only local mode.** On `pnpm dev` only, the login screen offers
*"Continuer en mode local (développement)"*. `src/lib/localDevMode.ts` gates
every entry point on `import.meta.env.DEV`, which Vite replaces with `false` in
every production build, so `signInLocally()` refuses and the UI is tree-shaken
out of the bundle. `tests/localDevMode.test.tsx` pins this. The Topbar shows a
permanent **"Mode local (dev)"** badge when it is active, so it can never be
mistaken for a real account.

**Idle logout.** `useIdleLogout(active, timeoutMs, onIdle)` listens for
`mousedown`, `mousemove`, `keydown`, `scroll`, `touchstart`, `wheel`, resets a
deadline on activity, and re-arms correctly when a background tab resumes
(it recomputes from the remaining time rather than trusting a throttled timer).

**Onboarding.** `useOnboarding(userId)` shows a first-run questionnaire —
referral source (Google, social, word of mouth, online ad, blog article, other)
and business profile (PME, indépendant, profession libérale, artisan,
particulier) plus a notifications opt-in — and writes an
`onboarding_responses` row. Its doc comment: *"A response row, not account
creation, marks completion. Always scoped to the current user."*

### 6.2 Plan gating — FREE / PRO / BOOST
**Files:** `src/lib/plans.ts` (the matrix), `src/lib/planCodes.ts` (activation
codes), `src/store/usePlan.ts` (per-account store), `src/components/PlanLock.tsx`
(lock screen), `src/components/PlanStatus.tsx` (dashboard strip + Paramètres
card), `scripts/plan-code.mjs` (the owner's code generator).

Three account types, defined as **module lists** — the rail, the router and the
top bar all ask "can this account open X?", so the matrix names modules rather
than abstract features:

| Module | FREE | PRO | BOOST |
|---|:-:|:-:|:-:|
| Tableau de bord, Projets, Clients, Achats & Dépenses, Factures*, Rapports (lecture), Paramètres | ✅ | ✅ | ✅ |
| Stock, Calendrier, Équipe, Journal d'audit | — | ✅ | ✅ |
| Risques, Coffre juridique, Abonnements & Outils (« Plus d'outils ») | — | — | ✅ |

*Factures has no route yet (`INVOICE_ROUTE_ENABLED` is off); the entitlement is
already in FREE so the module is covered the day it ships. Prices: PRO 199 MAD/mo
(1 990/yr), BOOST 499 MAD/mo (4 990/yr), in `PLANS` — the one place prices live.

**How it presents.** The plan is a second filter after the role's permissions.
A locked module stays visible in the rail with a 🔒 and a tooltip naming the plan
(`Aucun` = FREE row untouched), and clicking it keeps its URL: the shell renders
`PlanLock` instead of the module, with one card per plan generated **from the
same table** that unlocks the rail (so a card cannot advertise a module the app
would refuse). The top bar's quick actions carry the same lock mark. The
dashboard shows a plan strip (plan, end date, days left); Paramètres has the
"Plan & activation" card.

**How a code is sold and redeemed.** There is no payment gateway: the client
messages WhatsApp (`212772966980`, pre-filled with plan + prices), pays by
transfer (RIB), and receives a code like `PRO-1M-XXXXXXXX` minted offline with
`node scripts/plan-code.mjs pro 1m`. The client types it into Paramètres; the
window runs **from the redemption day** for a calendar month or year (month-end
clamped: 31 Jan + 1M → 28 Feb). Redeeming the same plan again **extends** the
running window from its own end; a different plan starts fresh today. An
expired activation is kept so the dashboard can say "votre PRO a pris fin le …".
Redemptions and refused attempts are written to the audit log. The activation
record is stored per account (`mizan.plan.v1.<userId>`), exactly like the
business data: another account on the same browser starts on FREE.

⚠️ **Caveats.** (1) The code check is an HMAC whose key ships in the bundle —
it stops typos, sharing and guessing, not a determined user who reads the
bundle. Real entitlement is the ☁️ `account_subscriptions` / `plan_catalog`
tables in the migrations; this is the merchandising layer in front of them.
(2) Older code (`lib/planLimits.ts`, `components/PlanGate.tsx`, the
`user_plan` localStorage key and its "Pro Max" copy) was removed; the admin
monitor's audit card is now an ungated capability note, because operator
tooling was never the customer's plan to gate.

### 6.2.1 Codes per client, freeze and stop (CMS) — built

The CMS page **الرموز والأسعار** (`/admin/subscription-editor`) is the subscription
console:

- **Code builder.** Each paying client gets a unique per-client code —
  `PRO-1M-K7Q2-BF6VSEZJ` — where `K7Q2` is a random 4-character serial and the last
  segment is an HMAC checksum over the *serial-bound* payload
  (`fatorati:plan:v2:…`, `src/lib/planCodes.ts`). The builder records the client's
  name, company, phone, how they found Fatorati (WhatsApp, Instagram, Facebook,
  Google, referral, other) and a note, then offers copy + one-tap WhatsApp send.
  Generic codes (`PRO-1M-BF6VSEZJ`, `scripts/plan-code.mjs`) keep working for the
  owner; only serial codes are tracked per client.
- **Registry.** Every issued code with its real start and end — written back by the
  app itself when the code is redeemed (`markRedeemed`), so the dates are facts,
  not estimates — the days left, and the status (pending, active, frozen, stopped,
  expired). Persisted locally as `fatorati.subscriptions.v1`.
- **Freeze (تجميد).** Pauses the client's clock: on resume the end date shifts by
  the whole frozen stretch, so the client keeps exactly the days they paid for.
  While frozen, remaining days are read as of the freeze day.
- **Stop (إيقاف).** Terminal: the plan falls back to FREE immediately, named as
  stopped in the app. Reactivating in the CMS turns the record back into an
  unsent code the same serial can redeem again.
- The app folds the record for the activation's serial into `planStatus`, so a
  freeze or stop made in the CMS applies in the signed-in app in the same browser,
  in the same tick — the honest local-first boundary until the records map onto
  Supabase `account_subscriptions` and enforcement becomes server-side.

### 6.2.2 Prices and plan paragraphs are CMS-editable — built

Prices (MAD monthly/yearly per paid plan) and the selling paragraphs (tagline +
value sentence, per plan per language) live in an editable catalog
(`fatorati.plan-catalog.v1`, `src/lib/planCatalog.ts`) layered over the shipped
defaults in `lib/plans.ts`. The CMS edits them and every in-app surface reads the
effective values — the black plan cards on the lock page, the dashboard strip,
Paramètres, and the pre-filled WhatsApp buy message — so one edit re-prices and
re-words the whole app. Reset returns to the shipped defaults. The plan cards
also carry a Mensuel/Annuel toggle, a computed yearly saving ("Économisez 398 MAD
par an ≈ 2 mois offerts" for PRO), badges (PRO "Le plus choisi", BOOST "Meilleure
valeur"), staggered entrance animation, and three promises the product actually
keeps (activation immédiate, virement sans carte, support WhatsApp FR/AR).

### 6.3 Formatting utilities — `src/lib/mizan.ts`

| Function | Behaviour |
|---|---|
| `money(n, currency, compact)` | `Intl.NumberFormat`, **0 decimals**, appends the currency code. `fr-MA` / `fr-FR` / `en-US` by currency |
| `dashboardMoney(n, currency, compact)` | Same locales but **2 decimals** — used for all dashboard and report figures |
| `num(n)` | `fr-MA` grouping, no currency |
| `fmtDate(iso)` | `dd MMM yyyy` in `fr-MA`, returns `—` for invalid input |
| `fmtDateTime(ts)` | `dd MMM yyyy, HH:mm` |
| `timeAgo(ts)` | "à l'instant" / "il y a N min" / "il y a N h" / days |
| `roleLabels`, `roleTints` | French role names and their badge colours |

The two-decimal `dashboardMoney` exists because, per its comment, the legacy
formatter *"rounds to whole units and must not disguise newly entered dashboard
values."*

### 6.4 Date utilities — `src/lib/calendarDates.ts`
`calendarDay()` (accepts `YYYY-MM-DD` and `DD/MM/DD/YYYY`, validates the real
calendar via a `Date.UTC` round-trip, returns a UTC day number or `null`) ·
`todayISO()` · `dateFromDay()` · `addCalendarDays()` · `daysUntil()` ·
`validDateRange()`.

### 6.5 Live clock — `src/hooks/useToday.ts`
Returns today's ISO date and **refreshes itself at local midnight** (a
self-rescheduling `setTimeout` to the next midnight + 20 ms) and on
`visibilitychange`, so a tab left open overnight shows correct "expires in N
days" badges without a reload. Cleans up both the timer and the listener.

### 6.6 Security toolkit — `src/lib/security/`

| File | Exports | Purpose |
|---|---|---|
| `inputGuard.ts` | `sanitizeInput`, `escapeHtml`, `isSafeEmail`, `isSafeText`, `toSafeNumber`, `sanitizeDeepValue` | Allowlist + injection-signature blocking, applied recursively to objects |
| `xssShield.ts` | `safeText`, `safeHtml`, `safeUrl`, `safeAttr` | Output-side escaping and URL scheme validation |
| `csrf.ts` | `generateCsrfToken`, `storeCsrf`, `getCsrf`, `verifyCsrf` | Crypto-random tokens bound to the session |
| `rateLimiter.ts` | `class RateLimiter` | Per-action limits in memory + `sessionStorage` |
| `encryption.ts` | `deriveKey`, `encryptString`, `decryptString`, `cryptoAvailable` | Web Crypto **AES-GCM with a PBKDF2 password-derived key** — no hardcoded secrets |
| `cmsMonitor.ts` | `logEvent`, `getAuditLog`, `exportEncryptedAudit`, `clearAudit`, `detectAnomaly` | CMS audit trail, encrypted export, anomaly detection |

The CMS side (`src/admin/lib/security.ts`) adds `sanitizeContent` /
`sanitizeTitle` with control-character stripping and angle-bracket removal.

Transport hardening (CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`) is
configured in the deploy headers — see [SECURITY.md](../SECURITY.md).

### 6.7 Analytics & consent
`src/lib/siteAnalytics.ts` (`recordSiteEvent`, `useSiteVisitTracking`) writes to
the ☁️ `site_analytics_events` and `site_page_views` tables.
`src/lib/cookieConsent.ts` (`readCookieConsent`, `writeCookieConsent`,
`useMarketingAnalytics`) gates any marketing measurement behind explicit
consent, stored under `COOKIE_CONSENT_KEY` and broadcast via
`COOKIE_CONSENT_EVENT`. `src/lib/site.ts` holds `SITE_URL` and
`GOOGLE_ANALYTICS_ID`.

---

### 6.8 Appearance — dark mode

**Paramètres → Apparence**: Clair / Sombre / Système (`src/lib/theme.ts`). A
device preference (persisted as `fatorati.theme.v1`, like the language, not
per-account business data), applied at once with no save step. The dashboard is
painted with semantic colour tokens (`bg-surface`, `text-ink`, `border-line`,
the sidebar set), so dark mode is a single redefinition of those tokens under a
`.dark` class (`src/index.css`) that `App` hangs on `<html>` while a signed-in
screen is showing — plus `color-scheme: dark` so scrollbars and form controls
agree. The marketing pages, auth screens and the CMS keep their designed light
identity; the plan cards are black in both appearances (`--color-night` never
flips). "Système" follows the OS live, including a sunset switch mid-session.

## 7. Admin CMS — 18 routes, 2 roles

**Router:** `src/admin/AdminApp.tsx` (react-router). **Auth:**
`src/admin/lib/adminAuth.ts`.

### 7.1 The two roles are separate

`useAdminAuth()` queries **two different sources** and derives:

```ts
const isContentAdmin  = profileResult.data?.is_admin === true       // public.profiles
const isPlatformAdmin = platformResult.data?.user_id === auth.user.id // public.platform_admins
```

Status is `checking` → `unauthenticated` | `forbidden` | `authenticated`.
A user with neither role is **forbidden**, not merely limited. The comment:
*"CMS editors and platform operators are separate roles."*

`AdminIndex` (the bare `/admin` route) is a pure redirect:

| You are | Sent to |
|---|---|
| Platform **and** content admin | `/admin/dashboard` |
| Platform admin only | `/admin/subscriptions` |
| Content admin only | `/admin/blogs` |

`ProtectedRoute` wraps everything, then `PlatformAdminRoute` and
`ContentAdminRoute` narrow by role. The router's own doc comment is explicit
that this is UX only: *"Database RLS and protected RPCs remain authoritative;
this route tree is UX only."* Unknown paths redirect to `/admin` (authenticated)
or `/admin/login`.

### 7.2 Platform-admin routes (9)

| Route | File | What it manages |
|---|---|---|
| `/admin/dashboard` | `platform/DashboardView.tsx` | Operator overview |
| `/admin/subscriptions` | `platform/SubscriptionsView.tsx` | Account subscriptions (`account_subscriptions`, `plan_catalog`, `usage_monthly`, `purchase_requests`) |
| `/admin/subscription-editor` | `subscriptions/SubscriptionEditor.tsx` | Edit plan records, export JSON |
| `/admin/traffic` | `platform/AnalyticsView.tsx` | `site_page_views`, `site_analytics_events` |
| `/admin/security` | `security/CmsSecurityControl.tsx` | Audit log, encrypted export, CSRF refresh, anomaly detection, password change, rate limits |
| `/admin/notifications` | `platform/NotificationsView.tsx` | `system_notifications` |
| `/admin/algorithms` | `platform/AlgorithmsView.tsx` | Tunable platform logic |
| `/admin/support` | `site/SupportRequestsView.tsx` | `cms_support_requests` from the public contact form |
| `/admin/backups` | `site/BackupsView.tsx` | `cms_backups` |

### 7.3 Content-admin routes (8)

| Route | File | What it manages |
|---|---|---|
| `/admin/website` | `site/WebsiteView.tsx` | Homepage, features, announcements, releases, downloads, products, assets, SEO (`cms_*` tables) |
| `/admin/site/pages` | `site/PagesPanel.tsx` | `cms_pages` |
| `/admin/monitor` | `monitor/MonitorPanel.tsx` | Site monitoring |
| `/admin/content-improvement` | `content/ContentImprovement.tsx` | AI-assisted content suggestions |
| `/admin/contact-inbox` | `contact/ContactInbox.tsx` | Inbox: search, draft replies, message log |
| `/admin/blogs` | `blogs/BlogListView.tsx` | `posts` + `post_translations` |
| `/admin/blogs/new` | `blogs/editor.tsx` | New post, with `ViralChecklist` scoring 0–100 and `BlogImageFields` (URL / alt / source) |
| `/admin/blogs/:id` | `blogs/editor.tsx` | Edit an existing post |

Blog posts are **multi-locale**: `BlogTranslation` carries per-locale title,
slug, content, excerpt and SEO keywords, so one post publishes at `/blog/slug`,
`/ar/blog/slug` and `/en/blog/slug` (`localizedBlogArticlePath()` enforces ASCII
slugs matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`).

`DashboardInfographic.tsx` provides the stats-and-export view referenced in
`llms.txt` as `/admin/dashboard-info`.

### 7.4 Why the CMS audit log is stronger than the app's

`cmsMonitor.ts` keeps up to **500 events**, offers `exportEncryptedAudit()` —
AES-GCM with a **password-derived** key, so the export cannot be read without
the operator's passphrase — and `detectAnomaly()` flags bursts (5+ events in
60 s). Combined with `rateLimiter.ts` and `csrf.ts`, this is a genuine control
surface. It protects **CMS content**, not the business records in §3, which
remain in the browser.

---

## 8. Public marketing site

**File:** `src/marketing/Landing.tsx` (≈144 KB) · **Styles:**
`src/marketing/landing.css` scoped under `.landing-atlas` · **Routes contract:**
`src/lib/routes.ts` · **Locales:** `src/lib/locales.ts`

### 8.1 Twelve pages, three languages, real HTML

`LANDING_PAGES` = home, features, assistant, about, benefits, pricing, blog,
faq, contact, privacy, terms, cookies.

The default locale (**French**) keeps unprefixed URLs; `ar` and `en` add a
prefix. A prefix is only honoured in front of a *real* public page, so
`/ar/login` is a 404 rather than a second URL for the French, `noindex` login
screen. `localeEntries()` produces **12 pages × 3 locales = 36 documents**, plus
blog articles on top.

`pnpm build` runs three steps: the client build, an **SSR build** of
`src/entry-server.tsx`, then `scripts/prerender.mjs`, which writes one real HTML
document per public route per language — injected content **and** its own
`<head>`, including `<html lang dir>` — plus `sitemap.xml` (with `xhtml:link`
alternates), `llms.txt`, `_redirects`, and `noindex` documents for private
routes. The client then hydrates over the prerendered HTML.

**No URL in this application contains a `#` fragment.** The header and footer
links are pages, not anchors. `normalizePath()` enforces lowercase, no trailing
slash, and strips query/fragment at runtime; the prerenderer writes
`/<path>/index.html` so the host serves the same document for `/features` and
`/features/`.

### 8.2 Sections on the homepage

`Hero` · `AnnouncementStrip` · `Features` · `Assistant` · `DashboardPreview` ·
`AboutSection` · `BenefitsSection` · `PricingSection` · `BlogSection` ·
`OneTimeProductsSection` · `DownloadReleaseSection` · `FaqSection` ·
`ContactSection` · `LegalSection` · `Footer`, plus `Header`, `LangSwitcher`,
`ThemeToggle` and `CookieBanner`.

`ManagedPage` renders CMS-driven pages, and `CmsFeatureCard` lets the
`/features` grid be populated from `cms_features` — when managed features exist
the grid switches from three hardcoded cards to a responsive 2/3-column layout.

### 8.3 Interactive landing widgets
`CalendarWidget`, `RiskWidget`, `SubscriptionWidget` and `TrendChart` are
**live, clickable demos** of the three headline features, driven by the `cal`,
`f2` and `f3` copy blocks. `DashboardPreview` shows a mock app shell with an
explicit caption: *"Aperçu de démonstration — les montants (1 720 MAD, +12 %)
sont fictifs."* — the landing page is honest that its numbers are invented, even
though §3.6 and §3.7 are not.

### 8.4 Fatorati Assistant — `/assistant`
A marketing panel, **not** a chatbot. It lists three suggested artefacts —
*Contrat de prestation — art. 723 DOC*, *Clause de confidentialité (Loi 09-08)*,
*Facture conforme ICE + TVA 20 %* — under the badge "Fatorati Assistant" with
the footer *"Vérifié selon le DOC & la Loi 09-08"*. Every item is a button
calling `onEnter()`, which navigates to `/login`. There is no model call and no
generated document.

⚠️ The third item promises a compliant invoice and §3.10 confirms no invoice or
TVA computation exists anywhere in the product.

### 8.5 Support request form
`SupportRequestForm` is fully trilingual and posts to `cms_support_requests`
with categories **contact / bug / feedback / feature_request**, a subject, a
message of ≥ 10 characters, and busy/success/error states.

### 8.6 SEO & machine-readability
`src/lib/seo.ts` holds `PAGE_SEO` and `PAGE_COPY` per page per locale and
exports `renderHeadTags()` / `renderNoIndexHeadTags()`. Each page gets its own
title, description, canonical, `hreflang` alternates, OpenGraph block and
**JSON-LD** (`buildJsonLd()` emits Organization, FAQPage, Article or WebPage
depending on the route). Contact details come from a single source,
`src/lib/contact.ts`, so the Organization node cannot drift from the footer.

Machine files at the repo root, all generated or maintained from the same route
contract: `robots.txt`, `sitemap.xml`, `ai-sitemap.xml`, `llms.txt`,
`llms-full.txt`, `ai.txt`, `.well-known/ai-plugin.json`,
`.well-known/openapi.json`.

### 8.7 Accessibility & motion
`useLandingMotion.ts` drives one-time section reveals with
`prefers-reduced-motion` support and proper cleanup. Desktop features flyouts
and the mobile navigation are keyboard-operable. The landing uses a self-hosted
**Inter** variable font under OFL 1.1 (plus Sora, JetBrains Mono and Tajawal for
Arabic from `package.json`), not a proprietary face.

---

## 9. Server-side schema

From `supabase/migrations/*.sql` — **25 tables created across 5 migrations**,
plus `profiles`:

| Group | Tables |
|---|---|
| Identity & entitlements | `platform_admins`, `account_subscriptions`, `plan_catalog`, `usage_monthly`, `purchase_requests`, `onboarding_responses` |
| CMS content | `posts`, `post_translations`, `cms_pages`, `cms_features`, `cms_homepage_content`, `cms_announcements`, `cms_releases`, `cms_downloads`, `cms_products`, `cms_assets`, `cms_seo_settings`, `cms_content_revisions`, `cms_backups`, `cms_support_requests` |
| Operations | `admin_audit_events`, `system_notifications`, `platform_settings`, `site_analytics_events`, `site_page_views` |

Migrations: `2026_add_cms_posts` · `2026_add_onboarding_responses` ·
`20261012_harden_profile_permissions` (**required** — closes an old self-admin
escalation) · `20261013_cms_control_center` · `20261014_cms_site_operations`.

`public.profiles` is **not** created by any migration — Supabase Auth's
`handle_new_user()` trigger creates it on sign-up, and the hardening migration
only `alter`s it. That migration's comment records the reason: *"self-update of
`profiles.is_admin` would bypass every CMS posts policy"*, so the column is now
written by the database rather than by the user.

⚠️ **There is no table for any business record.** No `projects`, `contacts`,
`expenses`, `stock`, `contracts`, `tools` or `audit` table exists. The
`numeric(14,2)` / `numeric(14,3)` ranges the client validators mirror are
*planned*, not created. This is the gap between the prototype and a product.

---

## 10. Build, deploy, verification

```sh
corepack enable && corepack prepare pnpm@10.34.3 --activate
pnpm install --frozen-lockfile
cp .env.example .env        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
pnpm dev                    # 0.0.0.0:5173, accepts Arena .e2b.app preview hosts
```

| Command | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest + React Testing Library / jsdom + **PGlite** embedded Postgres. **No real Supabase credentials needed** — SQL tests stub Supabase's `auth` schema and roles |
| `pnpm build` | client build → SSR build → `scripts/prerender.mjs` |
| `pnpm audit` | dependency advisories |
| `pnpm ci` | frozen install → typecheck → test → build |
| `pnpm deploy` | build + `wrangler pages deploy dist --project-name=fatooralaw` |

Node `^22.22.2 || ^24.15.0 || >=26.0.0`, pnpm `>=10`. Production uses
`minify: "terser"` and `sourcemap: false`.

**36 test files** cover the store, routing, i18n, GEO/hreflang symmetry,
dashboard and legal data provenance, validation, permissions, subscriptions,
charts, cookie consent, auth forms, admin auth, idle logout, onboarding,
Supabase config diagnostics, local-dev-mode gating, prerendering and the
landing styles.

**Build-time configuration guard.** `VITE_*` values are inlined at build time,
which is the most common cause of "works locally, deployed site says Supabase is
not configured". So `pnpm dev` and `pnpm build` **print the verdict**, a
Cloudflare Pages build **fails** instead of shipping an authentication-less
site, and `dist/build-report.json` records what a build was configured with.
Full detail in [ENVIRONMENT.md](ENVIRONMENT.md).

🔒 **Never put a Supabase `service_role` key in a `VITE_*` variable** — it would
be shipped to every browser. `supabaseConfig.ts` detects and refuses such a key.

---

## 11. Known limitations — read before using real data

Verbatim from `SECURITY.md`, cross-checked against the code above:

1. **Not a certified production ERP.** Business records are a `localStorage`
   prototype (§4).
2. **Per-account partitioning prevents accidental reuse — it is not encryption
   and not a device-access boundary.** Anyone with the browser can read the
   JSON. The Settings card says exactly this: *"Ces données ne sont pas
   chiffrées par l'application. Une sauvegarde JSON est une copie sensible."*
3. **Logout clears active memory but keeps saved local records** (§4.1).
4. **The audit log is editable by the browser user — not immutable compliance**
   (§3.12), and is capped at 500 events.
5. **Team invitations send no email; permissions are local, not server-shared**
   (§3.11).
6. **No JSON restore workflow.** Exports omit auth objects but contain sensitive
   business data (§5).
7. **Two tools are static demos.** Calendar and Risk ignore user data entirely
   (§3.6, §3.7).
8. **No invoicing, no TVA computation, no bank integration, no OCR, no document
   storage, no e-signature, no payments** (§3.4, §3.9, §3.10).

**Before handling real client data, `SECURITY.md` requires:** server storage,
server-side validation, a trustworthy audit trail, backups, and payment
webhooks.

### UI copy that overstates behaviour — worth fixing

| Where | Says | Reality |
|---|---|---|
| `AuditLog` subtitle | "Traçabilité **immuable** des événements système" | Editable `localStorage` array, capped at 500 |
| `Sidebar` footer | "Mizan ERP · v1.0 · **chiffré** (loi 09-08)" | Business data is **not** encrypted; Settings says so. Also names the product "Mizan ERP" while everything else says Fatorati |
| `Team` invite modal | "Une invitation **sera envoyée** à cette adresse" | No email is sent |
| `Procurement` receipt toggle | "Reçu / facture joint (**prêt OCR**)" | Boolean flag only; no file, no OCR |
| `/assistant` panel | "Facture conforme ICE + TVA 20 %" | No invoice or TVA feature exists |
| Plan activation codes | HMAC key ships in the bundle (§6.2) | Stops typos/sharing/guessing, not a determined user; real entitlement is `account_subscriptions` |

---

## 12. Summary table — every tool at a glance

| Tool | Real data? | Persists? | Server? | Exports | Key limitation |
|---|:-:|:-:|:-:|---|---|
| Dashboard | ✅ | 🖥️ | — | CSV, XLS, print | No revenue/cash-flow inference |
| Projects | ✅ | 🖥️ | — | — | No tasks, no timesheets, no Kanban |
| Contacts | ✅ | 🖥️ | — | CSV in + out | No pipeline, no interaction log |
| Procurement | ✅ | 🖥️ | — | XLS | No purchase orders, no receipt files |
| Inventory | ✅ | 🖥️ | — | — | No movements, no warehouses |
| **Calendar** | 🎬 **no** | — | — | — | **Hardcoded September 2026** |
| **Risk** | 🎬 **no** | — | — | — | **Hardcoded 7 risks, read-only** |
| Tools | ✅ | 🖥️ | — | — | No prorata, not a payment history |
| Legal Vault | ✅ | 🖥️ | — | print | No contract text, no signature, no email |
| Reports | ✅ | 🖥️ | — | CSV, print | **TVA explicitly not calculated** |
| Team | ✅ | 🖥️ | — | — | No email invite, permissions are client-side |
| Audit | ✅ | 🖥️ | — | CSV | Editable by the user, 500-event cap |
| Settings | ✅ | 🖥️ | — | JSON backup | **No restore path** |
| Auth | ✅ | ☁️ | ✅ | — | Requires Supabase configuration |
| Admin CMS | ✅ | ☁️ | ✅ | JSON, encrypted audit | Two roles, RLS-authoritative |
| Marketing site | ✅ | ☁️ | ✅ | sitemap, llms.txt | CMS-driven, prerendered per locale |

**Bottom line.** Ten of the thirteen signed-in tools are genuinely functional
against real local data, with unusually careful validation, honest labelling and
safe exports. Two — Calendar and Risk — are static mockups that the marketing
site sells as headline features. And the entire business layer sits in the
browser, which is the one change that has to happen before any of it can hold a
real company's books.
