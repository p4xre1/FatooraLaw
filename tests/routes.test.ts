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
  moduleFromPath,
  modulePath,
  normalizePath,
} from "../src/lib/routes"
import { buildLlmsTxt, buildSitemapXml, privatePaths, privateTitleFor, publicPages, renderHeadTags, renderNoIndexHeadTags } from "../src/lib/seo"
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
