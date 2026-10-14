import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  CreditCard,
  Scale,
} from "lucide-react"
import { Card, SectionTitle, Badge } from "../components/kit"
import { useTranslation } from "../lib/language/store"

type EvType = "renew" | "pay" | "legal"
type EventId = "ovh" | "adobe" | "microsoft" | "corporateTax" | "insurance" | "vat" | "sage"
type Ev = { day: number; type: EvType; id: EventId }

/** Colours and icons are presentation; every visible type label comes from i18n. */
const TYPE_META: Record<EvType, {
  dot: string
  icon: typeof RefreshCw
  tone: "brand" | "warn" | "serious"
}> = {
  renew: { dot: "bg-brand", icon: RefreshCw, tone: "brand" },
  pay: { dot: "bg-warn", icon: CreditCard, tone: "warn" },
  legal: { dot: "bg-serious", icon: Scale, tone: "serious" },
}

// September 2026 — starts Tuesday (Mon-first grid → 1 leading blank), 30 days.
// This sample month and its entries are static; the translated notice below says so.
const MONTH = new Date(2026, 8, 1)
const LEAD = 1
const DAYS = 30

const EVENTS: Ev[] = [
  { day: 3, type: "pay", id: "ovh" },
  { day: 8, type: "pay", id: "adobe" },
  { day: 12, type: "renew", id: "microsoft" },
  { day: 15, type: "legal", id: "corporateTax" },
  { day: 20, type: "pay", id: "insurance" },
  { day: 23, type: "legal", id: "vat" },
  { day: 27, type: "renew", id: "sage" },
]

export default function Calendar() {
  const { tag, t: copy } = useTranslation()
  const t = copy.calendar
  const { modules } = copy.shared

  const number = useMemo(
    () => new Intl.NumberFormat(tag, { useGrouping: false }),
    [tag],
  )
  const month = useMemo(
    () => new Intl.DateTimeFormat(tag, { month: "long" }).format(MONTH),
    [tag],
  )
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(
        MONTH,
      ),
    [tag],
  )
  const weekdays = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" })
    // 7 September 2026 is a Monday; the component uses a Monday-first grid.
    return Array.from({ length: 7 }, (_, i) =>
      weekday.format(new Date(2026, 8, 7 + i)),
    )
  }, [tag])

  const byDay = useMemo(() => {
    const m = new Map<number, Ev[]>()
    for (const e of EVENTS)
      (m.get(e.day) ?? m.set(e.day, []).get(e.day)!).push(e)
    return m
  }, [])
  const [sel, setSel] = useState<number>(23)
  const selEvents = byDay.get(sel) ?? []
  const upcoming = [...EVENTS].sort((a, b) => a.day - b.day)

  const cells: (number | null)[] = [
    ...Array(LEAD).fill(null),
    ...Array.from({ length: DAYS }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title={modules.calendar}
        sub={t.subtitle}
        action={
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-1 py-1">
            <button
              type="button"
              disabled
              aria-label={t.previousMonth}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1 text-[13px] font-semibold text-ink">
              {monthLabel}
            </span>
            <button
              type="button"
              disabled
              aria-label={t.nextMonth}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <p
        role="note"
        className="rounded-lg border border-warn/20 bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted"
      >
        {t.demoNotice}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Month grid */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {(Object.keys(TYPE_META) as EvType[]).map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${TYPE_META[k].dot}`}
                />{" "}
                {t.types[k]}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((d) => (
              <span
                key={d}
                className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-faint"
              >
                {d}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null)
                return (
                  <span
                    key={i}
                    className="aspect-square rounded-lg bg-canvas/40"
                  />
                )
              const evs = byDay.get(d) ?? []
              const on = sel === d
              const dayLabel = number.format(d)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel(d)}
                  aria-label={t.selectDay(dayLabel, monthLabel)}
                  aria-pressed={on}
                  className={`flex aspect-square flex-col rounded-lg border p-1.5 text-start transition-all ${
                    on
                      ? "border-brand bg-brand-50 ring-2 ring-brand/20"
                      : evs.length
                        ? "border-line-strong bg-surface hover:border-brand/40"
                        : "border-line bg-surface hover:bg-canvas"
                  }`}
                >
                  <span
                    className={`text-[12px] font-semibold ${
                      on ? "text-brand-700" : "text-ink"
                    }`}
                  >
                    {dayLabel}
                  </span>
                  <span className="mt-auto flex flex-wrap gap-0.5">
                    {evs.map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${TYPE_META[e.type].dot}`}
                      />
                    ))}
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
              <CalendarDays className="h-4 w-4 text-brand" /> {t.upcomingTitle}
            </p>
            <ul className="space-y-1">
              {upcoming.map((e) => {
                const M = TYPE_META[e.type]
                const event = t.events[e.id]
                return (
                  <li key={`${e.day}-${e.id}`}>
                    <button
                      type="button"
                      onClick={() => setSel(e.day)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-start transition-colors ${
                        sel === e.day ? "bg-brand-50" : "hover:bg-canvas"
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas">
                        <span className="text-[13px] font-bold text-ink">
                          {number.format(e.day)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {event.label}
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted">
                          <M.icon className="h-3 w-3" /> {t.types[e.type]}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {selEvents.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-[12px] font-bold text-ink">
                {t.selectedDate(number.format(sel), month)}
              </p>
              <div className="space-y-2.5">
                {selEvents.map((e) => {
                  const event = t.events[e.id]
                  return (
                    <div
                      key={e.id}
                      className="rounded-lg border border-line bg-canvas/50 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink">
                          {event.label}
                        </span>
                        <Badge tone={TYPE_META[e.type].tone} dot>
                          {t.types[e.type]}
                        </Badge>
                      </div>
                      <p className="text-[12px] leading-relaxed text-muted">
                        {event.detail}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
