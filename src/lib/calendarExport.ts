import type { CalendarEvent, CalendarEventKind } from "../store/types"
import { calendarDay, dateFromDay } from "./calendarDates"

const DAY_MS = 86_400_000

export type CalendarExportScope = "week" | "month"
export type CalendarExportDay = { date: string; events: CalendarEvent[] }
export type CalendarExportPeriod = {
  scope: CalendarExportScope
  days: CalendarExportDay[]
  leading: number
  rows: number
}

/** Get the visible dates for a week (Monday first) or the anchor date's month. */
export function calendarExportPeriod(
  scope: CalendarExportScope,
  anchorDate: string,
  events: readonly CalendarEvent[],
): CalendarExportPeriod {
  const anchor = calendarDay(anchorDate)
  if (anchor === null) throw new Error("The calendar export date is invalid.")

  const anchorUtc = new Date(anchor * DAY_MS)
  let dateNumbers: number[]
  let leading = 0
  if (scope === "week") {
    const mondayOffset = (anchorUtc.getUTCDay() + 6) % 7
    const monday = anchor - mondayOffset
    dateNumbers = Array.from({ length: 7 }, (_, index) => monday + index)
  } else {
    const year = anchorUtc.getUTCFullYear()
    const month = anchorUtc.getUTCMonth()
    const first = Date.UTC(year, month, 1) / DAY_MS
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    leading = (new Date(first * DAY_MS).getUTCDay() + 6) % 7
    dateNumbers = Array.from({ length: count }, (_, index) => first + index)
  }

  const dates = new Set(dateNumbers.map(dateFromDay))
  const grouped = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    if (!dates.has(event.date) || calendarDay(event.date) === null) continue
    const group = grouped.get(event.date) ?? []
    group.push(event)
    grouped.set(event.date, group)
  }

  const days = dateNumbers.map((day) => {
    const date = dateFromDay(day)
    const dayEvents = (grouped.get(date) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title))
    return { date, events: dayEvents }
  })
  return { scope, days, leading, rows: scope === "week" ? 1 : Math.ceil((leading + days.length) / 7) }
}

export type CalendarSvgLabels = {
  event: string
  deadline: string
  ended: string
  today: string
  moreEvents: (count: number) => string
}

export type CalendarSvgOptions = {
  scope: CalendarExportScope
  anchorDate: string
  events: readonly CalendarEvent[]
  title: string
  subtitle: string
  footer: string
  locale: string
  direction: "ltr" | "rtl"
  weekdays: readonly string[]
  labels: CalendarSvgLabels
  today: string
  formatDay: (isoDate: string) => string
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
})[character]!)

function truncate(text: string, maxLength: number) {
  const characters = Array.from(text)
  return characters.length > maxLength ? `${characters.slice(0, maxLength - 1).join("")}…` : text
}

function eventColor(kind: CalendarEventKind, ended: boolean) {
  if (ended) return "#64748b"
  return kind === "deadline" ? "#b45309" : "#6d28d9"
}

