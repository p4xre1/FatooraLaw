import { useMemo, useState } from "react"
import { Plus, FolderKanban, Boxes, CheckCircle2, Circle, TrendingUp } from "lucide-react"
import type { Project } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money, fmtDate } from "../lib/mizan"
import { uid } from "../store/seed"
import { Card, SectionTitle, Btn, Badge, Progress, Table, Th, Td, Modal, Field, Input, Select, EmptyState } from "../components/kit"

const statusMap = {
  planning: { label: "Planification", tone: "neutral" as const },
  active: { label: "En cours", tone: "brand" as const },
  on_hold: { label: "En pause", tone: "warn" as const },
  done: { label: "Terminé", tone: "good" as const },
}

export default function Projects() {
  const { projects, contacts, stock, addProject, toggleMilestone, assignStock } = useMizan()
  const [open, setOpen] = useState<Project | null>(null)
  const [assign, setAssign] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const clients = contacts.filter((c) => c.type === "client")

  const clientName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—"

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Projets" sub={`${projects.length} chantiers · suivi budgétaire`} action={<Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau projet</Btn>} />

      <Card>
        <Table head={<><Th>Projet</Th><Th>Client</Th><Th className="text-end">Budget</Th><Th className="text-end">Encaissé</Th><Th className="text-end">Créances</Th><Th className="text-end">Marge</Th><Th>Avancement</Th><Th>Statut</Th><Th /></>}>
          {projects.map((p) => {
            const receivable = p.budget - p.paid
            const margin = p.budget - p.cost
            const marginPct = p.budget ? (margin / p.budget) * 100 : 0
            return (
              <tr key={p.id} className="transition-colors hover:bg-canvas/60">
                <Td><span className="font-semibold text-ink">{p.name}</span><div className="text-[11px] text-muted">{fmtDate(p.start)} → {fmtDate(p.end)}</div></Td>
                <Td className="text-muted">{clientName(p.clientId)}</Td>
                <Td className="tnum text-end font-medium">{money(p.budget)}</Td>
                <Td className="tnum text-end text-emerald-700">{money(p.paid)}</Td>
                <Td className="tnum text-end text-warn">{money(receivable)}</Td>
                <Td className="tnum text-end font-semibold">{marginPct.toFixed(0)} %</Td>
                <Td>
                  <div className="flex w-32 items-center gap-2">
                    <Progress value={p.progress} tone={p.progress === 100 ? "good" : "brand"} />
                    <span className="tnum text-[11px] font-semibold text-muted">{p.progress}%</span>
                  </div>
                </Td>
                <Td><Badge tone={statusMap[p.status].tone} dot>{statusMap[p.status].label}</Badge></Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Btn variant="ghost" size="sm" onClick={() => setOpen(p)}>Jalons</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setAssign(p)}><Boxes className="h-4 w-4" /></Btn>
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
      </Card>

      {/* Milestones modal */}
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Budget" value={money(open.budget)} />
            <Stat label="Coût réel" value={money(open.cost)} />
            <Stat label="Marge" value={money(open.budget - open.cost)} accent />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Jalons — exécution par phase</p>
          <div className="space-y-2">
            {open.milestones.map((mi) => (
              <button key={mi.id} onClick={() => toggleMilestone(open.id, mi.id)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-start text-[13px] transition-colors hover:bg-canvas">
                {mi.done ? <CheckCircle2 className="h-5 w-5 text-emerald-brand" /> : <Circle className="h-5 w-5 text-faint" />}
                <span className={mi.done ? "font-medium text-muted line-through" : "font-medium"}>{mi.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Assign equipment modal */}
      {assign && (
        <Modal title={`Affecter du matériel — ${assign.name}`} onClose={() => setAssign(null)}>
          <div className="space-y-2">
            {stock.filter((s) => s.type === "equipment").map((s) => {
              const here = s.assignedProjectId === assign.id
              return (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                  <div><p className="text-[13px] font-semibold">{s.name}</p><p className="text-[11px] text-muted">{s.sku}</p></div>
                  <Btn variant={here ? "outline" : "primary"} size="sm" onClick={() => assignStock(s.id, here ? null : assign.id)}>
                    {here ? "Retirer" : "Affecter"}
                  </Btn>
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {creating && <CreateProject clients={clients} onClose={() => setCreating(false)} onCreate={(p) => { addProject(p); setCreating(false) }} />}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-canvas p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`tnum mt-0.5 text-[15px] font-bold ${accent ? "text-emerald-700" : "text-ink"}`}>{value}</p>
    </div>
  )
}

function CreateProject({ clients, onClose, onCreate }: { clients: { id: string; name: string }[]; onClose: () => void; onCreate: (p: Omit<Project, "id">) => void }) {
  const [name, setName] = useState("")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [budget, setBudget] = useState("")
  const [cost, setCost] = useState("")

  const margin = (Number(budget) || 0) - (Number(cost) || 0)

  return (
    <Modal title="Nouveau projet" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom du projet"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Villa R+2 — …" /></Field>
        <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget (MAD)"><Input type="number" className="tnum" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label="Coût estimé (MAD)"><Input type="number" className="tnum" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-good-50 px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700"><TrendingUp className="h-4 w-4" /> Marge automatique</span>
          <span className="tnum text-[15px] font-bold text-emerald-700">{money(margin)}</span>
        </div>
        <Btn className="w-full" disabled={!name.trim() || !clientId} onClick={() => onCreate({
          name, clientId, budget: Number(budget) || 0, cost: Number(cost) || 0, paid: 0,
          status: "planning", progress: 0, start: new Date().toISOString().slice(0, 10),
          end: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          milestones: [{ id: uid(), label: "Démarrage", done: false }], equipmentIds: [],
        })}>
          <FolderKanban className="h-4 w-4" /> Créer le projet
        </Btn>
      </div>
    </Modal>
  )
}
