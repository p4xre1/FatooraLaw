import { useState } from "react"
import { Check, Landmark, Lock, MessageCircle, ScanBarcode, ShieldCheck, Zap } from "lucide-react"
import { Btn, Card } from "./kit"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import {
  PLANS, PLAN_ORDER, planGain, planPurchaseLink, requiredPlan,
  type PlanCode, type PlanModule, type PlanPeriod,
} from "../lib/plans"
import { effectiveCopy, effectivePrices, yearlySaving } from "../lib/planCatalog"
import { usePlanCatalog } from "../store/usePlanCatalog"
import { usePlanStatus } from "../store/usePlan"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"
import type { ModuleKey } from "../store/types"

/**
 * What replaces a module the account's plan does not include — and the page
 * that sells the upgrade.
 *
 * Design contract: black cards (`bg-night`, a near-black pinned in both
 * appearances) on
 * the light page, because this is the one screen whose job is to be looked at.
 * Every card carries its *value* sentence before its feature list — what the
 * plan is worth, then what it contains — and the lists themselves are
 * generated from `lib/plans.ts`, the same table that unlocks the rail, so a
 * card can never advertise a module the app would still refuse to open.
 * Prices and paragraphs come from the CMS-editable catalog
 * (`lib/planCatalog.ts`), never from literals.
 *
 * Conversion details, kept honest: PRO is marked "most chosen" and BOOST
 * "best value" (the yearly saving is computed, not invented); the period
 * toggle defaults to the year because that is the better deal; and the three
 * promises under the cards are ones the product actually keeps — immediate
 * activation, no card required, WhatsApp support.
 */
