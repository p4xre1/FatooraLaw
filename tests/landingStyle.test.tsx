import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Landing from "../src/marketing/Landing"

const landingCss = () => readFileSync(resolve(process.cwd(), "src/marketing/landing.css"), "utf8")

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  localStorage.clear()
  document.body.style.overflow = ""
})
afterEach(() => vi.unstubAllGlobals())

it("keeps every language choice inside the screen on phones and tablets", () => {
  const css = landingCss()
  // The drawer's copy is laid out in place — nothing floats, so nothing can be
  // clipped by the panel's `max-height`/`overflow-y`, whatever the screen.
  expect(css).toMatch(/\.landing-lang-inline \{[^}]*display: flex/)
  expect(css).toMatch(/\.landing-drawer-preferences \{[^}]*display: flex/)
  // The bar's dropdown — the one place a floating list is still used, at a
  // width where there is room for it — is capped to the viewport on both axes.
  expect(css).toMatch(/\.landing-lang-menu \{[^}]*max-width: calc\(100vw - 1\.5rem\)/)
  expect(css).toMatch(/\.landing-lang-menu \{[^}]*max-height: min\(19rem, calc\(100dvh - 6rem\)\)/)
  expect(css).toMatch(/\.landing-lang-menu \{[^}]*overflow-y: auto/)
})

it("defaults to the public light design and applies no class to the body or dashboard root", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const root = view.container.querySelector(".landing-root")!
  expect(root.classList.contains("landing-atlas")).toBe(true)
  expect(root.getAttribute("data-theme")).toBe("light")
  expect(document.body.classList.contains("landing-atlas")).toBe(false)
  expect(document.documentElement.classList.contains("landing-atlas")).toBe(false)
  fireEvent.click(screen.getByRole("button", { name: "Basculer le thème" }))
  expect(root.getAttribute("data-theme")).toBe("dark")
})

it("opens an accessible features flyout whose cards link to /features and reach their preview", () => {
  const view = render(<Landing onEnter={() => {}} />)
  const toggle = screen.getByRole("button", { name: "Explorer les fonctionnalités" })
  fireEvent.click(toggle)
  expect(toggle.getAttribute("aria-expanded")).toBe("true")
  const panel = screen.getByRole("region", { name: "Fonctionnalités" })
  const links = within(panel).getAllByRole("link")
  // The previews are sections of /features, not `#anchors`: the link is the
  // page URL and the target is reached without putting a fragment in the URL.
  for (const id of ["calendar-preview", "risk-preview", "tools-preview"]) {
    expect(links.some((link) => link.getAttribute("href") === "/features")).toBe(true)
    expect(view.container.querySelector(`[id="${id}"]`)).not.toBeNull()
  }
  fireEvent.click(within(panel).getByRole("link", { name: /Outil de Calendrier/ }))
  expect(screen.queryByRole("region", { name: "Fonctionnalités" })).toBeNull()
  expect(window.location.hash).toBe("")
})

it("supports ArrowDown to focus the flyout and Escape to restore its toggle", () => {
  render(<Landing onEnter={() => {}} />)
  const toggle = screen.getByRole("button", { name: "Explorer les fonctionnalités" })
  toggle.focus()
  fireEvent.keyDown(toggle, { key: "ArrowDown" })
  const panel = screen.getByRole("region", { name: "Fonctionnalités" })
  expect(document.activeElement).toBe(within(panel).getAllByRole("link")[0])
  fireEvent.keyDown(window, { key: "Escape" })
  expect(screen.queryByRole("region", { name: "Fonctionnalités" })).toBeNull()
  expect(document.activeElement).toBe(toggle)
})

it("closes the flyout on an outside pointer and restores mobile scroll on unmount", () => {
  const view = render(<Landing onEnter={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Explorer les fonctionnalités" }))
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole("region", { name: "Fonctionnalités" })).toBeNull()
  document.body.style.overflow = "scroll"
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }))
  expect(document.body.style.overflow).toBe("hidden")
  view.unmount()
  expect(document.body.style.overflow).toBe("scroll")
})

it("keeps the new sign-in action on the existing auth callback", () => {
  const enter = vi.fn()
  render(<Landing onEnter={enter} />)
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }))
  expect(enter).toHaveBeenCalledOnce()
})

it("respects reduced motion without hiding any content or creating an observer", () => {
  const Observer = vi.fn()
  vi.stubGlobal("IntersectionObserver", Observer)
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const view = render(<Landing onEnter={() => {}} />)
  expect(view.container.querySelector(".landing-root")?.getAttribute("data-motion")).toBe("reduced")
  expect(Observer).not.toHaveBeenCalled()
  expect(document.getElementById("features")).not.toBeNull()
  expect(document.getElementById("contact")).not.toBeNull()
})

it("reveals sections once, then releases all observers on navigation/unmount", () => {
  const instances: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
  class FakeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    constructor(public callback: IntersectionObserverCallback) { instances.push(this) }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver)
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const view = render(<Landing onEnter={() => {}} />)
  const target = document.getElementById("features")!
  expect(target.classList.contains("landing-revealed")).toBe(false)
  expect(instances[0].observe).toHaveBeenCalledWith(target)
  act(() => instances[0].callback([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(target.classList.contains("landing-revealed")).toBe(true)
  expect(instances[0].unobserve).toHaveBeenCalledWith(target)
  view.unmount()
  expect(instances[0].disconnect).toHaveBeenCalled()
})
