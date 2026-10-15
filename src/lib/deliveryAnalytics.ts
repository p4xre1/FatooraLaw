import type {
  AdCampaign, AdPlatform, Contact, DeliveryOrder, OrderPaymentStatus, StockItem,
} from "../store/types"
import { roundMoney } from "./expenseCalc"
import { clientAge } from "./clientRank"
import { sanitizeKeywords } from "./keywords"

/**
 * What an ad-bought client costs, and who the audience really is.
 *
 * Everything here is computed from records the business typed itself —
 * orders, their costs, the campaigns' spend — never estimated. Three
 * questions get exact answers:
 *
 *   1. What did this client cost us? Product + delivery + packaging +
 *      other fees, plus the campaign's cost per verified client (its
 *      spend divided by the clients it actually verified — charged once
 *      per client, on their first verified order, never per order).
 *   2. How long do people wait, and how long do they take to convince?
 *      The order's stage stamps (`firstCallAt`, `verifiedAt`) are written
 *      by the store when the stage changes, so the durations are read
 *      off the record.
 *   3. Who is the target audience? The verified buyers, grouped by city,
 *      source, channel, age band, campaign and the products they bought —
 *      the profile the next campaign should be aimed at.
 */

const HOUR = 3_600_000

/* ------------------------------- one order ------------------------------ */

export function orderRevenue(order: DeliveryOrder): number {
  return roundMoney(order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0))
}

export function orderProductCost(order: DeliveryOrder): number {
  return roundMoney(order.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0))
}

/** Delivery + packaging + everything else the delivery itself cost. */
export function orderFulfilmentCost(order: DeliveryOrder): number {
  return roundMoney(order.deliveryCost + order.packagingCost + order.otherFees)
}

export function orderQuantity(order: DeliveryOrder): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0)
}

export function paymentStatus(order: DeliveryOrder): OrderPaymentStatus {
  const revenue = orderRevenue(order)
  if (revenue > 0 && order.amountPaid >= revenue) return "paid"
  return order.amountPaid > 0 ? "partial" : "unpaid"
}

/* ------------------------------- durations ------------------------------ */

export function durationHours(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / HOUR
}

export type OrderTimings = {
  /** Arrival → first call. While uncalled, the wait so far. */
  waitHours: number | null
  /** First call → verified: how long this client took to convince. */
  convinceHours: number | null
  /** Arrival → verified (or the wait so far, while unverified). */
  verifyHours: number | null
}

export function orderTimings(order: DeliveryOrder, now: string): OrderTimings {
  // A seeded/legacy verified order may carry no first-call stamp; the
  // verification stamp is then the earliest honest "we reached them".
  const firstCall = order.firstCallAt ?? order.verifiedAt
  const verified = order.verificationStatus === "verified"
  return {
    waitHours: durationHours(order.createdAt, firstCall ?? (verified ? order.verifiedAt : now)),
    convinceHours: durationHours(firstCall, order.verifiedAt),
    verifyHours: durationHours(order.createdAt, verified ? order.verifiedAt : now),
  }
}

function average(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v))
  return known.length ? roundMoney(known.reduce((a, b) => a + b, 0) / known.length) : null
}

/* ------------------------------- campaigns ------------------------------ */

export type CampaignPerformance = {
  campaign: AdCampaign
  /** Distinct clients the campaign brought in. */
  leads: number
  /** Distinct clients it got verified — the denominator of its CAC. */
  verifiedClients: number
  deliveredOrders: number
  /** Money actually collected on the campaign's orders. */
  collected: number
  conversionRate: number | null
  /** Spend per verified client; null while nobody is verified. */
  cac: number | null
  costPerLead: number | null
}

export function campaignPerformance(campaigns: readonly AdCampaign[], orders: readonly DeliveryOrder[]): CampaignPerformance[] {
  return campaigns.map((campaign) => {
    const own = orders.filter((order) => order.campaignId === campaign.id)
    const leads = new Set(own.map((order) => order.clientId)).size
    const verifiedClients = new Set(
      own.filter((order) => order.verificationStatus === "verified").map((order) => order.clientId),
    ).size
    return {
      campaign,
      leads,
      verifiedClients,
      deliveredOrders: own.filter((order) => order.deliveryStatus === "delivered").length,
      collected: roundMoney(own.reduce((sum, order) => sum + order.amountPaid, 0)),
      conversionRate: leads ? verifiedClients / leads : null,
      cac: verifiedClients ? roundMoney(campaign.spend / verifiedClients) : null,
      costPerLead: leads ? roundMoney(campaign.spend / leads) : null,
    }
  })
}

