import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { auditBlog } from "../src/admin/blogs/viralStandards"
import { BLOG_CATEGORY_LABELS, type PublicBlogPost } from "../src/lib/blog"
import { buildBlogCategoryHead, BLOG_CATEGORY_COPY } from "../src/lib/seo"
import {
  blogArticleFromPath,
  blogCategoryFromPath,
  isPublicPath,
  localizedBlogCategoryPath,
  normalizePath,
} from "../src/lib/routes"
import Landing from "../src/marketing/Landing"

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  localStorage.clear()
  document.getElementById("ld-content")?.remove()
  document.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').forEach((node) => node.remove())
  document.querySelector('meta[name="description"]')?.remove()
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

/* ------------------------------- routing --------------------------------- */

it("resolves the five section URLs in every locale", () => {
  expect(blogCategoryFromPath("/blog/tips")).toEqual({ locale: "fr", category: "tips" })
  expect(blogCategoryFromPath("/ar/blog/guides")).toEqual({ locale: "ar", category: "guides" })
  expect(blogCategoryFromPath("/en/blog/products")).toEqual({ locale: "en", category: "products" })
  expect(blogCategoryFromPath("/blog/unknown-thing")).toBeNull()
  expect(blogCategoryFromPath("/pricing")).toBeNull()
})

it("reserves the section words from the article slugs", () => {
  // /blog/tips is the section page, never an article.
  expect(blogArticleFromPath("/blog/tips")).toBeNull()
  expect(blogArticleFromPath("/ar/blog/news")).toBeNull()
  // Real article slugs keep working, including words that merely contain them.
  expect(blogArticleFromPath("/blog/tips-for-cashflow")).toEqual({ locale: "fr", slug: "tips-for-cashflow" })
  expect(blogArticleFromPath("/blog/gerer-tva")).toEqual({ locale: "fr", slug: "gerer-tva" })
})

it("treats the section pages as public and localizes their paths", () => {
  expect(isPublicPath("/blog/tips")).toBe(true)
  expect(isPublicPath("/ar/blog/tips")).toBe(true)
  expect(localizedBlogCategoryPath("ar", "tips")).toBe("/ar/blog/tips")
  expect(localizedBlogCategoryPath("fr", "news")).toBe("/blog/news")
  expect(normalizePath("/blog/tips/")).toBe("/blog/tips")
})

/* ------------------------------ SEO copy --------------------------------- */

it("keeps the section SERP budgets: titles 40–60, descriptions 140–160", () => {
  for (const [category, locales] of Object.entries(BLOG_CATEGORY_COPY)) {
    for (const [locale, copy] of Object.entries(locales)) {
      const title = [...copy.title].length
      const description = [...copy.description].length
      expect(title, `${category}/${locale} title`).toBeGreaterThanOrEqual(40)
      expect(title, `${category}/${locale} title`).toBeLessThanOrEqual(60)
      expect(description, `${category}/${locale} description`).toBeGreaterThanOrEqual(140)
      expect(description, `${category}/${locale} description`).toBeLessThanOrEqual(160)
    }
  }
})

it("builds a section head with canonical, alternates and CollectionPage schema", () => {
  const head = buildBlogCategoryHead("guides", "ar", "https://fatorati.tech")
  expect(head.canonical).toBe("https://fatorati.tech/ar/blog/guides")
  expect(head.alternates.map((entry) => entry.hreflang)).toEqual(["fr-MA", "ar-MA", "en", "x-default"])
  expect((head.jsonLd as { "@type": string })["@type"]).toBe("CollectionPage")
})

/* --------------------------- the audit engine ---------------------------- */

const STRONG_POST = {
  title: "Facturation électronique au Maroc : le guide complet Fatorati",
  slug: "facturation-electronique-maroc",
  excerpt: "Facturer correctement au Maroc : mentions obligatoires, ICE, TVA et échéances DGI expliqués pas à pas pour les petites entreprises.",
  seo_title: "Facturation électronique au Maroc : guide complet | Fatorati",
  seo_description: "Facturation au Maroc : mentions obligatoires, ICE, TVA à 20 %, échéances DGI et conservation des pièces, expliqués pas à pas pour une petite entreprise.",
  keywords: ["facturation"],
  image_url: "https://fatorati.tech/og/og-default.png",
  image_alt: "Aperçu d'une facture conforme marocaine dans l'application Fatorati",
  brandName: "Fatorati",
  siteHost: "fatorati.tech",
  content: `La facturation électronique au Maroc désigne l'émission, la transmission et la conservation de factures au format numérique structuré, conformément aux textes en vigueur de la DGI. Ce guide explique ce qu'une TPE doit faire, dans quel ordre, et ce qui change concrètement pour votre gestion quotidienne.

## Comment établir une facture conforme au Maroc ?

Une facture conforme mentionne l'identité du vendeur et de l'acheteur, l'ICE, le numéro de la facture, la date, le détail des quantités et prix, le taux de TVA applicable et le montant hors taxe. La DGI publie la liste des mentions obligatoires dans son guide officiel ([guide TVA de la DGI](https://www.tax.gov.ma/wps/wcm/connect/689f3a4d-98e4-4bb2-9ba2-d5fdd37c9625/TVA.pdf)). Vérifiez chaque mention avant l'envoi au client, car une mention manquante peut remettre en cause le droit à déduction de votre client.

## Pourquoi l'ICE figure-t-il sur chaque facture ?

L'Identifiant Commun de l'Entreprise relie la facture à votre registre fiscal. Sans ICE, l'administration peut contester la déductibilité pour le client. Selon les textes en vigueur, la mention est exigée sur les factures et les correspondances commerciales.

> « La pénalité de 10 % est portée à 20 % en cas de versement hors délai de la taxe sur la valeur ajoutée due. » — [CGI, article 208](https://www.tax.gov.ma/wps/portal/DGI/Documentation-fiscale/Code-general-des-impots/Partie3Livre1codegeneraledesimpots/)

## Quand faut-il émettre la facture ?

La facture s'émet à la réalisation de la livraison ou de la prestation. Conservez chaque pièce pendant la durée légale : la conservation comptable dépasse la durée de vie du compte dans l'application. ${"Fatorati rappelle chaque échéance dans le calendrier intégré, avec des alertes avant la date limite, un historique des déclarations et un export pour votre expert-comptable. ".repeat(14)}

## Quels outils pour suivre la trésorerie après la facturation ?

Un tableau de bord qui rapproche factures envoyées, paiements reçus et échéances fiscales évite les mauvaises surprises. Organisez vos documents dans un coffre unique et relisez les alertes de risque chaque semaine.`,
}

