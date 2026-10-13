import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), reset: vi.fn() }))
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseConfigProblem: null,
  supabaseConfigWarning: null,
  supabase: { auth: { signInWithPassword: mock.login, signUp: mock.signup, resetPasswordForEmail: mock.reset } },
}))
import Auth from "../src/components/Auth"
import { SignInForm } from "../src/modules/auth/SignIn/SignInForm"
import { SignUpForm } from "../src/modules/auth/SignUp/SignUpForm"
import { ForgotPasswordForm } from "../src/modules/auth/ForgotPassword/ForgotPasswordForm"
import { useLanguageStore } from "../src/modules/auth/language/useLanguage"

beforeEach(() => {
  useLanguageStore.getState().setLanguage("en")
  mock.login.mockReset().mockRejectedValue(new Error("offline"))
  mock.signup.mockReset().mockRejectedValue(new Error("offline"))
  mock.reset.mockReset().mockRejectedValue(new Error("offline"))
})

it("shows the idle-logout notice on the real main login form", () => {
  render(<Auth onBack={() => {}} idleSignedOut />)
  expect(screen.getByRole("status").textContent).toContain("déconnecté automatiquement")
})

it("recovers the main form after a thrown login request", async () => {
  render(<Auth onBack={() => {}} />)
  fireEvent.change(screen.getByLabelText("Email professionnel"), { target: { value: "a@example.com" } })
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "password123" } })
  const submit = screen.getByRole("button", { name: /Se connecter/ }) as HTMLButtonElement
  fireEvent.click(submit)
  await waitFor(() => expect(screen.getByText(/Problème de connexion/)).toBeDefined())
  expect(submit.disabled).toBe(false)
})

it("recovers modular sign-in after a thrown request", async () => {
  render(<SignInForm onForgotPassword={() => {}} />)
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
  const submit = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement
  fireEvent.click(submit)
  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
  expect(submit.disabled).toBe(false)
})

it("recovers modular sign-up after a thrown request", async () => {
  render(<SignUpForm onSignIn={() => {}} />)
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Atlas" } })
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } })
  fireEvent.click(screen.getByRole("checkbox"))
  const submit = screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement
  fireEvent.click(submit)
  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
  expect(submit.disabled).toBe(false)
})

it("recovers password-reset request form after a thrown request", async () => {
  render(<ForgotPasswordForm onBack={() => {}} />)
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@example.com" } })
  const submit = screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement
  fireEvent.click(submit)
  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
  expect(submit.disabled).toBe(false)
})