/**
 * The ad cost charged to each order. A campaign's CAC belongs to the
 * client, so it lands whole on that client's first verified order in the
 * campaign; repeat orders carry none. Unverified orders carry none.
 */
export function adAllocations(
  orders: readonly DeliveryOrder[],
  campaigns: readonly AdCampaign[],
): Map<string, number> {
  const cacByCampaign = new Map(campaignPerformance(campaigns, orders).map((p) => [p.campaign.id, p.cac]))
  const charged = new Set<string>()
  const allocations = new Map<string, number>()
  const verified = orders
    .filter((order) => order.verificationStatus === "verified" && order.campaignId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const order of orders) allocations.set(order.id, 0)
  for (const order of verified) {
    const key = `${order.campaignId}:${order.clientId}`
    if (charged.has(key)) continue
    charged.add(key)
    allocations.set(order.id, cacByCampaign.get(order.campaignId!) ?? 0)
  }
  return allocations
}

/* ------------------------------ per client ------------------------------ */

export type OrderEconomics = {
  revenue: number
  collected: number
  outstanding: number
  productCost: number
  fulfilmentCost: number
  adCost: number
  /** Everything this order cost us, ads included. */
  totalCost: number
  /** Collected minus total cost: what the order actually left behind. */
  profit: number
}

export function orderEconomics(order: DeliveryOrder, adCost: number): OrderEconomics {
  const revenue = orderRevenue(order)
  const productCost = orderProductCost(order)
  const fulfilmentCost = orderFulfilmentCost(order)
  const totalCost = roundMoney(productCost + fulfilmentCost + adCost)
  return {
    revenue,
    collected: order.amountPaid,
    outstanding: roundMoney(Math.max(0, revenue - order.amountPaid)),
    productCost,
    fulfilmentCost,
    adCost,
    totalCost,
    profit: roundMoney(order.amountPaid - totalCost),
  }
}

export type ClientCostSummary = {
  contact: Contact
  orders: number
  verifiedOrders: number
  deliveredOrders: number
  revenue: number
  collected: number
  productCost: number
  deliveryCost: number
  packagingCost: number
  otherFees: number
  adCost: number
  totalCost: number
  profit: number
  /** Mean arrival → verification over this client's verified orders. */
  avgVerifyHours: number | null
  /** Mean first call → verification: this client's convincing time. */
  avgConvinceHours: number | null
}

/** Every client who ordered, what they cost, and what they left. Costliest first. */
export function clientCosts(
  contacts: readonly Contact[],
  orders: readonly DeliveryOrder[],
  campaigns: readonly AdCampaign[],
): ClientCostSummary[] {
  const allocations = adAllocations(orders, campaigns)
  const byClient = new Map<string, DeliveryOrder[]>()
  for (const order of orders) {
    const list = byClient.get(order.clientId) ?? []
    list.push(order)
    byClient.set(order.clientId, list)
  }
  const now = new Date().toISOString()
  const summaries: ClientCostSummary[] = []
  for (const [clientId, own] of byClient) {
    const contact = contacts.find((c) => c.id === clientId)
    if (!contact) continue
    // A refused or cancelled order never became business: it counts in the
    // client's history, but its product and delivery lines — never spent —
    // stay out of what the client cost us.
    const bearing = own.filter((order) => order.verificationStatus !== "refused" && order.deliveryStatus !== "cancelled")
    const sum = (pick: (order: DeliveryOrder) => number) => roundMoney(bearing.reduce((total, order) => total + pick(order), 0))
    const productCost = sum(orderProductCost)
    const deliveryCost = sum((order) => order.deliveryCost)
    const packagingCost = sum((order) => order.packagingCost)
    const otherFees = sum((order) => order.otherFees)
    const adCost = sum((order) => allocations.get(order.id) ?? 0)
    const collected = sum((order) => order.amountPaid)
    const totalCost = roundMoney(productCost + deliveryCost + packagingCost + otherFees + adCost)
    const timings = own
      .filter((order) => order.verificationStatus === "verified")
      .map((order) => orderTimings(order, now))
    summaries.push({
      contact,
      orders: own.length,
      verifiedOrders: own.filter((order) => order.verificationStatus === "verified").length,
      deliveredOrders: own.filter((order) => order.deliveryStatus === "delivered").length,
      revenue: sum(orderRevenue),
      collected,
      productCost,
      deliveryCost,
      packagingCost,
      otherFees,
      adCost,
      totalCost,
      profit: roundMoney(collected - totalCost),
      avgVerifyHours: average(timings.map((t) => t.verifyHours)),
      avgConvinceHours: average(timings.map((t) => t.convinceHours)),
    })
  }
  return summaries.sort((a, b) => b.totalCost - a.totalCost || b.collected - a.collected || a.contact.name.localeCompare(b.contact.name))
}

