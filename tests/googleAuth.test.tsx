import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), configured: true, settings: vi.fn() }))
vi.mock("../src/lib/supabase", () => ({
  get isSupabaseConfigured() { return mock.configured },
  supabaseConfigProblem: null,
  supabaseConfigWarning: null,
  supabaseConfig: { url: "https://test.supabase.co", anonKey: "public-anon-key" },
  supabase: { auth: { signInWithOAuth: mock.signInWithOAuth } },
}))

import Auth from "../src/components/Auth"
import { mapGoogleSignInError, readGoogleSignInError } from "../src/modules/auth/lib/googleAuth"

beforeEach(() => {
  window.history.replaceState({}, "", "/login")
  mock.configured = true
  mock.signInWithOAuth.mockReset().mockResolvedValue({ data: { provider: "google" }, error: null })
  mock.settings.mockReset().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) })
  vi.stubGlobal("fetch", mock.settings)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it("starts the Supabase Google OAuth flow and returns to /login", async () => {
  render(<Auth onBack={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" }))

  await waitFor(() =>
    expect(mock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: "select_account" },
      },
    }),
  )
})

it("explains that Google sign-in is not enabled before leaving the app", async () => {
  mock.settings.mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) })
  render(<Auth onBack={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" }))

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("pas encore activée"))
  expect(mock.signInWithOAuth).not.toHaveBeenCalled()
  expect(mock.settings).toHaveBeenCalledWith(
    "https://test.supabase.co/auth/v1/settings",
    expect.objectContaining({ headers: { apikey: "public-anon-key" }, cache: "no-store" }),
  )
})

it("still attempts the redirect when the settings check cannot run", async () => {
  mock.settings.mockRejectedValue(new Error("offline"))
  render(<Auth onBack={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" }))

  await waitFor(() => expect(mock.signInWithOAuth).toHaveBeenCalled())
})

it("translates a raw provider error returned by the client", async () => {
  mock.signInWithOAuth.mockResolvedValue({
    data: { provider: "google", url: null },
    error: { message: "Unsupported provider: provider is not enabled" },
  })
  render(<Auth onBack={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" }))

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("pas encore activée"))
  expect(screen.queryByText(/Unsupported provider/)).toBeNull()
})

it("shows a cancelled Google callback once and removes it from the address bar", async () => {
  window.history.replaceState({}, "", "/login#error=access_denied&error_description=User+denied+access")
  render(<Auth onBack={() => {}} />)

  expect(screen.getByRole("alert").textContent).toContain("Connexion Google annulée.")
  await waitFor(() => expect(window.location.hash).toBe(""))
})

it("hides the Google button when the build has no usable Supabase configuration", () => {
  mock.configured = false
  render(<Auth onBack={() => {}} />)
  expect(screen.queryByRole("button", { name: "Continuer avec Google" })).toBeNull()
  expect(screen.queryByText("Continuer avec Google")).toBeNull()
})

it("maps provider errors to a small translatable set", () => {
  expect(mapGoogleSignInError("Unsupported provider: provider is not enabled")).toBe("providerNotEnabled")
  expect(mapGoogleSignInError("Invalid redirect_to: https://example.com is not allowed")).toBe("redirectNotAllowed")
  expect(mapGoogleSignInError("access_denied")).toBe("cancelled")
  expect(mapGoogleSignInError("Failed to fetch")).toBe("network")
  expect(mapGoogleSignInError("something else")).toBe("unexpected")
})

it("reads both implicit and PKCE callback errors", () => {
  window.history.replaceState({}, "", "/login#error=access_denied&error_description=User+denied")
  expect(readGoogleSignInError()).toBe("cancelled")

  window.history.replaceState({}, "", "/login?error=server_error&error_description=Provider+is+not+enabled")
  expect(readGoogleSignInError()).toBe("providerNotEnabled")

  window.history.replaceState({}, "", "/login")
  expect(readGoogleSignInError()).toBeNull()
})
