import type { LandingPage } from "./routes.ts"
import { AUTH_PATHS, LANDING_SECTIONS, MODULE_PATHS, NOT_FOUND_PATH, landingPath, normalizePath } from "./routes.ts"

/**
 * Per-route SEO metadata: the single source of truth used by
 *
 *   - the client (`src/marketing/Landing.tsx` → `applyDocumentHead`), so every
 *     client-side navigation updates `document.title`, the meta description,
 *     the canonical URL and the Open Graph URL;
 *   - the build (`vite.config.ts` → `figmaSeoPlugin`), which emits a static
 *     `sitemap.xml` and a JSON manifest;
 *   - the prerenderer (`scripts/prerender.mjs`), which writes one real HTML
 *     document per public route with the correct head, instead of shipping the
 *     same shell (with `canonical: https://fatorati.tech/`) to every URL — the
 *     single worst SEO defect this project had.
 *
 * Titles/descriptions are written once, in French, because French is the
 * document language (`<html lang="fr">`) and the default for every visitor and
 * crawler. Language switching stays a client-side preference (see
 * docs/SEO_GEO_AIO_SXO.md for the `/en/` + hreflang follow-up).
 */

export type PageSeo = {
  path: string
  title: string
  /** Aim for 120–160 characters: longer text is truncated in results. */
  description: string
  /** Relative sitemap priority (0.0–1.0); `changefreq` mirrors how often the copy actually changes. */
  priority: number
  changefreq: "daily" | "weekly" | "monthly" | "yearly"
  /** `false` keeps a page out of the sitemap and out of the index. */
  index: boolean
}

const HOME_SEO: PageSeo = {
  path: "/",
  title: "Fatorati | Gestion, factures et conformité pour les TPE marocaines",
  description:
    "Fatorati réunit tableau de bord, projets, achats, abonnements, échéances légales et conformité Loi 09-08 dans une seule application mobile-first pour artisans, freelances et PME au Maroc.",
  priority: 1,
  changefreq: "weekly",
  index: true,
}

