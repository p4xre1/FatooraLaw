import { useMemo, useState } from "react"
import { Wrench, Plus, Trash2, AlertCircle } from "lucide-react"
import type { SubscriptionTool } from "../store/types"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"
import { daysUntil, validDateRange } from "../lib/calendarDates"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { monthlySubscriptionCosts, subscriptionStatus } from "../lib/subscriptions"
import { fmtDate, num } from "../lib/mizan"
import { AreaChart } from "../components/charts"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Table, Th, Td, IconBtn } from "../components/kit"

export default function Tools() {
  const { tools, addTool, removeTool } = useMizan()
  const [open, setOpen] = useState(false)
  const today = useToday()
  const active = useMemo(() => tools.filter((tool) => subscriptionStatus(tool, today) === "active"), [tools, today])
  const total = active.reduce((sum, tool) => sum + tool.cost, 0)
  const expiringSoon = active.filter((tool) => { const days = daysUntil(tool.expiry, today); return days !== null && days >= 0 && days <= 30 }).length
  const trend = useMemo(() => monthlySubscriptionCosts(tools, today), [tools, today])

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Abonnements & Outils" sub="Suivi des coûts récurrents et des dates d'expiration" action={<Btn onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ajouter un outil</Btn>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12px] text-muted">Coût mensuel actif</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{num(total)} <span className="text-[13px] font-semibold text-muted">MAD</span></p>
          <p className="mt-2 text-[11.5px] text-faint">Hors abonnements expirés ou à venir</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">Outils actifs</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{active.length}</p>
          <p className="mt-2 text-[11.5px] text-faint">sur {tools.length} abonnements enregistrés</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">Expire sous 30 jours</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{expiringSoon}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-warn"><AlertCircle className="h-3.5 w-3.5" /> à renouveler bientôt</p>
        </Card>
      </div>
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-ink">Coûts mensuels prévus</h2>
          <Badge tone="brand" dot>7 derniers mois</Badge>
        </div>
        <p className="mb-3 text-[12px] text-muted">Montants théoriques des abonnements couvrant chaque mois, sans prorata. Ce graphique n'est pas un historique des paiements.</p>
        <AreaChart labels={trend.labels} series={[{ name: "Coût prévu", values: trend.values }]} height={200} format={(value) => `${num(value)} MAD`} />
      </Card>
      <Card className="overflow-hidden">
        <Table head={<><Th>Outil</Th><Th className="text-right">Coût / mois</Th><Th>Date de début</Th><Th>Expiration</Th><Th>Statut</Th><Th /></>}>
          {tools.map((tool) => {
            const status = subscriptionStatus(tool, today)
            const days = daysUntil(tool.expiry, today)
            const soon = status === "active" && days !== null && days <= 30
            return (
              <tr key={tool.id} className="transition-colors hover:bg-canvas/60">
                <Td><span className="flex items-center gap-2.5 font-semibold text-ink"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand"><Wrench className="h-3.5 w-3.5" /></span>{tool.name}</span></Td>
                <Td className="tnum text-right font-semibold text-ink">{num(tool.cost)} MAD</Td>
                <Td className="tnum text-muted">{tool.start ? fmtDate(tool.start) : "—"}</Td>
                <Td className="tnum text-muted">{tool.expiry ? fmtDate(tool.expiry) : "Sans échéance"}</Td>
                <Td>
                  {status === "expired" ? <Badge tone="serious" dot>Expiré</Badge> : status === "scheduled" ? <Badge tone="brand" dot>À venir</Badge> : status === "unknown" ? <Badge tone="neutral">Dates à vérifier</Badge> : soon ? <Badge tone="warn" dot>Expire dans {days} j</Badge> : <Badge tone="good" dot>Actif</Badge>}
                </Td>
                <Td className="text-right"><IconBtn onClick={() => removeTool(tool.id)} aria-label={`Supprimer ${tool.name}`}><Trash2 className="h-4 w-4" /></IconBtn></Td>
              </tr>
            )
          })}
        </Table>
        {tools.length === 0 && <p className="p-6 text-center text-sm text-muted">Aucun abonnement.</p>}
      </Card>
      {open && <AddTool onClose={() => setOpen(false)} onAdd={(tool) => { addTool(tool); setOpen(false) }} />}
    </div>
  )
}

function AddTool({ onClose, onAdd }: { onClose: () => void; onAdd: (tool: Omit<SubscriptionTool, "id">) => void }) {
  const [name, setName] = useState("")
  const [cost, setCost] = useState("")
  const [start, setStart] = useState("")
  const [expiry, setExpiry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const amount = parseAmount(cost)
  const valid = !!name.trim() && amount !== null && validDateRange(start, expiry)
  return (
    <Modal title="Ajouter un outil" onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (!valid || amount === null) return
        try { onAdd({ name, cost: amount, start, expiry }) }
        catch (err) { setError(err instanceof Error ? err.message : "Impossible d'ajouter l'abonnement.") }
      }}>
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label="Nom de l'outil"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Figma Organisation" autoFocus /></Field>
        <Field label="Coût mensuel (MAD)"><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="299" className="tnum" /></Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Date de début" hint="Facultative"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="tnum" /></Field>
          <Field label="Expiration" hint="Facultative"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="tnum" /></Field>
        </div>
        {!validDateRange(start, expiry) && <p role="alert" className="text-sm text-serious">L'expiration ne peut pas précéder la date de début.</p>}
        <div className="flex justify-end gap-2 pt-1"><Btn variant="outline" type="button" onClick={onClose}>Annuler</Btn><Btn type="submit" disabled={!valid}><Plus className="h-4 w-4" /> Ajouter</Btn></div>
      </form>
    </Modal>
  )
}
