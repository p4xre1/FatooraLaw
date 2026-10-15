import { Check, Lock, MessageCircle } from "lucide-react"
import { Badge, Btn, Card } from "./kit"
import { useTranslation } from "../lib/language/store"
import {
  PLANS, PLAN_ORDER, planGain, planPurchaseLink, requiredPlan,
  type PlanCode, type PlanModule,
} from "../lib/plans"
import { usePlanStatus } from "../store/usePlan"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"
import { useFormats } from "../lib/language/formats"
import type { ModuleKey } from "../store/types"

/**
 * What replaces a module the account's plan does not include.
 *
 * Shown by the shell wherever a locked module would render (the rail links to
 * the module's own URL, so a locked row, a deep link and a bookmark all land
 * here). It answers the three questions a client actually has: which plan is
 * this, what does that plan include, and how do I pay — the last one being the
 * WhatsApp conversation that sells the code, since there is no online checkout.
 *
 * The module lists on the cards are generated from `lib/plans.ts`, the same
 * table that unlocks the rail, so a card can never advertise a module the app
 * would still refuse to open.
 */
export default function PlanLock({ module, onNavigate }: { module: PlanModule; onNavigate: (m: ModuleKey) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.plans
  const today = useToday()
  const status = usePlanStatus(today)
  const company = useMizan((state) => state.settings.company)
  const { money } = useFormats()
  const needed = requiredPlan(module)

  /** A module's name, from the single place that names modules. */
  const moduleLabel = (key: PlanModule) => (key === "invoices" ? copy.sidebar.invoices : copy.shared.modules[key])

  return (
    <div className="mz-view mx-auto max-w-4xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold text-ink">{t.lockedTitle(t.names[needed])}</h1>
            <p className="mt-1 text-[13px] text-muted">{t.lockedBody(moduleLabel(module), t.names[needed])}</p>
            <p className="mt-2 text-[12.5px] text-muted">{t.buyHint}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((code: PlanCode) => {
          const plan = PLANS[code]
          const isCurrent = code === status.plan
          const isNeeded = code === needed
          // What this card adds over what the account has today: the honest
          // difference, not a marketing list.
          const gain = planGain(code, status.plan)
          return (
            <Card
              key={code}
              className={`flex flex-col p-4 ${isNeeded ? "ring-2 ring-brand" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">{t.names[code]}</h2>
                {isCurrent && <Badge tone="good">{t.current}</Badge>}
              </div>
              <p className="mt-1 font-display text-[22px] font-bold leading-tight text-ink">
                {code === "free" ? t.freePrice : money(plan.monthlyPrice, "MAD")}
                {code !== "free" && <span className="ms-1 text-[12px] font-medium text-muted">{t.perMonth}</span>}
              </p>
              {code !== "free" && (
                <p className="text-[11.5px] text-faint">{money(plan.yearlyPrice, "MAD")} {t.perYear}</p>
              )}
              <p className="mt-2 min-h-10 text-[12.5px] leading-relaxed text-muted">{t.tagline[code]}</p>

              <p className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">
                {gain.length && !isCurrent ? t.upgradeTo(t.names[code]) : t.includes}
              </p>
              <ul className="mt-1.5 space-y-1">
                {(gain.length ? gain : plan.modules).map((key) => (
                  <li key={key} className="flex items-start gap-1.5 text-[12.5px] text-ink">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-brand" aria-hidden="true" />
                    <span className="min-w-0">{moduleLabel(key)}</span>
                  </li>
                ))}
              </ul>

              {code !== "free" && (
                <a
                  href={planPurchaseLink(code, company)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {t.buy(t.names[code])}
                </a>
              )}
              {code === "free" && <p className="mt-4 text-[12px] text-faint">{t.haveCode}</p>}
            </Card>
          )
        })}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[12.5px] text-muted">{t.haveCode}</p>
        <Btn variant="outline" size="sm" onClick={() => onNavigate("settings")}>
          {copy.shared.modules.settings}
        </Btn>
      </Card>
    </div>
  )
}
