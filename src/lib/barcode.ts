import type { StockItem } from "../store/types"

/**
 * Matching a scanned (or typed) code to a stock item.
 *
 * A barcode reader returns whatever the label holds — an EAN-13, a QR with
 * the article's reference, a Code 128 from the supplier. The number under
 * the bars of most labels *is* the article's SKU in this app (the `sku`
 * field of a stock item), so matching is exact-after-normalization: codes
 * are compared trimmed and case-folded, never fuzzily — a scan that "almost"
 * matches another article's code must create a new article, not silently
 * move the wrong stock.
 */

/** The canonical form two codes are compared in. */
export function normalizeSku(code: string): string {
  return code.trim().replace(/\s+/g, "").toUpperCase()
}

/** The item carrying this code, if one does — first match wins on duplicates. */
export function findStockByCode(stock: readonly StockItem[], code: string): StockItem | undefined {
  const wanted = normalizeSku(code)
  if (!wanted) return undefined
  return stock.find((item) => normalizeSku(item.sku) === wanted)
}

/** A code worth looking up: non-empty once normalized. */
export function isUsableCode(code: string): boolean {
  return normalizeSku(code).length > 0
}
