import { describe, expect, it } from "vitest"
import {
  adAllocations, audienceInsights, campaignPerformance, clientCosts, funnelSummary,
  orderEconomics, orderFulfilmentCost, orderProductCost, orderRevenue, orderTimings,
  paymentStatus, stockAvailability,
} from "../src/lib/deliveryAnalytics"
import type { AdCampaign, Contact, DeliveryOrder, StockItem } from "../src/store/types"

/**
 * The cost contract, pinned by hand: a campaign's spend is divided by the
 * clients it *verified* (not its leads, not its orders) and charged once
 * per client; wait and convince times come off the stage stamps.
 */

const CONTACTS: Contact[] = [
  { id: "c1", type: "client", name: "Salma Bennani", ice: "", phone: "0661", email: "", city: "Tanger", balance: 0, birthYear: 1996, source: "facebook", channel: "whatsapp" },
  { id: "c2", type: "client", name: "Omar Haddad", ice: "", phone: "0662", email: "", city: "Casablanca", balance: 0, birthYear: 1988, source: "instagram", channel: "direct" },
]
const CAMPAIGNS: AdCampaign[] = [
  { id: "camp1", name: "Ramadan Meta", platform: "facebook", spend: 1000, startedAt: "2026-10-01", endedAt: "" },
  { id: "camp2", name: "Insta Octobre", platform: "instagram", spend: 300, startedAt: "2026-10-01", endedAt: "" },
]
const STOCK: StockItem[] = [
  { id: "s1", name: "Crème solaire", sku: "CRE-01", qty: 20, minQty: 3, unit: "pièce", assignedProjectId: null, type: "material", keywords: ["beauté", "été"], costPrice: 40 },
  { id: "s2", name: "Huile d'argan", sku: "HUI-01", qty: 5, minQty: 2, unit: "pièce", assignedProjectId: null, type: "material", keywords: ["beauté"], costPrice: 90 },
]

function order(patch: Partial<DeliveryOrder>): DeliveryOrder {
  return {
    id: "o?", clientId: "c1", campaignId: null, createdAt: "2026-10-01T09:00:00.000Z",
    items: [], deliveryCost: 0, packagingCost: 0, otherFees: 0, amountPaid: 0,
    verificationStatus: "new", deliveryStatus: "pending", callAttempts: 0,
    firstCallAt: null, verifiedAt: null, paidAt: null, shippedAt: null, deliveredAt: null,
    stockDeducted: false, notes: "", ...patch,
  }
}

const O1 = order({
  id: "o1", clientId: "c1", campaignId: "camp1",
  createdAt: "2026-10-01T09:00:00.000Z", firstCallAt: "2026-10-01T11:00:00.000Z", verifiedAt: "2026-10-02T11:00:00.000Z",
  verificationStatus: "verified", deliveryStatus: "delivered", callAttempts: 2,
  items: [{ stockId: "s1", label: "Crème solaire", qty: 2, unitPrice: 150, unitCost: 40 }],
  deliveryCost: 30, packagingCost: 5, otherFees: 5, amountPaid: 300,
})
const O2 = order({
  id: "o2", clientId: "c1", campaignId: "camp1",
  createdAt: "2026-10-03T09:00:00.000Z", firstCallAt: "2026-10-03T10:00:00.000Z", verifiedAt: "2026-10-03T12:00:00.000Z",
  verificationStatus: "verified", deliveryStatus: "preparing", callAttempts: 1,
  items: [{ stockId: "s2", label: "Huile d'argan", qty: 1, unitPrice: 200, unitCost: 90 }],
  deliveryCost: 30, packagingCost: 5, otherFees: 0, amountPaid: 100,
})
const O3 = order({
  id: "o3", clientId: "c2", campaignId: "camp1",
  createdAt: "2026-10-04T09:00:00.000Z", firstCallAt: "2026-10-04T10:00:00.000Z",
  verificationStatus: "refused", callAttempts: 3,
  items: [{ stockId: "s1", label: "Crème solaire", qty: 1, unitPrice: 150, unitCost: 40 }],
})
const O4 = order({
  id: "o4", clientId: "c2", campaignId: "camp2",
  createdAt: "2026-10-05T09:00:00.000Z", firstCallAt: "2026-10-05T10:00:00.000Z", verifiedAt: "2026-10-05T13:00:00.000Z",
  verificationStatus: "verified", deliveryStatus: "delivered", callAttempts: 1,
  items: [{ stockId: "s2", label: "Huile d'argan", qty: 1, unitPrice: 200, unitCost: 90 }],
  deliveryCost: 25, packagingCost: 5, otherFees: 10, amountPaid: 200,
})
const ORDERS = [O1, O2, O3, O4]

