import type { ModuleKey } from "../store/types"
import { daysUntil, todayISO } from "./calendarDates"

/**
 * The three accounts Fatorati sells, and the only place that decides which
 * module each one unlocks.
 *
 *   FREE   clients, projects, purchases & expenses and invoicing, plus read
 *          access to the reports.
 *   PRO    everything except the "Plus d'outils" group (risks, legal vault,
 *          subscriptions & tools).
 *   BOOST  everything.
 *
 * Why a module list and not a feature list: the rail, the router and the
 * toolbar all ask the same question — "can this account open X?" — and before
 * this module three different answers existed (`planLimits.ts` said
 * `advanced_audit`, the marketing page said "Rapports et exports", the admin
 * catalog said `reports: true`). Naming the modules themselves means the
 * sentence the client reads on the lock page is generated from the same data
 * that unlocks the module, so the two can never disagree.
 *
 * Invoicing is in the list before its route exists (`INVOICE_ROUTE_ENABLED` in
 * components/Sidebar.tsx is still off): the entitlement is agreed now, and the
 * day the module ships it is already covered by FREE instead of silently
 * becoming a paid extra.
 */

export type PlanCode = "free" | "pro" | "boost"

/** What a plan can unlock: a module, plus invoicing, which has no route yet. */
export type PlanModule = ModuleKey | "invoices"

/** How long a code is good for. */
export type PlanPeriod = "1M" | "1Y"

export type Plan = {
  code: PlanCode
  /** Prices shown on the lock page, in MAD. Fulfilment happens over WhatsApp. */
  monthlyPrice: number
  yearlyPrice: number
  /** Everything this plan unlocks, in the rail's order. */
  modules: readonly PlanModule[]
}

/** The rail's order, used wherever a plan's modules are listed or diffed. */
export const PLAN_MODULE_ORDER: readonly PlanModule[] = [
  "dashboard", "projects", "contacts", "procurement", "inventory", "delivery", "verification", "calendar",
  "invoices", "risk", "tools", "legal", "reports", "team", "audit", "settings",
]

/** The rail group "Plus d'outils" — the one line between PRO and BOOST. */
export const ADVANCED_MODULES: readonly PlanModule[] = ["risk", "legal", "tools"]

/** The accounts, cheapest first. Order drives the cards and the upgrade copy. */
export const PLAN_ORDER: readonly PlanCode[] = ["free", "pro", "boost"]

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    // Dashboard, settings and reports are never withheld: the first is the
    // account's home, the second is where a code is redeemed, and the third the
    // owner asked to leave readable on FREE.
    modules: ["dashboard", "projects", "contacts", "procurement", "invoices", "reports", "settings"],
  },
  pro: {
    code: "pro",
    monthlyPrice: 79,
    yearlyPrice: 790,
    modules: PLAN_MODULE_ORDER.filter((module) => !ADVANCED_MODULES.includes(module)),
  },
  boost: {
    code: "boost",
    monthlyPrice: 250,
    yearlyPrice: 2500,
    modules: PLAN_MODULE_ORDER,
  },
}

export function planIncludes(code: PlanCode, module: PlanModule): boolean {
  return PLANS[code].modules.includes(module)
}

/** The cheapest plan that unlocks `module` — the name shown on a locked row. */
export function requiredPlan(module: PlanModule): PlanCode {
  return PLAN_ORDER.find((code) => planIncludes(code, module)) ?? "boost"
}

/** The modules of `plan` that `other` does not have — the upsell's real content. */
export function planGain(plan: PlanCode, other: PlanCode): PlanModule[] {
  return PLAN_MODULE_ORDER.filter((module) => planIncludes(plan, module) && !planIncludes(other, module))
}

/* ------------------------------- activation ------------------------------ */

/** A redeemed code: which plan it unlocked, and the window it covers. */
export type PlanActivation = {
  /** The code as it was typed (normalized), kept for support. */
  code: string
  plan: Exclude<PlanCode, "free">
  period: PlanPeriod
  /** ISO date the paid window opened. */
  startedAt: string
  /** ISO date it ends — inclusive, in Morocco's local day. */
  expiresAt: string
  /**
   * The serial of a per-client code (`PRO-1M-K7Q2-…`), or null for a generic
   * code. This is the thread back to the CMS ledger: with a serial, the owner
   * can freeze or stop this exact subscription (see lib/subscriptionLedger.ts).
   */
  serial: string | null
}

/**
 * The owner's hand on one subscription, as recorded in the CMS ledger.
 *
 * `endsAt` wins over the activation's own end date when it is set: unfreezing
 * shifts it, and that shift — not the date computed at redemption — is the
 * window the client actually has.
 */
export type PlanControl = {
  status: "active" | "frozen" | "stopped"
  endsAt: string | null
  frozenAt: string | null
}

