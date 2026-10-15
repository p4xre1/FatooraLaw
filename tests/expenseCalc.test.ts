import { describe, expect, it } from "vitest"
import { expenseBreakdown, itemsQuantity, itemsSubtotalHt, roundMoney } from "../src/lib/expenseCalc"

/**
 * The expense split: amount is always what was paid (TTC); HT and TVA are
 * derived, never invented. A legacy expense without a rate must say
 * "unknown" (null), because a TVA claim built on a guessed rate is worse
 * than no claim at all.
 */

describe("expense money", () => {
  it("rounds to cents, half-up", () => {
    expect(roundMoney(0.125)).toBe(0.13)
    expect(roundMoney(10.004)).toBe(10)
    expect(roundMoney(10.005)).toBe(10.01)
  })

  it("splits an itemised expense at its own rate", () => {
    const b = expenseBreakdown({
      amount: 960,
      taxRate: 20,
      items: [
        { label: "Ciment", qty: 10, unitPrice: 60 },
        { label: "Sable", qty: 2, unitPrice: 100 },
      ],
    })
    expect(b.subtotalHt).toBe(800)
    expect(b.taxAmount).toBe(160)
    expect(b.total).toBe(960)
    expect(b.quantity).toBe(12)
  })

  it("counts the number of items across lines", () => {
    expect(itemsQuantity([{ label: "a", qty: 3, unitPrice: 1 }, { label: "b", qty: 4, unitPrice: 1 }])).toBe(7)
    expect(itemsQuantity(undefined)).toBe(0)
    expect(itemsSubtotalHt([{ label: "a", qty: 3, unitPrice: 33.33 }])).toBe(99.99)
  })

  it("derives HT from the TTC when there are no lines", () => {
    const b = expenseBreakdown({ amount: 240, taxRate: 20 })
    expect(b.subtotalHt).toBe(200)
    expect(b.taxAmount).toBe(40)
    expect(b.total).toBe(240)
  })

  it("treats a 0% rate as fully HT", () => {
    const b = expenseBreakdown({ amount: 150, taxRate: 0 })
    expect(b.subtotalHt).toBe(150)
    expect(b.taxAmount).toBe(0)
  })

  it("keeps a legacy expense honest: no rate, no invented split", () => {
    const b = expenseBreakdown({ amount: 123.5 })
    expect(b.subtotalHt).toBeNull()
    expect(b.taxAmount).toBeNull()
    expect(b.total).toBe(123.5)
  })

  it("knows the HT of rated items even when the rate is missing", () => {
    const b = expenseBreakdown({ amount: 300, items: [{ label: "Bois", qty: 3, unitPrice: 100 }] })
    expect(b.subtotalHt).toBe(300)
    expect(b.taxAmount).toBeNull()
  })
})
