import { useEffect, useMemo, useState } from "react"
import {
  TrendingUp, Wallet, PiggyBank, Landmark, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, FileText, FileDown, FolderPlus, ReceiptText, FileSignature, Loader2, SlidersHorizontal, Languages,
} from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money } from "../lib/mizan"
import { metrics, monthlySeries, expenseByCategory, MONTHS_AR } from "../lib/analytics"
import { toCSV, toExcel, runAsync } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Toggle } from "../components/kit"
import { AreaChart, BarChart, Donut, Legend } from "../components/charts"

type Lang = "fr" | "ar"

/** Dashboard UI strings. Only interface chrome is translated — seeded/user
 * data (project names, audit actors/notes, contact names…) stays as entered. */
const dict: Record<
  Lang,
  {
    dir: "ltr" | "rtl"
    title: string
    subtitle: string
    range: (n: number) => string
    csv: string
    excel: string
    pdf: string
    widgets: string
    show: string
    flow: string
    velocity: string
    breakdown: string
    quickProject: string
    quickExpense: string
    quickContract: string
    cardRevenue: string
    cardMargin: string
    cardTreasury: string
    cardReceivables: string
    receivablePending: string
    chartFlowTitle: string
    chartFlowSub: (cur: string) => string
    seriesRevenue: string
    seriesExpense: string
    chartBreakdownTitle: string
    chartBreakdownSub: string
    chartVelocityTitle: string
    chartVelocitySub: string
    seriesNet: string
    recentActivity: string
    viewLog: string
    sevCritical: string
    sevWarning: string
    sevInfo: string
    exportMonth: string
    exportRevenue: string
    exportExpense: string
    exportNet: string
    category: (raw: string) => string
  }
> = {
  fr: {
    dir: "ltr",
    title: "Tableau de bord",
    subtitle: "Vue exécutive · métriques temps réel",
    range: (n) => `${n} derniers mois`,
    csv: "CSV",
    excel: "Excel",
    pdf: "PDF",
    widgets: "Widgets",
    show: "Afficher",
    flow: "Flux financier",
    velocity: "Cash-velocity",
    breakdown: "Répartition",
    quickProject: "Générer un projet",
    quickExpense: "Créer une dépense",
    quickContract: "Générer un contrat",
    cardRevenue: "Chiffre d'affaires",
    cardMargin: "Marge (bénéfice)",
    cardTreasury: "Trésorerie (liquidité)",
    cardReceivables: "Créances clients",
    receivablePending: "à recouvrer",
    chartFlowTitle: "Flux financier",
    chartFlowSub: (cur) => `Revenus vs dépenses · ${cur}`,
    seriesRevenue: "Revenus",
    seriesExpense: "Dépenses",
    chartBreakdownTitle: "Répartition des dépenses",
    chartBreakdownSub: "Par catégorie",
    chartVelocityTitle: "Vélocité de trésorerie",
    chartVelocitySub: "Flux net mensuel (revenus − dépenses)",
    seriesNet: "Net",
    recentActivity: "Activité récente",
    viewLog: "Voir le journal",
    sevCritical: "Critique",
    sevWarning: "Attention",
    sevInfo: "Info",
    exportMonth: "Mois",
    exportRevenue: "Revenu",
    exportExpense: "Dépenses",
    exportNet: "Net",
    category: (raw) => raw,
  },
  ar: {
    dir: "rtl",
    title: "لوحة التحكم",
    subtitle: "نظرة تنفيذية · مؤشرات لحظية",
    range: (n) => `آخر ${n} أشهر`,
    csv: "CSV",
    excel: "Excel",
    pdf: "PDF",
    widgets: "الأدوات",
    show: "إظهار",
    flow: "التدفق المالي",
    velocity: "سرعة السيولة",
    breakdown: "التوزيع",
    quickProject: "إنشاء مشروع",
    quickExpense: "تسجيل مصروف",
    quickContract: "إنشاء عقد",
    cardRevenue: "رقم المعاملات",
    cardMargin: "الهامش (الربح)",
    cardTreasury: "الخزينة (السيولة)",
    cardReceivables: "ذمم العملاء",
    receivablePending: "قيد التحصيل",
    chartFlowTitle: "التدفق المالي",
    chartFlowSub: (cur) => `الإيرادات مقابل المصاريف · ${cur}`,
    seriesRevenue: "الإيرادات",
    seriesExpense: "المصاريف",
    chartBreakdownTitle: "توزيع المصاريف",
    chartBreakdownSub: "حسب الفئة",
    chartVelocityTitle: "سرعة السيولة",
    chartVelocitySub: "التدفق الصافي الشهري (الإيرادات − المصاريف)",
    seriesNet: "الصافي",
    recentActivity: "النشاط الأخير",
    viewLog: "عرض السجل",
    sevCritical: "حرج",
    sevWarning: "تنبيه",
    sevInfo: "معلومة",
    exportMonth: "الشهر",
    exportRevenue: "الإيرادات",
    exportExpense: "المصاريف",
    exportNet: "الصافي",
    category: (raw) => categoryAr[raw] ?? raw,
  },
}

/** Seed data uses a fixed, known set of expense categories — translate the ones we know. */
const categoryAr: Record<string, string> = {
  "Matériaux": "مواد البناء",
  "Quincaillerie": "أدوات ومعدات",
  "Location": "إيجار",
  "Carburant": "وقود",
}

