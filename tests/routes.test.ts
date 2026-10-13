import { describe, expect, it } from "vitest"
import {
  AUTH_PATHS,
  DEFAULT_APP_PATH,
  LANDING_PAGES,
  MODULE_PATHS,
  NOT_FOUND_PATH,
  authScreenFromPath,
  isPrivatePath,
  isPublicPath,
  landingPageFromPath,
  landingPath,
  localeEntries,
  localeRoute,
  localizedLandingPath,
  localizedPath,
  moduleFromPath,
  modulePath,
  normalizePath,
} from "../src/lib/routes"
import { DEFAULT_LOCALE, LOCALE_IDS, LOCALES } from "../src/lib/locales"
import {
  PAGE_COPY,
  buildLlmsTxt,
  buildSitemapXml,
  hreflangAlternates,
  localizedPages,
  privatePaths,
  privateTitleFor,
  publicPages,
  renderHeadTags,
  renderNoIndexHeadTags,
  seoForPath,
} from "../src/lib/seo"
import type { ModuleKey } from "../src/store/types"

const SITE = "https://fatorati.tech"

describe("normalizePath", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/features", "/features"],
    ["/features/", "/features"],
    ["/features/?utm_source=x", "/features"],
    ["/Features", "/features"],
    ["//features//", "/features"],
    ["/features#assistant", "/features"],
    ["https://fatorati.tech/pricing?x=1#y", "/pricing"],
    ["/login/", "/login"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected)
  })
})

describe("route mapping", () => {
  it("gives every public page its own fragment-free path", () => {
    const paths = LANDING_PAGES.map(landingPath)
    expect(new Set(paths).size).toBe(LANDING_PAGES.length)
    for (const path of paths) {
      expect(path).not.toContain("#")
      expect(path.startsWith("/")).toBe(true)
    }
    expect(landingPath("home")).toBe("/")
    expect(landingPath("assistant")).toBe("/assistant")
  })

  it("resolves a marketing page from its URL and nothing else", () => {
    expect(landingPageFromPath("/")).toBe("home")
    expect(landingPageFromPath("/pricing/")).toBe("pricing")
    expect(landingPageFromPath("/cookies")).toBe("cookies")
    expect(landingPageFromPath("/tableau")).toBeNull()
    expect(landingPageFromPath("/features/calendar-preview")).toBeNull()
  })

  it("round-trips every module key through its URL", () => {
    for (const [key, path] of Object.entries(MODULE_PATHS) as [ModuleKey, string][]) {
      expect(modulePath(key)).toBe(path)
      expect(moduleFromPath(path)).toBe(key)
      expect(moduleFromPath(`${path}/`)).toBe(key)
    }
    expect(moduleFromPath("/not-a-module")).toBeNull()
    expect(DEFAULT_APP_PATH).toBe("/dashboard")
  })

  it("gives every auth screen a URL, including the login screen that had none", () => {
    expect(authScreenFromPath("/login")).toBe("login")
    expect(authScreenFromPath("/signup")).toBe("signup")
    expect(authScreenFromPath("/forgot-password")).toBe("forgot")
    expect(authScreenFromPath("/reset-password")).toBe("reset")
    expect(authScreenFromPath("/")).toBeNull()
    expect(Object.values(AUTH_PATHS).every((path) => path.startsWith("/"))).toBe(true)
  })

  it("keeps the default locale unprefixed and gives every other language its own tree", () => {
    expect(localeRoute("/pricing")).toEqual({ locale: "fr", path: "/pricing" })
    expect(localeRoute("/ar/pricing")).toEqual({ locale: "ar", path: "/pricing" })
    expect(localeRoute("/en")).toEqual({ locale: "en", path: "/" })
    expect(localeRoute("/ar/")).toEqual({ locale: "ar", path: "/" })
    // A locale prefix in front of a screen that is not a public page is an
    // unknown path — not a second URL for the (French, noindex) login screen.
    expect(localeRoute("/ar/login")).toEqual({ locale: "fr", path: "/ar/login" })
    expect(landingPageFromPath(localeRoute("/ar/login").path)).toBeNull()

    expect(localizedLandingPath("pricing", "fr")).toBe("/pricing")
    expect(localizedLandingPath("pricing", "ar")).toBe("/ar/pricing")
    expect(localizedLandingPath("home", "en")).toBe("/en")
    expect(localizedLandingPath("home", "fr")).toBe("/")
    // The auth screens and the signed-in app exist once, in French.
    expect(localizedPath("/login", "ar")).toBe("/login")
    expect(localizedPath("/dashboard", "en")).toBe("/dashboard")
  })

  it("publishes one distinct URL per page per locale", () => {
    const entries = localeEntries()
    expect(entries).toHaveLength(LANDING_PAGES.length * LOCALES.length)
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(entries.length)
    expect(entries.every((entry) => !entry.path.includes("#"))).toBe(true)
    expect(entries.map((entry) => entry.path)).toContain("/ar/pricing")
    expect(entries.map((entry) => entry.path)).toContain("/en")
  })

  it("classifies public and private paths", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/pricing")).toBe(true)
    expect(isPublicPath("/login")).toBe(false)
    expect(isPrivatePath("/login")).toBe(true)
    expect(isPrivatePath("/dashboard")).toBe(true)
    expect(isPrivatePath("/admin/blogs/new")).toBe(true)
    expect(isPrivatePath("/pricing")).toBe(false)
  })
})