/* -------------------------------- funnel -------------------------------- */

export type FunnelSummary = {
  orders: number
  waiting: number
  inCall: number
  verified: number
  refused: number
  delivered: number
  /** Verified orders ÷ orders that got a verdict (verified or refused). */
  verifiedRate: number | null
  avgWaitHours: number | null
  avgConvinceHours: number | null
  avgVerifyHours: number | null
  /** Still to collect on verified orders. */
  toCollect: number
  collected: number
  totalCost: number
  profit: number
}

export function funnelSummary(
  orders: readonly DeliveryOrder[],
  campaigns: readonly AdCampaign[],
  now: string,
): FunnelSummary {
  const allocations = adAllocations(orders, campaigns)
  const verified = orders.filter((order) => order.verificationStatus === "verified")
  const refused = orders.filter((order) => order.verificationStatus === "refused")
  const timings = orders.map((order) => orderTimings(order, now))
  const economics = orders
    .filter((order) => order.verificationStatus !== "refused" && order.deliveryStatus !== "cancelled")
    .map((order) => orderEconomics(order, allocations.get(order.id) ?? 0))
  return {
    orders: orders.length,
    waiting: orders.filter((order) => order.verificationStatus === "new").length,
    inCall: orders.filter((order) => order.verificationStatus === "calling" || order.verificationStatus === "no_answer").length,
    verified: verified.length,
    refused: refused.length,
    delivered: orders.filter((order) => order.deliveryStatus === "delivered").length,
    verifiedRate: verified.length + refused.length ? verified.length / (verified.length + refused.length) : null,
    avgWaitHours: average(orders.map((order, i) => (order.firstCallAt || order.verifiedAt ? timings[i].waitHours : null))),
    avgConvinceHours: average(verified.map((order) => orderTimings(order, now).convinceHours)),
    avgVerifyHours: average(verified.map((order) => orderTimings(order, now).verifyHours)),
    toCollect: roundMoney(verified.reduce((sum, order) => sum + Math.max(0, orderRevenue(order) - order.amountPaid), 0)),
    collected: roundMoney(economics.reduce((sum, e) => sum + e.collected, 0)),
    totalCost: roundMoney(economics.reduce((sum, e) => sum + e.totalCost, 0)),
    profit: roundMoney(economics.reduce((sum, e) => sum + e.profit, 0)),
  }
}

/* --------------------------------- stock -------------------------------- */

export type StockAvailability = {
  item: StockItem
  /** Physically on the shelf. */
  onHand: number
  /** Promised to verified orders being prepared or shipped. */
  reserved: number
  available: number
}

/** What we actually have: on hand, minus what verified orders already claim. */
export function stockAvailability(stock: readonly StockItem[], orders: readonly DeliveryOrder[]): StockAvailability[] {
  const reservedById = new Map<string, number>()
  for (const order of orders) {
    if (order.verificationStatus !== "verified") continue
    if (order.deliveryStatus !== "preparing" && order.deliveryStatus !== "shipped" && order.deliveryStatus !== "pending") continue
    for (const line of order.items) {
      if (line.stockId) reservedById.set(line.stockId, (reservedById.get(line.stockId) ?? 0) + line.qty)
    }
  }
  return stock.map((item) => {
    const reserved = reservedById.get(item.id) ?? 0
    return { item, onHand: item.qty, reserved, available: Math.max(0, item.qty - reserved) }
  })
}

