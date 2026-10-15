import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Landing, { EXTRA } from "../src/marketing/Landing"
import { ROUTES, head, render as renderSsr } from "../src/entry-server"
import { LANDING_PAGES, localizedBlogCategoryPath,
  localizedLandingPath } from "../src/lib/routes"
import { LOCALE_IDS, LOCALES, hreflang } from "../src/lib/locales"
import { PAGE_COPY, hreflangAlternates } from "../src/lib/seo"
import { SITE_URL } from "../src/lib/site"

/**
 * Task-level guarantees for the internationalisation work: every language is a
 * real URL with its own prerendered document, the `hreflang` set is complete
 * and symmetric, and the language is read from — never guessed against — the
 * URL. These are the properties a search engine verifies before it trusts an
 * alternate cluster; getting them wrong is worse than not declaring them.
 */

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  localStorage.clear()
  document.getElementById("ld-content")?.remove()
  for (const node of document.querySelectorAll(
    'link[rel="canonical"], link[rel="alternate"][hreflang], meta[property="og:url"], meta[property="og:locale"], meta[property="og:locale:alternate"]',
  )) {
    node.remove()
  }
})

it("publishes one prerendered route per public page per language", () => {
  // 12 marketing pages + 5 blog section pages (/blog/tips, …), each × 3 locales.
  expect(ROUTES).toHaveLength((LANDING_PAGES.length + 5) * LOCALES.length)
  expect(new Set(ROUTES).size).toBe(ROUTES.length)
  for (const locale of LOCALE_IDS) {
    for (const page of LANDING_PAGES) {
      expect(ROUTES, `${page}/${locale}`).toContain(localizedLandingPath(page, locale))
    }
    for (const category of ["tips", "news", "articles", "products", "guides"] as const) {
      expect(ROUTES, `${category}/${locale}`).toContain(localizedBlogCategoryPath(locale, category))
    }
  }
  // French keeps the unprefixed URLs every existing link already points at.
  expect(ROUTES).toContain("/")
  expect(ROUTES).toContain("/pricing")
})

it("prerenders each language tree with its own copy and its own internal links", () => {
  const fr = renderSsr("/pricing")
  expect(fr).toContain('href="/about"')
  expect(fr).not.toContain('href="/ar/about"')

  const ar = renderSsr("/ar/pricing")
  expect(ar).toContain(EXTRA.ar.pricing.title)
  expect(ar).toContain('href="/ar/about"')
  expect(ar).toContain('href="/ar/contact"')
  expect(ar).not.toContain('href="/about"')
  expect(ar).not.toContain(EXTRA.fr.pricing.title)

  const en = renderSsr("/en/faq")
  expect(en).toContain(EXTRA.en.faq.title)
  expect(en).toContain('href="/en/features"')
})

it("writes a self-referencing canonical and the full alternate set in every language", () => {
  for (const locale of LOCALE_IDS) {
    const path = localizedLandingPath("pricing", locale)
    const html = head(path, SITE_URL)
    expect(html, locale).toContain(`<link rel="canonical" href="${SITE_URL}${path}">`)
    expect(html.match(/rel="canonical"/g), locale).toHaveLength(1)
    for (const alternate of hreflangAlternates("pricing", SITE_URL)) {
      expect(html, locale).toContain(`rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"`)
    }
  }
})

it("keeps the Arabic page Arabic from <title> to JSON-LD", () => {
  const html = head("/ar/faq", SITE_URL)
  expect(html).toContain(`<title>${PAGE_COPY.faq.ar.title}</title>`)
  expect(html).toContain('"inLanguage":"ar-MA"')
  expect(html).not.toContain(PAGE_COPY.faq.fr.title)
  expect(html).toContain(`hreflang="${hreflang("ar")}"`)
})

it("reads the language from the URL on the client and applies it to the document", () => {
  window.history.replaceState({}, "", "/ar/pricing")

  const view = render(<Landing onEnter={() => {}} />)

  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
  expect(document.title).toBe(PAGE_COPY.pricing.ar.title)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE_URL}/ar/pricing`)
  const alternates = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(
    (node) => `${node.getAttribute("hreflang")} ${node.getAttribute("href")}`,
  )
  expect(alternates).toEqual(
    hreflangAlternates("pricing", SITE_URL).map((alternate) => `${alternate.hreflang} ${alternate.href}`),
  )
  // The right *page* came with the language: `/ar/pricing` is the pricing page.
  expect(view.container.querySelector("#pricing")).not.toBeNull()
})

it("keeps the unprefixed URLs French and the x-default target of the cluster", () => {
  window.history.replaceState({}, "", "/pricing")

  const view = render(<Landing onEnter={() => {}} />)

  expect(document.documentElement.lang).toBe("fr")
  expect(document.documentElement.dir).toBe("ltr")
  expect(document.title).toBe(PAGE_COPY.pricing.fr.title)
  expect(document.querySelector('link[rel="alternate"][hreflang="x-default"]')?.getAttribute("href")).toBe(
    `${SITE_URL}/pricing`,
  )
  expect(view.container.innerHTML).toContain('href="/features"')
})

it("switches language by navigating to the same page in the other tree", () => {
  window.history.replaceState({}, "", "/en/faq")

  render(<Landing onEnter={() => {}} />)

  fireEvent.click(screen.getByRole("button", { name: "English" }))
  fireEvent.click(screen.getByRole("option", { name: "العربية" }))

  // The URL is the state: the language change is a navigation, so the back
  // button undoes it and the address bar can be shared as-is.
  expect(window.location.pathname).toBe("/ar/faq")
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
  expect(document.title).toBe(PAGE_COPY.faq.ar.title)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE_URL}/ar/faq`)
})
