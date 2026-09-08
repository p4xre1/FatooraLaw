import { useMemo, useState } from "react"
import {
  TrendingUp, Wallet, PiggyBank, Landmark, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, FileText, FileDown, FolderPlus, ReceiptText, FileSignature, Loader2, SlidersHorizontal,
} from "lucide-react"
import type { ModuleKey, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money } from "../lib/mizan"
import { metrics, monthlySeries, expenseByCategory } from "../lib/analytics"
import { toCSV, toExcel, runAsync } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Toggle } from "../components/kit"
import { AreaChart, BarChart, Donut, Legend } from "../components/charts"

type Lang = Settings["language"]

/**
 * Dashboard-local translations (English / Arabic). The rest of the app is
 * still French — this dictionary only covers the Dashboard's own chrome.
 * Dynamic business data (activity log text, expense category names, project
 * names) comes straight from the store and isn't translated here.
 */
const dict = {
  en: {
    title: "Dashboard",
    sub: "Executive view · real-time metrics",
    range: { 6: "Last 6 months", 8: "Last 8 months", 12: "Last 12 months" },
    csv: "CSV",
    excel: "Excel",
    pdf: "PDF",
    widgetsBtn: "Widgets",
    show: "Show",
    widgetFlow: "Cash flow",
    widgetVelocity: "Cash velocity",
    widgetBreakdown: "Breakdown",
    quickProject: "Create project",
    quickExpense: "Add expense",
    quickContract: "Generate contract",
    cardRevenue: "Revenue",
    cardMargin: "Margin (profit)",
    cardTreasury: "Treasury (cash)",
    cardReceivables: "Accounts receivable",
    deltaRevenue: "+8.2%",
    deltaTreasury: "+3.1%",
    deltaReceivables: "to collect",
    flowTitle: "Cash flow",
    flowSub: (cur: string) => `Revenue vs expenses · ${cur}`,
    legendRevenue: "Revenue",
    legendExpense: "Expenses",
    breakdownTitle: "Expense breakdown",
    breakdownSub: "By category",
    velocityTitle: "Cash velocity",
    velocitySub: "Net monthly flow (revenue − expenses)",
    netSeries: "Net",
    activityTitle: "Recent activity",
    viewLog: "View log",
    sevCritical: "Critical",
    sevWarning: "Warning",
    sevInfo: "Info",
    exportMonth: "Month",
    exportRevenue: "Revenue",
    exportExpense: "Expenses",
    exportNet: "Net",
  },
  ar: {
    title: "لوحة التحكم",
    sub: "نظرة تنفيذية · مؤشرات لحظية",
    range: { 6: "آخر 6 أشهر", 8: "آخر 8 أشهر", 12: "آخر 12 شهرًا" },
    csv: "CSV",
    excel: "Excel",
    pdf: "PDF",
    widgetsBtn: "العناصر",
    show: "إظهار",
    widgetFlow: "التدفق المالي",
    widgetVelocity: "سرعة التدفق النقدي",
    widgetBreakdown: "التوزيع",
    quickProject: "إنشاء مشروع",
    quickExpense: "إضافة مصروف",
    quickContract: "إنشاء عقد",
    cardRevenue: "الإيرادات",
    cardMargin: "الهامش (الربح)",
    cardTreasury: "الخزينة (السيولة)",
    cardReceivables: "ذمم العملاء",
    deltaRevenue: "+8.2%",
    deltaTreasury: "+3.1%",
    deltaReceivables: "قيد التحصيل",
    flowTitle: "التدفق المالي",
    flowSub: (cur: string) => `الإيرادات مقابل المصروفات · ${cur}`,
    legendRevenue: "الإيرادات",
    legendExpense: "المصروفات",
    breakdownTitle: "توزيع المصروفات",
    breakdownSub: "حسب الفئة",
    velocityTitle: "سرعة التدفق النقدي",
    velocitySub: "التدفق الشهري الصافي (الإيرادات − المصروفات)",
    netSeries: "الصافي",
    activityTitle: "النشاط الأخير",
    viewLog: "عرض السجل",
    sevCritical: "حرج",
    sevWarning: "تنبيه",
    sevInfo: "معلومة",
    exportMonth: "الشهر",
    exportRevenue: "الإيرادات",
    exportExpense: "المصروفات",
    exportNet: "الصافي",
  },
} as const

