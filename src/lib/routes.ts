import type { ModuleKey } from "../store/types.ts"

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
  contacts: "/contacts",
  procurement: "/procurement",
  inventory: "/inventory",
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
  return landingPageFromPath(pathname) !== null
}

/** True when `pathname` addresses a screen that must never be indexed. */
export function isPrivatePath(pathname: string | undefined | null): boolean {
  const path = normalizePath(pathname)
  if (authScreenFromPath(path) !== null) return true
  if (moduleFromPath(path) !== null) return true
  return path.startsWith("/admin")
}
