import { useEffect, useState } from "react"
import { Check, KeyRound, Loader2, MessageCircle, ShieldCheck, TriangleAlert, X } from "lucide-react"
import { Badge, Btn, Card, Field, Input } from "./kit"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { planPurchaseLink, type PlanActivation } from "../lib/plans"
import { effectivePrices } from "../lib/planCatalog"
import { usePlan, usePlanStatus } from "../store/usePlan"
import { usePlanBanner } from "../store/useDashboardPrefs"
import { usePlanCatalog } from "../store/usePlanCatalog"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"

/**
 * The account's own plan, in the two places the owner asked to see it:
 *
 *  - `PlanStrip` — the dashboard, visible by default so the client can see how
 *    long is left at a glance; the Widgets panel can hide it until the current
 *    plan window ends.
 *  - `PlanActivationCard` — Paramètres, where the code received over WhatsApp is
 *    typed in.
 *
 * Both read one store, so redeeming a code updates the strip, the rail and every
 * lock page in the same tick. What each plan *contains* is advertised on the
 * lock page and nowhere else — a client who already pays is not re-sold to on
 * every screen.
 */

/** How the account's plan reads right now, in one line. */
export function usePlanLine(): {
  tone: "neutral" | "good" | "warn"
  text: string
  activation: PlanActivation | null
  /** The plan name to badge: the paid plan's own, even once it stops running. */
  label: string
} {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const { date } = useFormats()
  const status = usePlanStatus(useToday())

  if (status.state === "free" || !status.activation) {
    return { tone: "neutral", text: t.never, activation: null, label: t.names.free }
  }
  const name = t.names[status.activation.plan]
  // Frozen: the clock is paused, so the message is the days in waiting, not a date.
  if (status.state === "frozen") {
    return { tone: "warn", text: t.frozen(name, status.daysLeft ?? 0), activation: status.activation, label: name }
  }
  if (status.state === "stopped") {
    return { tone: "warn", text: t.stopped(name), activation: status.activation, label: name }
  }
  const until = date(status.endsAt ?? status.activation.expiresAt)
  const left = status.daysLeft
  if (status.state === "expired" || (left !== null && left < 0)) {
    return { tone: "warn", text: t.expired(name, until), activation: status.activation, label: name }
  }
  if (left === null) return { tone: "good", text: t.active(name, until), activation: status.activation, label: name }
  if (left === 0) return { tone: "warn", text: t.lastDay(name), activation: status.activation, label: name }
  return {
    // The last week is the moment to renew, so it stops looking healthy then.
    tone: left <= 7 ? "warn" : "good",
    text: `${t.active(name, until)} · ${t.daysLeft(left)}`,
    activation: status.activation,
    label: name,
  }
}

/** The next plan worth offering: PRO from FREE, BOOST from PRO, PRO again on top. */
function nextPlan(plan: PlanActivation["plan"] | "free") {
  return plan === "free" || plan === "pro" ? ("pro" as const) : ("boost" as const)
}

/**
 * A buy/upgrade message the client hid with its × button.
 *
 * The dismissal is remembered in localStorage, scoped to the plan state it was
 * made in (`active:pro`, `free:free`, …): hiding the sales message today does
 * not hide tomorrow's "your plan ended" message, which is a different sentence
 * worth reading. Storage failures (private mode, full disk) degrade to a
 * session-only dismissal — the button still hides the message right now.
 */
const DISMISS_PREFIX = "fatorati.hide.v1."
function useDismissed(key: string, signature: string): [boolean, () => void] {
  const storageKey = `${DISMISS_PREFIX}${key}`
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(storageKey)
    } catch {
      stored = null
    }
    setDismissed(stored === signature)
  }, [storageKey, signature])
  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, signature)
    } catch {
      // The message still hides for this session via the state below.
    }
    setDismissed(true)
  }
  return [dismissed, dismiss]
}

