import { businessSnapshot, useMizan } from "../store/useMizan"
import { toJSON } from "./mizan"

export function hasLegacyData(): boolean {
  try { return localStorage.getItem("mizan.store.v1") !== null }
  catch { return false }
}

/** Export unassigned legacy records without reviving or exporting their old auth profile. */
export function exportLegacyBackup() {
  const raw = localStorage.getItem("mizan.store.v1")
  if (!raw) return
  const value = JSON.parse(raw) as { state?: Record<string, unknown> }
  if (!value.state || typeof value.state !== "object") throw new Error("Sauvegarde locale illisible.")
  const keys = ["settings", "projects", "contacts", "expenses", "stock", "contracts", "team", "audit"]
  const data = Object.fromEntries(keys.filter((key) => key in value.state!).map((key) => [key, value.state![key]]))
  toJSON({ format: "fatorati-legacy-backup", version: 1, data }, "fatorati-sauvegarde-ancienne.json")
}

export function exportCurrentBackup() {
  toJSON({ format: "fatorati-local-backup", version: 2, data: businessSnapshot(useMizan.getState()) }, "fatorati-sauvegarde-locale.json")
}
