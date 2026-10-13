import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useIdleLogout } from "../src/lib/useIdleLogout"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it("signs out after inactivity", () => {
  const idle = vi.fn()
  renderHook(() => useIdleLogout(true, 1_000, idle))
  act(() => vi.advanceTimersByTime(1_000))
  expect(idle).toHaveBeenCalledTimes(1)
})

it("does not count a tab visibility change as user activity", () => {
  const idle = vi.fn()
  renderHook(() => useIdleLogout(true, 1_000, idle))
  act(() => {
    vi.advanceTimersByTime(900)
    document.dispatchEvent(new Event("visibilitychange"))
    vi.advanceTimersByTime(100)
  })
  expect(idle).toHaveBeenCalledTimes(1)
})

it("expires on resume even if the browser throttled its background timer", () => {
  const idle = vi.fn()
  const now = Date.now()
  renderHook(() => useIdleLogout(true, 1_000, idle))
  act(() => {
    vi.setSystemTime(now + 2_000)
    window.dispatchEvent(new MouseEvent("mousemove"))
  })
  expect(idle).toHaveBeenCalledTimes(1)
})

it("resets before the deadline on genuine activity and cleans up on unmount", () => {
  const idle = vi.fn()
  const hook = renderHook(() => useIdleLogout(true, 1_000, idle))
  act(() => {
    vi.advanceTimersByTime(900)
    window.dispatchEvent(new KeyboardEvent("keydown"))
    vi.advanceTimersByTime(900)
  })
  expect(idle).not.toHaveBeenCalled()
  hook.unmount()
  act(() => vi.advanceTimersByTime(2_000))
  expect(idle).not.toHaveBeenCalled()
})
