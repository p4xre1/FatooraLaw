const DAY_MS = 86_400_000

/** Date-only arithmetic uses UTC day numbers, not elapsed hours across DST. */
export function calendarDay(value: string): number | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!iso && !dmy) return null
  const [year, month, day] = iso ? iso.slice(1).map(Number) : [Number(dmy![3]), Number(dmy![2]), Number(dmy![1])]
  if (year < 1000 || year > 9999) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.getTime() / DAY_MS
}

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function dateFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function addCalendarDays(value: string, days: number): string {
  const day = calendarDay(value)
  if (day === null || !Number.isInteger(days)) throw new Error("Date invalide.")
  return dateFromDay(day + days)
}

export function daysUntil(value: string, today = todayISO()): number | null {
  const target = calendarDay(value)
  const current = calendarDay(today)
  return target === null || current === null ? null : target - current
}

export function validDateRange(start: string, expiry: string): boolean {
  const a = start ? calendarDay(start) : null
  const b = expiry ? calendarDay(expiry) : null
  return (!start || a !== null) && (!expiry || b !== null) && (a === null || b === null || a <= b)
}
