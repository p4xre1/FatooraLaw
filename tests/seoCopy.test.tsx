import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Brand } from "../src/components/Brand"
import Landing from "../src/marketing/Landing"
import { localizedPages, PAGE_COPY } from "../src/lib/seo"

/**
 * The SERP length budgets the SEO crawlers check (and that the results page
 * truncates outside of): every title shows in full at 40–60 characters and
 * every description at 140–160. `PAGE_COPY` is the single source, so keeping
 * the budgets here keeps them on the prerendered documents, the sitemap, the
 * `llms.txt` index and the client-side `applyDocumentHead` at once.
 */
describe("PAGE_COPY SERP length budgets", () => {
  for (const [page, locales] of Object.entries(PAGE_COPY)) {
    for (const [locale, copy] of Object.entries(locales)) {
      it(`${page}/${locale}: title is 40–60 characters`, () => {
        const length = [...copy.title].length
        expect(
          length,
          `"${copy.title}" is ${length} characters`,
        ).toBeGreaterThanOrEqual(40)
        expect(
          length,
          `"${copy.title}" is ${length} characters`,
        ).toBeLessThanOrEqual(60)
      })

      it(`${page}/${locale}: description is 140–160 characters`, () => {
        const length = [...copy.description].length
        expect(
          length,
          `"${copy.description}" is ${length} characters`,
        ).toBeGreaterThanOrEqual(140)
        expect(
          length,
          `"${copy.description}" is ${length} characters`,
        ).toBeLessThanOrEqual(160)
      })
    }
  }

  it("every indexable route carries the same budgets", () => {
    for (const entry of localizedPages()) {
      expect([...entry.title].length).toBeGreaterThanOrEqual(40)
      expect([...entry.title].length).toBeLessThanOrEqual(60)
      expect([...entry.description].length).toBeGreaterThanOrEqual(140)
      expect([...entry.description].length).toBeLessThanOrEqual(160)
    }
  })
})

/**
 * The crawler finding this answers: "3 images missing alt text" — the brand
 * lock-up renders two <img> per surface (light + dark artwork) and the audit
 * counted the empty alts. No public page may ship an <img> without a
 * descriptive alt; the dark duplicate stays aria-hidden so screen readers
 * still hear the brand name once.
 */
describe("brand images always carry alt text", () => {
  it("Brand defaults to the brand name and repeats it on the theme duplicate", () => {
    const auto = render(<Brand tone="auto" />)
    for (const img of auto.container.querySelectorAll("img")) {
      expect(img.getAttribute("alt")).toBe("Fatorati")
    }
    expect(
      auto.container.querySelectorAll("img")[1].getAttribute("aria-hidden"),
    ).toBe("true")
  })

  it("the rendered landing page has no <img> without descriptive alt text", () => {
    const page = render(<Landing />)
    const imgs = page.container.querySelectorAll("img")
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(
        img.getAttribute("alt")?.trim() ?? "",
        `alt missing on ${img.getAttribute("src") ?? ""}`,
      ).not.toBe("")
    }
  })
})
