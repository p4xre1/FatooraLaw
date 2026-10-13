import { expect, it } from "vitest"
import { dashboardData, dashboardRecords, dashboardMoney } from "../src/lib/dashboardData"
import { MONTHS_AR } from "../src/lib/analytics"
import { addCalendarDays } from "../src/lib/calendarDates"
import { seedAudit, seedContacts, seedExpenses, seedProjects } from "../src/store/seed"
import type { AuditEvent, Contact, Expense, Project } from "../src/store/types"

const empty = () => ({ projects: [] as Project[], contacts: [] as Contact[], expenses: [] as Expense[], audit: [] as AuditEvent[] })
const expense = (id: string, date: string, amount: number, status: Expense["status"] = "approved"): Expense => ({ ...seedExpenses[0], id, date, amount, status })

it("returns zero saved totals and no activity for an empty account", () => {
  const data = dashboardData(empty(), 8, "2026-10-12")
  expect(data).toMatchObject({ budget: 0, collected: 0, approvedExpenses: 0, receivables: 0, hasRecords: false, hiddenDemoCount: 0, invalidCount: 0 })
  expect(data.monthly.values).toEqual(Array(8).fill(0))
  expect(data.recent).toEqual([])
  expect(data).not.toHaveProperty("treasury")
  expect(data.monthly).not.toHaveProperty("revenue")
})

it("uses exact dated expenses without waves, thousand-rounding or pending entries", () => {
  const input = { ...empty(), expenses: [expense("a", "2026-07-03", 12.35), expense("b", "2026-10-12", 29.5), expense("pending", "2026-10-11", 999, "pending")] }
  const data = dashboardData(input, 8, "2026-10-12")
  expect(data.monthly.values).toEqual([0, 0, 0, 0, 12.35, 0, 0, 29.5])
  expect(data.monthly.entries).toEqual([0, 0, 0, 0, 1, 0, 0, 1])
  expect(data.approvedExpenses).toBe(41.85)
})

it("does not reallocate recorded amounts when the displayed period changes", () => {
  const input = { ...empty(), expenses: [expense("old", "2026-03-02", 900), expense("recent", "2026-10-10", 12.35)] }
  const six = dashboardData(input, 6, "2026-10-12")
  const twelve = dashboardData(input, 12, "2026-10-12")
  expect(six.monthly.values.at(-1)).toBe(12.35)
  expect(twelve.monthly.values.at(-1)).toBe(12.35)
  expect(six.approvedExpenses).toBe(twelve.approvedExpenses)
})

it("supports ISO/DMY dates, year boundaries, Arabic labels, and cent-safe totals", () => {
  const data = dashboardData({ ...empty(), expenses: [expense("a", "31/12/2026", 0.1), expense("b", "2026-12-31", 0.2), expense("c", "2027-01-01", 1.25)] }, 2, "2027-01-05", MONTHS_AR)
  expect(data.monthly.labels).toEqual(["دجن 2026", "ينا 2027"])
  expect(data.monthly.values).toEqual([0.3, 1.25])
  expect(data.approvedExpenses).toBe(1.55)
})

it("does not place future, out-of-period or invalid dates into a historical chart", () => {
  const data = dashboardData({ ...empty(), expenses: [expense("future", "2026-10-13", 10), expense("old", "2020-01-01", 20), expense("bad", "2026-02-31", 30)] }, 8, "2026-10-12")
  expect(data.monthly.values).toEqual(Array(8).fill(0))
  expect(data.monthly.periodCount).toBe(0)
  expect(data.invalidDateCount).toBe(1)
  expect(data.approvedExpenses).toBe(60) // Cumulative entered approvals, not paid cash.
})

it("reports manual project totals and positive client balances, not revenue or liquidity", () => {
  const input = { ...empty(), projects: [{ ...seedProjects[0], id: "actual", name: "Actual project", budget: 500, paid: 123.45 }], contacts: [
    { ...seedContacts[0], id: "client", balance: 20 },
    { ...seedContacts[0], id: "credit", balance: -100 },
    { ...seedContacts[0], id: "supplier", type: "supplier" as const, balance: 500 },
  ] }
  const data = dashboardData(input, 8, "2026-10-12")
  expect(data.budget).toBe(500)
  expect(data.collected).toBe(123.45)
  expect(data.receivables).toBe(20)
  expect(data.projectChart[0].paid).toBe(123.45)
  expect(data.monthly.values).toEqual(Array(8).fill(0))
})