export default function Dashboard({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const { projects, expenses, contacts, audit, settings } = useMizan()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState<string | null>(null)
  const [widgets, setWidgets] = useState({ flow: true, velocity: true, breakdown: true })
  const [showCustomize, setShowCustomize] = useState(false)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("mizan.dashboard.lang") as Lang) || "fr")

  useEffect(() => {
    localStorage.setItem("mizan.dashboard.lang", lang)
  }, [lang])

  const t = dict[lang]
  const rtl = t.dir === "rtl"

  const m = useMemo(() => metrics(projects, expenses, contacts), [projects, expenses, contacts])
  const series = useMemo(
    () => monthlySeries(projects, expenses, range, lang === "ar" ? MONTHS_AR : undefined),
    [projects, expenses, range, lang],
  )
  const byCat = useMemo(
    () => expenseByCategory(expenses).map((s) => ({ ...s, label: t.category(s.label) })),
    [expenses, lang],
  )
  const cur = settings.currency

  const net = series.labels.map((_, i) => series.revenue[i] - series.expense[i])

  async function doExport(kind: "csv" | "excel" | "pdf") {
    setBusy(kind)
    const rows = series.labels.map((l, i) => ({
      [t.exportMonth]: l, [t.exportRevenue]: series.revenue[i], [t.exportExpense]: series.expense[i], [t.exportNet]: net[i],
    }))
    await runAsync(() => {
      if (kind === "csv") toCSV(rows, "fatorati-flux.csv")
      else if (kind === "excel") toExcel(rows, "fatorati-flux.xls")
      else window.print()
    })
    setBusy(null)
  }

  const cards = [
    { label: t.cardRevenue, value: money(m.contractValue, cur), icon: TrendingUp, chip: "bg-brand-50 text-brand-700", delta: "+8,2 %", up: true },
    { label: t.cardMargin, value: money(m.margin, cur), icon: PiggyBank, chip: "bg-good-50 text-emerald-700", delta: `${m.marginPct.toFixed(1)} %`, up: true },
    { label: t.cardTreasury, value: money(m.treasury, cur), icon: Wallet, chip: "bg-brand-50 text-brand-700", delta: "+3,1 %", up: true },
    { label: t.cardReceivables, value: money(m.receivables, cur), icon: Landmark, chip: "bg-warn-50 text-warn", delta: t.receivablePending, up: false },
  ]

  const quick = [
    { icon: FolderPlus, label: t.quickProject, to: "projects" as ModuleKey, tint: "bg-brand text-white" },
    { icon: ReceiptText, label: t.quickExpense, to: "procurement" as ModuleKey, tint: "bg-emerald-brand text-white" },
    { icon: FileSignature, label: t.quickContract, to: "legal" as ModuleKey, tint: "bg-navy text-white" },
  ]

  return (
    <div className="mz-view space-y-6" dir={t.dir} lang={lang}>
      <SectionTitle
        title={t.title}
        sub={t.subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="outline"
              size="sm"
              onClick={() => setLang((l) => (l === "fr" ? "ar" : "fr"))}
              title={lang === "fr" ? "التبديل إلى العربية" : "Passer au français"}
            >
              <Languages className="h-4 w-4" /> {lang === "fr" ? "العربية" : "Français"}
            </Btn>
            <select value={range} onChange={(e) => setRange(Number(e.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
              <option value={6}>{t.range(6)}</option>
              <option value={8}>{t.range(8)}</option>
              <option value={12}>{t.range(12)}</option>
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
              <SlidersHorizontal className="h-4 w-4" /> {t.widgets}
            </Btn>
          </div>
        }
      />

      {showCustomize && (
        <Card className="flex flex-wrap items-center gap-6 px-5 py-3.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{t.show}</span>
          {([["flow", t.flow], ["velocity", t.velocity], ["breakdown", t.breakdown]] as const).map(([k, lbl]) => (
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
                {c.up ? <ArrowUpRight className={`h-3.5 w-3.5 ${rtl ? "rotate-180" : ""}`} /> : <ArrowDownRight className={`h-3.5 w-3.5 ${rtl ? "rotate-180" : ""}`} />} {c.delta}
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
                <h2 className="text-[14px] font-bold">{t.chartFlowTitle}</h2>
                <p className="text-[12px] text-muted">{t.chartFlowSub(cur)}</p>
              </div>
              <Legend series={[{ name: t.seriesRevenue, values: [] }, { name: t.seriesExpense, color: "var(--chart-3)", values: [] }]} />
            </div>
            <AreaChart
              labels={series.labels}
              series={[
                { name: t.seriesRevenue, values: series.revenue },
                { name: t.seriesExpense, color: "var(--chart-3)", values: series.expense },
              ]}
              format={(n) => money(n, cur, true)}
            />
          </Card>
        )}
        {widgets.breakdown && (
          <Card className="p-5">
            <h2 className="text-[14px] font-bold">{t.chartBreakdownTitle}</h2>
            <p className="mb-4 text-[12px] text-muted">{t.chartBreakdownSub}</p>
            <Donut segments={byCat} />
          </Card>
        )}
      </div>

      {widgets.velocity && (
        <Card className="p-5">
          <div className="mb-3">
            <h2 className="text-[14px] font-bold">{t.chartVelocityTitle}</h2>
            <p className="text-[12px] text-muted">{t.chartVelocitySub}</p>
          </div>
          <BarChart labels={series.labels} series={[{ name: t.seriesNet, values: net }]} format={(n) => money(n, cur, true)} />
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-bold">{t.recentActivity}</h2>
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
