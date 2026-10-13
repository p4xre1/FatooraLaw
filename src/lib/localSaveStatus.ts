import { create } from "zustand"
import type { StateStorage } from "zustand/middleware"

type SaveIssue = { key: string; kind: "quota" | "unavailable" }
export const useLocalSaveStatus = create<{ issue: SaveIssue | null }>(() => ({ issue: null }))

const unreadableKeys = new Set<string>()

function failure(key: string, error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : ""
  useLocalSaveStatus.setState({ issue: { key, kind: /quota/i.test(name) ? "quota" : "unavailable" } })
}

function success(key: string) {
  if (useLocalSaveStatus.getState().issue?.key === key) useLocalSaveStatus.setState({ issue: null })
}

/** Keep the UI usable when business-record storage is full/disabled; never claim a failed write succeeded. */
export const businessStorage: StateStorage = {
  getItem(key) {
    try {
      const value = localStorage.getItem(key)
      // Do not overwrite an unreadable original with seed data after failed hydration.
      if (value !== null) JSON.parse(value)
      unreadableKeys.delete(key)
      return value
    } catch (error) { unreadableKeys.add(key); failure(key, error); return null }
  },
  setItem(key, value) {
    if (unreadableKeys.has(key)) return
    try { localStorage.setItem(key, value); success(key) }
    catch (error) { failure(key, error) }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); unreadableKeys.delete(key); success(key) }
    catch (error) { failure(key, error) }
  },
}
