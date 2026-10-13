import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

/**
 * The local session must exist only in development builds with no usable
 * Supabase configuration, and must never perform a network call. These tests
 * exercise the guard conditions directly (see src/lib/localDevMode.ts).
 */
const mock = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))

vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabaseConfigProblem: {
    code: "missing-both",
    message: "Supabase n'est pas configuré : test.",
    variables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
  },
  supabaseConfigWarning: null,
  supabase: { auth: { signInWithPassword: mock.signInWithPassword } },
}))

import Auth from "../src/components/Auth"
import SupabaseSetupNotice from "../src/components/SupabaseSetupNotice"
import {
  LOCAL_DEV_USER,
  forgetLocalDevSession,
  localDevSessionRequested,
  localDevModeEnabled,
  signInLocally,
} from "../src/lib/localDevMode"
import { useMizan } from "../src/store/useMizan"

afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  forgetLocalDevSession()
  useMizan.getState().signOut()
  localStorage.clear()
  mock.signInWithPassword.mockReset()
})

it("enables the local session only for a dev build with no Supabase configuration", () => {
  expect(import.meta.env.DEV).toBe(true) // vitest runs the dev-mode branch
  expect(localDevModeEnabled()).toBe(true)
  expect(localDevSessionRequested()).toBe(false)
})

it("opens the dashboard locally after an explicit opt-in, without touching Supabase", async () => {
  render(<SupabaseSetupNotice onContinueLocally={() => {
    // Mirrors the handler Auth.tsx installs.
    useMizan.getState().signIn(LOCAL_DEV_USER.name, LOCAL_DEV_USER.email, LOCAL_DEV_USER.role, LOCAL_DEV_USER.id)
  }} />)

  fireEvent.click(screen.getByRole("button", { name: /Continuer en mode local/ }))
  await waitFor(() => expect(useMizan.getState().auth?.id).toBe("local-dev"))
  expect(useMizan.getState().auth?.role).toBe("owner")
  expect(useMizan.getState().auth?.email).toBe("local-dev@localhost")
  expect(mock.signInWithPassword).not.toHaveBeenCalled()
})

it("offers the local workspace on the real login screen in dev, and records the opt-in per tab", () => {
  render(<Auth onBack={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: /Continuer en mode local/ }))
  expect(useMizan.getState().auth?.id).toBe("local-dev")
  expect(localDevSessionRequested()).toBe(true)
  expect(sessionStorage.getItem("mizan.dev-local-session")).toBe("1")
})

it("restores the opt-in session only while the flag is set", () => {
  expect(localDevSessionRequested()).toBe(false)
  sessionStorage.setItem("mizan.dev-local-session", "1")
  expect(localDevSessionRequested()).toBe(true)
  forgetLocalDevSession()
  expect(localDevSessionRequested()).toBe(false)
})

it("stays inert outside a dev build, even with a leftover opt-in flag", () => {
  // What `pnpm build` / the Cloudflare deploy produce: Vite replaces
  // `import.meta.env.DEV` with `false`, so signing in locally must be refused.
  vi.stubEnv("DEV", false)
  sessionStorage.setItem("mizan.dev-local-session", "1")

  expect(localDevModeEnabled()).toBe(false)
  expect(localDevSessionRequested()).toBe(false)
  expect(signInLocally()).toBe(false)
  expect(useMizan.getState().auth).toBeNull()

  render(<SupabaseSetupNotice onContinueLocally={signInLocally} />)
  expect(screen.queryByRole("button", { name: /Continuer en mode local/ })).toBeNull()
})
