import type { AuditEvent, Contact, Contract, Expense, Project, Settings } from "../store/types"
import { seedAudit, seedContracts, seedSettings } from "../store/seed"
import { MAX_AMOUNT } from "./businessValidation"
import { calendarDay } from "./calendarDates"
import { dashboardRecords, legacySampleOrigins, sameRecord } from "./dashboardData"

type Input = { contracts: Contract[]; projects: Project[]; contacts: Contact[]; expenses: Expense[]; audit: AuditEvent[] }
const seedDay = Math.floor((seedAudit[0].ts + 3600_000) / 86_400_000)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A read-only legal view: never delete an old contract to guess provenance. */
export function legalData(input: Input) {
  const { originDays, provenEpochs } = legacySampleOrigins(input)
  if (!provenEpochs.length) {
    // A complete original contract batch is evidence if the other old seed
    // collections/audit are absent. A lone ambiguous historical row is retained.
    const evidence = new Map<number, Set<string>>()
    for (const contract of input.contracts) {
      if (!isRecord(contract)) continue
      const sample = seedContracts.find((row) => row.id === contract.id && sameRecord(contract, row, ["date"]))
      const day = typeof contract.date === "string" ? calendarDay(contract.date) : null
      if (!sample || day === null) continue
      const origin = day - (calendarDay(sample.date)! - seedDay)
      const ids = evidence.get(origin) ?? new Set<string>()
      ids.add(sample.id); evidence.set(origin, ids)
    }
    for (const [day, ids] of evidence) if (ids.size === seedContracts.length) originDays.add(day)
  }
  let hiddenCount = 0, invalidCount = 0
  const contracts = input.contracts.filter((contract) => {
    if (isRecord(contract)) {
      const sample = seedContracts.find((row) => row.id === contract.id && sameRecord(contract, row, ["date"]))
      const day = typeof contract.date === "string" ? calendarDay(contract.date) : null
      if (sample && day !== null && [...originDays].some((origin) => day === origin + calendarDay(sample.date)! - seedDay)) { hiddenCount++; return false }
    }
    const valid = isRecord(contract) && typeof contract.id === "string" && typeof contract.title === "string" && typeof contract.clientId === "string" &&
      ["construction", "service", "rental"].includes(contract.type) && ["draft", "sent", "signed"].includes(contract.status) &&
      typeof contract.value === "number" && Number.isFinite(contract.value) && contract.value >= 0 && contract.value <= MAX_AMOUNT &&
      typeof contract.date === "string" && calendarDay(contract.date) !== null
    if (!valid) invalidCount++
    return valid
  })
  const clients = dashboardRecords(input).contacts.filter((client) => isRecord(client) && client.type === "client" && typeof client.id === "string" && typeof client.name === "string")
  return { contracts, clients, hiddenCount, invalidCount }
}

export function legalCompany(settings: Settings): string {
  const identity = ["company", "ice", "taxId", "rc", "address", "city"] as const
  if (identity.every((key) => settings[key] === seedSettings[key])) return ""
  return typeof settings.company === "string" ? settings.company : ""
}

/** Date-only display must not move a contract to the previous day in UTC- zones. */
export function contractDate(value: string): string {
  const day = calendarDay(value)
  return day === null ? "Date non renseignée" : new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(day * 86_400_000))
}
