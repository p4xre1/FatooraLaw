import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import App from "../src/App"
import { useMizan } from "../src/store/useMizan"
import { defaultSettings } from "../src/store/defaults"
import { useLanguageStore } from "../src/lib/language/store"
import { perms } from "../src/store/seed"

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))
vi.mock("../src/hooks/useSupabaseAuth", () => ({ useSupabaseAuth: () => ({ ready: true, recovery: false, clearRecovery: vi.fn(), logout: logoutMock }) }))
vi.mock("../src/hooks/useOnboarding", () => ({ useOnboarding: () => ({ needsOnboarding: false, submitting: false, error: null, submit: vi.fn() }) }))
vi.mock("../src/lib/useIdleLogout", () => ({ useIdleLogout: () => {} }))
vi.mock("../src/components/Sidebar", () => ({
  default: ({ onNavigate, onLogout }: { onNavigate: (module: string) => void; onLogout: () => void }) => (
    <>
      <button onClick={() => onNavigate("settings")}>Open settings</button>
      <button onClick={onLogout}>Sidebar sign out</button>
    </>
  ),
}))
vi.mock("../src/components/Topbar", () => ({ default: () => null }))
vi.mock("../src/components/Auth", () => ({ default: () => null }))
vi.mock("../src/marketing/Landing", () => ({ default: () => null }))
vi.mock("../src/modules/Dashboard", () => ({ default: () => null }))

beforeEach(() => {
  logoutMock.mockClear()
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "draft-a")
})

it("remounts business views on account changes so another account never sees the prior settings draft", async () => {
  useMizan.getState().updateSettings({ company: "A's company" })
  render(<App />)
  fireEvent.click(screen.getByRole("button", { name: "Open settings" }))
  await screen.findByDisplayValue("A's company")
  fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: "A's unsaved private draft" } })
  act(() => useMizan.getState().signIn("B", "b@gmail.com", "owner", "draft-b"))
  await waitFor(() => expect((screen.getByLabelText("Raison sociale") as HTMLInputElement).value).toBe(defaultSettings.company))
  expect(screen.queryByDisplayValue("A's unsaved private draft")).toBeNull()
})

it("routes the sidebar's sign-out through the shell's single logout path", () => {
  render(<App />)
  fireEvent.click(screen.getByRole("button", { name: "Sidebar sign out" }))
  // Sidebar -> App.signOutAndGoHome -> signOut() -> forgetLocalDevSession() +
  // logout(). The mocked logout never clears the session, so the redirect
  // effect still sees a signed-in visitor on "/" and sends it back to a module
  // route; asserting the call is what proves the wiring, not the final path.
  expect(logoutMock).toHaveBeenCalledOnce()
})

it("puts the module name in the page title in whichever language is chosen", async () => {
  render(<App />)
  // The signed-in shell is noindex, so the title is applied by applyNoIndexHead.
  await waitFor(() => expect(document.title).toContain("Tableau de bord"))

  act(() => useLanguageStore.getState().setLanguage("en"))
  await waitFor(() => expect(document.title).toContain("Dashboard"))

  act(() => useLanguageStore.getState().setLanguage("ar"))
  await waitFor(() => expect(document.title).toContain("لوحة التحكم"))
  expect(document.title).not.toContain("Tableau de bord")
})

it("leaves URL-owned lang/dir alone when App renders a marketing route", () => {
  // App also renders public marketing URLs. A preference-driven write from its
  // top-level hook would fight Landing.tsx, which owns <html> lang/dir from the
  // `/ar` URL prefix. The local-save notice is signed-in-only, so sign out here.
  const originalPath = window.location.pathname
  useMizan.getState().signOut()
  window.history.replaceState({}, "", "/ar/pricing")
  document.documentElement.lang = "ar"
  document.documentElement.dir = "rtl"
  render(<App />)
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
  window.history.replaceState({}, "", originalPath)
})


it("localises the no-access screen with the persisted app language", async () => {
  useMizan.getState().signIn("Disabled account", "disabled@example.ma", "assistant", "disabled-i18n")
  useMizan.setState({ team: [{ id: "disabled-member", name: "Disabled account", email: "disabled@example.ma", role: "assistant", active: false, permissions: perms([]) }] })
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<App />)
  await screen.findByText("No access available")
  expect(screen.getByText("This account is inactive or has no modules assigned. Contact your workspace owner.")).toBeDefined()
  expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined()

  act(() => useLanguageStore.getState().setLanguage("ar"))
  await screen.findByText("لا توجد صلاحية للوصول")
  expect(screen.getByRole("button", { name: "تسجيل الخروج" })).toBeDefined()
})