/* ------------------------------- audience ------------------------------- */

export type AudienceSegment = {
  /** The raw value (a city, a source key, an age band, a keyword…). */
  value: string
  clients: number
  orders: number
  collected: number
  /** Share of the verified buyers, 0..1. */
  share: number
}

function segments(
  rows: { clientId: string; order: DeliveryOrder; values: string[] }[],
  buyers: number,
): AudienceSegment[] {
  const byValue = new Map<string, { clients: Set<string>; orders: Set<string>; collected: number }>()
  for (const row of rows) {
    for (const value of row.values) {
      if (!value) continue
      const entry = byValue.get(value) ?? { clients: new Set<string>(), orders: new Set<string>(), collected: 0 }
      entry.clients.add(row.clientId)
      if (!entry.orders.has(row.order.id)) {
        entry.orders.add(row.order.id)
        entry.collected += row.order.amountPaid
      }
      byValue.set(value, entry)
    }
  }
  return [...byValue.entries()]
    .map(([value, entry]) => ({
      value,
      clients: entry.clients.size,
      orders: entry.orders.size,
      collected: roundMoney(entry.collected),
      share: buyers ? entry.clients.size / buyers : 0,
    }))
    .sort((a, b) => b.clients - a.clients || b.collected - a.collected || a.value.localeCompare(b.value))
}

export function ageBand(age: number | null): string {
  if (age === null) return "unknown"
  if (age < 25) return "18-24"
  if (age < 35) return "25-34"
  if (age < 45) return "35-44"
  if (age < 55) return "45-54"
  return "55+"
}

export type AudienceInsights = {
  /** Distinct clients with at least one verified order — the audience. */
  buyers: number
  byCity: AudienceSegment[]
  bySource: AudienceSegment[]
  byChannel: AudienceSegment[]
  byAge: AudienceSegment[]
  byPlatform: AudienceSegment[]
  byKeyword: AudienceSegment[]
  campaigns: CampaignPerformance[]
}

/**
 * The target audience, read off the verified buyers: where they live, how
 * they found the business, how they buy, how old they are, which campaign
 * brought them and what they bought. This is who the next ad should aim at.
 */
export function audienceInsights(input: {
  contacts: readonly Contact[]
  orders: readonly DeliveryOrder[]
  campaigns: readonly AdCampaign[]
  stock: readonly StockItem[]
  currentYear: number
}): AudienceInsights {
  const { contacts, orders, campaigns, stock, currentYear } = input
  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const stockById = new Map(stock.map((item) => [item.id, item]))
  const campaignById = new Map(campaigns.map((c) => [c.id, c]))
  const verified = orders.filter((order) => order.verificationStatus === "verified")
  const buyerIds = new Set(verified.map((order) => order.clientId))
  const buyers = buyerIds.size

  const rows = verified.flatMap((order) => {
    const contact = contactById.get(order.clientId)
    if (!contact) return []
    const keywords = new Set<string>()
    for (const line of order.items) {
      const item = line.stockId ? stockById.get(line.stockId) : undefined
      for (const word of sanitizeKeywords(item?.keywords)) keywords.add(word)
    }
    return [{
      clientId: order.clientId,
      order,
      city: contact.city.trim(),
      source: contact.source ?? "unknown",
      channel: contact.channel ?? "unknown",
      age: ageBand(clientAge(contact.birthYear, currentYear)),
      platform: order.campaignId ? campaignById.get(order.campaignId)?.platform ?? "unknown" : "organic",
      keywords: [...keywords],
    }]
  })

  return {
    buyers,
    byCity: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: [r.city] })), buyers),
    bySource: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: [r.source] })), buyers),
    byChannel: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: [r.channel] })), buyers),
    byAge: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: [r.age] })), buyers),
    byPlatform: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: [r.platform] })), buyers),
    byKeyword: segments(rows.map((r) => ({ clientId: r.clientId, order: r.order, values: r.keywords })), buyers),
    campaigns: campaignPerformance(campaigns, orders),
  }
}

export type { AdPlatform }
