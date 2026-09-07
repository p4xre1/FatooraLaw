import { useMemo, useState } from "react"
import {
  TrendingUp, Wallet, PiggyBank, Landmark, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, FileText, FileDown, FolderPlus, ReceiptText, FileSignature, Loader2, SlidersHorizontal,
} from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money } from "../lib/mizan"
import { metrics, monthlySeries, expenseByCategory } from "../lib/analytics"
import { toCSV, toExcel, runAsync } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Toggle } from "../components/kit"
import { AreaChart, BarChart, Donut, Legend } from "../components/charts"

export default function Dashboard({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const { projects, expenses, contacts, audit, settings } = useMizan()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState<string | null>(null)
  const [widgets, setWidgets] = useState({ flow: true, velocity: true, breakdown: true })
  const [showCustomize, setShowCustomize] = useState(false)

  const m = useMemo(() => metrics(projects, expenses, contacts), [projects, expenses, contacts])
  const series = useMemo(() => monthlySeries(projects, expenses, range), [projects, expenses, range])
  const byCat = useMemo(() => expenseByCategory(expenses), [expenses])
  const cur = settings.currency

  const net = series.labels.map((_, i) => series.revenue[i] - series.expense[i])

  async function doExport(kind: "csv" | "excel" | "pdf") {
    setBusy(kind)
    const rows = series.labels.map((l, i) => ({
      Mois: l, Revenu: series.revenue[i], Dépenses: series.expense[i], Net: net[i],
    }))
    await runAsync(() => {
      if (kind === "csv") toCSV(rows, "mizan-flux.csv")
      else if (kind === "excel") toExcel(rows, "mizan-flux.xls")
      else window.print()
    })
    setBusy(null)
  }

  const cards = [
    { label: "Chiffre d'affaires", value: money(m.contractValue, cur), icon: TrendingUp, chip: "bg-brand-50 text-brand-700", delta: "+8,2 %", up: true },
    { label: "Marge (bénéfice)", value: money(m.margin, cur), icon: PiggyBank, chip: "bg-good-50 text-emerald-700", delta: `${m.marginPct.toFixed(1)} %`, up: true },
    { label: "Trésorerie (liquidité)", value: money(m.treasury, cur), icon: Wallet, chip: "bg-brand-50 text-brand-700", delta: "+3,1 %", up: true },
    { label: "Créances clients", value: money(m.receivables, cur), icon: Landmark, chip: "bg-warn-50 text-warn", delta: "à recouvrer", up: false },
  ]

  const quick = [
    { icon: FolderPlus, label: "Générer un projet", to: "projects" as ModuleKey, tint: "bg-brand text-white" },
    { icon: ReceiptText, label: "Créer une dépense", to: "procurement" as ModuleKey, tint: "bg-emerald-brand text-white" },
    { icon: FileSignature, label: "Générer un contrat", to: "legal" as ModuleKey, tint: "bg-navy text-white" },
  ]

  return (
    <div className="mz-view space-y-6">
      <SectionTitle
        title="Tableau de bord"
        sub="Vue exécutive · métriques temps réel"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={range} onChange={(e) => setRange(Number(e.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
              <option value={6}>6 derniers mois</option>
              <option value={8}>8 derniers mois</option>
              <option value={12}>12 derniers mois</option>
            </select>
            <Btn variant="outline" size="sm" onClick={() => doExport("csv")} disabled={!!busy}>
              {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} CSV
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!!busy}>
              {busy === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowCustomize((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" /> Widgets
            </Btn>
          </div>
        }
      />

      {showCustomize && (
        <Card className="flex flex-wrap items-center gap-6 px-5 py-3.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Afficher</span>
          {([["flow", "Flux financier"], ["velocity", "Cash-velocity"], ["breakdown", "Répartition"]] as const).map(([k, lbl]) => (
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
                <h2 className="text-[14px] font-bold">Flux financier</h2>
                <p className="text-[12px] text-muted">Revenus vs dépenses · {cur}</p>
              </div>
              <Legend series={[{ name: "Revenus", values: [] }, { name: "Dépenses", color: "var(--chart-3)", values: [] }]} />
            </div>
            <AreaChart
              labels={series.labels}
              series={[
                { name: "Revenus", values: series.revenue },
                { name: "Dépenses", color: "var(--chart-3)", values: series.expense },
              ]}
              format={(n) => money(n, cur, true)}
            />
          </Card>
        )}
        {widgets.breakdown && (
          <Card className="p-5">
            <h2 className="text-[14px] font-bold">Répartition des dépenses</h2>
            <p className="mb-4 text-[12px] text-muted">Par catégorie</p>
            <Donut segments={byCat} />
          </Card>
        )}
      </div>

      {widgets.velocity && (
        <Card className="p-5">
          <div className="mb-3">
            <h2 className="text-[14px] font-bold">Vélocité de trésorerie</h2>
            <p className="text-[12px] text-muted">Flux net mensuel (revenus − dépenses)</p>
          </div>
          <BarChart labels={series.labels} series={[{ name: "Net", values: net }]} format={(n) => money(n, cur, true)} />
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-bold">Activité récente</h2>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate("audit")}>Voir le journal</Btn>
        </header>
        <ul className="divide-y divide-line">
          {audit.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
              <Badge tone={a.severity === "critical" ? "serious" : a.severity === "warning" ? "warn" : "neutral"} dot>
                {a.severity === "critical" ? "Critique" : a.severity === "warning" ? "Attention" : "Info"}
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
