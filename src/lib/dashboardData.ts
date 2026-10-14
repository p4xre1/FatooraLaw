import type { AuditEvent, Contact, Expense, Project, Settings } from "../store/types"
import { seedAudit, seedContacts, seedExpenses, seedProjects } from "../store/seed"
import { MAX_AMOUNT } from "./businessValidation"
import { calendarDay, dateFromDay, todayISO } from "./calendarDates"
import { MONTHS } from "./analytics"

type Records = { projects: Project[]; contacts: Contact[]; expenses: Expense[]; audit: AuditEvent[] }
const DAY_MS = 86_400_000
const AUDIT_HOURS = [1, 3, 5, 20, 26, 50]

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function amount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT
}
function equal(a: unknown, b: unknown, omit: string[] = [], depth = 0): boolean {
  if (a === b) return true
  if (depth > 10) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i], [], depth + 1))
  if (!record(a) || !record(b)) return false
  const keys = Object.keys(a).filter((key) => !omit.includes(key))
  const other = Object.keys(b).filter((key) => !omit.includes(key))
  return keys.length === other.length && keys.every((key) => key in b && equal(a[key], b[key], [], depth + 1))
}
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
const sum = (values: number[]) => values.reduce((total, value) => total + cents(value), 0) / 100
const seedEpoch = seedAudit[0].ts + AUDIT_HOURS[0] * 3600_000
const seedDay = Math.floor(seedEpoch / DAY_MS)

/** Old caches have no provenance flag. Only recognise original reserved IDs and
 * unchanged fingerprints, with coherent date/audit evidence. Never delete,
 * rewrite or mutate a stored row; edited and uncertain records stay visible.
 */
export function legacySampleOrigins(input: Records) {
  const candidates = new Set<number>()
  for (const event of input.audit) {
    if (!record(event) || typeof event.ts !== "number" || !Number.isFinite(event.ts)) continue
    seedAudit.forEach((sample, i) => {
      if (equal(event, sample, ["id", "ts"])) candidates.add(event.ts + AUDIT_HOURS[i] * 3600_000)
    })
  }
  const provenEpochs = [...candidates].filter((epoch) => seedAudit.every((sample, i) => input.audit.some((event) =>
    record(event) && event.ts === epoch - AUDIT_HOURS[i] * 3600_000 && equal(event, sample, ["id", "ts"]))))
  const originDays = new Set<number>([seedDay, ...provenEpochs.map((epoch) => Math.floor(epoch / DAY_MS))])

  // If the old demo audit batch is absent, a coherent mixed project/expense
  // batch can establish the historical seed date. One ambiguous row cannot.
  if (!provenEpochs.length) {
    const evidence = new Map<number, { ids: Set<string>; kinds: Set<string> }>()
    function add(day: number, id: string, kind: string) {
      const item = evidence.get(day) ?? { ids: new Set<string>(), kinds: new Set<string>() }
      item.ids.add(id); item.kinds.add(kind); evidence.set(day, item)
    }
    for (const project of input.projects) {
      if (!record(project)) continue
      const sample = seedProjects.find((s) => s.id === project.id && equal(project, s, ["start", "end"]))
      if (!sample || typeof project.start !== "string" || typeof project.end !== "string") continue
      const start = calendarDay(project.start), end = calendarDay(project.end)
      if (start === null || end === null) continue
      const origin = start - (calendarDay(sample.start)! - seedDay)
      if (origin === end - (calendarDay(sample.end)! - seedDay)) add(origin, project.id as string, "project")
    }
    for (const expense of input.expenses) {
      if (!record(expense)) continue
      const sample = seedExpenses.find((s) => s.id === expense.id && equal(expense, s, ["date"]))
      const date = typeof expense.date === "string" ? calendarDay(expense.date) : null
      if (sample && date !== null) add(date - (calendarDay(sample.date)! - seedDay), expense.id as string, "expense")
    }
    for (const [day, item] of evidence) if (item.ids.size >= 3 && item.kinds.size === 2) originDays.add(day)
  }

  return { originDays, provenEpochs }
}

export { equal as sameRecord }

