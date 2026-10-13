import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  configured: false,
  problem: null as null | { code: string; message: string; variables: string[] },
  warning: null as string | null,
}))

vi.mock("../src/lib/supabase", () => ({
  get isSupabaseConfigured() { return mock.configured },
  get supabaseConfigProblem() { return mock.problem },
  get supabaseConfigWarning() { return mock.warning },
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() } },
}))

import Auth from "../src/components/Auth"
import SupabaseSetupNotice from "../src/components/SupabaseSetupNotice"

const MISSING_MESSAGE =
  "Supabase n'est pas configuré : Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env (modèle : .env.example), puis redémarrez Vite."

beforeEach(() => {
  mock.configured = false
  mock.problem = { code: "missing-both", message: MISSING_MESSAGE, variables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] }
  mock.warning = null
})

it("shows the setup notice before anyone submits credentials", () => {
  render(<SupabaseSetupNotice />)
  const alert = screen.getByRole("alert")
  expect(alert.textContent).toContain("Configuration Supabase requise")
  expect(alert.textContent).toContain("VITE_SUPABASE_URL")
  expect(alert.textContent).toContain("VITE_SUPABASE_ANON_KEY=<clé anon publique>")
})

it("renders nothing when the configuration is complete", () => {
  mock.configured = true
  mock.problem = null
  const view = render(<SupabaseSetupNotice />)
  expect(view.container.textContent).toBe("")
})

it("surfaces a project mismatch on an otherwise usable configuration", () => {
  mock.configured = true
  mock.problem = null
  mock.warning = "La clé VITE_SUPABASE_ANON_KEY appartient au projet « b » alors que VITE_SUPABASE_URL pointe vers « a »."
  render(<SupabaseSetupNotice />)
  expect(screen.getByText(/appartient au projet/)).toBeDefined()
})

it("escalates a secret key instead of inviting a copy/paste", () => {
  mock.problem = {
    code: "secret-key",
    message: "Sécurité : VITE_SUPABASE_ANON_KEY contient une clé secrète (service_role ou sb_secret_).",
    variables: ["VITE_SUPABASE_ANON_KEY"],
  }
  render(<SupabaseSetupNotice />)
  const alert = screen.getByRole("alert")
  expect(alert.textContent).toContain("Clé secrète détectée dans le navigateur")
  expect(alert.textContent).not.toContain("<clé anon publique>")
})

it("shows the notice on the real login screen, and still blocks sign-in with the precise cause", () => {
  render(<Auth onBack={() => {}} />)
  expect(screen.getByRole("alert").textContent).toContain("Configuration Supabase requise")

  fireEvent.change(screen.getByLabelText("Email professionnel"), { target: { value: "a@example.com" } })
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "password123" } })
  fireEvent.click(screen.getByRole("button", { name: /Se connecter/ }))
  expect(screen.getAllByRole("alert").some((node) => node.textContent === MISSING_MESSAGE)).toBe(true)
})
