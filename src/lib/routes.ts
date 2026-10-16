import type { ModuleKey } from "../store/types.ts"
import { DEFAULT_LOCALE, LOCALES, localeInfo, type LocaleId } from "./locales.ts"

/**
 * Every URL this application can serve, in one place.
 *
 * Why this module exists: the public pages used to be `#sections` on a single
 * URL (`https://fatorati.tech/#assistant`) and the signed-in area plus the
 * auth screens had **no URL at all** — the login form was local component
 * state, so it could not be linked, bookmarked, shared, indexed or opened in a
 * new tab, and going "back" left the site. This file is now the single source
 * of truth for path ⇄ screen mapping, used by:
 *
 *   - `src/lib/router.ts` (client navigation),
 *   - `src/App.tsx` (which screen to render for the current path),
 *   - `src/marketing/Landing.tsx` (public page links),
 *   - `src/lib/seo.ts` + `scripts/prerender.mjs` (per-route head tags,
 *     prerendering and the generated sitemap).
 *
 * Conventions (keep them, crawlers and the deploy config depend on them):
 *   - Paths are absolute, lowercase, **without** a trailing slash (the root
 *     is exactly `/`). `normalizePath()` enforces this at runtime and
 *     `scripts/prerender.mjs` writes `/<path>/index.html` so the host serves
 *     the same document for `/features` and `/features/`.
 *   - No URL in this application contains a `#` fragment.
 *   - The default locale (French) keeps the unprefixed URLs. Every other
 *     locale adds its prefix: `/ar/pricing`, `/en/pricing`. A prefix is only
 *     honoured in front of a real public page, so `/ar/login` is an unknown
 *     path rather than a second URL for the (French, `noindex`) login screen.
 */

/** Public marketing pages. `home` is the only one served from `/`. */
export const LANDING_PAGES = [
  "home",
  "features",
  "assistant",
  "about",
  "benefits",
  "pricing",
  "blog",
  "faq",
  "contact",
  "privacy",
  "terms",
  "cookies",
  "refund",
  "investors",
  "partners",
  "docs",
] as const

export type LandingPage = (typeof LANDING_PAGES)[number]

/** Marketing pages that are not `home`, i.e. every page with its own path. */
export const LANDING_SECTIONS = LANDING_PAGES.filter((page): page is Exclude<LandingPage, "home"> => page !== "home")

/** Auth screens. Each has its own URL so it can be linked and bookmarked. */
export const AUTH_PATHS = {
  login: "/login",
  signup: "/signup",
  forgot: "/forgot-password",
  reset: "/reset-password",
} as const

export type AuthScreen = keyof typeof AUTH_PATHS

/** Signed-in application modules. */
export const MODULE_PATHS: Record<ModuleKey, string> = {
  dashboard: "/dashboard",
  projects: "/projects",
  invoices: "/invoices",
  contacts: "/contacts",
  procurement: "/procurement",
  inventory: "/inventory",
  delivery: "/delivery",
  verification: "/verification",
  calendar: "/calendar",
  risk: "/risk",
  tools: "/tools",
  legal: "/legal",
  reports: "/reports",
  team: "/team",
  audit: "/audit",
  settings: "/settings",
}

/** Shown for any path that is not a known page (hosts serve it with a 404-ish status via noindex). */
export const NOT_FOUND_PATH = "/404"

/* ---------------------------- blog categories -----------------------------
 * The five editorial sections of the blog. The keys are URL segments
 * (`/blog/tips`), so they stay ASCII, lowercase and stable — the localized
 * labels live in `BLOG_CATEGORY_LABELS` (src/lib/blog.ts) and never appear in
 * a URL. One category page exists per locale, exactly like the other public
 * pages, and `/blog/<category>` must never be mistaken for an article slug,
 * so `BLOG_ARTICLE_PATH` below reserves these five words.
 * ------------------------------------------------------------------------ */

export const BLOG_CATEGORIES = ["tips", "news", "articles", "products", "guides"] as const
export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

