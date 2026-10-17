import { describe, expect, it } from "vitest"
import { buildCalendarSvg, calendarExportPeriod } from "../src/lib/calendarExport"
import type { CalendarEvent } from "../src/store/types"

const events: CalendarEvent[] = [
  { id: "old", title: "<Supplier & client review>", date: "2026-09-22", kind: "deadline", note: "Bring the file" },
  { id: "future", title: "Project handover", date: "2026-09-27", kind: "event", note: "" },
  { id: "outside", title: "Next month", date: "2026-10-01", kind: "event", note: "" },
]

describe("calendar export periods", () => {
  it("exports the Monday-first week containing the selected date", () => {
    const period = calendarExportPeriod("week", "2026-09-23", events)
    expect(period.days.map((day) => day.date)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27",
    ])
    expect(period.days[1].events.map((event) => event.id)).toEqual(["old"])
    expect(period.days[6].events.map((event) => event.id)).toEqual(["future"])
  })

  it("exports every date in a leap-year month and excludes neighboring months", () => {
    const period = calendarExportPeriod("month", "2024-02-13", [
      { id: "leap", title: "Leap-day filing", date: "2024-02-29", kind: "deadline", note: "" },
      { id: "outside", title: "March visit", date: "2024-03-01", kind: "event", note: "" },
    ])
    expect(period.leading).toBe(3)
    expect(period.rows).toBe(5)
    expect(period.days).toHaveLength(29)
    expect(period.days.at(-1)?.events.map((event) => event.id)).toEqual(["leap"])
  })

  it("rejects an invalid anchor date", () => {
    expect(() => calendarExportPeriod("week", "2026-02-30", [])).toThrow("invalid")
  })

  it("builds a safe SVG image and marks past items as ended", () => {
    const image = buildCalendarSvg({
      scope: "week",
      anchorDate: "2026-09-23",
      events,
      title: "Week · 21–27 September 2026",
      subtitle: "Personal calendar",
      footer: "Personal reminders, not official advice.",
      locale: "en-GB",
      direction: "ltr",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      labels: {
        event: "Event",
        deadline: "Deadline",
        ended: "Ended",
        today: "Today",
        moreEvents: (count) => `+${count} more`,
      },
      today: "2026-09-23",
      formatDay: (iso) => String(Number(iso.slice(-2))),
    })

    expect(image.svg).toContain("&lt;Supplier &amp; client review&gt;")
    expect(image.svg).toContain("Ended")
    expect(image.svg).toContain("Project handover")
    expect(image.svg).toContain("Personal reminders, not official advice.")
    expect(image.svg).not.toContain("<Supplier & client review>")
    expect(image.width).toBeGreaterThan(1000)
    expect(image.height).toBeGreaterThan(500)
  })
})
