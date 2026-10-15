import { addCalendarDays, daysUntil, todayISO } from "./calendarDates"
import { periodEnd, type PlanCode, type PlanControl, type PlanPeriod } from "./plans"

/**
 * The owner's subscription ledger — one record per code handed to a client.
 *
 * This is the CMS side of the plan system (`/admin/subscription-editor`): who
 * got which code, how they found Fatorati, when their plan starts and ends,
 * and the owner's two hands on it — **freeze** (pause the clock; the remaining
 * days wait) and **stop** (end it now).
 *
 * Kept separate from `lib/plans.ts` on purpose: plans.ts answers "what can this
 * account open?" and stays pure; this module answers "what did we sell, and
 * what did we do to it afterwards?" The bridge between them is `PlanControl`:
 * the app folds the record for the activation's serial into `planStatus`.
 *
 * Local-first, like the rest of the product: records live in this browser
 * (store/useSubscriptions.ts). Freeze and stop therefore take effect in this
 * browser's app immediately; when Supabase is connected, these records map
 * onto `account_subscriptions` and the control becomes server-side.
 */

/** How the client found Fatorati — the answer to "منين عرفنا؟". */
export type SubscriptionSource = "whatsapp" | "instagram" | "facebook" | "google" | "referral" | "other"

export const SUBSCRIPTION_SOURCES: readonly SubscriptionSource[] = [
  "whatsapp", "instagram", "facebook", "google", "referral", "other",
]

export type SubscriptionRecord = {
  id: string
  /** The full code as sent to the client. */
  code: string
  /** The serial inside the code — the key the app's activation points back with. */
  serial: string
  plan: Exclude<PlanCode, "free">
  period: PlanPeriod
  clientName: string
  company: string
  /** Phone (WhatsApp) or email — whatever the owner reaches the client on. */
  contact: string
  source: SubscriptionSource
  /** The day the code was minted/sent. */
  issuedAt: string
  /** The day the client actually activated it; null while the code is unsent/unused. */
  startsAt: string | null
  /** The day the plan ends (inclusive); null until it is known or projected. */
  endsAt: string | null
  status: "active" | "frozen" | "stopped"
  /** The day the current freeze began, while frozen. */
  frozenAt: string | null
  note: string
}

export type DisplayStatus = "pending" | "active" | "frozen" | "stopped" | "expired"

/** What the CMS shows: the stored status, plus time doing its work. */
export function displayStatus(record: SubscriptionRecord, today = todayISO()): DisplayStatus {
  if (record.status === "stopped") return "stopped"
  if (record.status === "frozen") return "frozen"
  if (!record.startsAt) return "pending"
  const end = record.endsAt ?? periodEnd(record.startsAt, record.period)
  const left = daysUntil(end, today)
  if (left !== null && left < 0) return "expired"
  return "active"
}

/** The end date to show: recorded, else projected from the start (or issue). */
export function projectedEnd(record: SubscriptionRecord): string {
  return record.endsAt ?? periodEnd(record.startsAt ?? record.issuedAt, record.period)
}

/** Whole days left, counting the freeze as paused time. */
export function daysLeft(record: SubscriptionRecord, today = todayISO()): number | null {
  if (!record.startsAt && record.status !== "frozen") return null
  const from = record.status === "frozen" && record.frozenAt ? record.frozenAt : today
  const left = daysUntil(projectedEnd(record), from)
  return left === null ? null : Math.max(0, left)
}

/* ------------------------------ owner actions ---------------------------- */

/** Pause the clock. Only a live (or not-yet-started) subscription can freeze. */
export function applyFreeze(record: SubscriptionRecord, today = todayISO()): SubscriptionRecord {
  if (record.status !== "active") return record
  return { ...record, status: "frozen", frozenAt: today }
}

/**
 * Resume: the end date moves by exactly the frozen stretch, so the client
 * keeps every day they paid for. A subscription frozen before it ever started
 * has nothing to shift — its window begins at redemption anyway.
 */
export function applyUnfreeze(record: SubscriptionRecord, today = todayISO()): SubscriptionRecord {
  if (record.status !== "frozen") return record
  const frozenDays = record.frozenAt ? (daysUntil(today, record.frozenAt) ?? 0) : 0
  const shifted = record.endsAt && frozenDays > 0
    ? { endsAt: addCalendarDays(record.endsAt, frozenDays) }
    : {}
  return { ...record, status: "active", frozenAt: null, ...shifted }
}

/** End it now. Terminal: the code keeps verifying, but the plan does not run. */
export function applyStop(record: SubscriptionRecord): SubscriptionRecord {
  return { ...record, status: "stopped", frozenAt: null }
}

/** Bring a stopped record back as a fresh pending code (same code, new sale). */
export function applyReactivate(record: SubscriptionRecord, today = todayISO()): SubscriptionRecord {
  return { ...record, status: "active", frozenAt: null, startsAt: null, endsAt: null, issuedAt: today }
}

/** The control the app folds into `planStatus` for this record. */
export function controlFor(record: SubscriptionRecord): PlanControl {
  return { status: record.status, endsAt: record.endsAt, frozenAt: record.frozenAt }
}
