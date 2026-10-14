import { useMemo, useState } from "react"
import { FileDown, Printer, Loader2, FileSpreadsheet, Info } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { dashboardData } from "../lib/dashboardData"
import { useToday } from "../hooks/useToday"
import { toCSV, runAsync } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Table, Th, Td } from "../components/kit"
import { BarChart } from "../components/charts"

const SUMMARY_KEYS = ["budget", "collected", "expenses", "receivables"] as const

export default function Reports() {
  const { decimalMoney } = useFormats()
  const { language, t: copy } = useTranslation()
  const t = copy.reports
  const dashboardCopy = copy.dashboard
  const modules = copy.shared.modules
  const { projects, expenses, contacts, audit, settings } = useMizan()
  const today = useToday()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const m = useMemo(() => dashboardData({ projects, expenses, contacts, audit }, range, today, dashboardCopy.months), [projects, expenses, contacts, audit, range, today, dashboardCopy.months])
  const cur = settings.currency
  const values = {
    budget: m.budget,
    collected: m.collected,
    expenses: m.approvedExpenses,
    receivables: m.receivables,
  }

  async function exportExpenses() {
    if (busy || !m.monthly.periodCount) return
    setBusy(true); setExportError(null)
    const rows = m.monthly.labels.map((month, i) => ({
      [t.exportColumns.month]: month,
      [t.exportColumns.expenses]: m.monthly.values[i],
      [t.exportColumns.count]: m.monthly.entries[i],
    }))
    try { await runAsync(() => toCSV(rows, "fatorati-rapport-depenses-approuvees.csv")) }
    catch { setExportError(t.exportError) }
    finally { setBusy(false) }
  }

  return (
    <div className="mz-view space-y-5">
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <SectionTitle title={modules.reports} sub={t.subtitle} action={<div className="flex flex-wrap gap-2">
        <select aria-label={t.period} value={range} onChange={(event) => setRange(Number(event.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink">{[6, 8, 12].map((n) => <option key={n} value={n}>{t.months(n)}</option>)}</select>
        <Btn variant="outline" size="sm" onClick={exportExpenses} disabled={busy || !m.monthly.periodCount}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t.exportExpenses}</Btn>
        <Btn variant="dark" size="sm" onClick={() => window.print()} disabled={!m.hasRecords}><Printer className="h-4 w-4" /> {t.pdf}</Btn>
      </div>} />
      {!m.hasRecords && <Card className="border-dashed p-6 text-center"><h2 className="font-bold">{t.emptyTitle}</h2><p className="mt-2 text-sm text-muted">{t.emptyBody}</p></Card>}
      {m.hiddenDemoCount > 0 && <p className="text-[12px] text-muted">{t.hiddenSamples(m.hiddenDemoCount)}</p>}
      {(m.invalidCount + m.invalidDateCount) > 0 && <p role="alert" className="text-[12px] text-warn">{t.invalidRecords(m.invalidCount + m.invalidDateCount)}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SUMMARY_KEYS.map((key) => <Card key={key} className="p-4"><p className="text-[12px] text-muted">{t.summaries[key].label}</p><p className="tnum mt-1 text-[20px] font-bold">{decimalMoney(values[key], cur)}</p><p className="mt-1 text-[11px] text-faint">{t.allPeriods}</p></Card>)}</div>

      <Card className="border-warn/30 bg-warn-50 p-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" /><div><h2 className="text-[14px] font-bold">{t.tax.title}</h2><p className="mt-2 text-[13px] leading-relaxed text-muted">{t.tax.body}</p><p className="mt-2 text-[13px] leading-relaxed text-muted">{t.tax.limits}</p></div></div></Card>

      <Card className="p-5"><div className="mb-3"><h2 className="text-[14px] font-bold">{t.monthly.title}</h2><p className="text-[12px] text-muted">{t.monthly.note(cur)}</p></div>
        {m.monthly.periodCount ? <BarChart labels={m.monthly.labels} series={[{ name: t.monthly.series, values: m.monthly.values }]} format={(n) => decimalMoney(n, cur, true)} /> : <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{t.monthly.empty}</div>}
      </Card>
      <Card><header className="flex items-center gap-2 border-b border-line px-5 py-3.5"><FileSpreadsheet className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold">{t.totals}</h2></header><Table head={<><Th>{t.table.line}</Th><Th>{t.table.source}</Th><Th className="text-end">{t.table.amount}</Th></>}>
        {SUMMARY_KEYS.map((key) => <tr key={key}><Td className="font-medium text-ink">{t.summaries[key].label}</Td><Td className="text-muted">{t.summaries[key].source}</Td><Td className="tnum text-end font-semibold">{decimalMoney(values[key], cur)}</Td></tr>)}
      </Table></Card>
    </div>
  )
}
