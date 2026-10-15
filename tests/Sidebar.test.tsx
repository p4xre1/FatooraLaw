import { readFileSync, readdirSync } from "node:fs"
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
  "dashboard", "projects", "contacts", "procurement", "inventory", "delivery", "verification", "calendar",
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

/** Every source file under `src/`, so a token's reach can be asserted. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
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
    modulePath("projects"), modulePath("inventory"), modulePath("delivery"), modulePath("verification"), modulePath("reports"),
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
  for (const key of ["dashboard", "contacts", "procurement", "calendar", "projects", "inventory", "delivery", "verification", "reports"] as ModuleKey[]) {
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

it("shows no local-data notice in the footer, permitted or not", () => {
  renderSidebar({ allowed: perms(["dashboard"]) })
  expect(screen.queryByText("Données stockées sur cet appareil.")).toBeNull()
  expect(screen.queryByRole("button", { name: "Exporter une sauvegarde" })).toBeNull()
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

  // No primary/quick-actions button anywhere in the rail (the owner
  // asked for it gone); the collapsed rail is brought back by its named
  // expand control.
  expect(within(aside).queryByRole("button", { name: "Actions rapides" })).toBeNull()
  expect(within(aside).getByRole("button", { name: "Déployer le menu" })).not.toBeNull()
  // The local-data notice that used to sit pinned in this footer is gone.
  expect(within(aside).queryByRole("button", { name: /Données stockées sur cet appareil/ })).toBeNull()
})

it("collapses and expands the rail through a named, stateful toggle", () => {
  const setCollapsed = vi.fn()
  renderSidebar({ setCollapsed, collapsed: false })
  const toggle = screen.getByRole("button", { name: "Masquer le menu" })
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
})

/* ------------------------------ local data ------------------------------ */

