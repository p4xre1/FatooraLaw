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
  a.click()
  URL.revokeObjectURL(url)
}

export function toCSV(rows: Record<string, unknown>[], filename = "export.csv") {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? "")
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
  triggerDownload("﻿" + csv, filename, "text/csv;charset=utf-8")
}

/** Excel opens CSV natively; we label it .xls via a simple HTML table for richer import. */
export function toExcel(rows: Record<string, unknown>[], filename = "export.xls") {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const th = headers.map((h) => `<th>${h}</th>`).join("")
  const trs = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${String(r[h] ?? "")}</td>`).join("")}</tr>`)
    .join("")
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${`<tr>${th}</tr>`}${trs}</table></body></html>`
  triggerDownload(html, filename, "application/vnd.ms-excel")
}

export function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const out: string[] = []
      let cur = ""
      let inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
          else inQ = !inQ
        } else if (ch === "," && !inQ) { out.push(cur); cur = "" }
        else cur += ch
      }
      out.push(cur)
      return out
    })
}

/** Simulate a heavy async task off the main paint (keeps UI responsive). */
export function runAsync<T>(work: () => T, ms = 650): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(work()), ms)
  })
}
