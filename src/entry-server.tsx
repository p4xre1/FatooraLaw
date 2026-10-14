import { renderToString } from "react-dom/server"
import { createClient } from "@supabase/supabase-js"
import Landing, { BlogArticlePage, buildBlogArticleHead, buildJsonLd, buildManagedSiteHead, EXTRA, T } from "./marketing/Landing"
import { listPublishedPosts, type PublicBlogPost } from "./lib/blog"
import { getPublishedSiteCmsData, type PublicSiteCmsData } from "./lib/siteCms"
import { isSupabaseConfigured, supabaseConfig } from "./lib/supabase"
import { setServerPath } from "./lib/router"
import { SITE_URL } from "./lib/site"
import { blogArticleFromPath, landingPageFromPath, localeEntries, localeRoute, localizedBlogArticlePath, localizedLandingPath, normalizePath } from "./lib/routes"
import { LOCALES, localeInfo } from "./lib/locales"
import { renderCustomHeadTags, renderHeadTags, seoForPath, type SeoEntry } from "./lib/seo"

const prerenderFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
})
const prerenderSupabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: prerenderFetch },
    })
  : null
const prerenderBlogCache = new Map<string, Promise<PublicBlogPost[] | undefined>>()

function loadPrerenderedBlogPosts(locale: PublicBlogPost["locale"]): Promise<PublicBlogPost[] | undefined> {
  if (!prerenderSupabase) return Promise.resolve(undefined)
  const existing = prerenderBlogCache.get(locale)
  if (existing) return existing
  const request = listPublishedPosts(locale, prerenderSupabase).catch((error) => {
    console.warn(`[prerender] Published blog data unavailable for locale ${locale}; dynamic rendering remains enabled.`, error)
    return undefined
  })
  prerenderBlogCache.set(locale, request)
  return request
}

const prerenderCmsCache = new Map<string, Promise<PublicSiteCmsData | undefined>>()
function loadPrerenderedSiteCms(path: string, locale: PublicSiteCmsData["locale"]): Promise<PublicSiteCmsData | undefined> {
  if (!prerenderSupabase) return Promise.resolve(undefined)
  const key = `${locale}:${path}`
  const existing = prerenderCmsCache.get(key)
  if (existing) return existing
  const request = getPublishedSiteCmsData(path, locale, prerenderSupabase).catch((error) => {
    console.warn(`[prerender] CMS site data unavailable for ${path} (${locale}); built-in copy remains enabled.`, error)
    return undefined
  })
  prerenderCmsCache.set(key, request)
  return request
}

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

function headWithCms(pathname: string, siteUrl: string, socialImage: string | undefined, data?: PublicSiteCmsData): string {
  const { locale, path } = localeRoute(pathname)
  const page = landingPageFromPath(path) ?? "home"
  const input = buildManagedSiteHead(data, page, locale, siteUrl)
  return input ? renderCustomHeadTags({ ...input, ...(socialImage ? { socialImage } : {}) }) : head(pathname, siteUrl, socialImage)
}

/** HTML for the `#root` element of one public route. */
export function render(pathname: string = "/", initialBlogPosts?: PublicBlogPost[], initialSiteCmsData?: PublicSiteCmsData): string {
  const path = normalizePath(pathname)
  const page = landingPageFromPath(localeRoute(path).path) ?? "home"
  // The *localized* path: <Landing/> reads the current route and derives the
  // locale from the prefix, exactly as it does in the browser.
  setServerPath(path)
  return renderToString(<Landing initialPage={page} initialBlogPosts={initialBlogPosts} initialSiteCmsData={initialSiteCmsData} onEnter={() => {}} />)
}

/** Everything scripts/prerender.mjs needs for one route. */
export function renderRoute(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): { html: string; head: string } {
  return { html: render(pathname), head: head(pathname, siteUrl, socialImage) }
}

/** Prerenders the blog list into public landing documents when the DB is available. */
export async function renderStaticRoute(pathname: string, siteUrl: string = SITE_URL, socialImage?: string): Promise<{ html: string; head: string; blogPosts?: PublicBlogPost[]; siteCms?: PublicSiteCmsData }> {
  const { locale, path } = localeRoute(pathname)
  const page = landingPageFromPath(path) ?? "home"
  let blogPosts: PublicBlogPost[] | undefined
  if (page === "home" || page === "blog") blogPosts = await loadPrerenderedBlogPosts(locale)
  const siteCms = await loadPrerenderedSiteCms(pathname, locale)
  return {
    html: render(pathname, blogPosts, siteCms),
    head: headWithCms(pathname, siteUrl, socialImage, siteCms),
    ...(blogPosts ? { blogPosts } : {}),
    ...(siteCms ? { siteCms } : {}),
  }
}

export type PublishedBlogRoute = { path: string; locale: PublicBlogPost["locale"]; post: PublicBlogPost }

/** Fetch the published rows through the public read policy for build-time SSG. */
export async function publishedBlogRoutes(): Promise<PublishedBlogRoute[]> {
  const byLocale = await Promise.all(LOCALES.map((locale) => loadPrerenderedBlogPosts(locale.id)))
  return byLocale.flatMap((posts) => posts?.map((post) => ({
    path: localizedBlogArticlePath(post.locale, post.slug),
    locale: post.locale,
    post,
  })) ?? [])
}

/** Renders one localized, public article with crawlable metadata and body HTML. */
export function renderBlogArticleRoute(
  pathname: string,
  siteUrl: string,
  socialImage: string | undefined,
  post: PublicBlogPost,
): { html: string; head: string; htmlLang: string; dir: "ltr" | "rtl" } | null {
  const route = blogArticleFromPath(pathname)
  if (!route || route.locale !== post.locale || route.slug !== post.slug) return null
  setServerPath(normalizePath(pathname))
  const headInput = buildBlogArticleHead(post, route.locale, siteUrl)
  return {
    html: renderToString(<BlogArticlePage locale={route.locale} slug={route.slug} initialPost={post} />),
    head: renderCustomHeadTags({ ...headInput, ...(socialImage ? { socialImage } : {}) }),
    htmlLang: localeInfo(route.locale).lang,
    dir: localeInfo(route.locale).dir,
  }
}
