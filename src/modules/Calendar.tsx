import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw, CreditCard, Scale } from "lucide-react"
import { Card, SectionTitle, Badge } from "../components/kit"

type EvType = "renew" | "pay" | "legal"
type Ev = { day: number; type: EvType; label: string; detail: string }

const TYPE_META: Record<EvType, { label: string; dot: string; icon: typeof RefreshCw; tone: "brand" | "warn" | "serious" }> = {
  renew: { label: "Renouvellement", dot: "bg-brand", icon: RefreshCw, tone: "brand" },
  pay: { label: "Paiement", dot: "bg-warn", icon: CreditCard, tone: "warn" },
  legal: { label: "Échéance légale", dot: "bg-serious", icon: Scale, tone: "serious" },
}

// September 2026 — starts Tuesday (Mon-first grid → 1 leading blank), 30 days.
const MONTH_LABEL = "Septembre 2026"
const LEAD = 1
const DAYS = 30
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const EVENTS: Ev[] = [
  { day: 3, type: "pay", label: "Hébergement OVH", detail: "Prélèvement mensuel — 89 MAD (carte ****4021)." },
  { day: 8, type: "pay", label: "Adobe Creative Cloud", detail: "Paiement récurrent — 299 MAD. Renouvellement automatique." },
  { day: 12, type: "renew", label: "Microsoft 365 Business", detail: "Fin de période le 12/09 — 129 MAD/mois si reconduit." },
  { day: 15, type: "legal", label: "Acompte IS — 1er versement", detail: "À régler auprès de la DGI. Base : résultat fiscal N-1." },
  { day: 20, type: "pay", label: "Assurance RC Pro", detail: "Échéance trimestrielle — 640 MAD." },
  { day: 23, type: "legal", label: "Déclaration TVA — T3 2026", detail: "Dépôt avant le 30/09 (DGI). Pénalité de 15% en cas de retard." },
  { day: 27, type: "renew", label: "Sage Compta", detail: "Abonnement annuel à échéance — 450 MAD/mois." },
]

export default function Calendar() {
  const byDay = useMemo(() => {
    const m = new Map<number, Ev[]>()
    for (const e of EVENTS) (m.get(e.day) ?? m.set(e.day, []).get(e.day)!).push(e)
    return m
  }, [])
  const [sel, setSel] = useState<number>(23)
  const selEvents = byDay.get(sel) ?? []
  const upcoming = [...EVENTS].sort((a, b) => a.day - b.day)

  const cells: (number | null)[] = [...Array(LEAD).fill(null), ...Array.from({ length: DAYS }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title="Calendrier"
        sub="Échéances légales, renouvellements de contrats et paiements d'abonnements"
        action={
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-1 py-1">
            <button className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 text-[13px] font-semibold text-ink">{MONTH_LABEL}</span>
            <button className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Month grid */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {(Object.keys(TYPE_META) as EvType[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                <span className={`h-2.5 w-2.5 rounded-full ${TYPE_META[k].dot}`} /> {TYPE_META[k].label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => <span key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-faint">{d}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="aspect-square rounded-lg bg-canvas/40" />
              const evs = byDay.get(d) ?? []
              const on = sel === d
              return (
                <button
                  key={i}
                  onClick={() => setSel(d)}
                  className={`flex aspect-square flex-col rounded-lg border p-1.5 text-start transition-all ${on ? "border-brand bg-brand-50 ring-2 ring-brand/20" : evs.length ? "border-line-strong bg-surface hover:border-brand/40" : "border-line bg-surface hover:bg-canvas"}`}
                >
                  <span className={`text-[12px] font-semibold ${on ? "text-brand-700" : "text-ink"}`}>{d}</span>
                  <span className="mt-auto flex flex-wrap gap-0.5">
                    {evs.map((e, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${TYPE_META[e.type].dot}`} />)}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted">
              <CalendarDays className="h-4 w-4 text-brand" /> Dates cruciales à venir
            </p>
            <ul className="space-y-1">
              {upcoming.map((e) => {
                const M = TYPE_META[e.type]
                return (
                  <li key={`${e.day}-${e.label}`}>
                    <button onClick={() => setSel(e.day)} className={`flex w-full items-center gap-3 rounded-lg p-2 text-start transition-colors ${sel === e.day ? "bg-brand-50" : "hover:bg-canvas"}`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas">
                        <span className="text-[13px] font-bold text-ink">{e.day}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">{e.label}</span>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted"><M.icon className="h-3 w-3" /> {M.label}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {selEvents.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-[12px] font-bold text-ink">{MONTH_LABEL.split(" ")[0]} {sel}</p>
              <div className="space-y-2.5">
                {selEvents.map((e, i) => (
                  <div key={i} className="rounded-lg border border-line bg-canvas/50 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">{e.label}</span>
                      <Badge tone={TYPE_META[e.type].tone} dot>{TYPE_META[e.type].label}</Badge>
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted">{e.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
