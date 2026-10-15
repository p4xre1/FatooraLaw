import { describe, expect, it } from "vitest"
import { moneyOverview } from "../src/lib/moneyOverview"
import type {
  AdCampaign, Contact, Contract, DeliveryOrder, Expense, Project, StockItem, SubscriptionTool,
} from "../src/store/types"

/**
 * The whole money picture, pinned by hand: every figure the app reads —
 * projects, expenses and their VAT, orders and their costs, ads, stock,
 * contracts, subscriptions — consolidated once, scored in the open.
 */

const PROJECT: Project = {
  id: "pj-x", name: "Villa", clientId: "c1", budget: 10_000, paid: 6_000, cost: 0,
  status: "active", progress: 50, start: "2026-01-05", end: "2026-12-01", milestones: [], equipmentIds: [],
}
const EXPENSES: Expense[] = [
  { id: "e1", date: "2026-10-01", vendorId: "s1", category: "Matériaux", method: "cash", amount: 1000, status: "approved", receipt: true, note: "", taxRate: 20 },
  { id: "e2", date: "2026-10-02", vendorId: "s1", category: "Matériaux", method: "cash", amount: 500, status: "pending", receipt: false, note: "" },
]
const CONTACT: Contact = { id: "c1", type: "client", name: "Salma Bennani", ice: "", phone: "", email: "", city: "Tanger", balance: 2000 }
const CAMPAIGN: AdCampaign = { id: "camp1", name: "Meta", platform: "facebook", spend: 100, startedAt: "2026-10-01", endedAt: "" }
const ORDER: DeliveryOrder = {
  id: "o1", clientId: "c1", campaignId: "camp1", createdAt: "2026-10-01T09:00:00.000Z",
  items: [{ stockId: "st1", label: "Crème", qty: 1, unitPrice: 500, unitCost: 200 }],
  deliveryCost: 30, packagingCost: 10, otherFees: 10, amountPaid: 500,
  verificationStatus: "verified", deliveryStatus: "delivered", callAttempts: 1,
  firstCallAt: "2026-10-01T10:00:00.000Z", verifiedAt: "2026-10-01T12:00:00.000Z",
  paidAt: "2026-10-01T12:00:00.000Z", shippedAt: null, deliveredAt: "2026-10-02T09:00:00.000Z",
  stockDeducted: true, notes: "",
}
const STOCK: StockItem[] = [
  { id: "st1", name: "Crème", sku: "C1", qty: 10, minQty: 2, unit: "pièce", assignedProjectId: null, type: "material", costPrice: 50 },
  { id: "st2", name: "Sans prix", sku: "C2", qty: 3, minQty: 1, unit: "pièce", assignedProjectId: null, type: "material" },
]
const TOOLS: SubscriptionTool[] = [
  { id: "t1", name: "Sage", cost: 99, start: "2026-01-01", expiry: "2027-01-01" },
  { id: "t2", name: "Ancien", cost: 50, start: "2019-01-01", expiry: "2020-01-01" },
]
const CONTRACTS: Contract[] = [
  { id: "k1", type: "service", title: "Signé", clientId: "c1", value: 5000, date: "2026-09-01", status: "signed" },
  { id: "k2", type: "service", title: "Brouillon", clientId: "c1", value: 7000, date: "2026-09-01", status: "draft" },
]

const base = {
  projects: [PROJECT], expenses: EXPENSES, contacts: [CONTACT], audit: [],
  orders: [ORDER], campaigns: [CAMPAIGN], stock: STOCK, tools: TOOLS, contracts: CONTRACTS,
  today: "2026-10-15",
}

describe("the consolidated money picture", () => {
  it("reads every source once and derives in, out and what remains", () => {
    const money = moneyOverview(base)
    expect(money).toMatchObject({
      hasData: true,
      inProjects: 6000, inOrders: 500, totalIn: 6500,
      contractedProjects: 10_000, ordersRevenue: 500, contractedTotal: 10_500,
      outPurchases: 1000, outProducts: 200, outFulfilment: 50, outAds: 100, totalOut: 1350,
      net: 5150, ordersProfit: 150,
      receivables: 2000, toCollect: 0,
      stockValue: 500, stockUnknown: 1,
      contractsSigned: 5000, vatRecoverable: 166.67, subscriptionsMonthly: 99,
    })
  })

  it("scores collections, profitability and coverage in the open", () => {
    const money = moneyOverview(base)
    // 6 500 / 10 500 collected → 25/40 · margin 30% → 30/30 · keeps 79% → 30/30.
    expect(money.score.parts).toEqual([
      { key: "collection", points: 25, max: 40, ratio: 6500 / 10_500 },
      { key: "margin", points: 30, max: 30, ratio: 0.3 },
      { key: "coverage", points: 30, max: 30, ratio: 5150 / 6500 },
    ])
    expect(money.score.value).toBe(85)
  })

  it("says so, instead of inventing a score, when nothing is recorded", () => {
    const money = moneyOverview({ ...base, projects: [], expenses: [], contacts: [], orders: [], campaigns: [], stock: [], tools: [], contracts: [] })
    expect(money.hasData).toBe(false)
    expect(money.score.value).toBeNull()
    expect(money.totalIn).toBe(0)
  })
})
