import { useCallback, useSyncExternalStore } from "react"
import { normalizePath } from "./routes"

/**
 * A ~60-line history router.
 *
 * Why not react-router? The CMS already uses it under `/admin/*`, and that
 * subtree keeps using it. The marketing site and the dashboard were written
 * without any router at all — they hold their screen in local state — and are
 * covered by ~200 tests that render `<App/>` and `<Landing/>` **bare**, with
 * no `<Router>` wrapper. A hook-based store keeps those tests valid (it reads
 * `window.location` directly instead of React context), keeps the marketing
 * bundle free of router internals it never uses, and gives us exactly three
 * behaviours: read the current path, push a new one, and react to `popstate`.
 *
 * It is SSR-safe too: `getServerSnapshot` returns the path the prerenderer is
 * currently rendering, and `navigate()` is a no-op without a `window`.
 */

let serverPath = "/"
const listeners = new Set<() => void>()

/** Set by the prerenderer (`src/entry-server.tsx`) before rendering a route. */
export function setServerPath(pathname: string): void {
  serverPath = normalizePath(pathname)
}

/** The path currently displayed, normalized (no trailing slash, no query/hash). */
export function currentPath(): string {
  if (typeof window === "undefined") return serverPath
  return normalizePath(window.location.pathname)
}

/**
 * Always read the live URL. Caching the value here and comparing against it
 * would silently swallow a navigation: when something else moves the history
 * (another router, a redirect, a test calling `replaceState`), the cache no
 * longer describes the current URL, so a later navigation back to the cached
 * path looks like "no change" and nothing re-renders. React already bails out
 * when the value it reads is unchanged, so notifying unconditionally is both
 * correct and cheaper than getting this wrong.
 */
function readSnapshot(): string {
  return currentPath()
}

function syncSnapshot(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// `popstate` covers the browser back/forward buttons; `hashchange` is here
// only so a legacy `/#pricing` link that we rewrite to `/pricing` still
// re-renders. Our own `navigate()` calls notify listeners directly, because
// `history.pushState` deliberately fires no event.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", syncSnapshot)
  window.addEventListener("hashchange", syncSnapshot)
}

export type NavigateOptions = {
  /** Replace the current history entry instead of adding one (redirects). */
  replace?: boolean
  /** Arbitrary history state, e.g. `{ focus: "risk-preview" }` for a section scroll. */
  state?: Record<string, unknown>
}

/** Resolves `to` (absolute path, relative like `features`, or `..`) against the current path. */
export function resolvePath(to: string, from: string = currentPath()): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(to)) return to
  if (to.startsWith("/")) return normalizePath(to)
  const base = from.endsWith("/") ? from : `${from}/`
  const segments = `${base}${to}`.split("/")
  const stack: string[] = []
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") stack.pop()
    else stack.push(segment)
  }
  return normalizePath(`/${stack.join("/")}`)
}

/**
 * Client-side navigation. Keeps the same document (no full reload) and
 * notifies subscribers; a no-op during prerendering.
 */
export function navigate(to: string, options: NavigateOptions = {}): void {
  if (typeof window === "undefined") return
  const path = resolvePath(to)
  const { search, hash } = window.location
  const next = `${path}${search}${hash}`
  const current = `${currentPath()}${search}${hash}`
  if (next === current && !options.state) {
    syncSnapshot()
    return
  }
  try {
    if (options.replace) window.history.replaceState(options.state ?? null, "", next)
    else window.history.pushState(options.state ?? null, "", next)
  } catch {
    // Sandboxed iframes and `about:blank` documents can refuse history writes.
    // Falling back to no navigation is better than throwing inside a click handler.
    return
  }
  syncSnapshot()
}

/** History state attached by `navigate()`, if any. */
export function currentHistoryState(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null
  const state: unknown = window.history.state
  return state !== null && typeof state === "object" ? (state as Record<string, unknown>) : null
}

/** The path currently rendered. Re-renders on `navigate()` and back/forward. */
export function useRoutePath(): string {
  return useSyncExternalStore(subscribe, readSnapshot, () => serverPath)
}

export type Route = {
  path: string
  navigate: (to: string, options?: NavigateOptions) => void
}

export function useRoute(): Route {
  const path = useRoutePath()
  const go = useCallback((to: string, options?: NavigateOptions) => navigate(to, options), [])
  return { path, navigate: go }
}

/**
 * Click handler for internal `<a href="/…">` links: keeps the SPA behaviour
 * and browser affordances (middle-click, ⌘/Ctrl-click, "open in new tab",
 * crawlable `href`) while avoiding a full document reload on a plain click.
 * External links, downloads, new-tab clicks and modifier keys are untouched.
 */
export function onInternalLinkClick(event: React.MouseEvent<HTMLAnchorElement>, to?: string): void {
  if (event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.currentTarget
  if (target.target && target.target !== "_self") return
  if (target.hasAttribute("download")) return
  const href = to ?? target.getAttribute("href") ?? ""
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return
  event.preventDefault()
  navigate(href)
}
