import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import Landing from "../src/marketing/Landing"

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  localStorage.clear()
  document.getElementById("ld-content")?.remove()
  document.getElementById("fatorati-google-analytics")?.remove()
  delete window.gtag
  delete window.dataLayer
})

it("shows every existing content section on the homepage without the removed tagline", () => {
  const view = render(<Landing onEnter={() => {}} />)
  for (const id of ["hero", "features", "assistant", "about", "benefits", "pricing", "blog", "faq", "contact", "privacy", "terms", "cookies"]) {
    expect(view.container.querySelectorAll(`[id="${id}"]`), `missing or duplicate ${id}`).toHaveLength(1)
  }
  expect(screen.queryByText("Pensé pour les artisans, freelances & TPE marocaines")).toBeNull()
  expect(view.container.querySelector("footer")).not.toBeNull()
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

it("uses section anchors on desktop and mobile, and keeps the header outside the hero wrapper", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const header = view.container.querySelector("header")!
  expect(header.parentElement?.classList.contains("landing-root")).toBe(true)
  const desktop = header.querySelector("nav")!
  expect(within(desktop).getByRole("link", { name: "Fonctionnalités" }).getAttribute("href")).toBe("#features")
  expect(within(desktop).getByRole("link", { name: "Tarifs" }).getAttribute("href")).toBe("#pricing")
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }))
  const mobile = screen.getByRole("navigation", { name: "Navigation principale" })
  const link = within(mobile).getByRole("link", { name: "Fonctionnalités" })
  expect(link.getAttribute("href")).toBe("#features")
  fireEvent.click(link)
  expect(screen.queryByRole("navigation", { name: "Navigation principale" })).toBeNull()
})

it("keeps standalone pages working and links them back to homepage sections", () => {
  window.history.replaceState({}, "", "/pricing/")
  const view = render(<Landing onEnter={() => {}} />)
  expect(view.container.querySelector("#pricing")).not.toBeNull()
  expect(view.container.querySelector("#hero")).toBeNull()
  const header = view.container.querySelector("header")!
  expect(within(header).getByRole("link", { name: "Fonctionnalités" }).getAttribute("href")).toBe("/#features")
})

it("lets visitors explore the features without opening login, while sign-up still opens login", () => {
  const enter = vi.fn()
  render(<Landing onEnter={enter} />)
  expect(screen.getByRole("link", { name: "Explorer" }).getAttribute("href")).toBe("#features")
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

it("renders homepage hash targets before scrolling to a bookmarked section", () => {
  window.history.replaceState({}, "", "/#pricing")
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll })
  try {
    render(<Landing onEnter={() => {}} />)
    expect(scroll).toHaveBeenCalled()
    const target = scroll.mock.contexts[0] as HTMLElement
    expect(target.id).toBe("pricing")
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original)
    else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  }
})
