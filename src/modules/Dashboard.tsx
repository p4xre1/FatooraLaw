import { useEffect, useMemo, useState } from "react"
import { Wallet, Landmark, FolderOpen, FileSpreadsheet, FileText, FileDown, FolderPlus, ReceiptText, FileSignature, Loader2, SlidersHorizontal, Languages, Info } from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { toCSV, toExcel, runAsync } from "../lib/mizan"
import { MONTHS, MONTHS_AR } from "../lib/analytics"
import { dashboardData, dashboardMoney } from "../lib/dashboardData"
import { useToday } from "../hooks/useToday"
import { Card, SectionTitle, Btn, Badge, Toggle } from "../components/kit"
import { AreaChart, BarChart, Donut, Legend } from "../components/charts"

type Lang = "fr" | "ar"
const categoryAr: Record<string, string> = { "Matériaux": "مواد البناء", "Quincaillerie": "أدوات ومعدات", "Location": "إيجار", "Carburant": "وقود", "Sans catégorie": "بدون فئة" }
const dict = {
  fr: {
    dir: "ltr", title: "Tableau de bord", subtitle: "Données locales enregistrées · aucun chiffre simulé",
    range: (n: number) => `${n} derniers mois`, period: "Période des dépenses", widgets: "Widgets", show: "Afficher",
    flow: "Dépenses mensuelles", projects: "Budgets et encaissements", breakdown: "Répartition",
    quickProject: "Créer un projet", quickExpense: "Créer une dépense", quickContract: "Générer un contrat",
    cardBudget: "Budgets des projets", cardCollected: "Encaissements saisis", cardExpenses: "Dépenses approuvées", cardReceivables: "Soldes clients à recouvrer",
    allDates: "Toutes périodes", projectCount: (n: number) => `${n} projet${n === 1 ? "" : "s"}`, expenseCount: (n: number) => `${n} dépense${n === 1 ? "" : "s"}`, clientCount: (n: number) => `${n} client${n === 1 ? "" : "s"}`,
    chartExpenses: "Dépenses mensuelles approuvées", chartExpensesSub: "Selon la date enregistrée · montants exacts · hors dépenses en attente",
    seriesExpense: "Dépenses approuvées", seriesBudget: "Budget saisi", seriesCollected: "Encaissements saisis",
    chartBreakdown: "Répartition des dépenses", chartBreakdownSub: "Dépenses approuvées de la période, par catégorie",
    chartProjects: "Budgets et encaissements par projet", chartProjectsSub: "Montants cumulés saisis · jusqu'à 8 projets · toutes périodes",
    emptyTitle: "Aucune donnée financière enregistrée", emptyDescription: "Ajoutez vos projets, vos dépenses ou vos clients. Les totaux et graphiques utiliseront uniquement ces données, sans exemples préchargés.",
    emptyPeriod: "Aucune dépense approuvée datée dans cette période.", emptyCategory: "Aucun montant positif à répartir dans cette période.", emptyProjects: "Saisissez le budget ou les encaissements d'un projet pour afficher ce graphique.",
    cashNote: "Les encaissements sont les montants cumulés saisis dans les projets, pas un solde bancaire. Sans historique daté des paiements, aucun revenu mensuel ni flux de trésorerie n'est estimé.",
    samples: (n: number) => `${n} exemple${n === 1 ? "" : "s"} préchargé${n === 1 ? "" : "s"} exclu${n === 1 ? "" : "s"} de cette vue. Les données enregistrées restent conservées dans vos modules et sauvegardes.`,
    invalid: (n: number) => `${n} entrée${n === 1 ? "" : "s"} invalide${n === 1 ? "" : "s"} non représentée${n === 1 ? "" : "s"}. Vérifiez les montants et dates dans vos dossiers.`,
    recent: "Activité récente", viewLog: "Voir le journal", emptyActivity: "Aucune activité enregistrée.", critical: "Critique", warning: "Attention", info: "Info",
    exportMonth: "Mois", exportExpense: "Dépenses approuvées", exportCount: "Nombre d'entrées", exportError: "Échec de l'export. Veuillez réessayer.",
  },
  ar: {
    dir: "rtl", title: "لوحة التحكم", subtitle: "بيانات محلية مسجلة · بدون أرقام تجريبية",
    range: (n: number) => `آخر ${n} أشهر`, period: "فترة المصاريف", widgets: "الأدوات", show: "إظهار",
    flow: "المصاريف الشهرية", projects: "الميزانيات والتحصيلات", breakdown: "التوزيع",
    quickProject: "إنشاء مشروع", quickExpense: "تسجيل مصروف", quickContract: "إنشاء عقد",
    cardBudget: "ميزانيات المشاريع", cardCollected: "التحصيلات المسجلة", cardExpenses: "المصاريف المعتمدة", cardReceivables: "أرصدة العملاء المستحقة",
    allDates: "جميع الفترات", projectCount: (n: number) => `${n} مشاريع`, expenseCount: (n: number) => `${n} مصاريف`, clientCount: (n: number) => `${n} عملاء`,
    chartExpenses: "المصاريف الشهرية المعتمدة", chartExpensesSub: "حسب التاريخ المسجل · مبالغ فعلية · بدون المصاريف المعلقة",
    seriesExpense: "المصاريف المعتمدة", seriesBudget: "الميزانية المسجلة", seriesCollected: "التحصيلات المسجلة",
    chartBreakdown: "توزيع المصاريف", chartBreakdownSub: "مصاريف الفترة المعتمدة حسب الفئة",
    chartProjects: "الميزانيات والتحصيلات حسب المشروع", chartProjectsSub: "مبالغ تراكمية مسجلة · حتى 8 مشاريع · جميع الفترات",
    emptyTitle: "لا توجد بيانات مالية مسجلة", emptyDescription: "أضف مشاريعك أو مصاريفك أو عملاءك. تستخدم المؤشرات والرسوم هذه البيانات فقط، بدون أمثلة مسبقة.",
    emptyPeriod: "لا توجد مصاريف معتمدة مؤرخة في هذه الفترة.", emptyCategory: "لا توجد مبالغ موجبة لتوزيعها في هذه الفترة.", emptyProjects: "سجل ميزانية أو تحصيلات مشروع لإظهار هذا الرسم.",
    cashNote: "التحصيلات مبالغ تراكمية مسجلة في المشاريع وليست رصيداً بنكياً. بدون سجل دفعات مؤرخ لا يتم تقدير إيرادات شهرية أو تدفقات خزينة.",
    samples: (n: number) => `تم استبعاد ${n} أمثلة مسبقة من هذه الواجهة فقط. تبقى البيانات محفوظة في الأقسام والنسخ الاحتياطية.`,
    invalid: (n: number) => `لم يتم عرض ${n} إدخالات غير صالحة. تحقق من المبالغ والتواريخ في سجلاتك.`,
    recent: "النشاط الأخير", viewLog: "عرض السجل", emptyActivity: "لا يوجد نشاط مسجل.", critical: "حرج", warning: "تنبيه", info: "معلومة",
    exportMonth: "الشهر", exportExpense: "المصاريف المعتمدة", exportCount: "عدد الإدخالات", exportError: "تعذر التصدير. يرجى المحاولة مرة أخرى.",
  },
}

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
  const [lang, setLang] = useState<Lang>(() => {
    try { return localStorage.getItem("mizan.dashboard.lang") === "ar" ? "ar" : "fr" } catch { return "fr" }
  })
  useEffect(() => { try { localStorage.setItem("mizan.dashboard.lang", lang) } catch { /* Optional preference. */ } }, [lang])
  const t = dict[lang]
  const m = useMemo(() => dashboardData({ projects, expenses, contacts, audit }, range, today, lang === "ar" ? MONTHS_AR : MONTHS), [projects, expenses, contacts, audit, range, today, lang])
  const cur = settings.currency
  const byCategory = m.byCategory.map((item) => ({ ...item, label: lang === "ar" ? categoryAr[item.label] ?? item.label : item.label }))

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
    <div className="mz-view space-y-6" dir={t.dir} lang={lang}>
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <SectionTitle title={t.title} sub={t.subtitle} action={<div className="flex flex-wrap items-center gap-2">
        <Btn variant="outline" size="sm" onClick={() => setLang((value) => value === "fr" ? "ar" : "fr")} title={lang === "fr" ? "التبديل إلى العربية" : "Passer au français"}><Languages className="h-4 w-4" />{lang === "fr" ? "العربية" : "Français"}</Btn>
        <select aria-label={t.period} value={range} onChange={(e) => setRange(Number(e.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
          {[6, 8, 12].map((n) => <option key={n} value={n}>{t.range(n)}</option>)}
        </select>
        <Btn variant="outline" size="sm" onClick={() => doExport("csv")} disabled={!!busy || !m.monthly.periodCount}>{busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} CSV</Btn>
        <Btn variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!!busy || !m.monthly.periodCount}>{busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel</Btn>
        <Btn variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!!busy || !m.hasRecords}>{busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF</Btn>
        <Btn variant="ghost" size="sm" onClick={() => setShowCustomize((value) => !value)}><SlidersHorizontal className="h-4 w-4" />{t.widgets}</Btn>
      </div>} />

      {showCustomize && <Card className="flex flex-wrap items-center gap-6 px-5 py-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{t.show}</span>
        {([["flow", t.flow], ["projects", t.projects], ["breakdown", t.breakdown]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-[13px] font-medium"><Toggle checked={widgets[key]} onChange={(value) => setWidgets((all) => ({ ...all, [key]: value }))} />{label}</label>)}
      </Card>}

      <div className="grid gap-3 sm:grid-cols-3">{quick.map((action) => <button key={action.label} onClick={() => onNavigate(action.to)} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><span className={`grid h-10 w-10 place-items-center rounded-lg ${action.tint}`}><action.icon className="h-5 w-5" /></span><span className="text-[13.5px] font-semibold">{action.label}</span></button>)}</div>

      {!m.hasRecords && <Card className="border-dashed p-6 text-center"><h2 className="text-lg font-bold">{t.emptyTitle}</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-muted">{t.emptyDescription}</p></Card>}
      {m.hiddenDemoCount > 0 && <p className="text-[12px] text-muted">{t.samples(m.hiddenDemoCount)}</p>}
      {(m.invalidCount + m.invalidDateCount) > 0 && <p role="alert" className="text-[12px] text-warn">{t.invalid(m.invalidCount + m.invalidDateCount)}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Card key={card.label} className="p-5">
        <div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-lg ${card.chip}`}><card.icon className="h-4.5 w-4.5" strokeWidth={2.2} /></span><span className="text-[11.5px] text-muted">{card.detail}</span></div>
        <p className="mt-4 text-[12px] font-medium text-muted">{card.label}</p><p className="tnum mt-1 text-[22px] font-bold leading-none tracking-tight">{dashboardMoney(card.value, cur)}</p><p className="mt-2 text-[11px] text-faint">{t.allDates}</p>
      </Card>)}</div>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />{t.cashNote}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        {widgets.flow && <Card className="p-5 lg:col-span-2"><div className="mb-3"><h2 className="text-[14px] font-bold">{t.chartExpenses}</h2><p className="text-[12px] text-muted">{t.chartExpensesSub} · {cur}</p></div>
          {m.monthly.periodCount ? <AreaChart labels={m.monthly.labels} series={[{ name: t.seriesExpense, values: m.monthly.values }]} format={(n) => dashboardMoney(n, cur, true)} /> : <EmptyChart>{t.emptyPeriod}</EmptyChart>}
        </Card>}
        {widgets.breakdown && <Card className="p-5"><h2 className="text-[14px] font-bold">{t.chartBreakdown}</h2><p className="mb-4 text-[12px] text-muted">{t.chartBreakdownSub}</p>{byCategory.length ? <Donut segments={byCategory} /> : <EmptyChart>{t.emptyCategory}</EmptyChart>}</Card>}
      </div>

      {widgets.projects && <Card className="p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[14px] font-bold">{t.chartProjects}</h2><p className="text-[12px] text-muted">{t.chartProjectsSub}</p></div><Legend series={[{ name: t.seriesBudget, values: [] }, { name: t.seriesCollected, color: "var(--chart-2)", values: [] }]} /></div>
        {m.projectChart.some((p) => p.budget > 0 || p.paid > 0) ? <BarChart labels={m.projectChart.map((p) => p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name)} series={[{ name: t.seriesBudget, values: m.projectChart.map((p) => p.budget) }, { name: t.seriesCollected, color: "var(--chart-2)", values: m.projectChart.map((p) => p.paid) }]} format={(n) => dashboardMoney(n, cur, true)} /> : <EmptyChart>{t.emptyProjects}</EmptyChart>}
      </Card>}

      <Card><header className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[14px] font-bold">{t.recent}</h2><Btn variant="ghost" size="sm" onClick={() => onNavigate("audit")}>{t.viewLog}</Btn></header>
        {m.recent.length ? <ul className="divide-y divide-line">{m.recent.map((event) => <li key={event.id} className="flex items-center gap-3 px-5 py-3 text-[13px]"><Badge tone={event.severity === "critical" ? "serious" : event.severity === "warning" ? "warn" : "neutral"} dot>{event.severity === "critical" ? t.critical : event.severity === "warning" ? t.warning : t.info}</Badge><span className="min-w-0 flex-1 truncate"><span className="font-semibold">{event.actor}</span> <span className="text-muted">{event.action}</span> {event.target}</span></li>)}</ul> : <p className="px-5 py-6 text-[13px] text-muted">{t.emptyActivity}</p>}
      </Card>
    </div>
  )
}
