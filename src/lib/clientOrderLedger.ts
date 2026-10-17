import type { AdCampaign, DeliveryOrder } from "../store/types"
import { adAllocations, orderEconomics, type OrderEconomics } from "./deliveryAnalytics"

export type ClientOrderEntry = {
  order: DeliveryOrder
  economics: OrderEconomics
}

export type ClientOrderLedger = {
  entries: ClientOrderEntry[]
  revenue: number
  collected: number
  outstanding: number
  profit: number
}

const emptyLedger = (): ClientOrderLedger => ({ entries: [], revenue: 0, collected: 0, outstanding: 0, profit: 0 })

/**
 * The client-page ledger posts only confirmed sales: verified orders, plus
 * delivered orders in case fulfilment was recorded before verification.
 * Returned/cancelled orders are excluded. Receivables stay distinct from
 * profit; profit follows Delivery's existing collected-minus-cost definition.
 */
export function clientOrderLedgers(
  orders: readonly DeliveryOrder[],
  campaigns: readonly AdCampaign[],
): Map<string, ClientOrderLedger> {
  const allocations = adAllocations(orders, campaigns)
  const ledgers = new Map<string, ClientOrderLedger>()
  for (const order of orders) {
    if (!(order.verificationStatus === "verified" || order.deliveryStatus === "delivered")
      || order.deliveryStatus === "returned"
      || order.deliveryStatus === "cancelled") continue
    const ledger = ledgers.get(order.clientId) ?? emptyLedger()
    const economics = orderEconomics(order, allocations.get(order.id) ?? 0)
    ledger.entries.push({ order, economics })
    ledger.revenue += economics.revenue
    ledger.collected += economics.collected
    ledger.outstanding += economics.outstanding
    ledger.profit += economics.profit
    ledgers.set(order.clientId, ledger)
  }
  return ledgers
}

export function clientOrderLedger(
  clientId: string,
  orders: readonly DeliveryOrder[],
  campaigns: readonly AdCampaign[],
): ClientOrderLedger {
  return clientOrderLedgers(orders, campaigns).get(clientId) ?? emptyLedger()
}
