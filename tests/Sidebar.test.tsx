import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import Sidebar from "../src/components/Sidebar"
import { useMizan } from "../src/store/useMizan"
import { perms } from "../src/store/seed"
import type { ModuleKey } from "../src/store/types"
import { modulePath } from "../src/lib/routes"
import { LANGUAGE_STORAGE_KEY, useLanguageStore } from "../src/lib/language/store"

/**
 * The left rail's contract. `App.test.tsx` mocks this component out, so before
 * this file the sidebar had no coverage at all — and it is the one component
 * where a silent regression (a module disappearing for a role, a lost
 * `aria-current`, an untranslated label) is both invisible in the build and
 * immediately visible to a user.
 */

const ALL = perms([
  "dashboard", "projects", "contacts", "procurement", "inventory", "calendar",
  "risk", "tools", "legal", "reports", "team", "audit", "settings",
])

type Props = {
  active: ModuleKey
  onNavigate: (m: ModuleKey) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  allowed: Record<ModuleKey, boolean>
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  onLogout: () => void
}

function renderSidebar(overrides: Partial<Props> = {}) {
  const props: Props = {
    active: "dashboard",
    onNavigate: vi.fn(),
    collapsed: false,
    setCollapsed: vi.fn(),
    allowed: ALL,
    mobileOpen: true,
    setMobileOpen: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  }
  const view = render(<Sidebar {...props} />)
  return {
    ...view,
    props,
    aside: view.container.querySelector("aside")!,
    nav: view.container.querySelector("nav")!,
    footer: view.container.querySelector("aside > div:last-child")!,
  }
}

/** The hrefs of every module row in the scrollable nav, in DOM order. */
function navHrefs(nav: HTMLElement) {
  return within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))
}

beforeEach(() => {
  window.history.replaceState({}, "", "/dashboard")
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "user-1")
})

/* ------------------------------- structure ------------------------------ */

