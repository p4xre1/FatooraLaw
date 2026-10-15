import { describe, expect, it } from "vitest"
import { findStockByCode, isUsableCode, normalizeSku } from "../src/lib/barcode"
import type { StockItem } from "../src/store/types"

/**
 * A scan matches a SKU exactly, after normalization — never approximately.
 * In a stockroom a near-match applied to the wrong article is worse than
 * no match at all, so the fuzzy cases are asserted to miss.
 */

const item = (sku: string, name = "Article"): StockItem => ({
  id: sku, name, sku, qty: 3, minQty: 1, unit: "pièce", assignedProjectId: null, type: "material",
})

describe("matching a scanned code to stock", () => {
  it("normalizes case, padding and inner spaces", () => {
    expect(normalizeSku(" 6194 0012 ")).toBe("61940012")
    expect(normalizeSku("ab-c12")).toBe("AB-C12") // hyphens are data, kept
  })

  it("finds the article whatever case the label used", () => {
    const stock = [item("6194001234567", "Ciment"), item("REF-9", "Perceuse")]
    expect(findStockByCode(stock, "6194001234567")?.name).toBe("Ciment")
    expect(findStockByCode(stock, " ref-9 ")?.name).toBe("Perceuse")
  })

  it("misses honestly: unknown, empty and near-miss codes find nothing", () => {
    const stock = [item("6194001234567")]
    expect(findStockByCode(stock, "6194001234568")).toBeUndefined() // one digit off
    expect(findStockByCode(stock, "619400123456")).toBeUndefined() // truncated scan
    expect(findStockByCode(stock, "")).toBeUndefined()
    expect(findStockByCode(stock, "   ")).toBeUndefined()
    expect(isUsableCode(" ")).toBe(false)
    expect(isUsableCode(" X1 ")).toBe(true)
  })

  it("prefers the first article when two share a code", () => {
    const stock = [item("DUP", "Premier"), item("DUP", "Second")]
    expect(findStockByCode(stock, "dup")?.name).toBe("Premier")
  })
})
