import { describe, expect, it } from "vitest"
import { clientOrderLedger } from "../src/lib/clientOrderLedger"
import type { AdCampaign, DeliveryOrder } from "../src/store/types"

const campaign: AdCampaign = { id: "camp-1", name: "Launch", platform: "facebook", spend: 100, startedAt: "2026-10-01", endedAt: "" }
function order(patch: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: "order-1", clientId: "client-1", campaignId: "camp-1", createdAt: "2026-10-01T09:00:00.000Z",
    items: [{ stockId: null, label: "Service", qty: 1, unitPrice: 300, unitCost: 80 }],
    deliveryCost: 20, packagingCost: 0, otherFees: 0, amountPaid: 150, verificationStatus: "verified", deliveryStatus: "pending",
    callAttempts: 1, firstCallAt: null, verifiedAt: "2026-10-01T10:00:00.000Z", paidAt: null, shippedAt: null, deliveredAt: null,
    stockDeducted: false, notes: "", ...patch,
  }
}

describe("client delivery ledger", () => {
  it("adds confirmed revenue, collected profit and the unpaid remainder separately", () => {
    const result = clientOrderLedger("client-1", [order()], [campaign])
    expect(result).toMatchObject({ revenue: 300, collected: 150, outstanding: 150, profit: -50 })
    expect(result.entries).toHaveLength(1)
  })

  it("does not post unverified leads or returned/cancelled orders as client receivables", () => {
    const result = clientOrderLedger("client-1", [
      order({ id: "lead", verificationStatus: "new", amountPaid: 0 }),
      order({ id: "returned", deliveryStatus: "returned", amountPaid: 0 }),
      order({ id: "cancelled", deliveryStatus: "cancelled", amountPaid: 0 }),
    ], [campaign])
    expect(result).toMatchObject({ revenue: 0, collected: 0, outstanding: 0, profit: 0 })
    expect(result.entries).toHaveLength(0)
  })

  it("posts a delivered sale even if verification status was not updated first", () => {
    const result = clientOrderLedger("client-1", [order({ verificationStatus: "new", deliveryStatus: "delivered" })], [campaign])
    expect(result.entries).toHaveLength(1)
    expect(result.outstanding).toBe(150)
  })
})