/** Accepts a stored/URL value and returns a known category, defaulting to `articles`. */
export function blogCategory(value: unknown): BlogCategory {
  return (BLOG_CATEGORIES as readonly string[]).includes(String(value)) ? (value as BlogCategory) : "articles"
}

/** Default path for a signed-in visitor arriving on `/`, `/login`, … */
export const DEFAULT_APP_PATH = MODULE_PATHS.dashboard

const LANDING_PATH_SET = new Set<string>(LANDING_SECTIONS.map((page) => `/${page}`))

/**
 * `https://fatorati.tech/features/?utm=x#top` → `/features`.
 * Tolerates a full URL, a path with or without query/fragment, repeated
 * slashes and a trailing slash; the root stays `/`.
 */
export function normalizePath(input: string | undefined | null): string {
  if (!input) return "/"
  let path = input
  // Accept a full URL as well as a path.
  const schemeMatch = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/[^?#]*)?/i.exec(path)
  if (schemeMatch) path = schemeMatch[1] ?? "/"
  path = path.split("?")[0].split("#")[0]
  path = path.replace(/\/{2,}/g, "/").toLowerCase()
  if (!path.startsWith("/")) path = `/${path}`
  path = path.replace(/\/+$/, "")
  return path === "" ? "/" : path
}

/** The marketing page served at `pathname`, or null when it is not a public page. */
export function landingPageFromPath(pathname: string | undefined | null): LandingPage | null {
  const path = normalizePath(pathname)
  if (path === "/") return "home"
  return LANDING_PATH_SET.has(path) ? (path.slice(1) as Exclude<LandingPage, "home">) : null
}

/** Canonical path of a marketing page. Never contains a `#`. */
export function landingPath(page: LandingPage): string {
  return page === "home" ? "/" : `/${page}`
}

/* ------------------------------- locales --------------------------------
 * Marketing pages are published once per locale (see `src/lib/locales.ts`);
 * the auth screens and the signed-in app are not — they stay French and
 * `noindex` on a single URL each.
 * ---------------------------------------------------------------------- */

export type LocaleRoute = {
  /** The locale the requested URL belongs to. */
  locale: LocaleId
  /** The marketing path with the locale prefix stripped (`/` for a locale home). */
  path: string
}

/** Every public URL this build publishes, one per locale, in sitemap order. */
export type LocaleEntry = { page: LandingPage; locale: LocaleId; path: string }

/**
 * Split a URL into its locale and its unprefixed marketing path:
 *
 *   `/pricing`     → `{ locale: "fr", path: "/pricing" }`
 *   `/ar/pricing`  → `{ locale: "ar", path: "/pricing" }`
 *   `/en`          → `{ locale: "en", path: "/" }`
 *   `/ar/login`    → `{ locale: "fr", path: "/ar/login" }`  (unknown path → 404)
 */
/**
 * `/blog/<slug>` for an article. The five category words are reserved —
 * `/blog/tips` is the tips section page, never an article slug — so the
 * negative lookahead keeps article URLs and section URLs unambiguous.
 */
const BLOG_CATEGORY_ALTERNATION = BLOG_CATEGORIES.join("|")
const BLOG_ARTICLE_PATH = new RegExp(`^/blog/(?!(?:${BLOG_CATEGORY_ALTERNATION})(?:/|$))([a-z0-9]+(?:-[a-z0-9]+)*)$`)
const BLOG_CATEGORY_PATH = new RegExp(`^/blog/(${BLOG_CATEGORY_ALTERNATION})$`)

export function localeRoute(pathname?: string | null): LocaleRoute {
  const path = normalizePath(pathname)
  for (const locale of LOCALES) {
    if (!locale.prefix) continue
    if (path === locale.prefix) return { locale: locale.id, path: "/" }
    if (path.startsWith(`${locale.prefix}/`)) {
      const rest = path.slice(locale.prefix.length)
      if (landingPageFromPath(rest) !== null || BLOG_ARTICLE_PATH.test(rest) || BLOG_CATEGORY_PATH.test(rest)) return { locale: locale.id, path: rest }
    }
  }
  return { locale: DEFAULT_LOCALE, path }
}

/** A public, localized article URL such as `/ar/blog/slug`. */
export function blogArticleFromPath(pathname?: string | null): { locale: LocaleId; slug: string } | null {
  const { locale, path } = localeRoute(pathname)
  const match = BLOG_ARTICLE_PATH.exec(path)
  return match ? { locale, slug: match[1] } : null
}

/** A public, localized blog section URL such as `/ar/blog/guides`. */
export function blogCategoryFromPath(pathname?: string | null): { locale: LocaleId; category: BlogCategory } | null {
  const { locale, path } = localeRoute(pathname)
  const match = BLOG_CATEGORY_PATH.exec(path)
  return match ? { locale, category: match[1] as BlogCategory } : null
}

/**
 * The same marketing path in another locale: `/pricing` + `ar` → `/ar/pricing`.
 * Paths that are not public pages (auth, app modules, unknown) are returned
 * untouched — those screens exist in one language only.
 */
export function localizedPath(path: string, locale: LocaleId = DEFAULT_LOCALE): string {
  const normalized = normalizePath(path)
  const { prefix } = localeInfo(locale)
  if (!prefix || landingPageFromPath(normalized) === null) return normalized
  return normalized === "/" ? prefix : `${prefix}${normalized}`
}

/** Canonical path of a marketing page in one locale. Never contains a `#`. */
export function localizedLandingPath(page: LandingPage, locale: LocaleId = DEFAULT_LOCALE): string {
  return localizedPath(landingPath(page), locale)
}

/** Canonical URL of a translated blog article. Slugs are intentionally ASCII. */
export function localizedBlogArticlePath(locale: LocaleId, slug: string): string {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return localizedLandingPath("blog", locale)
  const { prefix } = localeInfo(locale)
  const path = `/blog/${normalizedSlug}`
  return prefix ? `${prefix}${path}` : path
}

/** Canonical path of a blog section page in one locale (`/blog/tips`, `/ar/blog/tips`, …). */
export function localizedBlogCategoryPath(locale: LocaleId, category: BlogCategory): string {
  const { prefix } = localeInfo(locale)
  const path = `/blog/${category}`
  return prefix ? `${prefix}${path}` : path
}

/** Every public page × locale, home first, locales in table order. */
export function localeEntries(): LocaleEntry[] {
  const entries: LocaleEntry[] = []
  for (const page of LANDING_PAGES) {
    for (const locale of LOCALES) {
      entries.push({ page, locale: locale.id, path: localizedLandingPath(page, locale.id) })
    }
  }
  return entries
}

/** The auth screen served at `pathname`, or null. */
export function authScreenFromPath(pathname: string | undefined | null): AuthScreen | null {
  const path = normalizePath(pathname)
  const entry = (Object.entries(AUTH_PATHS) as [AuthScreen, string][]).find(([, value]) => value === path)
  return entry ? entry[0] : null
}

/** The signed-in module served at `pathname`, or null. */
export function moduleFromPath(pathname: string | undefined | null): ModuleKey | null {
  const path = normalizePath(pathname)
  const entry = (Object.entries(MODULE_PATHS) as [ModuleKey, string][]).find(([, value]) => value === path)
  return entry ? entry[0] : null
}

export function modulePath(key: ModuleKey): string {
  return MODULE_PATHS[key]
}

/** True when the public layout (header, footer, cookie banner) should render. */
export function isPublicPath(pathname: string | undefined | null): boolean {
  const path = localeRoute(pathname).path
  return landingPageFromPath(path) !== null || BLOG_ARTICLE_PATH.test(path) || BLOG_CATEGORY_PATH.test(path)
}

/** True when `pathname` addresses a screen that must never be indexed. */
export function isPrivatePath(pathname: string | undefined | null): boolean {
  const path = normalizePath(pathname)
  if (authScreenFromPath(path) !== null) return true
  if (moduleFromPath(path) !== null) return true
  return path.startsWith("/admin")
}
