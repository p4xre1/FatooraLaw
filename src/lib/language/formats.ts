import { useMemo } from "react"
import { fmtDate, fmtDateTime, timeAgo } from "../mizan.ts"
import { useTranslation } from "./store.ts"

/**
 * Date and time formatters bound to the language on screen.
 *
 * `lib/mizan.ts` deliberately takes the locale tag as a required argument so a
 * call site cannot quietly fall back to French; this hook is the one place that
 * knows the current tag, which keeps the modules free of it. Components destructure
 * what they need — `const { date, dateTime, ago } = useFormats()` — and get
 * `fr-MA`, `ar-MA` or `en` formatting, including the translated "just now" that
 * `Intl.RelativeTimeFormat` phrases awkwardly on its own.
 */
export function useFormats() {
  const { tag, t } = useTranslation()

  return useMemo(
    () => ({
      date: (iso: string | number) => fmtDate(iso, tag),
      dateTime: (ts: number) => fmtDateTime(ts, tag),
      ago: (ts: number) => timeAgo(ts, tag, t.shared.justNow),
    }),
    [tag, t],
  )
}
