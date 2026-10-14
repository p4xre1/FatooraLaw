import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Landing from "../src/marketing/Landing"
import type { PublicSiteCmsData } from "../src/lib/siteCms"

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  localStorage.clear()
  document.getElementById("ld-content")?.remove()
  document.querySelector('link[rel="canonical"]')?.remove()
  document.querySelector('meta[property="og:url"]')?.remove()
  document.getElementById("fatorati-google-analytics")?.remove()
  delete window.gtag
  delete window.dataLayer
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

it("shows every existing content section on the homepage without the removed tagline", () => {
  const view = render(<Landing onEnter={() => {}} />)
  for (const id of ["hero", "features", "assistant", "about", "benefits", "pricing", "blog", "faq", "contact", "privacy", "terms", "cookies"]) {
    expect(view.container.querySelectorAll(`[id="${id}"]`), `missing or duplicate ${id}`).toHaveLength(1)
  }
  expect(screen.queryByText("Pensé pour les artisans, freelances & TPE marocaines")).toBeNull()
  expect(view.container.querySelector("footer")).not.toBeNull()
})

it.each(["Français", "English", "العربية"])("omits the official VAT citations from the homepage hero in %s", (language) => {
  const view = render(<Landing onEnter={() => {}} />)
  if (language !== "Français") {
    fireEvent.click(screen.getByRole("button", { name: "Français" }))
    fireEvent.click(screen.getByRole("option", { name: language }))
  }

  const hero = view.container.querySelector("#hero")!
  expect(hero.querySelector("blockquote, cite, q")).toBeNull()
  expect(hero.querySelector('a[href*="tax.gov.ma"]')).toBeNull()
})

it.each(["Français", "English", "العربية"])("removes the hero badge in %s without removing the headline or content", (language) => {
  const view = render(<Landing onEnter={() => {}} />)
  if (language !== "Français") {
    fireEvent.click(screen.getByRole("button", { name: "Français" }))
    fireEvent.click(screen.getByRole("option", { name: language }))
  }
  const headline = screen.getByRole("heading", { level: 1 })
  expect(headline.previousElementSibling).toBeNull()
  expect(view.container.querySelector("#features")).not.toBeNull()
  expect(view.container.querySelector("#contact")).not.toBeNull()
})

it("gives every public section its own URL on desktop and mobile, and keeps the header outside the hero wrapper", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const header = view.container.querySelector("header")!
  expect(header.parentElement?.classList.contains("landing-root")).toBe(true)
  const desktop = header.querySelector("nav")!
  // No `#` anywhere: each section is a real page a visitor can link to.
  expect(within(desktop).getByRole("link", { name: "Fonctionnalités" }).getAttribute("href")).toBe("/features")
  expect(within(desktop).getByRole("link", { name: "Tarifs" }).getAttribute("href")).toBe("/pricing")
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }))
  const mobile = screen.getByRole("navigation", { name: "Navigation principale" })
  const link = within(mobile).getByRole("link", { name: "Fonctionnalités" })
  expect(link.getAttribute("href")).toBe("/features")
  fireEvent.click(link)
  expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull()
  // Client-side navigation: the URL changed and the features page is mounted.
  expect(window.location.pathname).toBe("/features")
  expect(view.container.querySelector("#features")).not.toBeNull()
})

it("renders one support form on a CMS-managed contact page", () => {
  window.history.replaceState({}, "", "/contact")
  const siteCms: PublicSiteCmsData = {
    path: "/contact", locale: "fr", homepage: null,
    page: { id: "cms-contact", slug: "contact", locale: "fr", title: "Contactez-nous", excerpt: "", body: "Contenu de la page de contact", seo_title: "", seo_description: "", canonical_url: "", noindex: false, published_at: null, updated_at: "2026-10-14T00:00:00Z" },
    seo: null, features: [], announcements: [], releases: [], downloads: [], products: [],
  }
  render(<Landing onEnter={() => {}} initialSiteCmsData={siteCms} />)
  expect(screen.getAllByRole("button", { name: "Envoyer la demande" })).toHaveLength(1)
})

it("keeps standalone pages working and links back to the other public pages", () => {
  window.history.replaceState({}, "", "/pricing")
  const view = render(<Landing onEnter={() => {}} />)
  expect(view.container.querySelector("#pricing")).not.toBeNull()
  expect(view.container.querySelector("#hero")).toBeNull()
  const header = view.container.querySelector("header")!
  expect(within(header).getByRole("link", { name: "Fonctionnalités" }).getAttribute("href")).toBe("/features")
})

it("does not render the GitHub link in the footer", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const footer = view.container.querySelector<HTMLElement>(".landing-footer")!

  expect(within(footer).queryByRole("link", { name: "GitHub" })).toBeNull()
})

it("scrolls to the top when a footer link navigates to another page", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const footer = view.container.querySelector<HTMLElement>(".landing-footer")!

  fireEvent.click(within(footer).getByRole("link", { name: "Tarifs" }))

  expect(window.location.pathname).toBe("/pricing")
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
})

it("lets visitors explore the features without opening login, while sign-up still opens login", () => {
  const enter = vi.fn()
  render(<Landing onEnter={enter} />)
  expect(screen.getByRole("link", { name: "Explorer" }).getAttribute("href")).toBe("/features")
  fireEvent.click(screen.getAllByRole("button", { name: "S'inscrire" })[0])
  expect(enter).toHaveBeenCalledOnce()
})

it("loads no analytics until a consent choice and keeps refusing functional", () => {
  render(<Landing onEnter={() => {}} />)
  expect(document.getElementById("fatorati-google-analytics")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Refuser" }))
  expect(document.getElementById("fatorati-google-analytics")).toBeNull()
  expect(screen.queryByRole("dialog", { name: "En savoir plus" })).toBeNull()
})

it("rewrites a legacy /#pricing bookmark to the real /pricing URL", () => {
  window.history.replaceState({}, "", "/#pricing")
  const view = render(<Landing onEnter={() => {}} />)
  // The fragment is gone from the address bar and the pricing page is mounted.
  expect(window.location.hash).toBe("")
  expect(window.location.pathname).toBe("/pricing")
  expect(view.container.querySelector("#pricing")).not.toBeNull()
})

it("updates the canonical URL and title when a visitor changes page", () => {
  const view = render(<Landing onEnter={() => {}} />)
  expect(document.title).toContain("TPE marocaines")
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://fatorati.tech/")

  fireEvent.click(within(view.container.querySelector("header")!).getByRole("link", { name: "Tarifs" }))

  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://fatorati.tech/pricing")
  expect(document.title).toContain("Tarifs Fatorati")
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://fatorati.tech/pricing")
  expect(document.getElementById("ld-content")?.textContent).toContain("https://fatorati.tech/pricing")
})
