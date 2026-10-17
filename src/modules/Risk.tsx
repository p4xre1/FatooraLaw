import { useMemo, useState } from "react"
import { AlertTriangle, Bell, Search, ShieldAlert } from "lucide-react"
import { Badge, Card, Input, SectionTitle } from "../components/kit"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { buildBusinessRisks, type BusinessRisk, type RiskLevel } from "../lib/riskAnalytics"
import { todayISO } from "../lib/calendarDates"
import { useMizan } from "../store/useMizan"

const LEVEL_META: Record<RiskLevel, { tone: "serious" | "warn"; rail: string; icon: typeof Bell }> = {
  high: { tone: "serious", rail: "bg-serious", icon: AlertTriangle },
  medium: { tone: "warn", rail: "bg-warn", icon: Bell },
}

const LEVELS: RiskLevel[] = ["high", "medium"]
const FILTERS: (RiskLevel | "all")[] = ["all", "high", "medium"]

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))
}

function descriptionFor(
  risk: BusinessRisk,
  copy: ReturnType<typeof useTranslation>["t"]["risk"],
  money: (value: number, currency?: "MAD" | "EUR" | "USD") => string,
  currency: "MAD" | "EUR" | "USD",
): string {
  const detail = risk.detail
  switch (detail.kind) {
    case "deadline": {
      const message = detail.daysUntil < 0
        ? fill(copy.detail.deadline.overdue, { days: Math.abs(detail.daysUntil) })
        : detail.daysUntil === 0
          ? copy.detail.deadline.today
          : fill(copy.detail.deadline.upcoming, { days: detail.daysUntil })
      return detail.note ? `${message} ${fill(copy.detail.deadline.note, { note: detail.note })}` : message
    }
    case "stock":
      return fill(copy.detail.stock, { quantity: detail.quantity, minimum: detail.minimum, unit: detail.unit })
    case "receivable":
      return fill(detail.delivered ? copy.detail.receivable.delivered : copy.detail.receivable.pending, {
        amount: money(detail.outstanding, currency),
      })
    case "project":
      return relativeDate(copy.detail.project, detail.daysUntil)
    case "subscription":
      return relativeDate(copy.detail.subscription, detail.daysUntil)
    case "verification":
      return fill(copy.detail.verification, { days: detail.daysWaiting })
  }
}

function relativeDate(
  copy: { today: string; upcoming: string } & ({ overdue: string } | { expired: string }),
  daysUntil: number,
): string {
  const past = "overdue" in copy ? copy.overdue : copy.expired
  if (daysUntil < 0) return fill(past, { days: Math.abs(daysUntil) })
  if (daysUntil === 0) return copy.today
  return fill(copy.upcoming, { days: daysUntil })
}

export default function Risk() {
  const { language, t: copy } = useTranslation()
  const t = copy.risk
  const { modules } = copy.shared
  const { date, money } = useFormats()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<RiskLevel | "all">("all")

  const calendarEvents = useMizan((state) => state.calendarEvents)
  const stock = useMizan((state) => state.stock)
  const orders = useMizan((state) => state.orders)
  const campaigns = useMizan((state) => state.campaigns)
  const contacts = useMizan((state) => state.contacts)
  const projects = useMizan((state) => state.projects)
  const tools = useMizan((state) => state.tools)
  const currency = useMizan((state) => state.settings.currency)
  const today = todayISO()

  const risks = useMemo(
    () => buildBusinessRisks({ calendarEvents, stock, orders, campaigns, contacts, projects, tools }, today),
    [calendarEvents, stock, orders, campaigns, contacts, projects, tools, today],
  )
  const records = useMemo(
    () => risks.map((risk) => ({ risk, description: descriptionFor(risk, t, money, currency) })),
    [risks, t, money, currency],
  )
  const counts = useMemo(
    () => ({
      high: risks.filter((risk) => risk.level === "high").length,
      medium: risks.filter((risk) => risk.level === "medium").length,
    }),
    [risks],
  )
  const list = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(language)
    return records.filter(({ risk, description }) => {
      const category = t.categories[risk.category]
      return (filter === "all" || risk.level === filter)
        && `${risk.title} ${category} ${description}`.toLocaleLowerCase(language).includes(search)
    })
  }, [records, query, filter, language, t])

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.risk} sub={t.subtitle} />

      <p role="note" className="rounded-lg border border-warn/20 bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
        {t.sourceNotice}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {LEVELS.map((level) => {
          const meta = LEVEL_META[level]
          return (
            <Card key={level} className="flex items-center gap-3.5 p-4">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${meta.rail}`}>
                <meta.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[22px] font-bold leading-none text-ink tnum">{counts[level]}</p>
                <p className="mt-1 text-[12px] text-muted">{t.count[level]}</p>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${filter === key ? "bg-navy text-white" : "border border-line-strong bg-surface text-muted hover:text-ink"}`}
            >
              {t.filters[key]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            aria-label={t.searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="ps-9"
          />
        </div>
      </div>

      <div className="space-y-2.5">
        {list.map(({ risk, description }) => {
          const meta = LEVEL_META[risk.level]
          return (
            <Card key={risk.id} className="relative overflow-hidden p-4 ps-5">
              <span className={`absolute inset-y-0 start-0 w-1.5 ${meta.rail}`} />
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${risk.level === "medium" ? "bg-warn-50 text-warn" : "bg-serious-50 text-serious"}`}>
                  <meta.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-bold text-ink">{risk.title}</h3>
                      <Badge tone="neutral">{t.categories[risk.category]}</Badge>
                    </div>
                    <Badge tone={meta.tone} dot>{t.levels[risk.level]}</Badge>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
                  {risk.due && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-faint">
                      <ShieldAlert className="h-3.5 w-3.5" /> {t.dateLabel} <span className="text-ink">{date(risk.due)}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
        {list.length === 0 && <Card className="p-6 text-center text-sm text-muted">{t.empty}</Card>}
      </div>
    </div>
  )
}
