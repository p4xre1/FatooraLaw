import { describe, expect, it } from "vitest"
import { buildBusinessRisks, type RiskInput } from "../src/lib/riskAnalytics"
import type { CalendarEvent, Contact, DeliveryOrder, Project, StockItem, SubscriptionTool } from "../src/store/types"

const client: Contact = {
  id: "client-1", type: "client", name: "Nadia Alaoui", ice: "", phone: "", email: "", city: "Tanger", balance: 0,
}

function order(patch: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: "order-1", clientId: client.id, campaignId: null, createdAt: "2026-10-01T09:00:00.000Z",
    items: [{ stockId: null, label: "Huile d'argan", qty: 2, unitPrice: 100, unitCost: 40 }],
    deliveryCost: 10, packagingCost: 5, otherFees: 0, amountPaid: 50,
    verificationStatus: "verified", deliveryStatus: "pending", callAttempts: 1,
    firstCallAt: null, verifiedAt: "2026-10-02T09:00:00.000Z", paidAt: null, shippedAt: null, deliveredAt: null,
    stockDeducted: false, notes: "", ...patch,
  }
}

const base: RiskInput = {
  calendarEvents: [], stock: [], orders: [], campaigns: [], contacts: [], projects: [], tools: [],
}

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: "event-1", title: "Accountant meeting", date: "2026-10-20", kind: "deadline", note: "Bring receipts", ...patch }
}

function stock(patch: Partial<StockItem> = {}): StockItem {
  return {
    id: "stock-1", name: "Argan oil", sku: "ARG-1", qty: 0, minQty: 3, unit: "bottles",
    assignedProjectId: null, type: "material", ...patch,
  }
}

function project(patch: Partial<Project> = {}): Project {
  return {
    id: "project-1", name: "Shop renovation", clientId: client.id, budget: 1000, paid: 400, cost: 200,
    status: "active", progress: 50, start: "2026-09-01", end: "2026-10-16", milestones: [], equipmentIds: [], ...patch,
  }
}

function tool(patch: Partial<SubscriptionTool> = {}): SubscriptionTool {
  return { id: "tool-1", name: "Design service", cost: 20, start: "2026-01-01", expiry: "2026-10-25", ...patch }
}

describe("buildBusinessRisks", () => {
  it("derives translated-ready operational alerts from stored records and their actual amounts", () => {
    const risks = buildBusinessRisks({
      ...base,
      calendarEvents: [event()],
      stock: [stock()],
      contacts: [client],
      orders: [order()],
      projects: [project()],
      tools: [tool()],
    }, "2026-10-17")

    expect(risks.map((risk) => risk.category)).toEqual([
      "projects", "inventory", "deadlines", "subscriptions", "receivables",
    ])
    expect(risks.find((risk) => risk.category === "deadlines")).toMatchObject({
      title: "Accountant meeting", due: "2026-10-20", detail: { kind: "deadline", daysUntil: 3, note: "Bring receipts" },
    })
    expect(risks.find((risk) => risk.category === "inventory")).toMatchObject({
      level: "high", title: "Argan oil", detail: { kind: "stock", quantity: 0, minimum: 3, unit: "bottles" },
    })
    expect(risks.find((risk) => risk.category === "receivables")).toMatchObject({
      title: "Nadia Alaoui", level: "medium", detail: { kind: "receivable", outstanding: 150, delivered: false },
    })
    expect(risks.find((risk) => risk.category === "projects")).toMatchObject({
      level: "high", title: "Shop renovation", detail: { kind: "project", daysUntil: -1 },
    })
    expect(risks.find((risk) => risk.category === "subscriptions")).toMatchObject({
      title: "Design service", detail: { kind: "subscription", daysUntil: 8 },
    })
  })

  it("flags old unverified orders, but not paid, returned, cancelled, or refused records", () => {
    const risks = buildBusinessRisks({
      ...base,
      contacts: [client],
      orders: [
        order({ id: "waiting", verificationStatus: "new", deliveryStatus: "pending", createdAt: "2026-10-01T09:00:00.000Z" }),
        order({ id: "paid", amountPaid: 200 }),
        order({ id: "returned", deliveryStatus: "returned" }),
        order({ id: "cancelled", deliveryStatus: "cancelled" }),
        order({ id: "refused", verificationStatus: "refused", deliveryStatus: "pending" }),
      ],
    }, "2026-10-17")

    expect(risks.map((risk) => risk.id)).toEqual(["verification:waiting"])
    expect(risks[0]).toMatchObject({ level: "high", title: "Nadia Alaoui", detail: { kind: "verification", daysWaiting: 16 } })
  })

  it("does not invent alerts for non-deadline events, distant dates, inactive records, or healthy stock", () => {
    const risks = buildBusinessRisks({
      ...base,
      calendarEvents: [event({ kind: "event" }), event({ id: "distant", date: "2026-12-01" })],
      stock: [stock({ id: "healthy", qty: 5, minQty: 3 })],
      projects: [project({ status: "done" }), project({ id: "planning", status: "planning" })],
      tools: [tool({ id: "distant-tool", expiry: "2026-12-01" }), tool({ id: "invalid-tool", start: "2026-11-01", expiry: "2026-10-20" })],
    }, "2026-10-17")

    expect(risks).toEqual([])
  })
})
