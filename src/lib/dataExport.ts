import { businessSnapshot, useMizan, type LocalData } from "../store/useMizan"
import { toCSV } from "./mizan"
import { cryptoAvailable, encryptString } from "./security/encryption"

export const EXPORT_SECTIONS = [
  "settings", "projects", "contacts", "expenses", "stock", "orders", "campaigns",
  "contracts", "team", "tools", "audit",
] as const
export type ExportSection = (typeof EXPORT_SECTIONS)[number]

const EXCLUDED_MEDIA_KEYS = new Set(["logo", "receiptImage"])

/** Make a single spreadsheet-friendly table from several chosen collections. */
export function selectedCsvRows(data: LocalData, selected: readonly ExportSection[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const section of selected) {
    const value = data[section]
    const records = Array.isArray(value) ? value : [value]
    for (const record of records) {
      const fields = record && typeof record === "object" ? record as Record<string, unknown> : { value: record }
      const flat: Record<string, unknown> = { section, record_id: typeof fields.id === "string" ? fields.id : "" }
      for (const [key, field] of Object.entries(fields)) {
        if (EXCLUDED_MEDIA_KEYS.has(key)) continue
        flat[key] = field === null || field === undefined || typeof field !== "object" ? field ?? "" : JSON.stringify(field)
      }
      rows.push(flat)
    }
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return rows.map((row) => Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])))
}

export function downloadSelectedCsv(selected: readonly ExportSection[]): void {
  if (!selected.length) throw new Error("Select at least one data section.")
  const data = businessSnapshot(useMizan.getState())
  const rows = selectedCsvRows(data, selected)
  if (!rows.length) throw new Error("There is no data in the selected sections.")
  toCSV(rows, `fatorati-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

/** Full-fidelity JSON backup encrypted locally; the passphrase never leaves this browser. */
export async function downloadEncryptedBackup(passphrase: string): Promise<void> {
  if (passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.")
  if (!cryptoAvailable()) throw new Error("Secure browser encryption is unavailable. No file was created.")
  const data = businessSnapshot(useMizan.getState())
  const plaintext = JSON.stringify({ format: "fatorati-encrypted-backup", version: 1, createdAt: new Date().toISOString(), data })
  const encrypted = await encryptString(plaintext, passphrase)
  const blob = new Blob([encrypted], { type: "application/octet-stream" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `fatorati-backup-${new Date().toISOString().slice(0, 10)}.fatorati-encrypted`
  document.body.appendChild(anchor)
  try { anchor.click() }
  finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
