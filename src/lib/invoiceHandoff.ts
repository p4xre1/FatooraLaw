import type { Contact, DeliveryOrder } from "../store/types"
import { calendarDay, todayISO } from "./calendarDates"
import { navigate } from "./router"

export type OrderInvoicePrefill = {
  orderId: string
  issuedOn: string
  taxRate: number
  amountPaid: number
  client: { name: string; address: string; ice: string }
  items: { description: string; quantity: number; unitPriceTtc: number }[]
}

const PENDING_KEY = "fatorati.invoice.pending."
export const pendingInvoiceKey = (accountId: string | null | undefined) => `${PENDING_KEY}${encodeURIComponent(accountId || "local")}`

/** Store an account-scoped order snapshot and open the existing editable invoice page. */
export function requestInvoiceFromOrder(
  order: DeliveryOrder,
  client: Contact | undefined,
  taxRate: number,
  accountId: string | null | undefined,
): boolean {
  if (typeof window === "undefined" || order.verificationStatus !== "verified" || order.items.length === 0) return false
  const prefill: OrderInvoicePrefill = {
    orderId: order.id,
    issuedOn: calendarDay(order.createdAt.slice(0, 10)) === null ? todayISO() : order.createdAt.slice(0, 10),
    taxRate: Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100 ? taxRate : 0,
    amountPaid: Number.isFinite(order.amountPaid) ? Math.max(0, order.amountPaid) : 0,
    client: {
      name: client?.name ?? "",
      address: client?.city ?? "",
      ice: client?.ice ?? "",
    },
    items: order.items.map((item) => ({ description: item.label, quantity: item.qty, unitPriceTtc: item.unitPrice })),
  }
  try {
    window.localStorage.setItem(pendingInvoiceKey(accountId), JSON.stringify(prefill))
  } catch {
    return false
  }
  navigate("/invoices")
  return true
}

export function readPendingInvoicePrefill(accountId: string | null | undefined): OrderInvoicePrefill | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(pendingInvoiceKey(accountId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const row = value as Partial<OrderInvoicePrefill>
    if (typeof row.orderId !== "string" || !row.orderId || typeof row.issuedOn !== "string" || calendarDay(row.issuedOn) === null
      || typeof row.taxRate !== "number" || !Number.isFinite(row.taxRate) || row.taxRate < 0 || row.taxRate > 100
      || typeof row.amountPaid !== "number" || !Number.isFinite(row.amountPaid) || row.amountPaid < 0
      || !row.client || typeof row.client.name !== "string" || typeof row.client.address !== "string" || typeof row.client.ice !== "string"
      || !Array.isArray(row.items) || row.items.length === 0) return null
    const items = row.items.filter((item) => item && typeof item.description === "string"
      && typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
      && typeof item.unitPriceTtc === "number" && Number.isFinite(item.unitPriceTtc) && item.unitPriceTtc >= 0)
    if (items.length !== row.items.length) return null
    return { ...row, client: { ...row.client }, items: items.map((item) => ({ ...item })) } as OrderInvoicePrefill
  } catch {
    return null
  }
}
