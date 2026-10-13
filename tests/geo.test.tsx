import { expect, it } from "vitest"
import site from "../.figma/make/site.json"
import { render } from "../src/entry-server"
import { buildJsonLd, EXTRA, T } from "../src/marketing/Landing"
import { GITHUB_URL } from "../src/marketing/contentMeta"
import { LANDING_PAGES } from "../src/lib/routes"

function words(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
  return text.split(/\s+/).filter(Boolean).length
}

it("prerenders a citable homepage with one h1 and the content schema types", () => {
  const html = render("/")
  expect(html.match(/<h1\b/g)).toHaveLength(1)
  expect(html).toContain("<blockquote")
  expect(html).toContain("<q>")
  expect(html).toContain("<cite>")
  expect(html).toContain('href="/about"')
  expect(html).toContain('href="/contact"')
  expect(html).toContain("https://www.tax.gov.ma/")
  expect(html).toContain("https://www.cndp.ma/")
  expect(html).toContain("Aperçu de démonstration")
  expect(words(html)).toBeGreaterThan(700)

  const schema = JSON.stringify(buildJsonLd("home", "fr", T.fr, EXTRA.fr))
  for (const type of ["FAQPage", "HowTo", "Product", "Article"]) {
    expect(schema).toContain(type)
  }
})

it("gives every public page one h1, citations, about and contact links, and real depth", () => {
  for (const page of LANDING_PAGES) {
    const path = page === "home" ? "/" : `/${page}`
    const html = render(path)
    expect(html.match(/<h1\b/g), path).toHaveLength(1)
    expect(html, path).toContain("<blockquote")
    expect(html, path).toContain('href="/about"')
    expect(html, path).toContain('href="/contact"')
    expect(words(html), path).toBeGreaterThan(450)
    const schema = JSON.stringify(buildJsonLd(page, "fr", T.fr, EXTRA.fr))
    expect(schema, path).toContain("FAQPage")
    expect(schema, path).toContain("HowTo")
  }
})

it("publishes a real GitHub sameAs and does not invent a profile", () => {
  expect(site.organization.sameAs).toEqual([GITHUB_URL])
  expect(site.organization.sameAs.join(" ")).not.toMatch(/wikipedia|linkedin|wikidata/i)
})
