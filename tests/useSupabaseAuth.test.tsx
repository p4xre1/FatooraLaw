import { act, renderHook, waitFor } from "@testing-library/react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  configured: true,
  callback: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
  getSession: vi.fn(),
  signOut: vi.fn(),
  profile: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock("../src/lib/supabase", () => ({
  get isSupabaseConfigured() { return mock.configured },
  supabase: {
    auth: {
      getSession: mock.getSession,
      signOut: mock.signOut,
      onAuthStateChange: (callback: typeof mock.callback) => {
        mock.callback = callback
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } }
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.profile }) }) }),
  },
}))
import { useSupabaseAuth } from "../src/hooks/useSupabaseAuth"
import { useMizan } from "../src/store/useMizan"

const session = { user: { id: "a", email: "a@example.com", user_metadata: { role: "owner", name: "Untrusted" } } } as unknown as Session
beforeEach(() => {
  mock.configured = true
  mock.callback = null
  mock.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  mock.signOut.mockReset().mockResolvedValue({ error: null })
  mock.profile.mockReset().mockResolvedValue({ data: { name: "Verified", role: "accountant" }, error: null })
  useMizan.getState().signOut()
})

it("clears local auth when Supabase is not configured and always logs out locally", async () => {
  mock.configured = false
  useMizan.getState().signIn("A", "a@example.com", "owner", "a")
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(useMizan.getState().auth).toBeNull()
  useMizan.getState().signIn("A", "a@example.com", "owner", "a")
  await act(() => result.current.logout())
  expect(useMizan.getState().auth).toBeNull()
  expect(mock.signOut).not.toHaveBeenCalled()
})

it("unblocks the initial loading screen and fails closed when session loading rejects", async () => {
  mock.getSession.mockRejectedValue(new Error("offline"))
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(useMizan.getState().auth).toBeNull()
})

it("reads roles from protected profiles, not editable user metadata", async () => {
  mock.getSession.mockResolvedValue({ data: { session }, error: null })
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(useMizan.getState().auth).toEqual({ id: "a", name: "Verified", email: "a@example.com", role: "accountant" })
})

it("does not resurrect a session when an older getSession response arrives after sign-out", async () => {
  let resolve!: (value: unknown) => void
  mock.getSession.mockImplementation(() => new Promise((r) => { resolve = r }))
  const { result } = renderHook(() => useSupabaseAuth())
  act(() => mock.callback!("SIGNED_OUT", null))
  await act(async () => resolve({ data: { session }, error: null }))
  expect(result.current.ready).toBe(true)
  expect(useMizan.getState().auth).toBeNull()
  expect(mock.profile).not.toHaveBeenCalled()
})

it("does not resurrect auth from an in-flight profile lookup after local logout", async () => {
  let resolve!: (value: unknown) => void
  mock.profile.mockImplementation(() => new Promise((r) => { resolve = r }))
  mock.getSession.mockResolvedValue({ data: { session }, error: null })
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(mock.profile).toHaveBeenCalled())
  await act(() => result.current.logout())
  await act(async () => resolve({ data: { name: "Old", role: "owner" }, error: null }))
  expect(useMizan.getState().auth).toBeNull()
})

it("clears local auth even when the provider's sign-out request rejects", async () => {
  mock.getSession.mockResolvedValue({ data: { session }, error: null })
  mock.signOut.mockRejectedValue(new Error("offline"))
  vi.spyOn(console, "warn").mockImplementation(() => {})
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(() => result.current.logout())
  expect(useMizan.getState().auth).toBeNull()
})

it("hides the old account's local records immediately when a different account signs in", async () => {
  mock.getSession.mockResolvedValue({ data: { session }, error: null })
  const { result } = renderHook(() => useSupabaseAuth())
  await waitFor(() => expect(result.current.ready).toBe(true))
  mock.profile.mockImplementation(() => new Promise(() => {}))
  const other = { ...session, user: { ...session.user, id: "b", email: "b@example.com" } }
  act(() => mock.callback!("SIGNED_IN", other))
  expect(useMizan.getState().auth).toBeNull()
  expect(result.current.ready).toBe(false)
})
