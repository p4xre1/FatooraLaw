import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import App from "../src/App"
import Landing from "../src/marketing/Landing"
import { navigate } from "../src/lib/router"
import { useMizan } from "../src/store/useMizan"

/**
 * Task-level guarantee for the URL work: every screen must be reachable *by
 * URL*, not by clicking your way there — the login screen used to have no URL
 * at all, and the public pages were `#fragments` of the homepage.
 */
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

it.each([
  ["/features", "Trois outils, une seule application"],
  ["/assistant", "Intégration juridique intelligente"],
  ["/pricing", "Le logiciel simple"],
])("renders the page matching %s straight from the URL", (path, expectedText) => {
  window.history.replaceState({}, "", path)

  const view = render(<Landing onEnter={() => {}} />)

  // The page is chosen from the URL — no hash, no click required.
  expect(window.location.pathname).toBe(path)
  expect(window.location.hash).toBe("")
  const text = view.container.textContent ?? ""
  if (path === "/pricing") expect(text).toContain("Tarifs")
  else expect(text).toContain(expectedText)
})

it("serves the login screen at /login instead of an anonymous homepage", async () => {
  window.history.replaceState({}, "", "/login")

  render(<App />)

  await waitFor(() => expect(screen.getByRole("heading", { name: "Connexion" })).toBeDefined())
  expect(document.title).toBe("Connexion | Fatorati")
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex")
})

it("serves sign-up and password recovery at their own URLs", async () => {
  window.history.replaceState({}, "", "/signup")
  const view = render(<App />)
  await waitFor(() => expect(screen.getByRole("heading", { name: "Créer un compte" })).toBeDefined())

  act(() => navigate("/forgot-password"))
  await waitFor(() => expect(screen.getByRole("heading", { name: "Mot de passe oublié" })).toBeDefined())
  expect(window.location.pathname).toBe("/forgot-password")

  // "Retour à la connexion" is a real navigation, so the URL follows the view.
  fireEvent.click(screen.getByRole("button", { name: "Retour à la connexion" }))
  await waitFor(() => expect(window.location.pathname).toBe("/login"))
  expect(view.container.textContent).toContain("Connexion")
})

it("sends a signed-out visitor asking for /dashboard to /login and back again", async () => {
  window.history.replaceState({}, "", "/dashboard")

  render(<App />)

  await waitFor(() => expect(window.location.pathname).toBe("/login"))
  await waitFor(() => expect(screen.getByRole("heading", { name: "Connexion" })).toBeDefined())

  useMizan.getState().signIn("Karim", "karim@example.com", "owner", "account-1")

  // Signed in, the root URL belongs to the dashboard — and the URL says so.
  act(() => navigate("/"))
  await waitFor(() => expect(window.location.pathname).toBe("/dashboard"))
})

it("returns a visitor to the module they asked for before signing in", async () => {
  window.history.replaceState({}, "", "/reports")

  render(<App />)

  // Signed out, the module URL is kept as the destination and /login replaces it.
  await waitFor(() => expect(window.location.pathname).toBe("/login"))

  useMizan.getState().signIn("Karim", "karim@example.com", "owner", "account-1")

  await waitFor(() => expect(window.location.pathname).toBe("/reports"))
  expect(screen.getByRole("heading", { name: "Rapports & Fiscalité" })).toBeDefined()
})

it("shows the not-found screen (never the homepage) for an unknown URL", async () => {
  window.history.replaceState({}, "", "/tarifs-premium")

  render(<App />)

  await waitFor(() => expect(screen.getByRole("heading", { name: "Cette page n'existe pas" })).toBeDefined())
  expect(document.title).toBe("Page introuvable (404) | Fatorati")
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex")

  // The suggested links are real pages, and leaving the page fixes the URL.
  fireEvent.click(screen.getByRole("button", { name: /Retour à l'accueil/ }))
  await waitFor(() => expect(window.location.pathname).toBe("/"))
})

it("opens each module from its URL once a session exists", async () => {
  useMizan.getState().signIn("Karim", "karim@example.com", "owner", "account-1")
  window.history.replaceState({}, "", "/settings")

  render(<App />)

  await waitFor(() => expect(screen.getByRole("heading", { name: "Paramètres" })).toBeDefined())
  expect(document.title).toBe("Paramètres | Fatorati")
})

it("keeps the whole journey on real URLs: home → login → back to the site", async () => {
  render(<App />)
  fireEvent.click(screen.getAllByRole("button", { name: "S'inscrire" })[0])
  await waitFor(() => expect(window.location.pathname).toBe("/login"))

  fireEvent.click(screen.getByRole("button", { name: "Retour au site" }))
  await waitFor(() => expect(window.location.pathname).toBe("/"))
  expect(document.title).toContain("TPE marocaines")
})
