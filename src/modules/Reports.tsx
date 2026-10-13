import { useMemo, useState } from "react"
import { FileDown, Printer, Loader2, FileSpreadsheet, Info } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { dashboardData, dashboardMoney } from "../lib/dashboardData"
import { useToday } from "../hooks/useToday"
import { toCSV, runAsync } from "../lib/mizan"
import { Card, SectionTitle, Btn, Table, Th, Td } from "../components/kit"
import { BarChart } from "../components/charts"

export default function Reports() {
  const { projects, expenses, contacts, audit, settings } = useMizan()
  const today = useToday()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const m = useMemo(() => dashboardData({ projects, expenses, contacts, audit }, range, today), [projects, expenses, contacts, audit, range, today])
  const cur = settings.currency
  const summaries = [
    { label: "Budgets des projets", value: m.budget, source: "Budgets saisis, pas un chiffre d'affaires facturé" },
    { label: "Encaissements saisis", value: m.collected, source: "Cumuls saisis dans les projets, sans historique des dates de paiement" },
    { label: "Dépenses approuvées", value: m.approvedExpenses, source: "Montants enregistrés et approuvés, pas une preuve de paiement bancaire" },
    { label: "Soldes clients à recouvrer", value: m.receivables, source: "Soldes positifs enregistrés dans les fiches clients" },
  ]

  async function exportExpenses() {
    if (busy || !m.monthly.periodCount) return
    setBusy(true); setExportError(null)
    const rows = m.monthly.labels.map((month, i) => ({ Mois: month, "Dépenses approuvées": m.monthly.values[i], "Nombre d'entrées": m.monthly.entries[i] }))
    try { await runAsync(() => toCSV(rows, "fatorati-rapport-depenses-approuvees.csv")) }
    catch { setExportError("Échec de l'export. Veuillez réessayer.") }
    finally { setBusy(false) }
  }

  return (
    <div className="mz-view space-y-5">
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <SectionTitle title="Rapports fiscaux & financiers" sub="Récapitulatif des données locales enregistrées · sans calculs simulés" action={<div className="flex flex-wrap gap-2">
        <select aria-label="Période des dépenses" value={range} onChange={(event) => setRange(Number(event.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink">{[6, 8, 12].map((n) => <option key={n} value={n}>{n} derniers mois</option>)}</select>
        <Btn variant="outline" size="sm" onClick={exportExpenses} disabled={busy || !m.monthly.periodCount}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Exporter les dépenses</Btn>
        <Btn variant="dark" size="sm" onClick={() => window.print()} disabled={!m.hasRecords}><Printer className="h-4 w-4" />PDF</Btn>
      </div>} />
      {!m.hasRecords && <Card className="border-dashed p-6 text-center"><h2 className="font-bold">Aucune donnée financière enregistrée</h2><p className="mt-2 text-sm text-muted">Ajoutez vos propres projets, clients et dépenses. Aucun revenu, impôt ou solde bancaire n'est inventé pour remplir ce rapport.</p></Card>}
      {m.hiddenDemoCount > 0 && <p className="text-[12px] text-muted">{m.hiddenDemoCount} exemple(s) préchargé(s) exclu(s) de cette vue. Les données enregistrées sont conservées dans les modules et sauvegardes.</p>}
      {(m.invalidCount + m.invalidDateCount) > 0 && <p role="alert" className="text-[12px] text-warn">{m.invalidCount + m.invalidDateCount} entrée(s) invalide(s) non représentée(s). Vérifiez les montants et dates enregistrés.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaries.map((item) => <Card key={item.label} className="p-4"><p className="text-[12px] text-muted">{item.label}</p><p className="tnum mt-1 text-[20px] font-bold">{dashboardMoney(item.value, cur)}</p><p className="mt-1 text-[11px] text-faint">Toutes périodes</p></Card>)}</div>

      <Card className="border-warn/30 bg-warn-50 p-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" /><div><h2 className="text-[14px] font-bold">TVA non calculée</h2><p className="mt-2 text-[13px] leading-relaxed text-muted">Le taux configuré ne suffit pas à calculer une déclaration. Les factures de vente et d'achat, bases HT/TTC, opérations exonérées et montants de TVA collectée/déductible ne sont pas enregistrés dans un grand livre fiscal ici.</p><p className="mt-2 text-[13px] leading-relaxed text-muted">Aucun résultat net, revenu mensuel, solde bancaire ou prévision à 30 jours n'est estimé. Ce récapitulatif ne constitue pas un compte de résultat ni une déclaration fiscale.</p></div></div></Card>

      <Card className="p-5"><div className="mb-3"><h2 className="text-[14px] font-bold">Dépenses mensuelles approuvées</h2><p className="text-[12px] text-muted">Dates et montants enregistrés · hors dépenses en attente et dates futures · {cur}</p></div>
        {m.monthly.periodCount ? <BarChart labels={m.monthly.labels} series={[{ name: "Dépenses approuvées", values: m.monthly.values }]} format={(n) => dashboardMoney(n, cur, true)} /> : <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">Aucune dépense approuvée datée dans cette période.</div>}
      </Card>
      <Card><header className="flex items-center gap-2 border-b border-line px-5 py-3.5"><FileSpreadsheet className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold">Totaux enregistrés (toutes périodes)</h2></header><Table head={<><Th>Poste</Th><Th>Source du montant</Th><Th className="text-end">Montant</Th></>}>
        {summaries.map((item) => <tr key={item.label}><Td className="font-medium text-ink">{item.label}</Td><Td className="text-muted">{item.source}</Td><Td className="tnum text-end font-semibold">{dashboardMoney(item.value, cur)}</Td></tr>)}
      </Table></Card>
    </div>
  )
}
