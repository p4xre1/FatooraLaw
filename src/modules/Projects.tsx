import { useMemo, useState } from "react"
import { Plus, FolderKanban, Boxes, CheckCircle2, Circle, TrendingUp } from "lucide-react"
import type { Project, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { addCalendarDays, todayISO } from "../lib/calendarDates"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { uid } from "../store/seed"
import { Card, SectionTitle, Btn, Badge, Progress, Table, Th, Td, Modal, Field, Input, Select } from "../components/kit"

type ProjectCurrency = Settings["currency"]

const STATUS_TONES: Record<Project["status"], "neutral" | "brand" | "warn" | "good"> = {
  planning: "neutral",
  active: "brand",
  on_hold: "warn",
  done: "good",
}

export default function Projects() {
  const { date, money: formatMoney, number } = useFormats()
  const { t: copy } = useTranslation()
  const t = copy.projects
  const modules = copy.shared.modules
  const { projects, contacts, stock, settings, addProject, toggleMilestone, assignStock } = useMizan()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = projects.find((p) => p.id === openId) ?? null
  const [assign, setAssign] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const clients = contacts.filter((c) => c.type === "client")

  const clientName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—"

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.projects} sub={t.subtitle(projects.length)} action={<Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.newProject}</Btn>} />

      <Card>
        <Table head={<><Th>{t.table.project}</Th><Th>{t.table.client}</Th><Th className="text-end">{t.table.budget}</Th><Th className="text-end">{t.table.paid}</Th><Th className="text-end">{t.table.receivable}</Th><Th className="text-end">{t.table.margin}</Th><Th>{t.table.progress}</Th><Th>{t.table.status}</Th><Th /></>}>
          {projects.map((p) => {
            const receivable = p.budget - p.paid
            const margin = p.budget - p.cost
            const marginPct = p.budget ? (margin / p.budget) * 100 : 0
            return (
              <tr key={p.id} className="transition-colors hover:bg-canvas/60">
                <Td><span className="font-semibold text-ink">{p.name}</span><div className="text-[11px] text-muted">{date(p.start)} → {date(p.end)}</div></Td>
                <Td className="text-muted">{clientName(p.clientId)}</Td>
                <Td className="tnum text-end font-medium">{formatMoney(p.budget, settings.currency)}</Td>
                <Td className="tnum text-end text-emerald-700">{formatMoney(p.paid, settings.currency)}</Td>
                <Td className="tnum text-end text-warn">{formatMoney(receivable, settings.currency)}</Td>
                <Td className="tnum text-end font-semibold">{number(Math.round(marginPct))} %</Td>
                <Td>
                  <div className="flex w-32 items-center gap-2">
                    <Progress value={p.progress} tone={p.progress === 100 ? "good" : "brand"} />
                    <span className="tnum text-[11px] font-semibold text-muted">{number(p.progress)}%</span>
                  </div>
                </Td>
                <Td><Badge tone={STATUS_TONES[p.status]} dot>{t.status[p.status]}</Badge></Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Btn variant="ghost" size="sm" onClick={() => setOpenId(p.id)}>{t.milestones}</Btn>
                    <Btn variant="ghost" size="sm" aria-label={t.assignEquipment(p.name)} onClick={() => setAssign(p)}><Boxes className="h-4 w-4" /></Btn>
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
      </Card>

      {/* Milestones modal */}
      {open && (
        <Modal title={open.name} onClose={() => setOpenId(null)}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label={t.budget} value={formatMoney(open.budget, settings.currency)} />
            <Stat label={t.actualCost} value={formatMoney(open.cost, settings.currency)} />
            <Stat label={t.margin} value={formatMoney(open.budget - open.cost, settings.currency)} accent />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.milestoneHeading}</p>
          <div className="space-y-2">
            {open.milestones.map((mi) => (
              <button key={mi.id} type="button" onClick={() => toggleMilestone(open.id, mi.id)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-start text-[13px] transition-colors hover:bg-canvas">
                {mi.done ? <CheckCircle2 className="h-5 w-5 text-emerald-brand" /> : <Circle className="h-5 w-5 text-faint" />}
                <span className={mi.done ? "font-medium text-muted line-through" : "font-medium"}>{mi.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Assign equipment modal */}
      {assign && (
        <Modal title={t.assignTitle(assign.name)} onClose={() => setAssign(null)}>
          <div className="space-y-2">
            {stock.filter((s) => s.type === "equipment").map((s) => {
              const here = s.assignedProjectId === assign.id
              return (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                  <div><p className="text-[13px] font-semibold">{s.name}</p><p className="text-[11px] text-muted">{s.sku}</p></div>
                  <Btn variant={here ? "outline" : "primary"} size="sm" onClick={() => assignStock(s.id, here ? null : assign.id)}>
                    {here ? t.removeAssignment : t.assign}
                  </Btn>
                </div>
              )
            })}
            {stock.every((s) => s.type !== "equipment") && <p className="py-4 text-center text-sm text-muted">{t.emptyEquipment}</p>}
          </div>
        </Modal>
      )}

      {creating && <CreateProject clients={clients} currency={settings.currency} onClose={() => setCreating(false)} onCreate={(p) => { addProject(p); setCreating(false) }} />}
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

function CreateProject({ clients, currency, onClose, onCreate }: { clients: { id: string; name: string }[]; currency: ProjectCurrency; onClose: () => void; onCreate: (p: Omit<Project, "id">) => void }) {
  const { t: copy } = useTranslation()
  const { money: formatMoney } = useFormats()
  const t = copy.projects.create
  const [name, setName] = useState("")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [budget, setBudget] = useState("")
  const [cost, setCost] = useState("")
  const [error, setError] = useState<string | null>(null)
  const parsedBudget = parseAmount(budget, true)
  const parsedCost = parseAmount(cost, true)
  const margin = parsedBudget !== null && parsedCost !== null ? parsedBudget - parsedCost : null

  return (
    <Modal title={t.title} onClose={onClose}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={t.name}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} /></Field>
        <Field label={t.client}><Select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.budget(currency)} hint={t.optionalZero}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label={t.cost(currency)} hint={t.optionalZero}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-good-50 px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700"><TrendingUp className="h-4 w-4" /> {t.marginAuto}</span>
          <span className="tnum text-[15px] font-bold text-emerald-700">{margin === null ? "—" : formatMoney(margin, currency)}</span>
        </div>
        {margin === null && <p role="alert" className="text-sm text-serious">{t.amountError}</p>}
        <Btn className="w-full" disabled={!name.trim() || !clientId || margin === null} onClick={() => {
          if (parsedBudget === null || parsedCost === null) return
          try { onCreate({
            name, clientId, budget: parsedBudget, cost: parsedCost, paid: 0,
            status: "planning", progress: 0, start: todayISO(), end: addCalendarDays(todayISO(), 90),
            milestones: [{ id: uid(), label: t.firstMilestone, done: false }], equipmentIds: [],
          }) } catch (err) { setError(err instanceof Error ? err.message : t.error) }
        }}>
          <FolderKanban className="h-4 w-4" /> {t.save}
        </Btn>
      </div>
    </Modal>
  )
}