describe("one order's money", () => {
  it("totals sale, product cost and fulfilment from the lines", () => {
    expect(orderRevenue(O1)).toBe(300)
    expect(orderProductCost(O1)).toBe(80)
    expect(orderFulfilmentCost(O1)).toBe(40)
    expect(paymentStatus(O1)).toBe("paid")
    expect(paymentStatus(O2)).toBe("partial")
    expect(paymentStatus(O3)).toBe("unpaid")
  })

  it("reads wait, convince and total verification times off the stamps", () => {
    const timings = orderTimings(O1, "2026-10-10T09:00:00.000Z")
    expect(timings.waitHours).toBe(2)
    expect(timings.convinceHours).toBe(24)
    expect(timings.verifyHours).toBe(26)
  })
})

describe("campaigns and the cost of a client", () => {
  it("divides spend by verified clients — not leads, not orders", () => {
    const [meta, insta] = campaignPerformance(CAMPAIGNS, ORDERS)
    expect(meta).toMatchObject({ leads: 2, verifiedClients: 1, conversionRate: 0.5, cac: 1000, costPerLead: 500 })
    expect(insta).toMatchObject({ leads: 1, verifiedClients: 1, cac: 300 })
  })

  it("charges the CAC once per client, on the first verified order", () => {
    const allocations = adAllocations(ORDERS, CAMPAIGNS)
    expect(allocations.get("o1")).toBe(1000)
    expect(allocations.get("o2")).toBe(0) // same client, same campaign: already paid for
    expect(allocations.get("o3")).toBe(0) // refused: never acquired
    expect(allocations.get("o4")).toBe(300)
  })

  it("knows, per client, exactly what they cost and what they left", () => {
    expect(orderEconomics(O1, 1000)).toMatchObject({ revenue: 300, totalCost: 1120, profit: -820 })
    const [salma, omar] = clientCosts(CONTACTS, ORDERS, CAMPAIGNS)
    expect(salma.contact.id).toBe("c1")
    expect(salma).toMatchObject({
      orders: 2, collected: 400, productCost: 170, deliveryCost: 60, packagingCost: 10,
      otherFees: 5, adCost: 1000, totalCost: 1245, profit: -845, avgConvinceHours: 13,
    })
    expect(omar).toMatchObject({ adCost: 300, totalCost: 430, profit: -230 })
  })

  it("summarises the funnel with its verdict rate and pending money", () => {
    const funnel = funnelSummary(ORDERS, CAMPAIGNS, "2026-10-10T09:00:00.000Z")
    expect(funnel).toMatchObject({ orders: 4, verified: 3, refused: 1, delivered: 2, verifiedRate: 0.75, toCollect: 100, collected: 600 })
  })
})

describe("stock and audience", () => {
  it("reserves only what verified, undelivered orders claim", () => {
    const availability = stockAvailability(STOCK, ORDERS)
    expect(availability.find((a) => a.item.id === "s1")).toMatchObject({ onHand: 20, reserved: 0, available: 20 })
    expect(availability.find((a) => a.item.id === "s2")).toMatchObject({ onHand: 5, reserved: 1, available: 4 })
  })

  it("describes the audience from the verified buyers only", () => {
    const audience = audienceInsights({ contacts: CONTACTS, orders: ORDERS, campaigns: CAMPAIGNS, stock: STOCK, currentYear: 2026 })
    expect(audience.buyers).toBe(2)
    expect(audience.byCity[0]).toMatchObject({ value: "Tanger", clients: 1, collected: 400 })
    expect(audience.bySource.map((s) => s.value)).toEqual(["facebook", "instagram"])
    expect(audience.byAge.map((s) => s.value).sort()).toEqual(["25-34", "35-44"])
    expect(audience.byKeyword[0]).toMatchObject({ value: "beauté", clients: 2, collected: 600 })
    expect(audience.byPlatform.map((s) => s.value)).toEqual(["facebook", "instagram"])
  })
})
