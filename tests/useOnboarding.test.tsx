import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ query: vi.fn(), upsert: vi.fn(), eq: vi.fn() }))
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => ({
    select: () => ({ eq: (column: string, id: string) => { mock.eq(column, id); return { maybeSingle: mock.query } } }),
    upsert: mock.upsert,
  }) },
}))
import { useOnboarding, type OnboardingAnswers } from "../src/hooks/useOnboarding"
const answers: OnboardingAnswers = { referralSource: "other", referralSourceOther: "  Event  ", businessProfile: "self_employed", wantsNotifications: false }
beforeEach(() => {
  mock.query.mockReset().mockResolvedValue({ data: null, error: null })
  mock.upsert.mockReset().mockResolvedValue({ error: null })
  mock.eq.mockClear()
})

it("checks again when the account changes without a signed-out render between users", async () => {
  const { result, rerender } = renderHook(({ id }) => useOnboarding(id), { initialProps: { id: "a" } })
  await waitFor(() => expect(result.current.needsOnboarding).toBe(true))
  mock.query.mockResolvedValue({ data: { user_id: "b" }, error: null })
  rerender({ id: "b" })
  await waitFor(() => expect(result.current.checked).toBe(true))
  expect(mock.eq).toHaveBeenLastCalledWith("user_id", "b")
  expect(result.current.needsOnboarding).toBe(false)
})

it("fails open on a thrown check error", async () => {
  mock.query.mockRejectedValue(new Error("offline"))
  const { result } = renderHook(() => useOnboarding("a"))
  await waitFor(() => expect(result.current.checked).toBe(true))
  expect(result.current.needsOnboarding).toBe(false)
})

it("uses a retry-safe upsert and resets submitting when a network request throws", async () => {
  const { result } = renderHook(() => useOnboarding("a"))
  await waitFor(() => expect(result.current.checked).toBe(true))
  mock.upsert.mockRejectedValue(new Error("offline"))
  await act(() => result.current.submit(answers))
  expect(result.current.submitting).toBe(false)
  expect(result.current.error).not.toBeNull()
  mock.upsert.mockResolvedValue({ error: null })
  await act(() => result.current.submit(answers))
  expect(mock.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: "a", referral_source_other: "Event" }), { onConflict: "user_id" })
  expect(result.current.needsOnboarding).toBe(false)
})

it("does not apply an old account's submission completion to the new account", async () => {
  let resolve!: (value: unknown) => void
  mock.upsert.mockImplementation(() => new Promise((r) => { resolve = r }))
  const { result, rerender } = renderHook(({ id }) => useOnboarding(id), { initialProps: { id: "a" } })
  await waitFor(() => expect(result.current.checked).toBe(true))
  let submission!: Promise<void>
  act(() => { submission = result.current.submit(answers) })
  rerender({ id: "b" })
  await waitFor(() => expect(result.current.needsOnboarding).toBe(true))
  await act(async () => { resolve({ error: null }); await submission })
  expect(result.current.needsOnboarding).toBe(true)
})
