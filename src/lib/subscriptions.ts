import type { SubscriptionTool } from "../store/types"
import { calendarDay, daysUntil, todayISO, validDateRange } from "./calendarDates"

export type SubscriptionStatus = "active" | "expired" | "scheduled" | "unknown"
export function subscriptionStatus(tool: SubscriptionTool, today = todayISO()): SubscriptionStatus {
  if (!validDateRange(tool.start, tool.expiry)) return "unknown"
  const expiry = daysUntil(tool.expiry, today)
  const start = daysUntil(tool.start, today)
  if (expiry !== null && expiry < 0) return "expired"
  if (start !== null && start > 0) return "scheduled"
  return "active"
}

/** Planned full monthly cost of subscriptions whose date ranges overlap a month.
 * Not payment history, prorating, or a forecast of confirmed debits. */
export function monthlySubscriptionCosts(tools: SubscriptionTool[], today = todayISO(), count = 7) {
  const [year, month] = today.split("-").map(Number)
  const labels: string[] = []
  const values: number[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const first = new Date(Date.UTC(year, month - 1 - offset, 1))
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
    labels.push(new Intl.DateTimeFormat("fr-MA", { month: "short", year: "2-digit", timeZone: "UTC" }).format(first))
    const firstDay = first.getTime() / 86_400_000
    const lastDay = last.getTime() / 86_400_000
    values.push(tools.reduce((total, tool) => {
      if (!validDateRange(tool.start, tool.expiry)) return total
      const start = calendarDay(tool.start)
      const expiry = calendarDay(tool.expiry)
      return (start === null || start <= lastDay) && (expiry === null || expiry >= firstDay) ? total + tool.cost : total
    }, 0))
  }
  return { labels, values }
}