export function dashboardRecords(input: Records) {
  const { originDays, provenEpochs } = legacySampleOrigins(input)
  let hiddenDemoCount = 0
  function without<T>(rows: T[], isSample: (row: T) => boolean): T[] {
    return rows.filter((row) => { if (!isSample(row)) return true; hiddenDemoCount++; return false })
  }
  const projects = without(input.projects, (p) => {
    if (!record(p)) return false
    const sample = seedProjects.find((s) => s.id === p.id && equal(p, s, ["start", "end"]))
    if (!sample || typeof p.start !== "string" || typeof p.end !== "string") return false
    const start = calendarDay(p.start), end = calendarDay(p.end)
    return start !== null && end !== null && [...originDays].some((day) =>
      start === day + calendarDay(sample.start)! - seedDay && end === day + calendarDay(sample.end)! - seedDay)
  })
  const contacts = without(input.contacts, (c) => seedContacts.some((sample) => equal(c, sample)))
  const expenses = without(input.expenses, (e) => {
    if (!record(e)) return false
    const sample = seedExpenses.find((s) => s.id === e.id && equal(e, s, ["date"]))
    const date = typeof e.date === "string" ? calendarDay(e.date) : null
    return !!sample && date !== null && [...originDays].some((day) => date === day + calendarDay(sample.date)! - seedDay)
  })
  const audit = without(input.audit, (e) => seedAudit.some((sample, i) => equal(e, sample) ||
    (record(e) && equal(e, sample, ["id", "ts"]) && provenEpochs.some((epoch) => e.ts === epoch - AUDIT_HOURS[i] * 3600_000))))
  return { projects, contacts, expenses, audit, hiddenDemoCount }
}

/** Summaries of manual account records, not invoices, a bank balance or a
 * payment ledger. Project.paid is cumulative and has no dated payment history.
 */
export function dashboardData(input: Records, count = 8, today = todayISO(), monthNames = MONTHS) {
  const clean = dashboardRecords(input)
  const projects = clean.projects.filter((p) => record(p) && typeof p.id === "string" && typeof p.name === "string" && amount(p.budget) && amount(p.paid))
  const expenses = clean.expenses.filter((e) => record(e) && typeof e.id === "string" && amount(e.amount) && (e.status === "approved" || e.status === "pending"))
  const contacts = clean.contacts.filter((c) => record(c) && typeof c.id === "string" && (c.type === "client" || c.type === "supplier") && typeof c.balance === "number" && Number.isFinite(c.balance) && Math.abs(c.balance) <= MAX_AMOUNT)
  const invalidCount = clean.projects.length - projects.length + clean.expenses.length - expenses.length + clean.contacts.length - contacts.length
  const approved = expenses.filter((e) => e.status === "approved")
  const last = calendarDay(today)
  if (last === null || !Number.isInteger(count) || count < 1 || count > 24) throw new Error("Période invalide.")
  const current = new Date(last * DAY_MS)
  const monthKeys: string[] = [], labels: string[] = [], monthlyCents: number[] = [], entries: number[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - i, 1))
    monthKeys.push(date.toISOString().slice(0, 7))
    labels.push(`${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`)
    monthlyCents.push(0); entries.push(0)
  }
  const categories = new Map<string, number>()
  let invalidDateCount = 0, periodCount = 0
  for (const expense of approved) {
    const day = typeof expense.date === "string" ? calendarDay(expense.date) : null
    if (day === null) { invalidDateCount++; continue }
    if (day > last) continue
    const index = monthKeys.indexOf(dateFromDay(day).slice(0, 7))
    if (index < 0) continue
    const value = cents(expense.amount)
    monthlyCents[index] += value; entries[index]++; periodCount++
    const category = typeof expense.category === "string" && expense.category.trim() ? expense.category : "Sans catégorie"
    categories.set(category, (categories.get(category) ?? 0) + value)
  }
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "#64748b"]
  const byCategory = [...categories].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value: value / 100, color: colors[i % colors.length] }))
  const projectChart = [...projects].sort((a, b) => b.budget - a.budget).slice(0, 8)
  const recent = clean.audit.filter((a) => record(a) && typeof a.id === "string" && typeof a.actor === "string" && typeof a.action === "string" && typeof a.target === "string" && Number.isFinite(a.ts) && ["info", "warning", "critical"].includes(a.severity))
    .sort((a, b) => b.ts - a.ts).slice(0, 5)
  return {
    budget: sum(projects.map((p) => p.budget)), collected: sum(projects.map((p) => p.paid)),
    approvedExpenses: sum(approved.map((e) => e.amount)),
    receivables: sum(contacts.filter((c) => c.type === "client").map((c) => Math.max(0, c.balance))),
    projectCount: projects.length, approvedCount: approved.length,
    clientCount: contacts.filter((c) => c.type === "client").length,
    hasRecords: projects.length > 0 || expenses.length > 0 || contacts.length > 0,
    monthly: { labels, keys: monthKeys, values: monthlyCents.map((v) => v / 100), entries, periodCount },
    byCategory, projectChart, recent,
    hiddenDemoCount: clean.hiddenDemoCount, invalidCount, invalidDateCount,
  }
}


/** Dashboard amounts retain currency minor units; the legacy app-wide formatter
 * rounds to whole units and must not disguise newly entered dashboard values.
 */
export function dashboardMoney(value: number, currency: Settings["currency"] = "MAD", compact = false, locale = { MAD: "fr-MA", EUR: "fr-FR", USD: "en-US" }[currency]): string {
  return `${new Intl.NumberFormat(locale, { notation: compact ? "compact" : "standard", maximumFractionDigits: 2 }).format(value)} ${currency}`
}