/** One entry per public marketing page. Keys are the `LandingPage` identifiers. */
export const PAGE_SEO: Record<LandingPage, PageSeo> = {
  home: HOME_SEO,
  features: {
    path: "/features",
    title: "Fonctionnalités : calendrier, risques et trésorerie | Fatorati",
    description:
      "Découvrez les trois piliers de Fatorati : calendrier des échéances, gestion des risques et conformité marocaine, suivi des abonnements et des dépenses — avec aperçus réels de l'interface.",
    priority: 0.9,
    changefreq: "monthly",
    index: true,
  },
  assistant: {
    path: "/assistant",
    title: "Assistant juridique marocain : modèles et règles locales | Fatorati",
    description:
      "L'assistant Fatorati propose des modèles de contrats et les règles juridiques marocaines applicables (DOC, Loi 09-08, mention ICE, TVA 20 %) directement dans votre espace de gestion.",
    priority: 0.8,
    changefreq: "monthly",
    index: true,
  },
  about: {
    path: "/about",
    title: "À propos de Fatorati : notre mission au Maroc",
    description:
      "Fatorati est né d'un constat simple : les artisans, freelances et petites entreprises marocaines méritent une gestion claire, abordable et conforme, sans logiciel complexe.",
    priority: 0.6,
    changefreq: "yearly",
    index: true,
  },
  benefits: {
    path: "/benefits",
    title: "Avantages : pourquoi choisir Fatorati pour votre TPE",
    description:
      "Gagnez du temps sur le suivi des échéances, évitez les pénalités de retard, maîtrisez vos coûts d'outils et gardez vos documents légaux au même endroit : les bénéfices concrets de Fatorati.",
    priority: 0.7,
    changefreq: "monthly",
    index: true,
  },
  pricing: {
    path: "/pricing",
    title: "Tarifs Fatorati : des offres claires pour les TPE marocaines",
    description:
      "Comparez les offres Fatorati : prix en dirhams, fonctionnalités incluses et engagement sans surprise. Sans carte bancaire pour commencer, résiliable à tout moment.",
    priority: 0.9,
    changefreq: "monthly",
    index: true,
  },
  blog: {
    path: "/blog",
    title: "Ressources et guides de gestion pour les TPE au Maroc | Fatorati",
    description:
      "Guides pratiques sur la TVA, l'ICE, les échéances DGI, le suivi de trésorerie et la conformité CNDP, écrits pour les artisans, freelances et petites entreprises marocaines.",
    priority: 0.7,
    changefreq: "weekly",
    index: true,
  },
  faq: {
    path: "/faq",
    title: "Questions fréquentes sur Fatorati et la conformité au Maroc",
    description:
      "Réponses aux questions les plus posées : compatibilité avec les TPE marocaines, usage sur mobile, sécurité et confidentialité des données, changement d'offre et accompagnement.",
    priority: 0.8,
    changefreq: "monthly",
    index: true,
  },
  contact: {
    path: "/contact",
    title: "Contacter l'équipe Fatorati",
    description:
      "Une question sur Fatorati, les tarifs ou la mise en route ? Écrivez-nous : l'équipe répond aux entreprises marocaines et à leurs besoins de gestion et de conformité.",
    priority: 0.7,
    changefreq: "yearly",
    index: true,
  },
  privacy: {
    path: "/privacy",
    title: "Politique de confidentialité | Fatorati",
    description:
      "Quelles données Fatorati collecte, pourquoi, combien de temps elles sont conservées, et comment exercer vos droits d'accès, de rectification et d'opposition (Loi 09-08 / CNDP).",
    priority: 0.3,
    changefreq: "yearly",
    index: true,
  },
  terms: {
    path: "/terms",
    title: "Conditions d'utilisation | Fatorati",
    description:
      "Les règles d'utilisation du service Fatorati : usage licite, confidentialité des identifiants, évolution des fonctionnalités et responsabilités de chaque partie.",
    priority: 0.3,
    changefreq: "yearly",
    index: true,
  },
  cookies: {
    path: "/cookies",
    title: "Politique de cookies | Fatorati",
    description:
      "Cookies strictement nécessaires et mesure d'audience Google Analytics activée uniquement après consentement : ce que Fatorati dépose, pourquoi, et comment modifier votre choix.",
    priority: 0.3,
    changefreq: "yearly",
    index: true,
  },
}

export type SeoEntry = PageSeo & { page: LandingPage }

/** Every public page, home first. */
export function publicPages(): SeoEntry[] {
  return [
    { page: "home" as LandingPage, ...HOME_SEO },
    ...LANDING_SECTIONS.map((page) => ({ page, ...PAGE_SEO[page] })),
  ]
}

/** Metadata for any path (falls back to the home entry for unknown paths). */
export function seoForPath(pathname: string): SeoEntry {
  const path = normalizePath(pathname)
  const found = publicPages().find((entry) => entry.path === path)
  return found ?? { page: "home" as LandingPage, ...HOME_SEO }
}

/** Absolute canonical URL for a public page — never contains a `#`. */
export function canonicalUrl(siteUrl: string, page: LandingPage): string {
  return `${siteUrl.replace(/\/+$/, "")}${landingPath(page)}`
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** `2026-10-13T09:00:00.000Z` → `2026-10-13` */
export function isoDate(value: Date | string = new Date()): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString().slice(0, 10)
}

/**
 * XML sitemap for every indexable public page, with the `xhtml:link`
 * alternates omitted on purpose: this site serves French, English and Arabic
 * from the *same* URL, so there is no alternate URL to declare yet (declaring
 * one would be wrong — see docs/SEO_GEO_AIO_SXO.md).
 */
