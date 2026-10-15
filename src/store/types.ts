export type Role = "owner" | "accountant" | "supervisor" | "assistant"

export type ModuleKey =
  | "dashboard"
  | "projects"
  | "contacts"
  | "procurement"
  | "inventory"
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

export type Contact = {
  id: string
  type: "client" | "supplier"
  name: string
  ice: string
  phone: string
  email: string
  city: string
  balance: number // positive = they owe us (receivable), negative = we owe them
}

/** One bought article on an expense: what, how many, at what unit price. */
export type ExpenseItem = {
  label: string
  /** Number of items bought. */
  qty: number
  /** Unit price excluding tax (HT). */
  unitPrice: number
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