it("groups the rail into 'Au quotidien' then 'Gestion', with 'Plus d'outils' collapsed", () => {
  const { nav } = renderSidebar()

  const labels = within(nav).getAllByText(/^(Au quotidien|Gestion|Plus d'outils)$/)
    .map((node) => node.textContent)
  expect(labels).toEqual(["Au quotidien", "Gestion", "Plus d'outils"])

  expect(navHrefs(nav)).toEqual([
    modulePath("dashboard"), modulePath("contacts"),
    modulePath("procurement"), modulePath("calendar"),
    modulePath("projects"), modulePath("inventory"), modulePath("reports"),
  ])

  // Collapsed by default: the three tools are not in the document at all.
  expect(screen.queryByRole("link", { name: "Gestion des Risques" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Coffre juridique" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Abonnements & Outils" })).toBeNull()

  const more = screen.getByRole("button", { name: /Plus d'outils/ })
  expect(more.getAttribute("aria-expanded")).toBe("false")
  expect(more.getAttribute("aria-controls")).toBe("sidebar-more-tools")
  expect(more.textContent).toContain("3")
})

it("expands 'Plus d'outils' on click and exposes the three tools", () => {
  const { nav } = renderSidebar()
  fireEvent.click(screen.getByRole("button", { name: /Plus d'outils/ }))

  expect(screen.getByRole("button", { name: /Plus d'outils/ }).getAttribute("aria-expanded")).toBe("true")
  const panel = document.getElementById("sidebar-more-tools")!
  expect(within(panel).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
    modulePath("risk"), modulePath("legal"), modulePath("tools"),
  ])
  // The rest of the rail is untouched by the expansion.
  const hrefs = navHrefs(nav)
  for (const key of ["dashboard", "contacts", "procurement", "calendar", "projects", "inventory", "reports"] as ModuleKey[]) {
    expect(hrefs).toContain(modulePath(key))
  }
})

it("auto-expands 'Plus d'outils' when the active route lives inside it", () => {
  const { rerender } = renderSidebar({ active: "dashboard" })
  expect(screen.queryByRole("link", { name: "Coffre juridique" })).toBeNull()

  rerender(<Sidebar active="legal" onNavigate={vi.fn()} collapsed={false} setCollapsed={vi.fn()} allowed={ALL} mobileOpen setMobileOpen={vi.fn()} onLogout={vi.fn()} />)
  const legal = screen.getByRole("link", { name: "Coffre juridique" })
  expect(legal.getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("button", { name: /Plus d'outils/ }).getAttribute("aria-expanded")).toBe("true")
})

it("lets the visitor collapse the auto-expanded group again and keeps it collapsed", () => {
  renderSidebar({ active: "legal" })
  const toggle = screen.getByRole("button", { name: /Plus d'outils/ })
  expect(toggle.getAttribute("aria-expanded")).toBe("true")

  fireEvent.click(toggle)
  expect(screen.getByRole("button", { name: /Plus d'outils/ }).getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByRole("link", { name: "Coffre juridique" })).toBeNull()
})

it("remembers the 'Plus d'outils' state across mounts", () => {
  const first = renderSidebar()
  fireEvent.click(screen.getByRole("button", { name: /Plus d'outils/ }))
  expect(localStorage.getItem("mizan.sidebar.more")).toBe("open")
  first.unmount()

  renderSidebar({ active: "dashboard" })
  expect(screen.getByRole("button", { name: /Plus d'outils/ }).getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByRole("link", { name: "Gestion des Risques" })).not.toBeNull()
})

/* ------------------------------ permissions ----------------------------- */

it("hides every module the account is not allowed to open", () => {
  const allowed = perms(["dashboard", "contacts"])
  const { nav } = renderSidebar({ allowed })

  expect(navHrefs(nav)).toEqual([modulePath("dashboard"), modulePath("contacts")])
  // The whole 'Plus d'outils' row disappears rather than showing an empty group.
  expect(screen.queryByRole("button", { name: /Plus d'outils/ })).toBeNull()
  // Pinned footer: no Paramètres row, and no export link.
  expect(screen.queryByRole("link", { name: "Paramètres" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Exporter une sauvegarde" })).toBeNull()
})

it("keeps the local-data notice readable when Paramètres is not permitted", () => {
  renderSidebar({ allowed: perms(["dashboard"]) })
  expect(screen.getByText("Données stockées sur cet appareil.")).not.toBeNull()
})

it("offers only the permitted administration modules in the account popover", () => {
  renderSidebar({ allowed: perms(["dashboard", "audit"]) })
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))

  const menu = document.getElementById("sidebar-account-menu")!
  expect(within(menu).getByRole("button", { name: "Journal d'audit" })).not.toBeNull()
  expect(within(menu).queryByRole("button", { name: "Équipe & Rôles" })).toBeNull()
  // Sign-out and the language switch are never permission-gated.
  expect(within(menu).getByRole("button", { name: "Se déconnecter" })).not.toBeNull()
  expect(within(menu).getByRole("button", { name: "AR" })).not.toBeNull()
})

/* --------------------------- active route + a11y -------------------------- */

it("marks exactly one row aria-current and points it at the real module path", () => {
  const { nav } = renderSidebar({ active: "reports" })
  const current = within(nav).getAllByRole("link").filter((l) => l.hasAttribute("aria-current"))
  expect(current).toHaveLength(1)
  expect(current[0].getAttribute("aria-current")).toBe("page")
  expect(current[0].getAttribute("href")).toBe("/reports")
  expect(current[0].textContent).toContain("Rapports & Fiscalité")
})

it("routes through onNavigate and closes the mobile drawer", () => {
  const onNavigate = vi.fn()
  const setMobileOpen = vi.fn()
  renderSidebar({ onNavigate, setMobileOpen, active: "dashboard" })

  fireEvent.click(screen.getByRole("link", { name: "Clients & Fournisseurs" }))
  expect(onNavigate).toHaveBeenCalledWith("contacts")
  expect(setMobileOpen).toHaveBeenCalledWith(false)
})

it("gives every collapsed-rail control an accessible name and hides the group labels", () => {
  const { nav, aside } = renderSidebar({ collapsed: true })

  // Icon-only: no label text anywhere in the nav.
  expect(nav.textContent?.trim()).toBe("")
  expect(within(nav).queryByText("Au quotidien")).toBeNull()

  // Every row is still named, and named identically to the expanded rail.
  for (const name of ["Tableau de bord", "Clients & Fournisseurs", "Achats & Dépenses", "Calendrier", "Projets", "Stock & Matériel", "Rapports & Fiscalité", "Gestion des Risques", "Coffre juridique", "Abonnements & Outils"]) {
    expect(within(nav).getByRole("link", { name }).getAttribute("title")).toBe(name)
  }

  // The primary action degrades to a '+' icon button. It no longer opens a
  // menu, so it is named after the action it performs, not "Actions rapides".
  expect(within(aside).getByRole("button", { name: "Nouveau projet" })).not.toBeNull()
  // So does the pinned export shortcut.
  expect(within(aside).getByRole("button", { name: /Données stockées sur cet appareil/ })).not.toBeNull()
})

it("collapses and expands the rail through a named, stateful toggle", () => {
  const setCollapsed = vi.fn()
  renderSidebar({ setCollapsed, collapsed: false })
  const toggle = screen.getByRole("button", { name: "Réduire le menu" })
  expect(toggle.getAttribute("aria-expanded")).toBe("true")
  fireEvent.click(toggle)
  expect(setCollapsed).toHaveBeenCalledWith(true)
})

/* -------------------------------- search -------------------------------- */

it("filters the rail by search and reveals a match hidden in the collapsed group", () => {
  const { nav } = renderSidebar()
  fireEvent.change(screen.getByLabelText("Rechercher un module"), { target: { value: "juridique" } })

  expect(navHrefs(nav)).toEqual([modulePath("legal")])
  // Searching implies intent: the group opens itself so the match is reachable.
  expect(screen.getByRole("button", { name: /Plus d'outils/ }).getAttribute("aria-expanded")).toBe("true")
})

it("keeps every language's label searchable, not just the one on screen", () => {
  renderSidebar()
  act(() => useLanguageStore.getState().setLanguage("en"))
  // "Matériel" is in the French name only — the rail is now showing
  // "Stock & Equipment". Matching just the visible label would make the search
  // feel broken to anyone who thinks in the other language.
  fireEvent.change(screen.getByLabelText("Search a module"), { target: { value: "Matériel" } })
  expect(screen.getByRole("link", { name: "Stock & Equipment" })).not.toBeNull()
})

it("says so when nothing matches, and keeps the pinned footer usable", () => {
  renderSidebar()
  fireEvent.change(screen.getByLabelText("Rechercher un module"), { target: { value: "zzz" } })

  expect(screen.getByText("Aucun module ne correspond.")).not.toBeNull()
  // The footer is pinned, not part of the searchable rail: Paramètres and the
  // account block must survive a query that matches nothing.
  expect(screen.getByRole("link", { name: "Paramètres" })).not.toBeNull()
  expect(screen.getByRole("button", { name: "Menu du compte" })).not.toBeNull()
  expect(screen.getByRole("button", { name: "Exporter une sauvegarde" })).not.toBeNull()
})

/* ------------------------------ local data ------------------------------ */

it("links the local-data notice to the existing export action in Paramètres", () => {
  const onNavigate = vi.fn()
  renderSidebar({ onNavigate })
  fireEvent.click(screen.getByRole("button", { name: "Exporter une sauvegarde" }))
  expect(onNavigate).toHaveBeenCalledWith("settings")
})

/* ------------------------------- account -------------------------------- */

it("opens the account popover with team, audit, language switch and sign-out", () => {
  renderSidebar()
  const trigger = screen.getByRole("button", { name: "Menu du compte" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(trigger.textContent).toContain("Karim Benjelloun")
  expect(trigger.textContent).toContain("karim@atlas.ma")

  fireEvent.click(trigger)
  expect(screen.getByRole("button", { name: "Menu du compte" }).getAttribute("aria-expanded")).toBe("true")

  const menu = document.getElementById("sidebar-account-menu")!
  expect(within(menu).getByRole("button", { name: "Équipe & Rôles" })).not.toBeNull()
  expect(within(menu).getByRole("button", { name: "Journal d'audit" })).not.toBeNull()
  expect(within(menu).getByRole("button", { name: "FR" }).getAttribute("aria-pressed")).toBe("true")
  expect(within(menu).getByRole("button", { name: "EN" }).getAttribute("aria-pressed")).toBe("false")
  expect(within(menu).getByRole("button", { name: "Se déconnecter" })).not.toBeNull()
})

it("navigates from the account popover and closes it", () => {
  const onNavigate = vi.fn()
  renderSidebar({ onNavigate })
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  fireEvent.click(within(document.getElementById("sidebar-account-menu")!).getByRole("button", { name: "Équipe & Rôles" }))

  expect(onNavigate).toHaveBeenCalledWith("team")
  expect(document.getElementById("sidebar-account-menu")).toBeNull()
})

it("closes both popovers on Escape", () => {
  renderSidebar()
  fireEvent.click(screen.getByRole("button", { name: "Actions rapides" }))
  expect(document.getElementById("sidebar-quick-actions")).not.toBeNull()
  fireEvent.keyDown(document, { key: "Escape" })
  expect(document.getElementById("sidebar-quick-actions")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  expect(document.getElementById("sidebar-account-menu")).not.toBeNull()
  fireEvent.keyDown(document, { key: "Escape" })
  expect(document.getElementById("sidebar-account-menu")).toBeNull()
})

it("signs out through the shell's callback rather than a path of its own", () => {
  const onLogout = vi.fn()
  renderSidebar({ onLogout })
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  fireEvent.click(within(document.getElementById("sidebar-account-menu")!).getByRole("button", { name: "Se déconnecter" }))
  expect(onLogout).toHaveBeenCalledOnce()
})

/* --------------------------------- i18n --------------------------------- */

it("switches to English, keeping the same modules and the same active row", () => {
  renderSidebar({ active: "reports" })
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  fireEvent.click(within(document.getElementById("sidebar-account-menu")!).getByRole("button", { name: "EN" }))

  expect(screen.getByRole("link", { name: "Reports & Tax" }).getAttribute("aria-current")).toBe("page")
  expect(screen.queryByRole("link", { name: "Rapports & Fiscalité" })).toBeNull()
  expect(screen.getByText("Day to day")).not.toBeNull()
  expect(screen.getByText("Management")).not.toBeNull()
  expect(screen.getByLabelText("Search a module")).not.toBeNull()
  // One preference for the whole app now, not a sidebar-private key that had to
  // be mirrored into the dashboard's by hand.
  expect(useLanguageStore.getState().language).toBe("en")
  expect(JSON.parse(localStorage.getItem(LANGUAGE_STORAGE_KEY)!).state.language).toBe("en")
  expect(localStorage.getItem("mizan.sidebar.lang")).toBeNull()
})

it("switches to Arabic, mirroring the rail and the whole document to RTL", () => {
  const { aside } = renderSidebar()
  expect(aside.getAttribute("dir")).toBe("ltr")
  expect(aside.getAttribute("lang")).toBe("fr")

  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  fireEvent.click(within(document.getElementById("sidebar-account-menu")!).getByRole("button", { name: "AR" }))

  expect(aside.getAttribute("dir")).toBe("rtl")
  expect(aside.getAttribute("lang")).toBe("ar")
  expect(screen.getByRole("link", { name: "لوحة التحكم" }).getAttribute("href")).toBe("/dashboard")
  expect(screen.getByText("يومياً")).not.toBeNull()
  expect(screen.getByLabelText("ابحث عن وحدة")).not.toBeNull()
  expect(useLanguageStore.getState().language).toBe("ar")
  // useTranslation() writes to <html>, so the page — not just the rail — flips.
  expect(document.documentElement.getAttribute("dir")).toBe("rtl")
  expect(document.documentElement.getAttribute("lang")).toBe("ar")
})

it("restores the chosen language on the next mount", async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { language: "en" }, version: 1 }))
  await useLanguageStore.persist.rehydrate()
  renderSidebar()
  expect(screen.getByText("Day to day")).not.toBeNull()
  expect(screen.queryByText("Au quotidien")).toBeNull()
})

it("falls back to French for a language value it does not publish", () => {
  // setLanguage validates, so bypass it: this covers a value that reached the
  // store some other way, e.g. a hand-edited or truncated payload.
  act(() => useLanguageStore.setState({ language: "de" as never }))
  renderSidebar()
  expect(screen.getByText("Au quotidien")).not.toBeNull()
})

/* --------------------------- quick actions ------------------------------ */

it("offers the three existing quick actions while no /invoices route exists", () => {
  const onNavigate = vi.fn()
  renderSidebar({ onNavigate })
  fireEvent.click(screen.getByRole("button", { name: "Actions rapides" }))

  const menu = document.getElementById("sidebar-quick-actions")!
  fireEvent.click(within(menu).getByRole("button", { name: "Nouvelle dépense" }))
  expect(onNavigate).toHaveBeenCalledWith("procurement")
})

it("drops quick actions the account cannot open", () => {
  renderSidebar({ allowed: perms(["dashboard", "projects"]) })
  fireEvent.click(screen.getByRole("button", { name: "Actions rapides" }))
  const menu = document.getElementById("sidebar-quick-actions")!
  expect(within(menu).getByRole("button", { name: "Nouveau projet" })).not.toBeNull()
  expect(within(menu).queryByRole("button", { name: "Nouvelle dépense" })).toBeNull()
  expect(within(menu).queryByRole("button", { name: "Générer un contrat" })).toBeNull()
})

/* --------------------------- colour contract ---------------------------- */

it("introduces no colour of its own: every token it names was already in the dark sidebar", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/Sidebar.tsx"), "utf8")

  // No literal colour anywhere in the component.
  expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  expect(source).not.toMatch(/\brgba?\(/)

  // Every colour-bearing utility must resolve to one of the tokens the sidebar
  // already used before the redesign (plus `brand`/`navy`/`white`, also already
  // present). Anything outside this list is a colour change.
  const allowed = new Set([
    "bg-sidebar", "bg-sidebar-hover", "bg-sidebar-active", "bg-brand", "bg-navy/50",
    "text-sidebar-ink", "text-sidebar-faint", "text-white",
    "border-sidebar-hover", "placeholder:text-sidebar-faint", "decoration-sidebar-faint",
    "ring-brand",
  ])
  const used = new Set(
    [...source.matchAll(/\b(?:bg|text|border|ring|decoration|from|via|to|fill|stroke|shadow|placeholder:text)-[a-z0-9]+(?:-[a-z0-9]+)*(?:\/\d+)?/g)]
      .map((match) => match[0])
      // Width/position/alignment utilities share these prefixes but name no colour.
      .filter((token) => !["border-t", "border-b", "ring-1", "ring-2", "ring-inset", "text-start", "text-end", "text-center", "shadow-sm"].includes(token)),
  )
  expect([...used].filter((token) => !allowed.has(token))).toEqual([])

  // No gradients, and the only shadow is the pre-existing one on the active row.
  expect(source).not.toMatch(/bg-gradient|from-|via-|to-\[/)
  expect(source.match(/shadow-(?!sm)\w+/g) ?? []).toEqual([])
})
