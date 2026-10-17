import { useMemo, useState } from "react"
import { Wallet, Landmark, FolderOpen, FileSpreadsheet, FileText, FileDown, FolderPlus, ReceiptText, FileSignature, Loader2, SlidersHorizontal, Info } from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { toCSV, toExcel, runAsync } from "../lib/mizan"
import { dashboardData, dashboardMoney } from "../lib/dashboardData"
import { useToday } from "../hooks/useToday"
import { Card, SectionTitle, Btn, Badge, Toggle } from "../components/kit"
import { PlanStrip } from "../components/PlanStatus"
import { usePlanBanner } from "../store/useDashboardPrefs"
import { AreaChart, BarChart, Donut, Legend } from "../components/charts"
import { useTranslation } from "../lib/language/store"


function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-line p-6 text-center text-[13px] text-muted">{children}</div>
}

export default function Dashboard({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const { projects, expenses, contacts, audit, settings } = useMizan()
  const today = useToday()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [widgets, setWidgets] = useState({ flow: true, projects: true, breakdown: true })
  const [showCustomize, setShowCustomize] = useState(false)
  // The app-wide language preference, shared with the navigation rail and the
  // auth screens. It used to be this module's own FR/AR key plus its own toggle
  // button, which let the dashboard and the rail disagree.
  const { language, dir, tag, t: copy } = useTranslation()
  const t = copy.dashboard
  const banner = usePlanBanner()
  const m = useMemo(() => dashboardData({ projects, expenses, contacts, audit }, range, today, t.months), [projects, expenses, contacts, audit, range, today, t])
  const cur = settings.currency
  // Stored category labels are French; a category the user created has no
  // translation and keeps its own name.
  const byCategory = m.byCategory.map((item) => ({ ...item, label: t.categories[item.label] ?? item.label }))

  async function doExport(kind: "csv" | "excel" | "pdf") {
    if (busy || (kind === "pdf" ? !m.hasRecords : !m.monthly.periodCount)) return
    setBusy(kind); setExportError(null)
    const rows = m.monthly.labels.map((label, i) => ({ [t.exportMonth]: label, [t.exportExpense]: m.monthly.values[i], [t.exportCount]: m.monthly.entries[i] }))
    try {
      await runAsync(() => {
        if (kind === "csv") toCSV(rows, "fatorati-depenses-approuvees.csv")
        else if (kind === "excel") toExcel(rows, "fatorati-depenses-approuvees.xls")
        else window.print()
      })
    } catch { setExportError(t.exportError) } finally { setBusy(null) }
  }

  const cards = [
    { label: t.cardBudget, value: m.budget, icon: FolderOpen, chip: "bg-brand-50 text-brand-700", detail: t.projectCount(m.projectCount) },
    { label: t.cardCollected, value: m.collected, icon: Wallet, chip: "bg-good-50 text-emerald-700", detail: t.projectCount(m.projectCount) },
    { label: t.cardExpenses, value: m.approvedExpenses, icon: ReceiptText, chip: "bg-brand-50 text-brand-700", detail: t.expenseCount(m.approvedCount) },
    { label: t.cardReceivables, value: m.receivables, icon: Landmark, chip: "bg-warn-50 text-warn", detail: t.clientCount(m.clientCount) },
  ]
  const quick = [
    { icon: FolderPlus, label: t.quickProject, to: "projects" as ModuleKey, tint: "bg-brand text-white" },
    { icon: ReceiptText, label: t.quickExpense, to: "procurement" as ModuleKey, tint: "bg-emerald-brand text-white" },
    { icon: FileSignature, label: t.quickContract, to: "legal" as ModuleKey, tint: "bg-navy text-white" },
  ]

  return (
    <div className="mz-view space-y-6" dir={dir} lang={language}>
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <SectionTitle title={t.title} sub={t.subtitle} action={<div className="flex flex-wrap items-center gap-2">
        <select aria-label={t.period} value={range} onChange={(e) => setRange(Number(e.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
          {[6, 8, 12].map((n) => <option key={n} value={n}>{t.range(n)}</option>)}
        </select>
        <Btn variant="outline" size="sm" onClick={() => doExport("csv")} disabled={!!busy || !m.monthly.periodCount}>{busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} CSV</Btn>
        <Btn variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!!busy || !m.monthly.periodCount}>{busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel</Btn>
        <Btn variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!!busy || !m.hasRecords}>{busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF</Btn>
        <Btn variant="ghost" size="sm" onClick={() => setShowCustomize((value) => !value)}><SlidersHorizontal className="h-4 w-4" />{t.widgets}</Btn>
      </div>} />

      {/* How long this account's plan runs. Shown by default and kept out of the
          charts' reach — but the client can hide it from the Widgets panel below
          until the plan window ends (see `store/useDashboardPrefs.ts`). */}
      <PlanStrip onNavigate={() => onNavigate("settings")} />

      {showCustomize && <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{t.show}</span>
        {([["flow", t.flow], ["projects", t.projects], ["breakdown", t.breakdown]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-[13px] font-medium"><Toggle checked={widgets[key]} label={label} onChange={(value) => setWidgets((all) => ({ ...all, [key]: value }))} />{label}</label>)}
        {/* The plan banner switches off only for the window it was hidden in:
            the note says so, because a toggle that comes back by itself would
            otherwise look broken. */}
        <span className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] font-medium"><Toggle checked={banner.visible} label={t.planBanner} onChange={(value) => (value ? banner.show() : banner.hide())} />{t.planBanner}</label>
          <span className="text-[11.5px] text-faint">{t.planBannerNote}</span>
        </span>
      </Card>}

      <div className="grid gap-3 sm:grid-cols-3">{quick.map((action) => <button key={action.label} onClick={() => onNavigate(action.to)} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><span className={`grid h-10 w-10 place-items-center rounded-lg ${action.tint}`}><action.icon className="h-5 w-5" /></span><span className="text-[13.5px] font-semibold">{action.label}</span></button>)}</div>

      {!m.hasRecords && <Card className="border-dashed p-6 text-center"><h2 className="text-lg font-bold">{t.emptyTitle}</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-muted">{t.emptyDescription}</p></Card>}
      {m.hiddenDemoCount > 0 && <p className="text-[12px] text-muted">{t.samples(m.hiddenDemoCount)}</p>}
      {(m.invalidCount + m.invalidDateCount) > 0 && <p role="alert" className="text-[12px] text-warn">{t.invalid(m.invalidCount + m.invalidDateCount)}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Card key={card.label} className="p-5">
        <div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-lg ${card.chip}`}><card.icon className="h-4.5 w-4.5" strokeWidth={2.2} /></span><span className="text-[11.5px] text-muted">{card.detail}</span></div>
        <p className="mt-4 text-[12px] font-medium text-muted">{card.label}</p><p className="tnum mt-1 text-[22px] font-bold leading-none tracking-tight">{dashboardMoney(card.value, cur, false, tag)}</p><p className="mt-2 text-[11px] text-faint">{t.allDates}</p>
      </Card>)}</div>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />{t.cashNote}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        {widgets.flow && <Card className="p-5 lg:col-span-2"><div className="mb-3"><h2 className="text-[14px] font-bold">{t.chartExpenses}</h2><p className="text-[12px] text-muted">{t.chartExpensesSub} · {cur}</p></div>
          {m.monthly.periodCount ? <AreaChart labels={m.monthly.labels} series={[{ name: t.seriesExpense, values: m.monthly.values }]} format={(n) => dashboardMoney(n, cur, true, tag)} /> : <EmptyChart>{t.emptyPeriod}</EmptyChart>}
        </Card>}
        {widgets.breakdown && <Card className="p-5"><h2 className="text-[14px] font-bold">{t.chartBreakdown}</h2><p className="mb-4 text-[12px] text-muted">{t.chartBreakdownSub}</p>{byCategory.length ? <Donut segments={byCategory} /> : <EmptyChart>{t.emptyCategory}</EmptyChart>}</Card>}
      </div>

      {widgets.projects && <Card className="p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[14px] font-bold">{t.chartProjects}</h2><p className="text-[12px] text-muted">{t.chartProjectsSub}</p></div><Legend series={[{ name: t.seriesBudget, values: [] }, { name: t.seriesCollected, color: "var(--chart-2)", values: [] }]} /></div>
        {m.projectChart.some((p) => p.budget > 0 || p.paid > 0) ? <BarChart labels={m.projectChart.map((p) => p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name)} series={[{ name: t.seriesBudget, values: m.projectChart.map((p) => p.budget) }, { name: t.seriesCollected, color: "var(--chart-2)", values: m.projectChart.map((p) => p.paid) }]} format={(n) => dashboardMoney(n, cur, true, tag)} /> : <EmptyChart>{t.emptyProjects}</EmptyChart>}
      </Card>}

      <Card><header className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[14px] font-bold">{t.recent}</h2><Btn variant="ghost" size="sm" onClick={() => onNavigate("audit")}>{t.viewLog}</Btn></header>
        {m.recent.length ? <ul className="divide-y divide-line">{m.recent.map((event) => <li key={event.id} className="flex items-center gap-3 px-5 py-3 text-[13px]"><Badge tone={event.severity === "critical" ? "serious" : event.severity === "warning" ? "warn" : "neutral"} dot>{event.severity === "critical" ? t.critical : event.severity === "warning" ? t.warning : t.info}</Badge><span className="min-w-0 flex-1 truncate"><span className="font-semibold">{event.actor}</span> <span className="text-muted">{event.action}</span> {event.target}</span></li>)}</ul> : <p className="px-5 py-6 text-[13px] text-muted">{t.emptyActivity}</p>}
      </Card>
    </div>
  )
}
