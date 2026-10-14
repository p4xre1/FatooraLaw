import { useMemo, useState } from "react"
import { ShieldAlert, ShieldCheck, Bell, AlertTriangle, Search } from "lucide-react"
import { Card, SectionTitle, Badge, Input } from "../components/kit"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import type { RiskCategory, RiskId, RiskLevel } from "../i18n/risk"

/** Colours and icons are presentation; all risk/status words come from i18n. */
const LEVEL_META: Record<RiskLevel, { tone: "serious" | "warn" | "good"; rail: string; icon: typeof Bell }> = {
  high: { tone: "serious", rail: "bg-serious", icon: AlertTriangle },
  medium: { tone: "warn", rail: "bg-warn", icon: Bell },
  ok: { tone: "good", rail: "bg-emerald-brand", icon: ShieldCheck },
}

const LEVELS: RiskLevel[] = ["high", "medium", "ok"]
const FILTERS: (RiskLevel | "all")[] = ["all", "high", "medium", "ok"]

/** Fixed records used only to illustrate the screen; none are user data. */
const RISKS: { id: RiskId; category: RiskCategory; due: string | null; level: RiskLevel }[] = [
  { id: "vat", category: "tax", due: "2026-09-30", level: "high" },
  { id: "corporateTax", category: "tax", due: "2026-09-15", level: "high" },
  { id: "contract", category: "contracts", due: "2026-09-22", level: "medium" },
  { id: "registry", category: "registry", due: null, level: "ok" },
  { id: "insurance", category: "contracts", due: "2026-09-20", level: "medium" },
  { id: "social", category: "social", due: null, level: "ok" },
  { id: "privacy", category: "privacy", due: null, level: "ok" },
]

export default function Risk() {
  const { language, t: copy } = useTranslation()
  const t = copy.risk
  const { modules } = copy.shared
  const { date } = useFormats()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<RiskLevel | "all">("all")

  const counts = useMemo(
    () => ({
      high: RISKS.filter((r) => r.level === "high").length,
      medium: RISKS.filter((r) => r.level === "medium").length,
      ok: RISKS.filter((r) => r.level === "ok").length,
    }),
    [],
  )

  const list = useMemo(() => {
    const query = q.trim().toLocaleLowerCase(language)
    return RISKS.filter((r) => {
      const item = t.items[r.id]
      const category = t.categories[r.category]
      return (
        (filter === "all" || r.level === filter) &&
        `${item.label} ${category} ${item.desc}`.toLocaleLowerCase(language).includes(query)
      )
    })
  }, [q, filter, language, t])

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.risk} sub={t.subtitle} />

      <p role="note" className="rounded-lg border border-warn/20 bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
        {t.demoNotice}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {LEVELS.map((level) => {
          const meta = LEVEL_META[level]
          return (
            <Card key={level} className="flex items-center gap-3.5 p-4">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${meta.rail}`}><meta.icon className="h-5 w-5" /></span>
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
          <Input aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="ps-9" />
        </div>
      </div>

      <div className="space-y-2.5">
        {list.map((r) => {
          const meta = LEVEL_META[r.level]
          const item = t.items[r.id]
          return (
            <Card key={r.id} className="relative overflow-hidden p-4 ps-5">
              <span className={`absolute inset-y-0 start-0 w-1.5 ${meta.rail}`} />
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${r.level === "ok" ? "bg-good-50 text-emerald-700" : r.level === "medium" ? "bg-warn-50 text-warn" : "bg-serious-50 text-serious"}`}>
                  <meta.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-ink">{item.label}</h3>
                      <Badge tone="neutral">{t.categories[r.category]}</Badge>
                    </div>
                    <Badge tone={meta.tone} dot>{t.levels[r.level]}</Badge>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{item.desc}</p>
                  {r.due && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-faint">
                      <ShieldAlert className="h-3.5 w-3.5" /> {t.dueLabel} <span className="text-ink">{date(r.due)}</span>
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
