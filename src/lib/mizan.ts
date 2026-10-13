import type { Role, Settings } from "../store/types"

const currencyLocale: Record<Settings["currency"], string> = {
  MAD: "fr-MA",
  EUR: "fr-FR",
  USD: "en-US",
}

export function money(n: number, currency: Settings["currency"] = "MAD", compact = false): string {
  const v = Math.round(n)
  const formatted = new Intl.NumberFormat(currencyLocale[currency], {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v)
  return `${formatted} ${currency}`
}

export function num(n: number): string {
  return new Intl.NumberFormat("fr-MA").format(n)
}

export function fmtDate(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric" }).format(d)
}

export function fmtDateTime(ts: number): string {
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ts))
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

export const roleLabels: Record<Role, string> = {
  owner: "Propriétaire",
  accountant: "Comptable",
  supervisor: "Superviseur",
  assistant: "Assistant",
}

export const roleTints: Record<Role, string> = {
  owner: "bg-brand-50 text-brand-700 ring-brand/20",
  accountant: "bg-emerald-50 text-emerald-700 ring-emerald-brand/20",
  supervisor: "bg-warn-50 text-warn ring-warn/20",
  assistant: "bg-canvas text-muted ring-line-strong",
}

/* ---- Exports (offline, non-blocking) ---- */

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
    // Let the browser consume the URL before releasing it (Firefox in
    // particular can cancel the download if it is revoked synchronously).
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export function toJSON(data: unknown, filename = "backup.json") {
  triggerDownload(JSON.stringify(data, null, 2), filename, "application/json;charset=utf-8")
}

/** Spreadsheet applications execute formula-looking strings, even in quoted CSV. */
function spreadsheetText(value: unknown): string {
  const text = String(value ?? "")
  // Actual numbers (including negative balances) must remain numeric.
  return typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export function toCSV(rows: Record<string, unknown>[], filename = "export.csv") {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = spreadsheetText(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(escape).join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
  triggerDownload("\uFEFF" + csv, filename, "text/csv;charset=utf-8")
}

/** Excel-compatible HTML table; this is not a binary XLS workbook. */
export function toExcel(rows: Record<string, unknown>[], filename = "export.xls") {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const cell = (value: unknown) => escapeHtml(spreadsheetText(value))
  const th = headers.map((h) => `<th>${cell(h)}</th>`).join("")
  const trs = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${cell(r[h])}</td>`).join("")}</tr>`)
    .join("")
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${th}</tr>${trs}</table></body></html>`
  triggerDownload(html, filename, "application/vnd.ms-excel")
}

/** Parse records, not individual lines: quoted fields may contain newlines. */
export function parseCSV(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "")
  if (!source) return []
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let recordStarted = false

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"') {
      recordStarted = true
      if (quoted && source[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (ch === "," && !quoted) {
      row.push(field)
      field = ""
      recordStarted = true
    } else if ((ch === "\r" || ch === "\n") && !quoted) {
      rows.push([...row, field])
      row = []
      field = ""
      recordStarted = false
      if (ch === "\r" && source[i + 1] === "\n") i++
    } else {
      field += ch
      recordStarted = true
    }
  }
  if (quoted) throw new Error("CSV invalide : guillemets non fermés.")
  if (recordStarted) rows.push([...row, field])
  return rows
}

/** Run deferred work without blocking the current paint; failures reject normally. */
export function runAsync<T>(work: () => T, ms = 650): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(work()) }
      catch (error) { reject(error) }
    }, ms)
  })
}
