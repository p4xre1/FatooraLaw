import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import App from "../src/App"
import { useMizan } from "../src/store/useMizan"
import { defaultSettings } from "../src/store/defaults"

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