it("carries no local-data notice or export shortcut in the footer", () => {
  renderSidebar()
  expect(screen.queryByText("Données stockées sur cet appareil.")).toBeNull()
  expect(screen.queryByRole("button", { name: "Exporter une sauvegarde" })).toBeNull()
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

it("closes the account popover on Escape", () => {
  renderSidebar()
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

/* --------------------------- quick actions & the ✕ --------------------------- */

it("has no quick-actions button or menu in the rail", () => {
  renderSidebar()
  expect(screen.queryByRole("button", { name: "Actions rapides" })).toBeNull()
  expect(document.getElementById("sidebar-quick-actions")).toBeNull()
})

it("hides the rail from the ✕: the drawer closes and the rail folds", () => {
  const setCollapsed = vi.fn()
  const setMobileOpen = vi.fn()
  renderSidebar({ setCollapsed, setMobileOpen, collapsed: false, mobileOpen: true })

  const hide = screen.getByRole("button", { name: "Masquer le menu" })
  fireEvent.click(hide)
  expect(setMobileOpen).toHaveBeenCalledWith(false)
  expect(setCollapsed).toHaveBeenCalledWith(true)
})

/* --------------------------- colour contract ---------------------------- */

it("takes every colour from the left menu's own tokens", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/Sidebar.tsx"), "utf8")

  // No literal colour anywhere in the component: the palette lives in
  // `src/index.css` as the `--color-sidebar-*` tokens, which is what lets the
  // menu be restyled (white rail, Fatorati blue) without editing this file.
  expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  expect(source).not.toMatch(/\brgba?\(/)

  // Width/position utilities share the colour prefixes but name no colour.
  const notColour = /^(?:border-[tbles](?:-\d)?|ring-\d|ring-inset|text-(?:start|end|center))$/
  const used = [...source.matchAll(/\b(?:bg|text|border|ring|decoration|placeholder:text|from|via|to|fill|stroke|shadow)-[a-z0-9]+(?:-[a-z0-9]+)*(?:\/\d+)?/g)]
    .map((match) => match[0])
    .filter((token) => !notColour.test(token))

  // Everything the rail paints with is either one of the menu's own `sidebar-*`
  // tokens, white (text on the blue row), or the scrim behind the mobile drawer.
  const allowed = (token: string) =>
    /^(?:bg|text|border|ring|decoration|placeholder:text)-sidebar(?:-[a-z]+)*(?:\/\d+)?$/.test(token) ||
    ["text-white", "bg-navy/50"].includes(token)
  expect(used.filter((token) => !token.startsWith("shadow-") && !allowed(token))).toEqual([])

  // No gradients. The only shadows are the two the rail legitimately owns: the
  // selected row and the popovers that float above it.
  expect(source).not.toMatch(/bg-gradient|from-|via-|to-\[/)
  expect(new Set(used.filter((token) => token.startsWith("shadow-")))).toEqual(new Set(["shadow-sm", "shadow-lg"]))
})

it("sizes the whole menu from one scale", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/Sidebar.tsx"), "utf8")

  // One row geometry: 44 px touch target below `lg`, 40 px on desktop, a single
  // 14 px label size, 12 px gaps, 10 px radius.
  const item = source.match(/const ITEM = "([^"]+)"/)?.[1] ?? ""
  expect(item).toContain("h-11 lg:h-10")
  expect(item).toContain("gap-3")
  expect(item).toContain("text-[14px]")
  expect(item).toContain("rounded-[10px]")

  // Popover rows are the one deliberate step down.
  const row = source.match(/const POPOVER_ITEM = "([^"]+)"/)?.[1] ?? ""
  expect(row).toContain("h-9")
  expect(row).toContain("text-[13px]")

  // Every row icon is 18 px at one stroke weight — no row picks its own.
  expect(source).toMatch(/<item\.icon className="h-\[18px\] w-\[18px\] shrink-0"/)
  expect(source).not.toMatch(/strokeWidth=/)
})

it("styles the rail from the brand palette, and keeps that palette to the rail", () => {
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8")
  // White rail, the brand's own blue for the selected row, the mark's fold blue
  // for hover and small blue text (see `BRAND_BLUE`/`BRAND_NAVY` in
  // scripts/brand-assets.py), and the hairlines the menu is drawn with.
  expect(css).toMatch(/--color-sidebar:\s*#ffffff/)
  expect(css).toMatch(/--color-sidebar-active:\s*#3a88ea/)
  expect(css).toMatch(/--color-sidebar-active-deep:\s*#2b68bf/)
  expect(css).toMatch(/--color-sidebar-line:\s*#e5e8ee/)

  // The menu was restyled on its own: no other file may consume these tokens,
  // or the rail stops being re-themable without dragging the dashboard along.
  const root = resolve(process.cwd(), "src")
  for (const file of walk(root)) {
    if (file.endsWith("Sidebar.tsx") || file.endsWith("index.css")) continue
    expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(?:bg|text|border|ring|decoration)-sidebar(?:-[a-z]+)?\b/)
  }
})

/* ------------------------------ plan locks ------------------------------ */

import { usePlan } from "../src/store/usePlan"
import { codeFor } from "../src/lib/planCodes"

/**
 * The plan is a second filter on top of the role's `allowed` map: a locked row
 * stays visible (that is the upsell) but announces the plan that opens it.
 * These run on a signed-out plan store, which is FREE — see plans.ts.
 */

async function activate(plan: "pro" | "boost") {
  usePlan.getState().forAccount("user-1")
  await usePlan.getState().redeem(await codeFor(plan, "1Y"))
}

it("keeps locked modules visible on FREE, with the plan named in the tooltip", async () => {
  usePlan.getState().forAccount("user-1")
  renderSidebar()

  // FREE modules are untouched: no lock hint on the rows it includes —
  // Achats & Dépenses among them since it joined FREE.
  expect(screen.getByRole("link", { name: "Clients & Fournisseurs" }).getAttribute("title")).toBeNull()
  expect(screen.getByRole("link", { name: "Projets" }).getAttribute("title")).toBeNull()
  expect(screen.getByRole("link", { name: "Rapports & Fiscalité" }).getAttribute("title")).toBeNull()
  expect(screen.getByRole("link", { name: "Achats & Dépenses" }).getAttribute("title")).toBeNull()

  // A PRO module says PRO; the row still links to its own page, where the
  // lock screen replaces the module.
  const calendar = screen.getByRole("link", { name: "Calendrier" })
  expect(calendar.getAttribute("href")).toBe(modulePath("calendar"))
  expect(calendar.getAttribute("title")).toContain("PRO")

  // The advanced group names BOOST, not PRO.
  fireEvent.click(screen.getByRole("button", { name: /Plus d'outils/ }))
  expect(screen.getByRole("link", { name: "Gestion des Risques" }).getAttribute("title")).toContain("BOOST")
})

it("unlocks in step with the plan: PRO opens the middle, BOOST opens the rest", async () => {
  await activate("pro")
  renderSidebar()
  expect(screen.getByRole("link", { name: "Calendrier" }).getAttribute("title")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /Plus d'outils/ }))
  expect(screen.getByRole("link", { name: "Coffre juridique" }).getAttribute("title")).toContain("BOOST")
})

it("leaves nothing locked on BOOST", async () => {
  await activate("boost")
  const { nav } = renderSidebar()
  fireEvent.click(screen.getByRole("button", { name: /Plus d'outils/ }))
  for (const link of within(nav).getAllByRole("link")) {
    expect(link.getAttribute("title") ?? "").not.toMatch(/PRO|BOOST/)
  }
})

it("still navigates from a locked row — the lock screen is the destination, not a dead end", () => {
  usePlan.getState().forAccount("user-1")
  const onNavigate = vi.fn()
  renderSidebar({ onNavigate })
  fireEvent.click(screen.getByRole("link", { name: "Calendrier" }))
  expect(onNavigate).toHaveBeenCalledWith("calendar")
})
