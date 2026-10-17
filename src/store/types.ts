export type Role = "owner" | "accountant" | "supervisor" | "assistant"

export type ModuleKey =
  | "dashboard"
  | "projects"
  | "invoices"
  | "contacts"
  | "procurement"
  | "inventory"
  | "delivery"
  | "verification"
  | "legal"
  | "reports"
  | "calendar"
  | "risk"
  | "tools"
  | "team"
  | "audit"
  | "settings"

export type Milestone = { id: string; label: string; done: boolean }

export type Project = {
  id: string
  name: string
  clientId: string
  budget: number
  paid: number
  cost: number
  status: "planning" | "active" | "on_hold" | "done"
  progress: number
  start: string
  end: string
  milestones: Milestone[]
  equipmentIds: string[]
}

/** Where a client first heard of Fatorati — the acquisition source. */
export type ContactSource = "whatsapp" | "instagram" | "facebook" | "google" | "referral" | "other"

/** The channel the sale itself happens through. */
export type SalesChannel = "direct" | "whatsapp" | "instagram" | "facebook" | "reseller" | "other"

export type Contact = {
  id: string
  type: "client" | "supplier"
  name: string
  ice: string
  phone: string
  email: string
  city: string
  balance: number // positive = they owe us (receivable), negative = we owe them
  /** Birth year, when known — the ranking's age signal (never a full date). */
  birthYear?: number | null
  /** How this client found Fatorati. */
  source?: ContactSource | null
  /** How this client usually buys. */
  channel?: SalesChannel | null
}

/** One bought article on an expense: what, how many, at what unit price. */
export type ExpenseItem = {
  label: string
  /** Number of items bought. */
  qty: number
  /** Unit price excluding tax (HT). */
  unitPrice: number
  /** Free keywords (ciment, promo, chantier…) for purchase analysis. */
  keywords?: string[]
}

export type Expense = {
  id: string
  date: string
  vendorId: string
  category: string
  method: "transfer" | "check" | "cash"
  /** What was paid, tax included (TTC) — the dashboard's number. */
  amount: number
  status: "pending" | "approved"
  /** A receipt/invoice is noted for this expense (paper, or the photo below). */
  receipt: boolean
  note: string
  /** Line detail, when the purchase was itemised. `amount` is its TTC total. */
  items?: ExpenseItem[]
  /** TVA rate (%) charged on this expense — the TVA récupérable basis. */
  taxRate?: number
  /** The receipt photo itself, stored with the record (data URL, ≤ 512 KB). */
  receiptImage?: string | null
}

export type StockItem = {
  id: string
  name: string
  sku: string
  qty: number
  minQty: number
  unit: string
  assignedProjectId: string | null
  type: "material" | "equipment"
  /** Free keywords (ciment, plomberie…) — the categories clients are ranked by. */
  keywords?: string[]
  /** Purchase cost of one unit, when known — the product-cost basis of an order. */
  costPrice?: number
}

export type Contract = {
  id: string
  type: "construction" | "service" | "rental"
  title: string
  clientId: string
  value: number
  date: string
  status: "draft" | "sent" | "signed"
}

export type Severity = "info" | "warning" | "critical"

export type AuditEvent = {
  id: string
  ts: number
  actor: string
  action: string
  target: string
  module: ModuleKey
  severity: Severity
}

export type TeamMember = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  permissions: Record<ModuleKey, boolean>
}

export type Settings = {
  company: string
  ice: string
  taxId: string
  rc: string
  address: string
  city: string
  currency: "MAD" | "EUR" | "USD"
  taxRate: number
  logo: string | null
  headerNote: string
  footerNote: string
}

export type SubscriptionTool = {
  id: string
  name: string
  cost: number // planned monthly cost, not a recorded payment
  start: string // ISO date, empty means no known start
  expiry: string // ISO date, empty means no expiry
}

/** A date the business wants to remember; these are user-entered, not legal advice. */
export type CalendarEventKind = "event" | "deadline"
export type CalendarEvent = {
  id: string
  title: string
  /** Normalized ISO date (`YYYY-MM-DD`). */
  date: string
  kind: CalendarEventKind
  note: string
}

/** An advertising platform a campaign ran on. */
export type AdPlatform = "facebook" | "instagram" | "google" | "tiktok" | "whatsapp" | "other"

/** A paid acquisition campaign: what was spent to bring clients in. */
export type AdCampaign = {
  id: string
  name: string
  platform: AdPlatform
  /** Total amount spent on the campaign, in the account currency. */
  spend: number
  startedAt: string
  endedAt: string
  /** Aggregate ad-platform metrics, when imported from a report. Optional:
   *  never account credentials or per-user data — campaign-level only. */
  impressions?: number
  clicks?: number
  conversions?: number
  conversionValue?: number
}

/** Call-confirmation stage of an order's client. */
export type VerificationStatus = "new" | "calling" | "no_answer" | "verified" | "refused"

/** A caller in the business's verification group. */
export type VerificationAgent = { id: string; name: string }
export type VerificationTeam = { name: string; members: VerificationAgent[] }
export type VerificationCallOutcome = "called" | "no_answer" | "verified" | "refused"
/** One attributed attempt in the verification call history. */
export type VerificationCall = {
  id: string
  orderId: string
  clientId: string
  /** Snapshot keeps the call history readable if a client record is removed. */
  clientName: string
  agentId: string | null
  /** Snapshot keeps old call history readable if a team member is removed. */
  agentName: string | null
  outcome: VerificationCallOutcome
  calledAt: string
}

/** Fulfilment stage of an order, after (or beside) verification. */
export type DeliveryStatus = "pending" | "preparing" | "shipped" | "delivered" | "returned" | "cancelled"

/** Derived from the amount paid against the order total — never stored. */
export type OrderPaymentStatus = "unpaid" | "partial" | "paid"

/** One sold article on an order: what, how many, sold and bought at what. */
export type OrderItem = {
  /** The stock article sold, or null for a free-typed product. */
  stockId: string | null
  label: string
  qty: number
  /** Sale price of one unit. */
  unitPrice: number
  /** Product cost of one unit (from the stock article, or typed). */
  unitCost: number
}

/**
 * An order that came in (often from an ad), whose client must be called,
 * verified, paid and delivered. It is the unit every cost hangs on:
 * product cost, delivery, packaging, other fees and the campaign cost of
 * acquiring the client are all computed from these records.
 */
export type DeliveryOrder = {
  id: string
  clientId: string
  /** The campaign that brought this client, when it came from ads. */
  campaignId: string | null
  /** ISO date-time the lead/order arrived. */
  createdAt: string
  items: OrderItem[]
  deliveryCost: number
  packagingCost: number
  otherFees: number
  amountPaid: number
  verificationStatus: VerificationStatus
  deliveryStatus: DeliveryStatus
  callAttempts: number
  firstCallAt: string | null
  verifiedAt: string | null
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  /** True once the delivered quantities have left the stock (deduct once). */
  stockDeducted: boolean
  notes: string
}
