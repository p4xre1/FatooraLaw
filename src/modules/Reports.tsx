import { useMemo, useState } from "react"
import { FileDown, Printer, Loader2, TrendingUp } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { money } from "../lib/mizan"
import { metrics, monthlySeries } from "../lib/analytics"
import { toCSV, runAsync } from "../lib/mizan"
import { Card, SectionTitle, Btn, Table, Th, Td } from "../components/kit"
import { BarChart, Legend } from "../components/charts"

export default function Reports() {
  const { projects, expenses, contacts, settings } = useMizan()
  const [busy, setBusy] = useState(false)
  const cur = settings.currency
  const m = useMemo(() => metrics(projects, expenses, contacts), [projects, expenses, contacts])
  const series = useMemo(() => monthlySeries(projects, expenses, 8), [projects, expenses])

  const vat = Math.round(m.margin * (settings.taxRate / 100))
  const forecast = Math.round(m.receivables * 0.85 - m.payables)

  const income = [
    { label: "Chiffre d'affaires (contrats)", value: m.contractValue, kind: "in" },
    { label: "Encaissements réalisés", value: m.collected, kind: "in" },
    { label: "Coûts directs (chantiers)", value: -m.cost, kind: "out" },
    { label: "Dépenses approuvées", value: -m.approvedExpenses, kind: "out" },
    { label: "Résultat d'exploitation", value: m.margin, kind: "net" },
    { label: `TVA estimée (${settings.taxRate}%)`, value: -vat, kind: "out" },
    { label: "Résultat net estimé", value: m.margin - vat, kind: "net" },
  ]

  async function exportReport() {
    setBusy(true)
    await runAsync(() => toCSV(income.map((r) => ({ Poste: r.label, Montant: r.value })), "fatorti-compte-resultat.csv"))
    setBusy(false)
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Rapports fiscaux & financiers" sub="Compte de résultat · prévision de trésorerie" action={
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={exportReport} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Exporter</Btn>
          <Btn variant="dark" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> PDF</Btn>
        </div>
      } />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[12px] text-muted">Résultat net estimé</p><p className="tnum mt-1 text-[20px] font-bold text-emerald-700">{money(m.margin - vat, cur)}</p></Card>
        <Card className="p-4"><p className="text-[12px] text-muted">TVA à reverser ({settings.taxRate}%)</p><p className="tnum mt-1 text-[20px] font-bold text-warn">{money(vat, cur)}</p></Card>
        <Card className="p-4"><p className="text-[12px] text-muted">Prévision trésorerie (30j)</p><p className={`tnum mt-1 text-[20px] font-bold ${forecast >= 0 ? "text-ink" : "text-serious"}`}>{money(forecast, cur)}</p></Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="text-[14px] font-bold">Comparatif mensuel</h2><p className="text-[12px] text-muted">Revenus vs dépenses · {cur}</p></div>
          <Legend series={[{ name: "Revenus", values: [] }, { name: "Dépenses", color: "var(--chart-3)", values: [] }]} />
        </div>
        <BarChart labels={series.labels} series={[{ name: "Revenus", values: series.revenue }, { name: "Dépenses", color: "var(--chart-3)", values: series.expense }]} format={(n) => money(n, cur, true)} />
      </Card>

      <Card>
        <header className="flex items-center gap-2 border-b border-line px-5 py-3.5"><TrendingUp className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold">Compte de résultat simplifié</h2></header>
        <Table head={<><Th>Poste</Th><Th className="text-end">Montant</Th></>}>
          {income.map((r) => (
            <tr key={r.label} className={r.kind === "net" ? "bg-canvas/60" : ""}>
              <Td className={r.kind === "net" ? "font-bold text-ink" : "text-muted"}>{r.label}</Td>
              <Td className={`tnum text-end font-semibold ${r.kind === "net" ? "text-ink" : r.value < 0 ? "text-serious" : "text-emerald-700"}`}>{money(r.value, cur)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
