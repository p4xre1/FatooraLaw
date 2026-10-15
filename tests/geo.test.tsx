import { expect, it } from "vitest"
import site from "../.figma/make/site.json"
import { render, renderBlogArticleRoute } from "../src/entry-server"
import { buildBlogArticleHead, buildJsonLd, EXTRA, T } from "../src/marketing/Landing"
import type { PublicBlogPost } from "../src/lib/blog"
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
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]))
  levels.reduce((previous, level) => {
    expect(level, `h${level} skips after h${previous}`).toBeLessThanOrEqual(previous + 1)
    return level
  }, 0)
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
  for (const type of ["FAQPage", "HowTo", "Product"]) {
    expect(schema).toContain(type)
  }
  expect(schema).not.toContain("BlogPosting")
})

it("renders localized database-backed blog articles with reciprocal hreflang and Article schema", () => {
  const post: PublicBlogPost = {
    id: "post-1", locale: "fr", category: "articles", title: "Gérer une petite entreprise au Maroc", slug: "gerer-petite-entreprise", content: "## Organiser son activité\n\nUn article de démonstration publié pour tester le rendu serveur sécurisé.", excerpt: "Conseils pratiques pour structurer une petite entreprise marocaine.", seo_title: "Gérer une petite entreprise | Fatorati", seo_description: "Des conseils concrets pour organiser la gestion d’une petite entreprise marocaine au quotidien.", keywords: ["TPE Maroc"], author_name: "Fatorati", published_at: "2026-10-13T10:00:00.000Z", updated_at: "2026-10-13T10:00:00.000Z", canonical_slug_fr: "gerer-petite-entreprise",
    translations: {
      fr: { title: "Gérer une petite entreprise au Maroc", slug: "gerer-petite-entreprise", content: "Article", excerpt: "Résumé", seo_title: "Gérer une petite entreprise | Fatorati", seo_description: "Des conseils concrets pour organiser la gestion d’une petite entreprise marocaine au quotidien.", keywords: ["TPE Maroc"] },
      ar: { title: "تدبير المقاولة الصغيرة", slug: "tadbir-moqawala", content: "مقال", excerpt: "ملخص", seo_title: "تدبير المقاولة الصغيرة بالمغرب", seo_description: "خطوات عملية لتنظيم تدبير المقاولة الصغيرة في المغرب وتحسين عملها اليومي.", keywords: ["مقاولة صغيرة"] },
      en: { title: "Managing a small business in Morocco", slug: "managing-small-business", content: "Article", excerpt: "Summary", seo_title: "Managing a small business | Fatorati", seo_description: "Practical steps for organizing a small Moroccan business and improving day-to-day operations.", keywords: ["small business Morocco"] },
    },
  }
  const head = buildBlogArticleHead(post, "fr")
  expect(head.canonical).toBe("https://fatorati.tech/blog/gerer-petite-entreprise")
  expect(head.alternates.map((item) => item.hreflang)).toEqual(["fr-MA", "ar-MA", "en", "x-default"])
  expect(JSON.stringify(head.jsonLd)).toContain("BlogPosting")

  const rendered = renderBlogArticleRoute("/blog/gerer-petite-entreprise", "https://fatorati.tech", undefined, post)
  expect(rendered).not.toBeNull()
  expect(rendered?.html.match(/<h1\b/g)).toHaveLength(1)
  expect(rendered?.html).toContain("Organiser son activité")
  expect(rendered?.head).toContain("rel=\"canonical\"")
  expect(rendered?.head).toContain("hreflang=\"ar-MA\"")

  const invalidDatePost = { ...post, published_at: "not-a-date", updated_at: "also-not-a-date" }
  const invalidHead = buildBlogArticleHead(invalidDatePost, "fr")
  expect(invalidHead.jsonLd).not.toHaveProperty("datePublished")
  expect(invalidHead.jsonLd).not.toHaveProperty("dateModified")
  const invalidRendered = renderBlogArticleRoute("/blog/gerer-petite-entreprise", "https://fatorati.tech", undefined, invalidDatePost)
  expect(invalidRendered?.html).not.toContain('itemProp="datePublished"')
  expect(invalidRendered?.head).not.toContain("datePublished")
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
