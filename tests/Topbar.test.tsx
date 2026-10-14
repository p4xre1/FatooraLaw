import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import Topbar from "../src/components/Topbar"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan } from "../src/store/useMizan"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Karim Benjelloun", "karim@example.ma", "owner", "topbar-i18n")
})

it("localises quick actions, profile navigation and sign-out in French", () => {
  const onNavigate = vi.fn()
  const onLogout = vi.fn()
  render(<Topbar title="Tableau de bord" onMenu={vi.fn()} onNavigate={onNavigate} onLogout={onLogout} />)

  const quick = screen.getByRole("button", { name: "Actions rapides" })
  expect(quick.getAttribute("aria-expanded")).toBe("false")
  fireEvent.click(quick)
  expect(screen.getByRole("menu", { name: "Actions rapides" })).toBeDefined()
  fireEvent.click(screen.getByRole("menuitem", { name: "Nouvelle dépense" }))
  expect(onNavigate).toHaveBeenCalledWith("procurement")

  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  const account = screen.getByRole("menu", { name: "Menu du compte" })
  expect(within(account).getByText("Propriétaire").textContent).not.toBe("")
  fireEvent.click(within(account).getByRole("menuitem", { name: "Profil & entreprise" }))
  expect(onNavigate).toHaveBeenCalledWith("settings")
  fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }))
  fireEvent.click(screen.getByRole("menuitem", { name: "Déconnexion" }))
  expect(onLogout).toHaveBeenCalledOnce()
})

it("uses English labels for the application header menus", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  const onNavigate = vi.fn()
  render(<Topbar title="Dashboard" onMenu={vi.fn()} onNavigate={onNavigate} onLogout={vi.fn()} />)

  fireEvent.click(screen.getByRole("button", { name: "Quick actions" }))
  fireEvent.click(screen.getByRole("menuitem", { name: "Generate a contract" }))
  expect(onNavigate).toHaveBeenCalledWith("legal")
  fireEvent.click(screen.getByRole("button", { name: "Account menu" }))
  expect(screen.getByRole("menuitem", { name: "Profile & company" })).toBeDefined()
  expect(screen.getByText("Owner")).toBeDefined()
})

it("uses Arabic labels and preserves the RTL language on the whole document", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Topbar title="لوحة التحكم" onMenu={vi.fn()} onNavigate={vi.fn()} onLogout={vi.fn()} />)

  expect(screen.getByRole("heading", { name: "لوحة التحكم" })).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "إجراءات سريعة" }))
  expect(screen.getByRole("menuitem", { name: "مشروع جديد" })).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "قائمة الحساب" }))
  expect(screen.getByRole("menuitem", { name: "الملف الشخصي والشركة" })).toBeDefined()
  expect(screen.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
