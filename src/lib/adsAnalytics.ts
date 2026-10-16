import { parseCSV } from "./mizan"
import type { AdCampaign, AdPlatform } from "../store/types"
import { calendarDay, dateFromDay } from "./calendarDates"
import { sanitize } from "../store/useMizan"

export type AdReportAggregate = Omit<AdCampaign, "id">

export type AdReportParseResult = {
  campaigns: AdReportAggregate[]
  errors: string[]
  rowCount: number
}

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function toNumber(value: string): number | null {
  const raw = value.trim().replace(/[^\d.,-]/g, "")
  if (!raw) return value.trim() ? null : 0
  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  let normalized = raw
  if (lastComma >= 0 && lastDot >= 0) {
    // The rightmost separator is decimal; the other is a thousands separator.
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1
    normalized = decimals > 0 && decimals <= 2 ? raw.replace(",", ".") : raw.replace(/,/g, "")
  } else if ((raw.match(/\./g) ?? []).length === 1 && raw.length - lastDot - 1 === 3) {
    normalized = raw.replace(".", "")
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    const decimals = raw.length - lastDot - 1
    normalized = decimals > 0 && decimals <= 2 ? raw.slice(0, lastDot).replace(/\./g, "") + raw.slice(lastDot) : raw.replace(/\./g, "")
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function findHeader(headers: string[], predicates: ((h: string) => boolean)[]): number {
  for (const predicate of predicates) {
    const index = headers.findIndex(predicate)
    if (index >= 0) return index
  }
  return -1
}

function normalizeDate(value: string): string {
  const day = calendarDay(value.trim())
  return day ? dateFromDay(day) : ""
}

export function parseAdReportCsv(text: string, platform: AdPlatform): AdReportParseResult {
  const rows = parseCSV(text)
  const errors: string[] = []
  if (rows.length === 0) return { campaigns: [], errors: ["Empty CSV."], rowCount: 0 }

  const headers = rows[0].map(normHeader)
  const campaignIndex = findHeader(headers, [
    (h) => h.includes("campaign"),
  ])
  const dateIndex = findHeader(headers, [
    (h) => h === "day" || h === "date" || h.includes("day") || h.includes("date") || h.includes("reporting starts") || h.includes("start"),
  ])
  const impressionsIndex = findHeader(headers, [(h) => h.includes("impression")])
  const clicksIndex = findHeader(headers, [(h) => h.includes("click")])
  const spendIndex = findHeader(headers, [
    (h) => h.includes("amount spent") || h.includes("spend") || h.includes("cost"),
  ])
  const conversionsIndex = findHeader(headers, [
    (h) => h.includes("conversion") && !h.includes("value"),
    (h) => h.includes("purchase") && !h.includes("value"),
    (h) => h === "results" || h === "leads",
  ])
  const valueIndex = findHeader(headers, [
    (h) => h.includes("conversion value") || h.includes("value") || h.includes("revenue"),
  ])

  if (campaignIndex < 0) {
    return { campaigns: [], errors: ["CSV must contain a campaign column."], rowCount: rows.length - 1 }
  }

  type Accumulator = {
    name: string
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversionValue: number
    dates: string[]
  }
  const byCampaign = new Map<string, Accumulator>()

  let dataRows = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((cell) => cell.trim() === "")) continue
    dataRows++
    const name = (row[campaignIndex] ?? "").trim()
    if (!name) {
      errors.push(`Row ${i + 1}: missing campaign name.`)
      continue
    }
    const spend = spendIndex >= 0 ? toNumber(row[spendIndex] ?? "") : 0
    const impressions = impressionsIndex >= 0 ? toNumber(row[impressionsIndex] ?? "") : 0
    const clicks = clicksIndex >= 0 ? toNumber(row[clicksIndex] ?? "") : 0
    const conversions = conversionsIndex >= 0 ? toNumber(row[conversionsIndex] ?? "") : 0
    const conversionValue = valueIndex >= 0 ? toNumber(row[valueIndex] ?? "") : 0

    if ([spend, impressions, clicks, conversions, conversionValue].some((n) => n === null)) {
      errors.push(`Row ${i + 1}: invalid number.`)
      continue
    }

    const key = name.toLowerCase()
    const existing = byCampaign.get(key) ?? {
      name,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
      dates: [],
    }
    existing.spend += spend!
    existing.impressions += impressions!
    existing.clicks += clicks!
    existing.conversions += conversions!
    existing.conversionValue += conversionValue!
    if (dateIndex >= 0) {
      const normalized = normalizeDate(row[dateIndex] ?? "")
      if (normalized) existing.dates.push(normalized)
    }
    byCampaign.set(key, existing)
  }

  const campaigns: AdReportAggregate[] = [...byCampaign.values()].map((entry) => {
    const sortedDates = entry.dates.slice().sort()
    return {
      name: sanitize(entry.name),
      platform,
      spend: entry.spend,
      startedAt: sortedDates[0] ?? "",
      endedAt: sortedDates.length ? sortedDates[sortedDates.length - 1] : "",
      impressions: entry.impressions,
      clicks: entry.clicks,
      conversions: entry.conversions,
      conversionValue: entry.conversionValue,
    }
  })

  return { campaigns, errors, rowCount: dataRows }
}

export type AdMetrics = {
  ctr: number | null
  cpc: number | null
  cpa: number | null
  conversionRate: number | null
  roas: number | null
}

export function adMetrics(campaign: Pick<AdCampaign, "spend" | "impressions" | "clicks" | "conversions" | "conversionValue">): AdMetrics {
  const impressions = campaign.impressions ?? 0
  const clicks = campaign.clicks ?? 0
  const conversions = campaign.conversions ?? 0
  const spend = campaign.spend
  const value = campaign.conversionValue ?? 0
  return {
    ctr: impressions > 0 ? clicks / impressions : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: conversions > 0 ? spend / conversions : null,
    conversionRate: clicks > 0 ? conversions / clicks : null,
    roas: spend > 0 ? value / spend : null,
  }
}
