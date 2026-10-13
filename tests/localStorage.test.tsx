import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { accountStorageKey, useMizan } from "../src/store/useMizan"
import { businessStorage, useLocalSaveStatus } from "../src/lib/localSaveStatus"
import LocalSaveNotice from "../src/components/LocalSaveNotice"
import Settings from "../src/modules/Settings"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Tester", "tester@gmail.com", "owner", "storage-account")
  useLocalSaveStatus.setState({ issue: null })
})

it("keeps unsaved records in memory and preserves the previous saved value when storage is full", () => {
  const key = accountStorageKey("storage-account")
  const previous = localStorage.getItem(key)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError") })
  expect(() => useMizan.getState().addTool({ name: "Unsaved tool", cost: 10, start: "", expiry: "" })).not.toThrow()
  expect(useMizan.getState().tools[0].name).toBe("Unsaved tool")
  expect(localStorage.getItem(key)).toBe(previous)
  expect(useLocalSaveStatus.getState().issue).toEqual({ key, kind: "quota" })
})

it("shows a current-account warning, offers backup, warns on unload, and clears after a successful write", () => {
  render(<LocalSaveNotice />)
  const writer = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError") })
  act(() => useMizan.getState().addTool({ name: "Unsaved tool", cost: 10, start: "", expiry: "" }))
  expect(screen.getByRole("alert").textContent).toContain("ne sont pas enregistrées")
  expect(screen.getByRole("button", { name: "Exporter une sauvegarde" })).toBeDefined()
  const blocked = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(blocked)
  expect(blocked.defaultPrevented).toBe(true)
  writer.mockRestore()
  act(() => useMizan.getState().updateSettings({ city: "Tanger" }))
  expect(screen.queryByRole("alert")).toBeNull()
  const allowed = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(allowed)
  expect(allowed.defaultPrevented).toBe(false)
})

it("never displays a stale storage warning belonging to a different account", () => {
  useLocalSaveStatus.setState({ issue: { key: accountStorageKey("other-account"), kind: "quota" } })
  render(<LocalSaveNotice />)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("does not report Settings as saved after a failed local write", () => {
  render(<Settings />)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError") })
  fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: "Unsaved company" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
  expect(screen.getByRole("alert").textContent).toContain("sauvegarde locale a échoué")
  expect(screen.queryByRole("button", { name: "Enregistré" })).toBeNull()
})

it("handles unavailable reads and refuses to replace an unreadable original until a read succeeds", () => {
  const key = "mizan.store.v2.disabled-test"
  localStorage.setItem(key, JSON.stringify({ state: { tools: [] } }))
  const original = localStorage.getItem(key)
  const reader = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError") })
  expect(businessStorage.getItem(key)).toBeNull()
  expect(useLocalSaveStatus.getState().issue).toEqual({ key, kind: "unavailable" })
  const writer = vi.spyOn(Storage.prototype, "setItem")
  businessStorage.setItem(key, JSON.stringify({ state: {} }))
  expect(writer).not.toHaveBeenCalled()
  reader.mockRestore()
  expect(businessStorage.getItem(key)).toBe(original)
  businessStorage.setItem(key, JSON.stringify({ state: {} }))
  expect(writer).toHaveBeenCalledOnce()
  expect(useLocalSaveStatus.getState().issue).toBeNull()
})

it("preserves corrupted JSON rather than overwriting it with seeded records during sign-in", () => {
  const key = accountStorageKey("corrupt-save-test")
  localStorage.setItem(key, "not json but keep this original")
  useMizan.getState().signIn("B", "b@gmail.com", "owner", "corrupt-save-test")
  expect(useMizan.getState().auth?.id).toBe("corrupt-save-test")
  expect(localStorage.getItem(key)).toBe("not json but keep this original")
  expect(useLocalSaveStatus.getState().issue?.key).toBe(key)
})
