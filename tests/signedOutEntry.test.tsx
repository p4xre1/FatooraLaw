import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import App from "../src/App"
import { useMizan } from "../src/store/useMizan"

const mock = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseConfigProblem: null,
  supabaseConfigWarning: null,
  supabase: { auth: { signInWithPassword: mock.login } },
}))
vi.mock("../src/hooks/useSupabaseAuth", () => ({ useSupabaseAuth: () => ({ ready: true, recovery: false, clearRecovery: vi.fn(), logout: vi.fn() }) }))
vi.mock("../src/hooks/useOnboarding", () => ({ useOnboarding: () => ({ needsOnboarding: false, submitting: false, error: null, submit: vi.fn() }) }))
vi.mock("../src/lib/useIdleLogout", () => ({ useIdleLogout: () => {} }))

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  useMizan.getState().signOut()
  localStorage.clear()
  mock.login.mockReset().mockResolvedValue({ error: null })
})

it("opens the restored complete landing page, not a forced login page", () => {
  const view = render(<App />)
  expect(view.container.querySelector(".landing-root")).not.toBeNull()
  expect(view.container.querySelector("#features")).not.toBeNull()
  expect(view.container.querySelector("#pricing")).not.toBeNull()
  expect(screen.queryByRole("heading", { name: "Connexion" })).toBeNull()
  expect(screen.queryByText("Pensé pour les artisans, freelances & TPE marocaines")).toBeNull()
})

it("preserves email/password login, Gmail addresses, and return-to-site navigation", async () => {
  render(<App />)
  fireEvent.click(screen.getAllByRole("button", { name: "S'inscrire" })[0])
  expect(screen.getByRole("heading", { name: "Connexion" })).toBeDefined()
  fireEvent.change(screen.getByLabelText("Email professionnel"), { target: { value: "person@gmail.com" } })
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "example-password" } })
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }))
  await waitFor(() => expect(mock.login).toHaveBeenCalledWith({ email: "person@gmail.com", password: "example-password" }))
  fireEvent.click(screen.getByRole("button", { name: "Retour au site" }))
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Le logiciel simple")
  expect(document.getElementById("features")).not.toBeNull()
})