describe("SEO metadata", () => {
  it("describes every public page exactly once", () => {
    const pages = publicPages()
    expect(pages).toHaveLength(LANDING_PAGES.length)
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length)
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length)
    for (const page of pages) {
      expect(page.title.length).toBeGreaterThan(20)
      expect(page.title.length).toBeLessThan(75)
      expect(page.description.length).toBeGreaterThan(80)
      expect(page.description.length).toBeLessThan(200)
    }
  })

  it("builds a sitemap with every page and no fragments", () => {
    const xml = buildSitemapXml(SITE, "2026-10-13")
    for (const page of publicPages()) {
      expect(xml).toContain(`<loc>${SITE}${page.path}</loc>`)
    }
    expect(xml).not.toContain("#")
    expect(xml).not.toContain("fatoriti")
    expect(xml.startsWith("<?xml")).toBe(true)
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true)
  })

  it("builds an llms.txt that lists every public page with its URL", () => {
    const txt = buildLlmsTxt(SITE)
    for (const page of publicPages()) {
      expect(txt).toContain(`${SITE}${page.path}`)
    }
    expect(txt).toContain("GPTBot")
    expect(txt).not.toContain("fatoriti")
  })

  it("emits one canonical and one page-schema script per page", () => {
    const html = renderHeadTags({
      page: "pricing",
      locale: DEFAULT_LOCALE,
      siteUrl: SITE,
      jsonLd: { "@context": "https://schema.org", "@type": "WebPage" },
      socialImage: "/og.png",
    })
    expect(html).toContain('<link rel="canonical" href="https://fatorati.tech/pricing">')
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/id="ld-content"/g)).toHaveLength(1)
    expect(html).toContain('<meta property="og:url" content="https://fatorati.tech/pricing">')
    expect(html).toContain('<meta property="og:image" content="https://fatorati.tech/og.png">')
    expect(html).toContain("index, follow")
    // No navigable URL keeps a fragment (the only `#` left is the hex colour).
    expect(html).not.toMatch(/href="[^"]*#/)
    expect(html).not.toMatch(/content="https?:\/\/[^"]*#/)
  })

  it("declares every language variant in both directions, plus x-default", () => {
    expect(hreflangAlternates("pricing", SITE)).toEqual([
      { hreflang: "fr-MA", href: "https://fatorati.tech/pricing" },
      { hreflang: "ar-MA", href: "https://fatorati.tech/ar/pricing" },
      { hreflang: "en", href: "https://fatorati.tech/en/pricing" },
      { hreflang: "x-default", href: "https://fatorati.tech/pricing" },
    ])

    // Symmetry is the rule that makes a hreflang set usable: every language
    // lists the same alternates (including itself), so search engines can
    // verify each pair in both directions.
    for (const locale of LOCALE_IDS) {
      const html = renderHeadTags({ page: "pricing", locale, siteUrl: SITE })
      for (const alternate of hreflangAlternates("pricing", SITE)) {
        expect(html, locale).toContain(`rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"`)
      }
      // …and nothing points at a second URL for the language it is written in.
      expect(html, locale).toContain(`<link rel="canonical" href="${SITE}${localizedLandingPath("pricing", locale)}">`)
      expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    }
  })

  it("serves each language its own title, description and Open Graph locale", () => {
    for (const entry of localizedPages()) {
      expect(entry.title.length, entry.path).toBeGreaterThan(15)
      expect(entry.title.length, entry.path).toBeLessThan(75)
      expect(entry.description.length, entry.path).toBeGreaterThan(80)
      expect(entry.description.length, entry.path).toBeLessThan(200)
      expect(entry.title, entry.path).not.toContain("<")
    }

    expect(seoForPath("/pricing").title).toBe(PAGE_COPY.pricing.fr.title)
    expect(seoForPath("/ar/pricing").title).toBe(PAGE_COPY.pricing.ar.title)
    expect(seoForPath("/en/faq").title).toBe(PAGE_COPY.faq.en.title)

    const html = renderHeadTags({ page: "pricing", locale: "ar", siteUrl: SITE })
    expect(html).toContain(`<title>${PAGE_COPY.pricing.ar.title}</title>`)
    expect(html).toContain('<meta property="og:locale" content="ar_MA">')
    expect(html).toContain('<meta property="og:locale:alternate" content="fr_MA">')
    expect(html).toContain('<meta property="og:locale:alternate" content="en">')
    expect(html).not.toContain('<meta property="og:locale:alternate" content="ar_MA">')
  })

  it("lists every localized URL in the sitemap, each with the same alternates", () => {
    const xml = buildSitemapXml(SITE, "2026-10-13")
    for (const entry of localizedPages()) {
      expect(xml, entry.path).toContain(`<loc>${SITE}${entry.path}</loc>`)
    }
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="ar-MA" href="https://fatorati.tech/ar/pricing"/>')
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="x-default" href="https://fatorati.tech/pricing"/>')
    expect(xml.match(/<url>/g)).toHaveLength(LANDING_PAGES.length * LOCALE_IDS.length)
    // Each URL carries its own four alternates (three languages + x-default).
    expect(xml.match(/<xhtml:link /g)).toHaveLength(LANDING_PAGES.length * LOCALE_IDS.length * (LOCALES.length + 1))
  })

  it("keeps private screens out of the index", () => {
    const html = renderNoIndexHeadTags("Connexion | Fatorati")
    expect(html).toContain("noindex, nofollow, noarchive")
    expect(html).toContain("<title>Connexion | Fatorati</title>")
    expect(html).not.toContain("canonical")

    for (const path of privatePaths()) {
      expect(privateTitleFor(path)).toContain("Fatorati")
    }
    expect(privatePaths()).toContain(AUTH_PATHS.login)
    expect(privatePaths()).toContain(MODULE_PATHS.dashboard)
    expect(privatePaths()).toContain(NOT_FOUND_PATH)
    expect(privateTitleFor("/admin/blogs")).toBe("Fatorati CMS")
  })
})
