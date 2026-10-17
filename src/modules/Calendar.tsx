import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react"
import type { CalendarCopy } from "../i18n/calendar"
import type { CalendarEvent, CalendarEventKind } from "../store/types"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"
import { calendarDay, todayISO } from "../lib/calendarDates"
import {
  buildCalendarSvg,
  calendarExportPeriod,
  calendarSvgToPng,
  type CalendarExportScope,
} from "../lib/calendarExport"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { Badge, Btn, Card, Field, IconBtn, Input, Modal, SectionTitle, Select, Textarea } from "../components/kit"

const TYPE_META: Record<CalendarEventKind, { dot: string; tone: "brand" | "warn"; icon: typeof CalendarDays }> = {
  event: { dot: "bg-brand", tone: "brand", icon: CalendarDays },
  deadline: { dot: "bg-warn", tone: "warn", icon: Bell },
}

type PrintRequest = { scope: CalendarExportScope; anchorDate: string }

const pad = (value: number) => String(value).padStart(2, "0")
function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}
function localNoon(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day, 12).getTime()
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try { link.click() }
  finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export default function Calendar() {
  const { language, dir, tag, t: copy } = useTranslation()
  const t = copy.calendar
  const { date, number } = useFormats()
  const events = useMizan((state) => state.calendarEvents)
  const addCalendarEvent = useMizan((state) => state.addCalendarEvent)
  const removeCalendarEvent = useMizan((state) => state.removeCalendarEvent)
  const today = useToday()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [adding, setAdding] = useState(false)
  const [printRequest, setPrintRequest] = useState<PrintRequest | null>(null)
  const [exportingImage, setExportingImage] = useState<CalendarExportScope | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const monthValue = `${year}-${pad(monthIndex + 1)}`
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(month), [tag, month])
  const weekdays = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" })
    // 1 January 2024 is a Monday; keep the grid Monday-first in every locale.
    return Array.from({ length: 7 }, (_, index) => weekday.format(new Date(2024, 0, index + 1)))
  }, [tag])

  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const byDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const day = calendarDay(event.date)
      if (day === null) continue
      const list = grouped.get(event.date) ?? []
      list.push(event)
      grouped.set(event.date, list)
    }
    return grouped
  }, [events])
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    [events],
  )
  const selectedEvents = byDate.get(selectedDate) ?? []
  const selectedDay = calendarDay(selectedDate)
  // Date-only strings parse as UTC in JavaScript; format at local noon so a
  // user west of UTC never sees an event on the previous calendar day.
  const displayDate = (iso: string) => date(localNoon(iso))
  const selectedDateLabel = selectedDay === null ? selectedDate : displayDate(selectedDate)
  const monthAnchor = isoDate(year, monthIndex, 1)

  function goToMonth(value: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (!match) return
    const nextYear = Number(match[1])
    const nextMonth = Number(match[2]) - 1
    if (nextYear < 1000 || nextYear > 9999 || nextMonth < 0 || nextMonth > 11) return
    const selectedDayNumber = Number(selectedDate.slice(8, 10)) || 1
    const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate()
    setMonth(new Date(nextYear, nextMonth, 1))
    setSelectedDate(isoDate(nextYear, nextMonth, Math.min(selectedDayNumber, lastDay)))
  }

  function changeMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1)
    if (next.getFullYear() < 1000 || next.getFullYear() > 9999) return
    goToMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`)
  }

  function goToToday() {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(todayISO())
  }

  function selectEvent(event: CalendarEvent) {
    const [eventYear, eventMonth] = event.date.split("-").map(Number)
    setMonth(new Date(eventYear, eventMonth - 1, 1))
    setSelectedDate(event.date)
  }

  function saveEvent(event: Omit<CalendarEvent, "id">) {
    addCalendarEvent(event)
    const [eventYear, eventMonth] = event.date.split("-").map(Number)
    setMonth(new Date(eventYear, eventMonth - 1, 1))
    setSelectedDate(event.date)
    setAdding(false)
  }

  function requestPdf(scope: CalendarExportScope) {
    setExportError(null)
    setPrintRequest({ scope, anchorDate: scope === "month" ? monthAnchor : selectedDate })
  }

  useEffect(() => {
    if (!printRequest) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrintRequest(null)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [printRequest])

  async function exportImage(scope: CalendarExportScope) {
    setExportError(null)
    setExportingImage(scope)
    try {
      const anchorDate = scope === "month" ? monthAnchor : selectedDate
      const period = calendarExportPeriod(scope, anchorDate, events)
      const title = scope === "month"
        ? t.monthTitle(monthLabel)
        : t.weekTitle(displayDate(period.days[0].date), displayDate(period.days[period.days.length - 1].date))
      const image = buildCalendarSvg({
        scope,
        anchorDate,
        events,
        title,
        subtitle: t.printSubtitle,
        footer: t.notice,
        locale: tag,
        direction: dir,
        weekdays,
        labels: {
          event: t.types.event,
          deadline: t.types.deadline,
          ended: t.ended,
          today: t.today,
          moreEvents: t.moreEvents,
        },
        today,
        formatDay: (iso) => number(Number(iso.slice(8, 10))),
      })
      const png = await calendarSvgToPng(image.svg, image.width, image.height)
      const fileDate = scope === "month" ? monthValue : period.days[0].date
      downloadBlob(png, `fatorati-calendar-${scope}-${fileDate}.png`)
    } catch {
      setExportError(t.exportError)
    } finally {
      setExportingImage(null)
    }
  }

  return (
    <>
      <div className="mz-view space-y-5" dir={dir} lang={language}>
        <SectionTitle
          title={copy.shared.modules.calendar}
          sub={t.subtitle}
          action={<Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> {t.addEvent}</Btn>}
        />

        <p role="note" className="rounded-lg border border-warn/20 bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
          {t.notice}
        </p>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {(Object.keys(TYPE_META) as CalendarEventKind[]).map((kind) => (
                  <span key={kind} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                    <span className={`h-2.5 w-2.5 rounded-full ${TYPE_META[kind].dot}`} />
                    {t.types[kind]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-1 py-1">
                <button type="button" aria-label={t.previousMonth} onClick={() => changeMonth(-1)} disabled={year === 1000 && monthIndex === 0} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="month"
                  aria-label={t.selectMonth}
                  min="1000-01"
                  max="9999-12"
                  value={monthValue}
                  onChange={(event) => goToMonth(event.target.value)}
                  className="h-8 w-[160px] rounded-md border-0 bg-transparent px-1 text-center text-[13px] font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button type="button" aria-label={t.nextMonth} onClick={() => changeMonth(1)} disabled={year === 9999 && monthIndex === 11} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" aria-label={t.thisMonth} title={t.thisMonth} onClick={goToToday} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.05] hover:text-ink">
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map((weekday, index) => (
                <span key={`${index}-${weekday}`} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-faint">{weekday}</span>
              ))}
              {cells.map((day, index) => {
                if (day === null) return <span key={`blank-${index}`} className="aspect-square rounded-lg bg-canvas/40" />
                const key = isoDate(year, monthIndex, day)
                const dayEvents = byDate.get(key) ?? []
                const selected = selectedDate === key
                const isToday = today === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    aria-label={t.selectDay(displayDate(key))}
                    aria-pressed={selected}
                    className={`flex aspect-square flex-col rounded-lg border p-1.5 text-start transition-all ${
                      selected
                        ? "border-brand bg-brand-50 ring-2 ring-brand/20"
                        : dayEvents.length
                          ? "border-line-strong bg-surface hover:border-brand/40"
                          : "border-line bg-surface hover:bg-canvas"
                    }`}
                  >
                    <span className={`text-[12px] font-semibold ${selected ? "text-brand-700" : isToday ? "text-brand" : "text-ink"}`}>
                      {number(day)}
                    </span>
                    <span className="mt-auto flex flex-wrap gap-0.5" aria-hidden="true">
                      {dayEvents.slice(0, 5).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_META[event.kind].dot}`} />)}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="me-1 text-[11px] font-bold uppercase tracking-wide text-muted">{t.selectedWeek}</span>
                <Btn variant="outline" size="sm" onClick={() => requestPdf("week")}><FileText className="h-4 w-4" /> {t.weekPdf}</Btn>
                <Btn variant="outline" size="sm" disabled={exportingImage !== null} onClick={() => void exportImage("week")}>
                  <ImageIcon className="h-4 w-4" /> {exportingImage === "week" ? t.exportingImage : t.weekPng}
                </Btn>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="me-1 text-[11px] font-bold uppercase tracking-wide text-muted">{t.shownMonth}</span>
                <Btn variant="outline" size="sm" onClick={() => requestPdf("month")}><FileText className="h-4 w-4" /> {t.monthPdf}</Btn>
                <Btn variant="outline" size="sm" disabled={exportingImage !== null} onClick={() => void exportImage("month")}>
                  <ImageIcon className="h-4 w-4" /> {exportingImage === "month" ? t.exportingImage : t.monthPng}
                </Btn>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">{t.pdfHint}</p>
              {exportError && <p role="alert" className="text-[12px] text-serious">{exportError}</p>}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted">
                <CalendarDays className="h-4 w-4 text-brand" /> {t.listTitle}
              </p>
              {sortedEvents.length ? (
                <ul className="max-h-[430px] space-y-1 overflow-y-auto">
                  {sortedEvents.map((event) => {
                    const meta = TYPE_META[event.kind]
                    const Icon = meta.icon
                    const ended = event.date < today
                    return (
                      <li key={event.id} className="flex items-center gap-1 rounded-lg hover:bg-canvas">
                        <button
                          type="button"
                          onClick={() => selectEvent(event)}
                          aria-pressed={selectedDate === event.date}
                          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-start transition-colors ${selectedDate === event.date ? "bg-brand-50" : ""}`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas">
                            <Icon className="h-4 w-4 text-ink" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold text-muted">{displayDate(event.date)}</span>
                            <span className="block truncate text-[12.5px] font-semibold text-ink">{event.title}</span>
                            <span className="mt-0.5 block truncate text-[10.5px] text-muted">{event.note || t.types[event.kind]}</span>
                          </span>
                          <span className="flex flex-wrap justify-end gap-1">
                            <Badge tone={meta.tone}>{t.types[event.kind]}</Badge>
                            {ended && <Badge tone="neutral">{t.ended}</Badge>}
                          </span>
                        </button>
                        <IconBtn onClick={() => removeCalendarEvent(event.id)} aria-label={t.removeAria(event.title)} title={t.remove}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-line p-4 text-center text-[12.5px] leading-relaxed text-muted">{t.empty}</p>
              )}
            </Card>

            <Card className="p-4">
              <p className="mb-3 flex items-center gap-2 text-[12px] font-bold text-ink">
                <CalendarDays className="h-4 w-4 text-brand" /> {t.selectedDate(selectedDateLabel)}
              </p>
              {selectedEvents.length ? (
                <ul className="space-y-2.5">
                  {selectedEvents.map((event) => (
                    <li key={event.id} className="rounded-lg border border-line bg-canvas/50 p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-[13px] font-semibold text-ink">{event.title}</span>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={TYPE_META[event.kind].tone} dot>{t.types[event.kind]}</Badge>
                          {event.date < today && <Badge tone="neutral">{t.ended}</Badge>}
                        </span>
                      </div>
                      {event.note && <p className="mb-2 text-[12px] leading-relaxed text-muted">{event.note}</p>}
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeCalendarEvent(event.id)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-serious hover:underline">
                          <Trash2 className="h-3.5 w-3.5" /> {t.remove}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-muted">{t.emptyDate}</p>
              )}
            </Card>
          </div>
        </div>

        {adding && <AddCalendarEvent defaultDate={selectedDate} onClose={() => setAdding(false)} onAdd={saveEvent} />}
      </div>

      {printRequest && (
        <CalendarPrintView
          scope={printRequest.scope}
          anchorDate={printRequest.anchorDate}
          events={events}
          today={today}
          language={language}
          direction={dir}
          locale={tag}
          weekdays={weekdays}
          t={t}
          displayDate={displayDate}
          formatDay={(iso) => number(Number(iso.slice(8, 10)))}
        />
      )}
    </>
  )
}

function CalendarPrintView({
  scope,
  anchorDate,
  events,
  today,
  language,
  direction,
  locale,
  weekdays,
  t,
  displayDate,
  formatDay,
}: {
  scope: CalendarExportScope
  anchorDate: string
  events: readonly CalendarEvent[]
  today: string
  language: string
  direction: "ltr" | "rtl"
  locale: string
  weekdays: string[]
  t: CalendarCopy
  displayDate: (iso: string) => string
  formatDay: (iso: string) => string
}) {
  const period = calendarExportPeriod(scope, anchorDate, events)
  const firstDate = period.days[0].date
  const printMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(localNoon(firstDate))
  const title = scope === "week"
    ? t.weekTitle(displayDate(firstDate), displayDate(period.days[period.days.length - 1].date))
    : t.monthTitle(printMonth)
  const cells: (typeof period.days[number] | null)[] = scope === "week"
    ? period.days
    : [...Array.from({ length: period.leading }, () => null), ...period.days]

  return (
    <div id="calendar-print" className="calendar-print-page" dir={direction} lang={language}>
      <header className="calendar-print-header">
        <h1>{title}</h1>
        <p>{t.printSubtitle}</p>
      </header>
      <div className="calendar-print-weekdays">
        {weekdays.map((weekday, index) => <div key={`${index}-${weekday}`}>{weekday}</div>)}
      </div>
      <div className={`calendar-print-grid ${scope === "week" ? "calendar-print-week" : "calendar-print-month"}`}>
        {cells.map((day, index) => day ? (
          <article className="calendar-print-day" key={day.date}>
            <div className="calendar-print-date">
              <span>{formatDay(day.date)}</span>
              {day.date === today && <span className="calendar-print-today">{t.today}</span>}
            </div>
            {day.events.length > 0 && (
              <ul className="calendar-print-events">
                {day.events.map((event) => (
                  <li key={event.id} className={event.date < today ? "calendar-print-event calendar-print-event-ended" : "calendar-print-event"}>
                    <div className="calendar-print-event-title">
                      <span>{event.title}</span>
                      <span className="calendar-print-type">{t.types[event.kind]}</span>
                    </div>
                    {event.date < today && <span className="calendar-print-ended">{t.ended}</span>}
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : <div key={`blank-${index}`} className="calendar-print-blank" />)}
      </div>
      <footer className="calendar-print-footer">{t.notice}</footer>
    </div>
  )
}

function AddCalendarEvent({
  defaultDate,
  onClose,
  onAdd,
}: {
  defaultDate: string
  onClose: () => void
  onAdd: (event: Omit<CalendarEvent, "id">) => void
}) {
  const { t: copy } = useTranslation()
  const t = copy.calendar
  const common = copy.common
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [kind, setKind] = useState<CalendarEventKind>("event")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const valid = !!title.trim() && calendarDay(date) !== null

  return (
    <Modal title={t.modalTitle} onClose={onClose}>
      <form className="space-y-4" onSubmit={(submitEvent) => {
        submitEvent.preventDefault()
        if (!valid) return
        try {
          onAdd({ title, date, kind, note })
        } catch {
          setError(t.addError)
        }
      }}>
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={t.titleLabel}>
          <Input autoFocus maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); setError(null) }} placeholder={t.titlePlaceholder} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.dateLabel}>
            <Input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setError(null) }} className="tnum" />
          </Field>
          <Field label={t.kindLabel}>
            <Select value={kind} onChange={(event) => setKind(event.target.value as CalendarEventKind)}>
              <option value="event">{t.types.event}</option>
              <option value="deadline">{t.types.deadline}</option>
            </Select>
          </Field>
        </div>
        <Field label={t.noteLabel}>
          <Textarea rows={3} maxLength={400} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.notePlaceholder} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="outline" type="button" onClick={onClose}>{common.cancel}</Btn>
          <Btn type="submit" disabled={!valid}><Plus className="h-4 w-4" /> {t.save}</Btn>
        </div>
      </form>
    </Modal>
  )
}