export default function PlanLock({ module, onNavigate }: { module: PlanModule; onNavigate: (m: ModuleKey) => void }) {
  const { t: copy, language } = useTranslation()
  const t = copy.plans
  const status = usePlanStatus(useToday())
  const company = useMizan((state) => state.settings.company)
  const catalog = usePlanCatalog((state) => state.catalog)
  const { money } = useFormats()
  const needed = requiredPlan(module)
  const [period, setPeriod] = useState<PlanPeriod>("1Y")

  /** The plan the account is on — the paid one even frozen/expired/stopped. */
  const currentCode: PlanCode = status.activation && status.state !== "free" ? status.activation.plan : status.plan

  /** A module's name, from the single place that names modules. */
  const moduleLabel = (key: PlanModule) => (key === "invoices" ? copy.sidebar.invoices : copy.shared.modules[key])

  const trust = [
    { icon: Zap, text: t.trust.immediate },
    { icon: Landmark, text: t.trust.noCard },
    { icon: MessageCircle, text: t.trust.support },
  ]

  return (
    <div className="mz-view mx-auto max-w-5xl space-y-4">
      {/* ---- Header: what is locked, and the billing period ---- */}
      <div className="overflow-hidden rounded-2xl bg-night text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold">{t.lockedTitle(t.names[needed])}</h1>
            <p className="mt-0.5 text-[13px] text-white/65">{t.lockedBody(moduleLabel(module), t.names[needed])}</p>
            {module === "inventory" && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/85">
                <ScanBarcode className="h-3.5 w-3.5 text-emerald-brand" aria-hidden="true" /> {t.scannerNote}
              </p>
            )}
          </div>
          <div className="flex rounded-full bg-white/10 p-1" role="group" aria-label={`${t.period["1M"]} / ${t.period["1Y"]}`}>
            {(["1M", "1Y"] as PlanPeriod[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${period === value ? "bg-brand text-white shadow" : "text-white/70 hover:text-white"}`}
              >
                {t.period[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- The three black cards ---- */}
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((code: PlanCode, index) => {
          const isCurrent = code === currentCode
          const isNeeded = code === needed
          const prices = effectivePrices(catalog, code)
          const saving = yearlySaving(prices)
          const paragraphs = effectiveCopy(catalog, code, language, {
            tagline: t.tagline[code],
            value: t.value[code],
          })
          // What this card adds over what the account has today: the honest
          // difference, not a marketing list.
          const gain = planGain(code, status.plan)
          const price = code === "free" ? null : period === "1M" ? prices.monthly : prices.yearly

          const inner = (
            <>
              {code === "boost" && (
                <span className="plan-glow pointer-events-none absolute -end-12 -top-12 h-40 w-40 rounded-full bg-brand/25 blur-3xl" aria-hidden="true" />
              )}
              <div className="relative flex items-start justify-between gap-2">
                <h2 className="font-display text-[17px] font-extrabold tracking-tight">{t.names[code]}</h2>
                {code === "pro" && (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">{t.popular}</span>
                )}
                {code === "boost" && (
                  <span className="rounded-full bg-emerald-brand px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">{t.bestValue}</span>
                )}
                {code === "free" && isCurrent && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white/75">{t.current}</span>
                )}
              </div>

              <p className="relative mt-3 border-s-2 border-brand ps-3 text-[13.5px] font-medium leading-relaxed text-white/90">
                {paragraphs.value}
              </p>
              <p className="relative mt-2 text-[12.5px] leading-relaxed text-white/55">{paragraphs.tagline}</p>

              <div className="relative mt-4">
                {price === null ? (
                  <p className="font-display text-[26px] font-bold leading-none">{t.freePrice}</p>
                ) : (
                  <>
                    <p className="font-display text-[30px] font-bold leading-none tracking-tight">
                      {money(price, "MAD")}
                      <span className="ms-1.5 align-middle text-[12.5px] font-medium text-white/55">
                        {period === "1M" ? t.perMonth : t.perYear}
                      </span>
                    </p>
                    {period === "1Y" && saving > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-emerald-brand/15 px-2 py-0.5 text-[11px] font-bold text-emerald-brand ring-1 ring-inset ring-emerald-brand/40">
                          {t.saveYear(money(saving, "MAD"))}
                        </span>
                        {saving >= prices.monthly && (
                          <span className="text-[11px] font-semibold text-white/60">{t.twoMonthsFree}</span>
                        )}
                      </p>
                    )}
                    {period === "1M" && (
                      <p className="mt-1.5 text-[11.5px] text-white/50">
                        {money(prices.yearly, "MAD")} {t.perYear}
                        {saving > 0 && <> · {t.saveYear(money(saving, "MAD"))}</>}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="relative my-4 h-px bg-white/10" />

              <p className="relative text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/45">
                {gain.length && !isCurrent ? t.upgradeTo(t.names[code]) : t.includes}
              </p>
              <ul className="relative mt-2 space-y-1.5">
                {(gain.length ? gain : PLANS[code].modules).map((key) => (
                  <li key={key} className="flex items-start gap-2 text-[12.5px] text-white/85">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-brand" aria-hidden="true" />
                    <span className="min-w-0">{moduleLabel(key)}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-5 flex-1" />
              {code !== "free" ? (
                <a
                  href={planPurchaseLink(code, company, prices)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition-all hover:-translate-y-0.5 ${
                    code === "boost"
                      ? "bg-white text-night shadow-lg hover:bg-white/90"
                      : "bg-brand text-white shadow-lg hover:bg-brand-700"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {t.buy(t.names[code])}
                </a>
              ) : isCurrent ? (
                <p className="relative inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/70">
                  <ShieldCheck className="h-4 w-4 text-emerald-brand" aria-hidden="true" /> {t.current}
                </p>
              ) : (
                <p className="relative text-[12px] text-white/50">{t.haveCode}</p>
              )}
              {isCurrent && code !== "free" && (
                <p className="relative mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-brand">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t.current}
                </p>
              )}
            </>
          )

          const cardClass = "plan-rise relative flex h-full flex-col overflow-hidden rounded-2xl bg-night p-5 text-white shadow-xl transition-transform duration-300 hover:-translate-y-1"
          return code === "boost" ? (
            <div
              key={code}
              className="plan-rise rounded-2xl bg-gradient-to-br from-brand via-emerald-brand to-brand p-[1.5px] shadow-xl transition-transform duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="relative flex h-full flex-col overflow-hidden rounded-[15px] bg-night p-5 text-white">
                {inner}
              </div>
            </div>
          ) : (
            <div
              key={code}
              className={`${cardClass} ${isNeeded || code === "pro" ? "ring-2 ring-brand" : "ring-1 ring-white/10"}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              {inner}
            </div>
          )
        })}
      </div>

      {/* ---- Promises the product actually keeps ---- */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-2">
        {trust.map((item) => (
          <span key={item.text} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
            <item.icon className="h-4 w-4 text-brand" aria-hidden="true" />
            {item.text}
          </span>
        ))}
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