/** Build a self-contained SVG for a printable/downloadable calendar picture. */
export function buildCalendarSvg(options: CalendarSvgOptions) {
  if (options.weekdays.length !== 7) throw new Error("Seven weekday labels are required.")
  const period = calendarExportPeriod(options.scope, options.anchorDate, options.events)
  const width = 1680
  const margin = 44
  const innerWidth = width - margin * 2
  const columnWidth = innerWidth / 7
  const headingY = 58
  const subtitleY = 94
  const legendY = 132
  const weekdayY = 164
  const gridY = 192
  const cellHeight = options.scope === "week" ? 540 : 172
  const height = gridY + period.rows * cellHeight + 46
  const rtl = options.direction === "rtl"
  const align = rtl ? "end" : "start"
  const cellInset = 12
  const maxEvents = options.scope === "week" ? 16 : 5
  const maxTitleLength = options.scope === "week" ? 28 : 25

  const header = [
    `<text x="${width / 2}" y="${headingY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#111827">${escapeXml(options.title)}</text>`,
    `<text x="${width / 2}" y="${subtitleY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#475569">${escapeXml(options.subtitle)}</text>`,
    `<circle cx="${margin + 5}" cy="${legendY - 5}" r="5" fill="#6d28d9"/><text x="${margin + 17}" y="${legendY}" font-family="Arial, sans-serif" font-size="12" fill="#475569">${escapeXml(options.labels.event)}</text>`,
    `<circle cx="${margin + 130}" cy="${legendY - 5}" r="5" fill="#b45309"/><text x="${margin + 142}" y="${legendY}" font-family="Arial, sans-serif" font-size="12" fill="#475569">${escapeXml(options.labels.deadline)}</text>`,
    `<circle cx="${margin + 280}" cy="${legendY - 5}" r="5" fill="#64748b"/><text x="${margin + 292}" y="${legendY}" font-family="Arial, sans-serif" font-size="12" fill="#475569">${escapeXml(options.labels.ended)}</text>`,
  ].join("")

  const weekdayHeaders = options.weekdays.map((weekday, logicalColumn) => {
    const column = rtl ? 6 - logicalColumn : logicalColumn
    const x = margin + column * columnWidth + columnWidth / 2
    return `<text x="${x}" y="${weekdayY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#475569">${escapeXml(weekday)}</text>`
  }).join("")

  const monthCells: (CalendarExportDay | null)[] = options.scope === "week"
    ? period.days
    : [...Array.from({ length: period.leading }, () => null), ...period.days]
  const cells = monthCells.map((day, logicalIndex) => {
    const logicalColumn = logicalIndex % 7
    const row = Math.floor(logicalIndex / 7)
    const column = rtl ? 6 - logicalColumn : logicalColumn
    const x = margin + column * columnWidth
    const y = gridY + row * cellHeight
    const rect = `<rect x="${x + 2}" y="${y + 2}" width="${columnWidth - 4}" height="${cellHeight - 4}" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>`
    if (!day) return rect

    const isToday = day.date === options.today
    const dayColor = isToday ? "#6d28d9" : "#111827"
    const textX = rtl ? x + columnWidth - cellInset : x + cellInset
    const dayHeader = `<text x="${textX}" y="${y + 27}" text-anchor="${align}" direction="${options.direction}" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${dayColor}">${escapeXml(options.formatDay(day.date))}${isToday ? ` · ${escapeXml(options.labels.today)}` : ""}</text>`
    const entries = day.events.slice(0, maxEvents).map((event, eventIndex) => {
      const ended = event.date < options.today
      const color = eventColor(event.kind, ended)
      const label = `${truncate(event.title, maxTitleLength)}${ended ? ` · ${options.labels.ended}` : ""}`
      const baseline = y + 51 + eventIndex * (options.scope === "week" ? 24 : 22)
      const markerX = rtl ? x + columnWidth - cellInset : x + cellInset
      const labelX = rtl ? markerX - 10 : markerX + 10
      const textAnchor = rtl ? "end" : "start"
      return `<circle cx="${markerX}" cy="${baseline - 4}" r="3.5" fill="${color}"/><text x="${labelX}" y="${baseline}" text-anchor="${textAnchor}" direction="${options.direction}" font-family="Arial, sans-serif" font-size="${options.scope === "week" ? 12 : 11}" fill="${color}">${escapeXml(label)}</text>`
    }).join("")
    const overflowCount = day.events.length - maxEvents
    const overflow = overflowCount > 0
      ? `<text x="${textX}" y="${y + cellHeight - 12}" text-anchor="${align}" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#475569">${escapeXml(options.labels.moreEvents(overflowCount))}</text>`
      : ""
    return rect + dayHeader + entries + overflow
  }).join("")

  const footer = `<text x="${width / 2}" y="${height - 14}" text-anchor="middle" direction="${options.direction}" font-family="Arial, sans-serif" font-size="10" fill="#475569">${escapeXml(options.footer)}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" lang="${escapeXml(options.locale)}" direction="${options.direction}"><title>${escapeXml(options.title)}</title><rect width="100%" height="100%" fill="#ffffff"/>${header}${weekdayHeaders}${cells}${footer}</svg>`
  return { svg, width, height }
}

/** Rasterize an SVG calendar at 2× for a crisp PNG export. */
export async function calendarSvgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("The calendar image could not be rendered."))
      image.src = url
    })

    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = width * scale
    canvas.height = height * scale
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas image export is unavailable.")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The calendar PNG could not be created.")), "image/png")
    })
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}
