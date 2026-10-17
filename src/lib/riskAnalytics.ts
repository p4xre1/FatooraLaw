import type { AdCampaign, CalendarEvent, Contact, DeliveryOrder, Project, StockItem, SubscriptionTool } from "../store/types"
import { calendarDay, daysUntil, validDateRange } from "./calendarDates"
import { adAllocations, orderEconomics } from "./deliveryAnalytics"

export type RiskLevel = "high" | "medium"
export type RiskCategory = "deadlines" | "inventory" | "receivables" | "projects" | "subscriptions" | "verification"

export type RiskDetail =
  | { kind: "deadline"; daysUntil: number; note: string }
  | { kind: "stock"; quantity: number; minimum: number; unit: string }
  | { kind: "receivable"; outstanding: number; delivered: boolean }
  | { kind: "project"; daysUntil: number }
  | { kind: "subscription"; daysUntil: number }
  | { kind: "verification"; daysWaiting: number }

export type BusinessRisk = {
  id: string
  category: RiskCategory
  level: RiskLevel
  title: string
  due: string | null
  detail: RiskDetail
}

export type RiskInput = {
  calendarEvents: readonly CalendarEvent[]
  stock: readonly StockItem[]
  orders: readonly DeliveryOrder[]
  campaigns: readonly AdCampaign[]
  contacts: readonly Contact[]
  projects: readonly Project[]
  tools: readonly SubscriptionTool[]
}

function ageDays(value: string, today: string): number | null {
  const date = value.slice(0, 10)
  const target = calendarDay(date)
  const current = calendarDay(today)
  return target === null || current === null ? null : current - target
}

/**
 * Derives operational alerts from the account's actual records. Thresholds
 * are product reminders (30 days for due dates, 7 days for stale leads), not
 * claims about statutory deadlines or legal compliance.
 */
export function buildBusinessRisks(input: RiskInput, today: string): BusinessRisk[] {
  const risks: BusinessRisk[] = []
  const add = (risk: BusinessRisk) => risks.push(risk)

  for (const event of input.calendarEvents) {
    if (event.kind !== "deadline") continue
    const remaining = daysUntil(event.date, today)
    if (remaining === null || remaining > 30) continue
    add({
      id: `deadline:${event.id}`,
      category: "deadlines",
      level: remaining < 0 ? "high" : "medium",
      title: event.title,
      due: event.date,
      detail: { kind: "deadline", daysUntil: remaining, note: event.note },
    })
  }

  for (const item of input.stock) {
    if (item.qty > 0 && (item.minQty <= 0 || item.qty > item.minQty)) continue
    add({
      id: `stock:${item.id}`,
      category: "inventory",
      level: item.qty <= 0 ? "high" : "medium",
      title: item.name,
      due: null,
      detail: { kind: "stock", quantity: item.qty, minimum: item.minQty, unit: item.unit },
    })
  }

  const allocations = adAllocations(input.orders, input.campaigns)
  for (const order of input.orders) {
    if (!(order.verificationStatus === "verified" || order.deliveryStatus === "delivered")
      || order.deliveryStatus === "returned"
      || order.deliveryStatus === "cancelled") continue
    const economics = orderEconomics(order, allocations.get(order.id) ?? 0)
    if (economics.outstanding <= 0) continue
    const client = input.contacts.find((contact) => contact.id === order.clientId)
    add({
      id: `receivable:${order.id}`,
      category: "receivables",
      level: order.deliveryStatus === "delivered" ? "high" : "medium",
      title: client?.name ?? (order.items.map((item) => item.label).join(", ") || order.id),
      due: null,
      detail: { kind: "receivable", outstanding: economics.outstanding, delivered: order.deliveryStatus === "delivered" },
    })
  }

  for (const project of input.projects) {
    if ((project.status !== "active" && project.status !== "on_hold") || !project.end) continue
    const remaining = daysUntil(project.end, today)
    if (remaining === null || remaining > 30) continue
    add({
      id: `project:${project.id}`,
      category: "projects",
      level: remaining < 0 ? "high" : "medium",
      title: project.name,
      due: project.end,
      detail: { kind: "project", daysUntil: remaining },
    })
  }

  for (const tool of input.tools) {
    if (!tool.expiry || !validDateRange(tool.start, tool.expiry)) continue
    const remaining = daysUntil(tool.expiry, today)
    if (remaining === null || remaining > 30) continue
    add({
      id: `subscription:${tool.id}`,
      category: "subscriptions",
      level: remaining < 0 ? "high" : "medium",
      title: tool.name,
      due: tool.expiry,
      detail: { kind: "subscription", daysUntil: remaining },
    })
  }

  for (const order of input.orders) {
    if (order.verificationStatus === "verified" || order.verificationStatus === "refused") continue
    const waiting = ageDays(order.createdAt, today)
    if (waiting === null || waiting < 7) continue
    const client = input.contacts.find((contact) => contact.id === order.clientId)
    add({
      id: `verification:${order.id}`,
      category: "verification",
      level: waiting >= 14 ? "high" : "medium",
      title: client?.name ?? order.id,
      due: order.createdAt.slice(0, 10),
      detail: { kind: "verification", daysWaiting: waiting },
    })
  }

  return risks.sort((a, b) => {
    if (a.level !== b.level) return a.level === "high" ? -1 : 1
    const aDate = a.due ?? "9999-12-31"
    const bDate = b.due ?? "9999-12-31"
    return aDate.localeCompare(bDate) || a.title.localeCompare(b.title)
  })
}