/** Month-abbreviation lookup keyed by the French labels lib/analytics.ts emits
 *  (Moroccan/Maghrebi Arabic month names — يوليوز، غشت، شتنبر... — since this
 *  is a Morocco-based app, not the Mashriqi Arabic names). */
const MONTH_TR: Record<string, { en: string; ar: string }> = {
  "Jan": { en: "Jan", ar: "يناير" },
  "Fév": { en: "Feb", ar: "فبراير" },
  "Mar": { en: "Mar", ar: "مارس" },
  "Avr": { en: "Apr", ar: "أبريل" },
  "Mai": { en: "May", ar: "ماي" },
  "Jun": { en: "Jun", ar: "يونيو" },
  "Jul": { en: "Jul", ar: "يوليوز" },
  "Aoû": { en: "Aug", ar: "غشت" },
  "Sep": { en: "Sep", ar: "شتنبر" },
  "Oct": { en: "Oct", ar: "أكتوبر" },
  "Nov": { en: "Nov", ar: "نونبر" },
  "Déc": { en: "Dec", ar: "دجنبر" },
}

export default function Dashboard({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const { projects, expenses, contacts, audit, settings, updateSettings } = useMizan()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState<string | null>(null)
  const [widgets, setWidgets] = useState({ flow: true, velocity: true, breakdown: true })
  const [showCustomize, setShowCustomize] = useState(false)

  const lang: Lang = settings.language ?? "en"
  const t = dict[lang]
  const rtl = lang === "ar"

  const m = useMemo(() => metrics(projects, expenses, contacts), [projects, expenses, contacts])
  const rawSeries = useMemo(() => monthlySeries(projects, expenses, range), [projects, expenses, range])
  const byCat = useMemo(() => expenseByCategory(expenses), [expenses])
  const cur = settings.currency

  const labels = useMemo(() => rawSeries.labels.map((l) => MONTH_TR[l]?.[lang] ?? l), [rawSeries.labels, lang])
  const series = { ...rawSeries, labels }
  const net = series.labels.map((_, i) => series.revenue[i] - series.expense[i])

  async function doExport(kind: "csv" | "excel" | "pdf") {
    setBusy(kind)
    const rows = series.labels.map((l, i) => ({
      [t.exportMonth]: l, [t.exportRevenue]: series.revenue[i], [t.exportExpense]: series.expense[i], [t.exportNet]: net[i],
    }))
    await runAsync(() => {
      if (kind === "csv") toCSV(rows, "mizan-flux.csv")
      else if (kind === "excel") toExcel(rows, "mizan-flux.xls")
      else window.print()
    })
    setBusy(null)
  }

  const cards = [
    { label: t.cardRevenue, value: money(m.contractValue, cur), icon: TrendingUp, chip: "bg-brand-50 text-brand-700", delta: t.deltaRevenue, up: true },
    { label: t.cardMargin, value: money(m.margin, cur), icon: PiggyBank, chip: "bg-good-50 text-emerald-700", delta: `${m.marginPct.toFixed(1)}%`, up: true },
    { label: t.cardTreasury, value: money(m.treasury, cur), icon: Wallet, chip: "bg-brand-50 text-brand-700", delta: t.deltaTreasury, up: true },
    { label: t.cardReceivables, value: money(m.receivables, cur), icon: Landmark, chip: "bg-warn-50 text-warn", delta: t.deltaReceivables, up: false },
  ]

  const quick = [
    { icon: FolderPlus, label: t.quickProject, to: "projects" as ModuleKey, tint: "bg-brand text-white" },
    { icon: ReceiptText, label: t.quickExpense, to: "procurement" as ModuleKey, tint: "bg-emerald-brand text-white" },
    { icon: FileSignature, label: t.quickContract, to: "legal" as ModuleKey, tint: "bg-navy text-white" },
  ]

  return (
    <div className="mz-view space-y-6" dir={rtl ? "rtl" : "ltr"} lang={lang}>
      <SectionTitle
        title={t.title}
        sub={t.sub}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-line-strong bg-surface p-0.5">
              {(["en", "ar"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => updateSettings({ language: l })}
                  className={`rounded-md px-2.5 py-1.5 text-[12px] font-bold transition-colors ${lang === l ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                  aria-pressed={lang === l}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <select value={range} onChange={(e) => setRange(Number(e.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
              <option value={6}>{t.range[6]}</option>
              <option value={8}>{t.range[8]}</option>
              <option value={12}>{t.range[12]}</option>
            </select>
            <Btn variant="outline" size="sm" onClick={() => doExport("csv")} disabled={!!busy}>
              {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t.csv}
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!!busy}>
              {busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} {t.excel}
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {t.pdf}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowCustomize((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" /> {t.widgetsBtn}
            </Btn>
          </div>
        }
      />

      {showCustomize && (
        <Card className="flex flex-wrap items-center gap-6 px-5 py-3.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{t.show}</span>
          {([["flow", t.widgetFlow], ["velocity", t.widgetVelocity], ["breakdown", t.widgetBreakdown]] as const).map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 text-[13px] font-medium">
              <Toggle checked={widgets[k]} onChange={(v) => setWidgets((w) => ({ ...w, [k]: v }))} /> {lbl}
            </label>
          ))}
        </Card>
      )}

      {/* Quick action cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {quick.map((a) => (
          <button key={a.label} onClick={() => onNavigate(a.to)} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className={`grid h-10 w-10 place-items-center rounded-lg ${a.tint}`}><a.icon className="h-5 w-5" /></span>
            <span className="text-[13.5px] font-semibold">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-start justify-between">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.chip}`}><c.icon className="h-4.5 w-4.5" strokeWidth={2.2} /></span>
              <span className={`inline-flex items-center gap-0.5 text-[11.5px] font-semibold ${c.up ? "text-emerald-700" : "text-warn"}`}>
                {c.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />} {c.delta}
              </span>
            </div>
            <p className="mt-4 text-[12px] font-medium text-muted">{c.label}</p>
            <p className="tnum mt-1 text-[22px] font-bold leading-none tracking-tight">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {widgets.flow && (
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold">{t.flowTitle}</h2>
                <p className="text-[12px] text-muted">{t.flowSub(cur)}</p>
              </div>
              <Legend series={[{ name: t.legendRevenue, values: [] }, { name: t.legendExpense, color: "var(--chart-3)", values: [] }]} />
            </div>
            <AreaChart
              labels={series.labels}
              series={[
                { name: t.legendRevenue, values: series.revenue },
                { name: t.legendExpense, color: "var(--chart-3)", values: series.expense },
              ]}
              format={(n) => money(n, cur, true)}
            />
          </Card>
        )}
        {widgets.breakdown && (
          <Card className="p-5">
            <h2 className="text-[14px] font-bold">{t.breakdownTitle}</h2>
            <p className="mb-4 text-[12px] text-muted">{t.breakdownSub}</p>
            <Donut segments={byCat} />
          </Card>
        )}
      </div>

      {widgets.velocity && (
        <Card className="p-5">
          <div className="mb-3">
            <h2 className="text-[14px] font-bold">{t.velocityTitle}</h2>
            <p className="text-[12px] text-muted">{t.velocitySub}</p>
          </div>
          <BarChart labels={series.labels} series={[{ name: t.netSeries, values: net }]} format={(n) => money(n, cur, true)} />
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-bold">{t.activityTitle}</h2>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate("audit")}>{t.viewLog}</Btn>
        </header>
        <ul className="divide-y divide-line">
          {audit.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
              <Badge tone={a.severity === "critical" ? "serious" : a.severity === "warning" ? "warn" : "neutral"} dot>
                {a.severity === "critical" ? t.sevCritical : a.severity === "warning" ? t.sevWarning : t.sevInfo}
              </Badge>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{a.actor}</span> <span className="text-muted">{a.action}</span> {a.target}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