it("scores a complete, well-sourced draft as excellent", () => {
  const result = auditBlog(STRONG_POST)
  expect(result.score).toBeGreaterThanOrEqual(85)
  expect(result.band).toBe("excellent")
  expect(result.counts.questionHeadings).toBeGreaterThanOrEqual(3)
  expect(result.counts.externalSources).toBeGreaterThanOrEqual(1)
  expect(result.counts.quotes).toBeGreaterThanOrEqual(1)
})

it("flags every standard an empty draft is missing", () => {
  const result = auditBlog({ title: "", slug: "", content: "", excerpt: "", seo_title: "", seo_description: "", keywords: [] })
  expect(result.score).toBeLessThanOrEqual(25)
  expect(result.band).toBe("critical")
  const failing = new Set(result.checks.filter((check) => !check.pass).map((check) => check.id))
  for (const id of ["title", "description", "depth", "headings", "answer", "sources", "quotes", "image"]) {
    expect(failing.has(id), `${id} should fail on an empty draft`).toBe(true)
  }
  // Every failing check explains its fix.
  for (const check of result.checks) {
    if (!check.pass) expect(check.advice.length, check.id).toBeGreaterThan(20)
  }
})

it("keeps the keyword check honest", () => {
  const missing = auditBlog({ ...STRONG_POST, keywords: ["reporting financier"] })
  const keywordCheck = missing.checks.find((check) => check.id === "keyword")!
  expect(keywordCheck.pass).toBe(false)
})

/* ------------------------- the public blog page --------------------------- */

const POSTS: PublicBlogPost[] = [
  {
    id: "p1", locale: "fr", category: "tips", title: "Trois réflexes de trésorerie", slug: "trois-reflexes-tresorerie",
    content: "Contenu", excerpt: "Résumé", seo_title: "Trois réflexes de trésorerie | Fatorati", seo_description: "Résumé",
    keywords: ["trésorerie"], author_name: "Fatorati", published_at: "2026-10-01", updated_at: "2026-10-01", canonical_slug_fr: "trois-reflexes-tresorerie", translations: {},
  },
  {
    id: "p2", locale: "fr", category: "guides", title: "Guide TVA pas à pas", slug: "guide-tva-pas-a-pas",
    content: "Contenu", excerpt: "Résumé", seo_title: "Guide TVA pas à pas | Fatorati", seo_description: "Résumé",
    keywords: ["TVA"], author_name: "Fatorati", published_at: "2026-10-02", updated_at: "2026-10-02", canonical_slug_fr: "guide-tva-pas-a-pas", translations: {},
  },
]

it("shows the section sidebar with counts on /blog and filters on /blog/tips", async () => {
  window.history.replaceState({}, "", "/blog")
  const all = render(<Landing initialPage="blog" initialBlogPosts={POSTS} />)
  expect(all.container.querySelector("aside")).not.toBeNull()
  expect(screen.getByRole("navigation", { name: "Sections" }).textContent).toContain("Conseils")
  expect(screen.getByRole("navigation", { name: "Sections" }).textContent).toContain("Guides")
  expect(screen.getByText("Trois réflexes de trésorerie")).toBeTruthy()
  expect(screen.getByText("Guide TVA pas à pas")).toBeTruthy()
  cleanup()

  window.history.replaceState({}, "", "/blog/tips")
  const tips = render(<Landing initialBlogPosts={POSTS} />)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://fatorati.tech/blog/tips")
  expect(screen.getByText("Trois réflexes de trésorerie")).toBeTruthy()
  expect(screen.queryByText("Guide TVA pas à pas")).toBeNull()
  cleanup()

  window.history.replaceState({}, "", "/ar/blog/tips")
  const arabic = render(<Landing initialBlogPosts={POSTS} />)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://fatorati.tech/ar/blog/tips")
  expect(screen.getByRole("navigation", { name: "الأقسام" }).textContent).toContain(BLOG_CATEGORY_LABELS.tips.ar)
})