it("limits expense categories to approved dated records in the selected period", () => {
  const data = dashboardData({ ...empty(), expenses: [expense("a", "2026-10-12", 19.5), expense("b", "2026-10-11", 10), expense("old", "2020-01-01", 500), expense("pending", "2026-10-12", 100, "pending")] }, 8, "2026-10-12")
  expect(data.byCategory).toEqual([{ label: "Matériaux", value: 29.5, color: "var(--chart-1)" }])
})

it("does not corrupt the dashboard or present NaN/Infinity from malformed stored rows", () => {
  const input = { ...empty(), projects: [null, { ...seedProjects[0], id: "bad", paid: NaN }], expenses: [expense("infinite", "2026-10-12", Infinity)], contacts: [null] } as unknown as Parameters<typeof dashboardData>[0]
  const data = dashboardData(input, 8, "2026-10-12")
  expect(data.invalidCount).toBe(4)
  expect(data.budget).toBe(0)
  expect(data.approvedExpenses).toBe(0)
})

it("recognises historical demo batches from earlier runtimes without deleting or mutating them", () => {
  const days = -40
  const input = {
    projects: seedProjects.map((p) => ({ ...structuredClone(p), start: addCalendarDays(p.start, days), end: addCalendarDays(p.end, days) })),
    expenses: seedExpenses.map((e) => ({ ...e, date: addCalendarDays(e.date, days) })),
    contacts: structuredClone(seedContacts),
    audit: seedAudit.map((e) => ({ ...e, id: `old-${e.id}`, ts: e.ts + days * 86_400_000 })),
  }
  const saved = JSON.stringify(input)
  const data = dashboardData(input, 8, "2026-10-12")
  expect(data.hasRecords).toBe(false)
  expect(data.hiddenDemoCount).toBe(23)
  expect(data.recent).toEqual([])
  expect(JSON.stringify(input)).toBe(saved)
})

it("preserves edited, copied and date-edited sample rows as entered user data", () => {
  const changedProject = { ...structuredClone(seedProjects[0]), start: addCalendarDays(seedProjects[0].start, 1) }
  const changedExpense = { ...seedExpenses[0], date: addCalendarDays(seedExpenses[0].date, 1) }
  const input = { projects: [changedProject, { ...seedProjects[1], budget: 19.5 }], expenses: [changedExpense], contacts: [{ ...seedContacts[0], balance: 4 }], audit: structuredClone(seedAudit) }
  const clean = dashboardRecords(input)
  expect(clean.projects).toEqual(input.projects)
  expect(clean.expenses).toEqual(input.expenses)
  expect(clean.contacts).toEqual(input.contacts)
})

it("preserves uncertain isolated historical rows rather than guessing ownership", () => {
  const project = { ...seedProjects[0], start: addCalendarDays(seedProjects[0].start, -40), end: addCalendarDays(seedProjects[0].end, -40) }
  const clean = dashboardRecords({ ...empty(), projects: [project] })
  expect(clean.projects).toEqual([project])
})

it("recognises coherent mixed old demo dates even when their original audit is absent", () => {
  const input = { ...empty(), projects: seedProjects.slice(0, 2).map((p) => ({ ...p, start: addCalendarDays(p.start, -40), end: addCalendarDays(p.end, -40) })), expenses: [{ ...seedExpenses[0], date: addCalendarDays(seedExpenses[0].date, -40) }] }
  expect(dashboardRecords(input).hiddenDemoCount).toBe(3)
})

it("shows actual audit events newest-first, never seed actors mixed into the summary", () => {
  const event = { id: "real", actor: "Actual user", action: "a créé", target: "My project", module: "projects", severity: "info", ts: Date.now() } as const
  const data = dashboardData({ ...empty(), audit: [...structuredClone(seedAudit), event] }, 8, "2026-10-12")
  expect(data.recent).toEqual([event])
})

it("rejects invalid period requests instead of constructing misleading or infinite charts", () => {
  expect(() => dashboardData(empty(), 0, "2026-10-12")).toThrow()
  expect(() => dashboardData(empty(), 25, "2026-10-12")).toThrow()
  expect(() => dashboardData(empty(), 8, "not-a-date")).toThrow()
})


it("retains recorded cents rather than rounding them to whole currency units", () => {
  expect(dashboardMoney(123.45, "MAD")).toContain("123,45")
  expect(dashboardMoney(29.5, "EUR")).toContain("29,5")
  expect(dashboardMoney(123.45, "USD")).toContain("123.45")
})