export type PlanStatus = {
  /** The plan in force today: a paid plan while its window is open, else FREE. */
  plan: PlanCode
  /**
   * `free` = never activated, `active` = paid window open, `expired` = it
   * closed; `frozen`/`stopped` = the owner paused or ended it from the CMS.
   */
  state: "free" | "active" | "expired" | "frozen" | "stopped"
  activation: PlanActivation | null
  /** Whole days left, 0 on the last day, null when nothing is active. */
  daysLeft: number | null
}

/**
 * The paid window a code buys, from `start`.
 *
 * Calendar arithmetic, not 30/365 days: a code sold on 15 January runs to 15
 * February, and the end of a month clamps (31 January + 1 month → 28 February)
 * instead of rolling into the next month.
 */
export function periodEnd(start: string, period: PlanPeriod): string {
  const [year, month, day] = start.split("-").map(Number)
  if (!year || !month || !day) return start
  // Month arithmetic on a month index, so December → January and a leap-day
  // start both fall out of the same two lines.
  const index = year * 12 + (month - 1) + (period === "1Y" ? 12 : 1)
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${targetYear}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`
}

/**
 * The plan in force: the activation if its window is still open, FREE otherwise.
 *
 * An expired activation is kept and reported (`state: "expired"`) so the
 * dashboard can say "your PRO ended on 15 October" instead of pretending the
 * account never had one.
 */
export function planStatus(activation: PlanActivation | null, today = todayISO(), control?: PlanControl | null): PlanStatus {
  if (!activation) return { plan: "free", state: "free", activation: null, daysLeft: null }
  const endsAt = control?.endsAt ?? activation.expiresAt
  // Stopped is terminal in a way expiry is not: the plan name is kept on the
  // activation so the UI can say *what* was stopped.
  if (control?.status === "stopped") return { plan: "free", state: "stopped", activation, daysLeft: 0 }
  if (control?.status === "frozen") {
    // The clock is paused: what remains is what remained on the freeze day.
    const left = daysUntil(endsAt, control.frozenAt ?? today)
    return { plan: "free", state: "frozen", activation, daysLeft: left === null ? null : Math.max(0, left) }
  }
  const left = daysUntil(endsAt, today)
  if (left === null) return { plan: "free", state: "free", activation: null, daysLeft: null }
  if (left < 0) return { plan: "free", state: "expired", activation, daysLeft: 0 }
  return { plan: activation.plan, state: "active", activation, daysLeft: left }
}

/**
 * The activation a redemption produces.
 *
 * Redeeming the same plan again **extends** the current window from its own end
 * date — a client who pays for a second month before the first one ends gets two
 * months, not a month lost. A different plan starts a fresh window from today
 * (that is an upgrade, not a renewal), and an expired one always starts today.
 */
export function activationFor(
  input: { code: string; plan: Exclude<PlanCode, "free">; period: PlanPeriod; serial?: string | null },
  current: PlanActivation | null,
  today = todayISO(),
): PlanActivation {
  const status = planStatus(current, today)
  const extendsWindow = status.state === "active" && status.activation?.plan === input.plan
  const from = extendsWindow && status.activation ? status.activation.expiresAt : today
  return {
    code: input.code,
    plan: input.plan,
    period: input.period,
    startedAt: extendsWindow && status.activation ? status.activation.startedAt : today,
    expiresAt: periodEnd(from, input.period),
    // Extending keeps the serial of the running subscription; a fresh window
    // takes the serial of the code that opened it.
    // (`?? null`: activations stored before serials existed have no key at all.)
    serial: extendsWindow && status.activation ? status.activation.serial ?? null : input.serial ?? null,
  }
}

/* --------------------------------- sales --------------------------------- */

/**
 * The WhatsApp line that sells the codes. Fulfilment is manual today: the client
 * pays by transfer (RIB) and receives a code to type into Paramètres, so this
 * number is the whole checkout — it is the same one the previous upgrade panel
 * published.
 */
export const PLAN_SALES_WHATSAPP = "212772966980"

/**
 * A pre-filled WhatsApp message so the client only has to press send.
 *
 * Both periods are named with their price, read from `PLANS` — the same table
 * the lock page shows — so the conversation starts from the published prices
 * and a price can never be changed in one place and quoted from another.
 */
export function planPurchaseLink(
  plan: Exclude<PlanCode, "free">,
  company: string,
  prices?: { monthly: number; yearly: number },
): string {
  const monthlyPrice = prices?.monthly ?? PLANS[plan].monthlyPrice
  const yearlyPrice = prices?.yearly ?? PLANS[plan].yearlyPrice
  const message = `Bonjour Fatorati, je souhaite activer ${plan.toUpperCase()} pour ${company || "mon compte"} — `
    + `1 mois (${monthlyPrice} MAD) ou 1 an (${yearlyPrice} MAD).`
  return `https://wa.me/${PLAN_SALES_WHATSAPP}?text=${encodeURIComponent(message)}`
}
