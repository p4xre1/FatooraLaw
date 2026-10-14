import { act, renderHook, waitFor } from "@testing-library/react"
import type { AuthChangeEvent } from "@supabase/supabase-js"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  callback: null as null | ((event: AuthChangeEvent) => void),
  getUser: vi.fn(),
  profile: vi.fn(),
  platform: vi.fn(),
}))
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: mock.getUser,
      signOut: vi.fn(),
      onAuthStateChange: (callback: typeof mock.callback) => {
        mock.callback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === "profiles" ? mock.profile : mock.platform }) }) }),
  },
}))
import { useAdminAuth } from "../src/admin/lib/adminAuth"

beforeEach(() => {
  mock.getUser.mockReset().mockResolvedValue({ data: { user: { id: "a" } }, error: null })
  mock.profile.mockReset().mockResolvedValue({ data: { is_admin: true }, error: null })
  mock.platform.mockReset().mockResolvedValue({ data: null, error: null })
})

it("fails closed when verification rejects instead of leaving a permanent spinner", async () => {
  mock.getUser.mockRejectedValue(new Error("offline"))
  const { result } = renderHook(() => useAdminAuth())
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"))
})

it("ignores a stale verification response after sign-out", async () => {
  let resolve!: (value: unknown) => void
  mock.profile.mockImplementation(() => new Promise((r) => { resolve = r }))
  const { result } = renderHook(() => useAdminAuth())
  await waitFor(() => expect(mock.profile).toHaveBeenCalled())
  act(() => mock.callback!("SIGNED_OUT"))
  await act(async () => resolve({ data: { is_admin: true }, error: null }))
  expect(result.current.status).toBe("unauthenticated")
})

it("cancels a deferred signed-in verification if sign-out arrives before it runs", async () => {
  const { result } = renderHook(() => useAdminAuth())
  await waitFor(() => expect(result.current.status).toBe("authenticated"))
  mock.getUser.mockClear()
  vi.useFakeTimers()
  try {
    act(() => { mock.callback!("SIGNED_IN"); mock.callback!("SIGNED_OUT") })
    await act(() => vi.runAllTimersAsync())
    expect(mock.getUser).not.toHaveBeenCalled()
    expect(result.current.status).toBe("unauthenticated")
  } finally { vi.useRealTimers() }
})

it("requires a literal true admin flag", async () => {
  mock.profile.mockResolvedValue({ data: { is_admin: "true" }, error: null })
  const { result } = renderHook(() => useAdminAuth())
  await waitFor(() => expect(result.current.status).toBe("forbidden"))
})

it("accepts a platform operator without content-editor access", async () => {
  mock.profile.mockResolvedValue({ data: { is_admin: false }, error: null })
  mock.platform.mockResolvedValue({ data: { user_id: "a" }, error: null })
  const { result } = renderHook(() => useAdminAuth())
  await waitFor(() => expect(result.current.status).toBe("authenticated"))
  expect(result.current.isContentAdmin).toBe(false)
  expect(result.current.isPlatformAdmin).toBe(true)
})
