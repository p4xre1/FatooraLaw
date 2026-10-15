import { useState } from "react"
import { Check, KeyRound, Loader2, MessageCircle, ShieldCheck, TriangleAlert } from "lucide-react"
import { Badge, Btn, Card, Field, Input } from "./kit"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { planPurchaseLink, type PlanActivation } from "../lib/plans"
import { usePlan, usePlanStatus } from "../store/usePlan"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"

/**
 * The account's own plan, in the two places the owner asked to see it:
 *
 *  - `PlanStrip` — the dashboard, so the client always knows how long is left
 *    without going looking for it ("BUT ON DASH U CAN SEE IT").
 *  - `PlanActivationCard` — Paramètres, where the code received over WhatsApp is
 *    typed in.
 *
 * Both read one store, so redeeming a code updates the strip, the rail and every
 * lock page in the same tick. What each plan *contains* is advertised on the
 * lock page and nowhere else — a client who already pays is not re-sold to on
 * every screen.
 */

/** How the account's plan reads right now, in one line. */
export function usePlanLine(): { tone: "neutral" | "good" | "warn"; text: string; activation: PlanActivation | null } {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const { date } = useFormats()
  const status = usePlanStatus(useToday())
  const name = t.names[status.plan]

  if (status.state === "free" || !status.activation) return { tone: "neutral", text: t.never, activation: null }
  const until = date(status.activation.expiresAt)
  const left = status.daysLeft
  if (left === null) return { tone: "good", text: t.active(name, until), activation: status.activation }
  if (left < 0) return { tone: "warn", text: t.expired(name, until), activation: status.activation }
  if (left === 0) return { tone: "warn", text: t.lastDay(name), activation: status.activation }
  return {
    // The last week is the moment to renew, so it stops looking healthy then.
    tone: left <= 7 ? "warn" : "good",
    text: `${t.active(name, until)} · ${t.daysLeft(left)}`,
    activation: status.activation,
  }
}

/** The next plan worth offering: PRO from FREE, BOOST from PRO, PRO again on top. */
function nextPlan(plan: PlanActivation["plan"] | "free") {
  return plan === "free" || plan === "pro" ? ("pro" as const) : ("boost" as const)
}

/** The dashboard strip: which plan, how long is left, and the way to extend it. */
export function PlanStrip({ onNavigate }: { onNavigate?: () => void }) {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const { tone, text } = usePlanLine()
  const company = useMizan((state) => state.settings.company)
  const plan = usePlanStatus(useToday()).plan
  const next = nextPlan(plan)

  return (
    <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Badge tone={tone} dot>{t.names[plan]}</Badge>
      <p className="min-w-0 flex-1 text-[13px] text-muted">{text}</p>
      <a
        href={planPurchaseLink(next, company)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {plan === "free" ? t.buy(t.names.pro) : t.upgradeTo(t.names[next])}
      </a>
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
  const company = useMizan((state) => state.settings.company)
  const log = useMizan((state) => state.log)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneText, setDoneText] = useState<string | null>(null)
  const next = nextPlan(status.plan)

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
      // A refused attempt belongs in the audit trail: repeated guessing is the
      // one thing a hand-issued code system should be able to show afterwards.
      log("a tenté un code d'activation refusé", value.slice(0, 24), "settings", "warning")
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

      <p className="text-[12px] text-faint">
        {t.buyHint}{" "}
        <a href={planPurchaseLink(next, company)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
          {t.buyOnWhatsApp}
        </a>
      </p>
    </Card>
  )
}
