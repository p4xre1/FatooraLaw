import { expect, it } from "vitest"
import { contractDate, legalCompany, legalData } from "../src/lib/legalData"
import { addCalendarDays } from "../src/lib/calendarDates"
import { seedAudit, seedContacts, seedContracts, seedExpenses, seedProjects, seedSettings } from "../src/store/seed"
import type { Contract } from "../src/store/types"

const empty = () => ({ contracts: [] as Contract[], projects: [], contacts: [], expenses: [], audit: [] })

it("excludes original documents and clients but never mutates the cache", () => {
  const input = { contracts: structuredClone(seedContracts), contacts: structuredClone(seedContacts), projects: structuredClone(seedProjects), expenses: structuredClone(seedExpenses), audit: structuredClone(seedAudit) }
  const saved = JSON.stringify(input)
  const view = legalData(input)
  expect(view.contracts).toEqual([])
  expect(view.clients).toEqual([])
  expect(view.hiddenCount).toBe(3)
  expect(JSON.stringify(input)).toBe(saved)
})

it("recognises historical sample contracts from an old runtime's full audit evidence", () => {
  const days = -60
  const input = { ...empty(), contracts: seedContracts.map((c) => ({ ...c, date: addCalendarDays(c.date, days) })), audit: seedAudit.map((a) => ({ ...a, id: `old-${a.id}`, ts: a.ts + days * 86_400_000 })) }
  const saved = JSON.stringify(input)
  expect(legalData(input).contracts).toEqual([])
  expect(JSON.stringify(input)).toBe(saved)
})

it("recognises a coherent complete old contract batch without requiring other collections", () => {
  const input = { ...empty(), contracts: seedContracts.map((c) => ({ ...c, date: addCalendarDays(c.date, -60) })) }
  expect(legalData(input).hiddenCount).toBe(3)
})

it("retains uncertain isolated historical contracts instead of guessing whether they are real", () => {
  const contract = { ...seedContracts[0], date: addCalendarDays(seedContracts[0].date, -60) }
  expect(legalData({ ...empty(), contracts: [contract] }).contracts).toEqual([contract])
})

it("preserves edited names, values, statuses, dates and user-created copies", () => {
  const contracts: Contract[] = [
    { ...seedContracts[0], title: "My actual contract" },
    { ...seedContracts[0], value: 19.5 },
    { ...seedContracts[0], status: "draft" },
    { ...seedContracts[0], date: addCalendarDays(seedContracts[0].date, 1) },
    { ...seedContracts[0], id: "user-created-copy" },
  ]
  expect(legalData({ ...empty(), contracts, audit: structuredClone(seedAudit) }).contracts).toEqual(contracts)
})

it("does not fabricate company identity from untouched demo registration details", () => {
  expect(legalCompany(seedSettings)).toBe("")
  expect(legalCompany({ ...seedSettings, taxRate: 0, footerNote: "Edited note" })).toBe("")
  expect(legalCompany({ ...seedSettings, company: "My actual company" })).toBe("My actual company")
})

it("skips malformed records with a warning count rather than crashing or repairing storage", () => {
  const contracts = [null, { ...seedContracts[0], id: "bad-amount", value: Infinity }, { ...seedContracts[0], id: "bad-type", type: "unknown" }, { ...seedContracts[0], id: "bad-date", date: "2026-02-31" }] as unknown as Contract[]
  const view = legalData({ ...empty(), contracts })
  expect(view.invalidCount).toBe(4)
  expect(view.contracts).toEqual([])
  expect(contracts[0]).toBeNull()
})

it("formats date-only values consistently without timezone day shifting", () => {
  expect(contractDate("2026-10-13")).toBe(contractDate("13/10/2026"))
  expect(contractDate("2026-10-13")).toContain("13")
  expect(contractDate("not-a-date")).toBe("Date non renseignée")
})
