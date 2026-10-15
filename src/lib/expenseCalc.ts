import type { Expense, ExpenseItem } from "../store/types"

/**
 * The money of an expense: HT, TVA, TTC — and how many items it bought.
 *
 * One convention keeps every reader honest: `Expense.amount` is always what
 * was actually paid, tax included (TTC). Dashboards and totals have always
 * summed it, and they keep summing the same number. What is new is the
 * *split*:
 *
 *  - with line items, HT is their sum and TVA is computed on top of it at
 *    the expense's own rate (the TTC the form saves is exactly that sum);
 *  - without items, the split is derived from the TTC and the rate;
 *  - a legacy expense with no rate splits into `null`s, not into invented
 *    numbers — "we don't know" is displayed as such.
 *
 * The rate is a percent (20 means 20 %), like `Settings.taxRate`.
 */

/** Round to cents — money never carries a third decimal out of here. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Σ qty × unit price over the lines, in HT. */
export function itemsSubtotalHt(items: readonly ExpenseItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0))
}

/** Total number of items bought across the lines. */
export function itemsQuantity(items: readonly ExpenseItem[] | undefined): number {
  return items?.reduce((sum, item) => sum + item.qty, 0) ?? 0
}

export type ExpenseBreakdown = {
  /** Number of items across the lines (0 when the expense is not itemised). */
  quantity: number
  /** Amount excluding tax, or null when no rate is known to derive it. */
  subtotalHt: number | null
  /** The expense's TVA rate (%), or null when not recorded. */
  taxRate: number | null
  /** The TVA amount, or null alongside a null HT. */
  taxAmount: number | null
  /** What was paid (TTC): always the expense's own amount. */
  total: number
}

export function expenseBreakdown(
  expense: Pick<Expense, "amount" | "items" | "taxRate">,
): ExpenseBreakdown {
  const items = expense.items?.length ? expense.items : undefined
  const quantity = itemsQuantity(items)
  const rate =
    typeof expense.taxRate === "number" && Number.isFinite(expense.taxRate) && expense.taxRate >= 0
      ? expense.taxRate
      : null

  if (items) {
    const ht = itemsSubtotalHt(items)
    if (rate === null) {
      // Itemised but unrated: the HT is a fact, the tax is unknown.
      return { quantity, subtotalHt: ht, taxRate: null, taxAmount: null, total: expense.amount }
    }
    return {
      quantity,
      subtotalHt: ht,
      taxRate: rate,
      taxAmount: roundMoney((ht * rate) / 100),
      total: expense.amount,
    }
  }

  if (rate === null) {
    return { quantity: 0, subtotalHt: null, taxRate: null, taxAmount: null, total: expense.amount }
  }
  const ht = roundMoney(expense.amount / (1 + rate / 100))
  return {
    quantity: 0,
    subtotalHt: ht,
    taxRate: rate,
    taxAmount: roundMoney(expense.amount - ht),
    total: expense.amount,
  }
}
