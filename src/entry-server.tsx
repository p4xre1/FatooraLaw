import { renderToString } from "react-dom/server"
import Landing, { buildJsonLd, EXTRA, T } from "./marketing/Landing"
import { setServerPath } from "./lib/router"
import { SITE_URL } from "./lib/site"
import { LANDING_PAGES, landingPageFromPath, normalizePath } from "./lib/routes"
import { renderHeadTags, seoForPath, type SeoEntry } from "./lib/seo"

/**
 * Renders one public page to static HTML at *build time*. Used by
 * scripts/prerender.mjs to fill `dist/<route>/index.html` with the real page
 * and its real head tags, so crawlers that don't execute JavaScript (most AI
 * and social bots) see the actual content instead of an empty
 * `<div id="root"></div>` — and so each URL has its own canonical, title,
 * description and structured data instead of all sharing the homepage's.
 *
 * Deliberately renders only <Landing/>: the same component tree <App/>
 * renders for a signed-out visitor with the login form closed, which is every
 * crawler's and every first-time visitor's actual initial state. The `onEnter`
 * handler is a no-op here — it only matters once the client hydrates and
 * re-attaches the real handler from <App/>.
 */

/** Every public route, in sitemap order (`/` first). */
export const ROUTES: string[] = LANDING_PAGES.map((page) => seoForPath(page === "home" ? "/" : `/${page}`).path)

/** The document head (title, description, canonical, Open Graph, JSON-LD) for one route. */
export function head(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): string {
  const entry: SeoEntry = seoForPath(pathname)
  const jsonLd = buildJsonLd(entry.page, "fr", T.fr, EXTRA.fr)
  return renderHeadTags({
    page: entry.page,
    siteUrl,
    socialImage: socialImage || undefined,
    jsonLd,
    lastmod: new Date().toISOString().slice(0, 10),
  })
}

/** HTML for the `#root` element of one public route. */
export function render(pathname: string = "/"): string {
  const path = normalizePath(pathname)
  const page = landingPageFromPath(path) ?? "home"
  setServerPath(page === "home" ? "/" : `/${page}`)
  return renderToString(<Landing initialPage={page} onEnter={() => {}} />)
}

/** Everything scripts/prerender.mjs needs for one route. */
export function renderRoute(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): { html: string; head: string } {
  return { html: render(pathname), head: head(pathname, siteUrl, socialImage) }
}
