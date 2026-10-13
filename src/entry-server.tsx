import { renderToString } from "react-dom/server"
import Landing, { buildJsonLd, EXTRA, T } from "./marketing/Landing"
import { setServerPath } from "./lib/router"
import { SITE_URL } from "./lib/site"
import { landingPageFromPath, localeEntries, localeRoute, normalizePath } from "./lib/routes"
import { renderHeadTags, seoForPath, type SeoEntry } from "./lib/seo"

/**
 * Renders one public page to static HTML at *build time*. Used by
 * scripts/prerender.mjs to fill `dist/<route>/index.html` with the real page
 * and its real head tags, so crawlers that don't execute JavaScript (most AI
 * and social bots) see the actual content instead of an empty
 * `<div id="root"></div>` — and so each URL has its own canonical, title,
 * description, `hreflang` alternates and structured data instead of all
 * sharing the homepage's.
 *
 * There is one route per page **per locale** (`/pricing`, `/ar/pricing`,
 * `/en/pricing`): `hreflang` is only usable when each language has its own
 * URL, so the localized documents are real files, not a client-side swap.
 *
 * Deliberately renders only <Landing/>: the same component tree <App/>
 * renders for a signed-out visitor with the login form closed, which is every
 * crawler's and every first-time visitor's actual initial state. The `onEnter`
 * handler is a no-op here — it only matters once the client hydrates and
 * re-attaches the real handler from <App/>.
 */

/** Every public route in every locale, in sitemap order (`/`, `/ar`, `/en`, `/features`, …). */
export const ROUTES: string[] = localeEntries().map((entry) => entry.path)

/** The document head (title, description, canonical, hreflang, Open Graph, JSON-LD) for one route. */
export function head(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): string {
  const { locale, path } = localeRoute(pathname)
  const entry: SeoEntry = seoForPath(path, locale)
  const jsonLd = buildJsonLd(entry.page, locale, T[locale], EXTRA[locale])
  return renderHeadTags({
    page: entry.page,
    locale,
    siteUrl,
    socialImage: socialImage || undefined,
    jsonLd,
    lastmod: new Date().toISOString().slice(0, 10),
  })
}

/** HTML for the `#root` element of one public route. */
export function render(pathname: string = "/"): string {
  const path = normalizePath(pathname)
  const page = landingPageFromPath(localeRoute(path).path) ?? "home"
  // The *localized* path: <Landing/> reads the current route and derives the
  // locale from the prefix, exactly as it does in the browser.
  setServerPath(path)
  return renderToString(<Landing initialPage={page} onEnter={() => {}} />)
}

/** Everything scripts/prerender.mjs needs for one route. */
export function renderRoute(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): { html: string; head: string } {
  return { html: render(pathname), head: head(pathname, siteUrl, socialImage) }
}
