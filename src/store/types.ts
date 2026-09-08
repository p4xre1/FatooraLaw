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

export type Expense = {
  id: string
  date: string
  vendorId: string
  category: string
  method: "transfer" | "check" | "cash"
  amount: number
  status: "pending" | "approved"
  receipt: boolean
  note: string
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
  language: "en" | "ar"
  taxRate: number
  logo: string | null
  headerNote: string
  footerNote: string
}
