import { useMemo } from "react"
import { dashboardMoney } from "../dashboardData.ts"
import { fmtDate, fmtDateTime, money as formatMoney, num as formatNumber, timeAgo } from "../mizan.ts"
import type { Settings } from "../../store/types.ts"
import { useTranslation } from "./store.ts"

/**
 * Date, time, number and amount formatters bound to the language on screen.
 *
 * `lib/mizan.ts` keeps a currency-based locale as its default for callers that
 * do not render inside the app. Components destructure what they need —
 * `const { date, money } = useFormats()` — and receive the BCP-47 tag of the UI
 * (`fr-MA`, `ar-MA` or `en`). Passing currency separately preserves the account's
 * chosen ISO code while choosing the conventions of the selected interface.
 *
 * `money` is the app's established whole-unit display; `decimalMoney` is for
 * reports with more precision (up to two decimals).
 */
export function useFormats() {
  const { tag, t } = useTranslation()

  return useMemo(
    () => ({
      date: (iso: string | number) => fmtDate(iso, tag),
      dateTime: (ts: number) => fmtDateTime(ts, tag),
      ago: (ts: number) => timeAgo(ts, tag, t.shared.justNow),
      number: (value: number) => formatNumber(value, tag),
      money: (value: number, currency: Settings["currency"] = "MAD", compact = false) => formatMoney(value, currency, compact, tag),
      decimalMoney: (value: number, currency: Settings["currency"] = "MAD", compact = false) => dashboardMoney(value, currency, compact, tag),
    }),
    [tag, t],
  )
}