/** The × that hides a buy/upgrade message. */
function DismissButton({ label, onDismiss, className = "h-7 w-7" }: { label: string; onDismiss: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink ${className}`}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

/**
 * Whether a paid account should still be shown a buy/renew message.
 *
 * A PRO/BOOST window with more than a week left is comfortable: the client
 * already pays and is not re-sold to. The message returns for the last week
 * (renewal time), and for every non-active state — FREE, expired, frozen,
 * stopped — where buying is the way forward.
 */
function showSalesMessage(state: string, daysLeft: number | null): boolean {
  if (state !== "active") return true
  return (daysLeft ?? 0) <= 7
}

/**
 * The dashboard strip: which plan, how long is left, and the way to extend it.
 *
 * The client can hide it from the dashboard's Widgets panel, and the choice is
 * remembered for the plan window it was made in (`store/useDashboardPrefs.ts`):
 * "hide it until the end" means until the end of *this* window, so the strip is
 * back once the window has expired, is extended, or is frozen by the owner —
 * each of which is a new sentence worth reading. Hiding it is a display choice,
 * not a change of plan: the rail, the locks and Paramètres keep saying what the
 * account is on.
 */
export function PlanStrip({ onNavigate }: { onNavigate?: () => void }) {
  const { visible } = usePlanBanner()
  if (!visible) return null
  return <PlanStripCard onNavigate={onNavigate} />
}

function PlanStripCard({ onNavigate }: { onNavigate?: () => void }) {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const { tone, text, label } = usePlanLine()
  const company = useMizan((state) => state.settings.company)
  const catalog = usePlanCatalog((state) => state.catalog)
  const status = usePlanStatus(useToday())
  const plan = status.plan
  const next = nextPlan(plan)
  const salesVisible = showSalesMessage(status.state, status.daysLeft)
  const [salesDismissed, dismissSales] = useDismissed("plan-strip-sales", `${status.state}:${plan}`)

  return (
    <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Badge tone={tone} dot>{label}</Badge>
      <p className="min-w-0 flex-1 text-[13px] text-muted">{text}</p>
      {salesVisible && !salesDismissed && (
        <span className="inline-flex items-center gap-1">
          <a
            href={planPurchaseLink(next, company, effectivePrices(catalog, next))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {plan === "free" ? t.buy(t.names.pro) : t.upgradeTo(t.names[next])}
          </a>
          <DismissButton label={t.dismiss} onDismiss={dismissSales} />
        </span>
      )}
      {onNavigate && (
        <Btn variant="outline" size="sm" onClick={onNavigate}>
          <KeyRound className="h-3.5 w-3.5" /> {t.activate}
        </Btn>
      )}
    </Card>
  )
}

/**
 * Paramètres → "Plan & activation": the code box.
 *
 * Everything the client needs is on the card — what is active today, when it
 * ends, how long that is, and what a rejected code meant. Nothing here decides
 * what a code buys: `lib/planCodes.ts` verifies it and `lib/plans.ts` computes
 * the window, including the case where a code extends a window that is still
 * running. This form only says what happened.
 */
export function PlanActivationCard() {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const { date } = useFormats()
  const status = usePlanStatus(useToday())
  const line = usePlanLine()
  const catalog = usePlanCatalog((state) => state.catalog)
  const company = useMizan((state) => state.settings.company)
  const log = useMizan((state) => state.log)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneText, setDoneText] = useState<string | null>(null)
  const next = nextPlan(status.plan)
  const salesVisible = showSalesMessage(status.state, status.daysLeft)
  const [buyDismissed, dismissBuy] = useDismissed("plan-card-buy", `${status.state}:${status.plan}`)

  async function submit() {
    const value = code.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    setDoneText(null)
    const wasActive = status.state === "active"
    const result = await usePlan.getState().redeem(value)
    if (!result.ok) {
      setError(result.reason === "format" ? t.codeFormat : t.codeWrong)
      // Never log the submitted key (or a prefix). Server-side abuse telemetry
      // records only the authenticated account and a short-lived source digest.
      log("a tenté un code d'activation refusé", "", "settings", "warning")
      setBusy(false)
      return
    }
    const { activation } = result
    const until = date(activation.expiresAt)
    const name = t.names[activation.plan]
    setDoneText(wasActive && activation.plan === status.plan ? t.codeExtended(name, until) : t.codeSuccess(name, until))
    setCode("")
    setBusy(false)
    log(`a activé le plan ${activation.plan.toUpperCase()} (${activation.period})`, until, "settings", "info")
  }

  return (
    <Card className="space-y-3 p-5">
      <h2 className="inline-flex items-center gap-2 text-[14px] font-bold">
        <KeyRound className="h-4 w-4 text-brand" /> {t.codeTitle}
      </h2>
      <p className="text-[13px] text-muted">{t.codeSubtitle}</p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5">
        {status.state === "free"
          ? <ShieldCheck className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
          : <Check className="h-4 w-4 shrink-0 text-emerald-brand" aria-hidden="true" />}
        <span className="text-[13px] font-semibold text-ink">{t.names[status.plan]}</span>
        <span className="min-w-0 flex-1 text-[12.5px] text-muted">{line.text}</span>
        {status.state !== "free" && (
          <button
            type="button"
            onClick={() => { usePlan.getState().clear(); setDoneText(null); setError(null); log("a retiré l'activation du compte", t.names[status.plan], "settings", "warning") }}
            className="text-[12px] font-semibold text-serious hover:underline"
          >
            {t.clearCode}
          </button>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="min-w-56 flex-1">
          <Field label={t.codeLabel} hint={t.codeHelp}>
            <Input
              value={code}
              onChange={(event) => { setCode(event.target.value); setError(null); setDoneText(null) }}
              placeholder={t.codePlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="tnum uppercase"
              aria-invalid={!!error}
            />
          </Field>
        </div>
        <Btn type="submit" disabled={busy || !code.trim()}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.activating}</> : <><KeyRound className="h-4 w-4" /> {t.activate}</>}
        </Btn>
      </form>

      {error && <p role="alert" className="flex items-start gap-2 text-[12.5px] text-serious"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {doneText && <p role="status" className="flex items-start gap-2 text-[12.5px] font-semibold text-emerald-700"><Check className="mt-0.5 h-4 w-4 shrink-0" />{doneText}</p>}

      {salesVisible && !buyDismissed && (
        <p className="flex items-start justify-between gap-2 text-[12px] text-faint">
          <span>
            {t.buyHint}{" "}
            <a href={planPurchaseLink(next, company, effectivePrices(catalog, next))} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
              {t.buyOnWhatsApp}
            </a>
          </span>
          <DismissButton label={t.dismiss} onDismiss={dismissBuy} className="h-6 w-6" />
        </p>
      )}
    </Card>
  )
}