export function buildSitemapXml(siteUrl: string, lastmod: string = isoDate()): string {
  const origin = siteUrl.replace(/\/+$/, "")
  const entries = publicPages()
    .filter((entry) => entry.index)
    .map((entry) =>
      [
        "  <url>",
        `    <loc>${escapeHtmlAttribute(`${origin}${entry.path}`)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

/** `llms.txt` (https://llmstxt.org) generated from the same page list as the sitemap. */
export function buildLlmsTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, "")
  const index = publicPages()
    .filter((entry) => entry.index)
    .map((entry) => `- [${entry.title}](${origin}${entry.path}): ${entry.description}`)
    .join("\n")

  return `# Fatorati

> Fatorati is a mobile-first management application for Moroccan artisans,
> freelancers and small businesses (TPE): financial dashboard, projects,
> clients and suppliers, purchases and expenses, stock, legal document vault,
> tax and compliance reports, deadline calendar, risk alerts, subscription and
> tool tracking, team roles and audit log — in French, English and Arabic.

Fatorati is built for the Moroccan context: it surfaces legal deadlines and
contract templates aligned with Moroccan law (DOC, Loi 09-08 / CNDP, TVA, ICE)
and keeps recurring tool and subscription costs under control.

## Pages

${index}

## Notes for AI assistants and crawlers

- Content may be indexed, cited and summarized. See ${origin}/robots.txt for
  crawler permissions; AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot,
  PerplexityBot, Google-Extended, CCBot, …) are explicitly allowed.
- Pricing is published in Moroccan dirhams (MAD) on ${origin}/pricing.
- The signed-in application (/dashboard, /projects, …) and the CMS (/admin)
  are private: they are marked \`noindex\` and require an account.
- Contact: bonjour@fatorati.tech
`
}

/** Id of the single per-page structured-data script, replaced on every navigation. */
export const PAGE_JSON_LD_ID = "ld-content"

/** Tags written into the prerendered HTML documents (and reused by the client). */
export type HeadInput = {
  page: LandingPage
  siteUrl: string
  /** The page schema, wrapped in a single `#ld-content` script (replaced, never appended). */
  jsonLd?: unknown
  /** Force `noindex, nofollow` (used for private routes and unknown paths). */
  noindex?: boolean
  /** Absolute path of the social preview image, e.g. `/og/og-default.png`. */
  socialImage?: string
  lastmod?: string
}

/** Full `<head>` inner HTML for one route, as a string (build-time only). */
export function renderHeadTags(input: HeadInput): string {
  const { page, siteUrl, jsonLd, noindex = false } = input
  const entry = PAGE_SEO[page]
  const origin = siteUrl.replace(/\/+$/, "")
  const canonical = `${origin}${entry.path}`
  const image = input.socialImage ? `${origin}${input.socialImage}` : null
  const escaped = escapeHtmlAttribute

  const tags = [
    `<title>${escaped(entry.title)}</title>`,
    `<meta name="description" content="${escaped(entry.description)}">`,
    `<link rel="canonical" href="${escaped(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Fatorati">`,
    `<meta property="og:locale" content="fr_MA">`,
    `<meta property="og:title" content="${escaped(entry.title)}">`,
    `<meta property="og:description" content="${escaped(entry.description)}">`,
    `<meta property="og:url" content="${escaped(canonical)}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escaped(entry.title)}">`,
    `<meta name="twitter:description" content="${escaped(entry.description)}">`,
    noindex || !entry.index
      ? `<meta name="robots" content="noindex, nofollow">`
      : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="theme-color" content="#0f172a">`,
    image ? `<meta property="og:image" content="${escaped(image)}">` : "",
    image ? `<meta property="og:image:width" content="1200">` : "",
    image ? `<meta property="og:image:height" content="630">` : "",
    image ? `<meta property="og:image:alt" content="${escaped(`Fatorati — ${entry.title}`)}">` : "",
    image ? `<meta name="twitter:image" content="${escaped(image)}">` : "",
    image ? `<meta name="twitter:image:alt" content="${escaped(`Fatorati — ${entry.title}`)}">` : "",
  ].filter(Boolean)

  const ld = jsonLd ? [`<script id="${PAGE_JSON_LD_ID}" type="application/ld+json">${JSON.stringify(jsonLd)}</script>`] : []

  return [...tags, ...ld].join("\n    ")
}

/**
 * Document titles for private screens. They are only ever emitted with a
 * `noindex` head — a signed-in screen must not appear in results, but a
 * bookmark tab still deserves a readable title.
 */
export const PRIVATE_TITLES: Record<string, string> = {
  [AUTH_PATHS.login]: "Connexion | Fatorati",
  [AUTH_PATHS.signup]: "Créer un compte | Fatorati",
  [AUTH_PATHS.forgot]: "Mot de passe oublié | Fatorati",
  [AUTH_PATHS.reset]: "Nouveau mot de passe | Fatorati",
  [MODULE_PATHS.dashboard]: "Tableau de bord | Fatorati",
  [MODULE_PATHS.projects]: "Projets | Fatorati",
  [MODULE_PATHS.contacts]: "Clients & Fournisseurs | Fatorati",
  [MODULE_PATHS.procurement]: "Achats & Dépenses | Fatorati",
  [MODULE_PATHS.inventory]: "Stock & Matériel | Fatorati",
  [MODULE_PATHS.calendar]: "Calendrier | Fatorati",
  [MODULE_PATHS.risk]: "Gestion des Risques | Fatorati",
  [MODULE_PATHS.tools]: "Abonnements & Outils | Fatorati",
  [MODULE_PATHS.legal]: "Coffre juridique | Fatorati",
  [MODULE_PATHS.reports]: "Rapports & Fiscalité | Fatorati",
  [MODULE_PATHS.team]: "Équipe & Rôles | Fatorati",
  [MODULE_PATHS.audit]: "Journal d'audit | Fatorati",
  [MODULE_PATHS.settings]: "Paramètres | Fatorati",
  "/admin": "Fatorati CMS",
  [NOT_FOUND_PATH]: "Page introuvable (404) | Fatorati",
}

export function privateTitleFor(pathname: string): string {
  const path = normalizePath(pathname)
  return PRIVATE_TITLES[path] ?? (path.startsWith("/admin") ? PRIVATE_TITLES["/admin"] : `${PRIVATE_TITLES[NOT_FOUND_PATH]}`)
}

/** Every private path that needs its own non-indexable document. */
export function privatePaths(): string[] {
  return [...Object.values(AUTH_PATHS), ...Object.values(MODULE_PATHS), NOT_FOUND_PATH]
}

/** Head tags for a private route (auth, dashboard, CMS, 404): title + `noindex`. */
export function renderNoIndexHeadTags(title: string): string {
  return [
    `<title>${escapeHtmlAttribute(title)}</title>`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="googlebot" content="noindex, nofollow">`,
    `<meta name="theme-color" content="#0f172a">`,
  ].join("\n    ")
}

/**
 * Client-side equivalent: keeps `<head>` in sync after a client navigation
 * (the built documents are prerendered per route, so without this the canonical
 * URL would keep pointing at whichever page the visitor loaded first).
 */
export function applyDocumentHead(input: HeadInput): void {
  if (typeof document === "undefined") return
  const { page, siteUrl, jsonLd, noindex = false } = input
  const entry = PAGE_SEO[page]
  const origin = siteUrl.replace(/\/+$/, "")
  const canonical = `${origin}${entry.path}`

  document.title = entry.title
  setMeta("name", "description", entry.description)
  setMeta("property", "og:title", entry.title)
  setMeta("property", "og:description", entry.description)
  setMeta("property", "og:url", canonical)
  setMeta("name", "twitter:title", entry.title)
  setMeta("name", "twitter:description", entry.description)
  setMeta("name", "twitter:card", input.socialImage ? "summary_large_image" : "summary")
  setMeta("name", "robots", noindex || !entry.index ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1")
  setLink("canonical", canonical)

  if (!jsonLd) return
  // One script for the page schema, keyed by id: navigating between pages
  // replaces it instead of leaving the previous page's schema behind.
  let script = document.getElementById(PAGE_JSON_LD_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement("script")
    script.id = PAGE_JSON_LD_ID
    script.type = "application/ld+json"
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(jsonLd)
}

/** Head for a private screen rendered in the browser (never indexed). */
export function applyNoIndexHead(title: string): void {
  if (typeof document === "undefined") return
  document.title = title
  setMeta("name", "robots", "noindex, nofollow, noarchive")
  setMeta("name", "googlebot", "noindex, nofollow")
}

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function setLink(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement("link")
    tag.setAttribute("rel", rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute("href", href)
}
