import { useId, useMemo, useState } from "react"
import { Wrench, Plus, TrendingUp, Trash2, AlertCircle } from "lucide-react"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Table, Th, Td, IconBtn } from "../components/kit"
import { sanitize } from "../store/useMizan"

type Tool = { id: string; name: string; cost: number; start: string; expiry: string }

const SEED: Tool[] = [
  { id: "t1", name: "Adobe Creative Cloud", cost: 299, start: "01/03/2026", expiry: "01/03/2027" },
  { id: "t2", name: "Microsoft 365 Business", cost: 129, start: "12/01/2026", expiry: "12/09/2026" },
  { id: "t3", name: "Sage Compta", cost: 450, start: "05/06/2026", expiry: "05/06/2027" },
  { id: "t4", name: "Hébergement OVH", cost: 89, start: "20/02/2026", expiry: "20/02/2027" },
  { id: "t5", name: "Google Workspace", cost: 168, start: "10/04/2026", expiry: "10/04/2027" },
  { id: "t6", name: "Slack Pro", cost: 95, start: "18/05/2026", expiry: "18/05/2027" },
  { id: "t7", name: "Assurance RC Pro", cost: 213, start: "01/01/2026", expiry: "20/09/2026" },
]

const TREND = [1240, 1180, 1420, 1360, 1580, 1490, 1720]
const TREND_LABELS = ["Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû"]
const MAD = (n: number) => n.toLocaleString("fr-MA")

// Days until expiry from a fixed "today" (07/09/2026) for the demo dataset.
const TODAY = new Date(2026, 8, 7)
function daysTo(dmy: string) {
  const [d, m, y] = dmy.split("/").map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - TODAY.getTime()) / 86_400_000)
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>(SEED)
  const [open, setOpen] = useState(false)

  const total = useMemo(() => tools.reduce((s, t) => s + t.cost, 0), [tools])
  const expiringSoon = useMemo(() => tools.filter((t) => { const d = daysTo(t.expiry); return d >= 0 && d <= 30 }).length, [tools])

  function add(t: Omit<Tool, "id">) {
    setTools((p) => [{ ...t, id: Math.random().toString(36).slice(2, 8) }, ...p])
    setOpen(false)
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title="Abonnements & Outils"
        sub="Suivi des dépenses récurrentes et des dates d'expiration"
        action={<Btn onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ajouter un outil</Btn>}
      />

      {/* Metric overview blocks */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4" >
          <p className="text-[12px] text-muted">Dépense mensuelle totale</p>
          <p className="mt-1.5 text-[26px] font-bold leading-none text-ink tnum">{MAD(total)} <span className="text-[13px] font-semibold text-muted">MAD</span></p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700"><TrendingUp className="h-3.5 w-3.5" /> +12% vs mois précédent</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">Outils actifs</p>
          <p className="mt-1.5 text-[26px] font-bold leading-none text-ink tnum">{tools.length}</p>
          <p className="mt-2 text-[11.5px] text-faint">abonnements en cours</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">Expire sous 30 jours</p>
          <p className="mt-1.5 text-[26px] font-bold leading-none text-ink tnum">{expiringSoon}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-warn"><AlertCircle className="h-3.5 w-3.5" /> à renouveler bientôt</p>
        </Card>
      </div>

      {/* Spending trend chart */}
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-ink">Tendance des dépenses mensuelles</h2>
          <Badge tone="brand" dot>7 derniers mois</Badge>
        </div>
        <p className="mb-3 text-[12px] text-muted">Coût récurrent cumulé, en MAD</p>
        <TrendChart />
      </Card>

      {/* Tracking table */}
      <Card className="overflow-hidden">
        <Table head={<><Th>Outil</Th><Th className="text-right">Coût / mois</Th><Th>Date de début</Th><Th>Expiration</Th><Th>Statut</Th><Th /></>}>
          {tools.map((t) => {
            const d = daysTo(t.expiry)
            const soon = d >= 0 && d <= 30
            return (
              <tr key={t.id} className="transition-colors hover:bg-canvas/60">
                <Td>
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand"><Wrench className="h-3.5 w-3.5" /></span>
                    {t.name}
                  </span>
                </Td>
                <Td className="text-right font-semibold tnum text-ink">{MAD(t.cost)} MAD</Td>
                <Td className="tnum text-muted">{t.start}</Td>
                <Td className="tnum text-muted">{t.expiry}</Td>
                <Td>{soon ? <Badge tone="warn" dot>Expire dans {d} j</Badge> : <Badge tone="good" dot>Actif</Badge>}</Td>
                <Td className="text-right">
                  <IconBtn onClick={() => setTools((p) => p.filter((x) => x.id !== t.id))} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></IconBtn>
                </Td>
              </tr>
            )
          })}
        </Table>
      </Card>

      {open && <AddTool onClose={() => setOpen(false)} onAdd={add} />}
    </div>
  )
}

function AddTool({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Omit<Tool, "id">) => void }) {
  const [name, setName] = useState("")
  const [cost, setCost] = useState("")
  const [start, setStart] = useState("")
  const [expiry, setExpiry] = useState("")
  const valid = name.trim() && Number(cost) > 0

  return (
    <Modal title="Ajouter un outil" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (valid) onAdd({ name: sanitize(name), cost: Number(cost), start: start || "—", expiry: expiry || "—" }) }}
      >
        <Field label="Nom de l'outil"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Figma Organisation" autoFocus /></Field>
        <Field label="Coût mensuel (MAD)"><Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="299" className="tnum" /></Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Date de début"><Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="JJ/MM/AAAA" className="tnum" /></Field>
          <Field label="Expiration"><Input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="JJ/MM/AAAA" className="tnum" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="outline" type="button" onClick={onClose}>Annuler</Btn>
          <Btn type="submit" disabled={!valid}><Plus className="h-4 w-4" /> Ajouter</Btn>
        </div>
      </form>
    </Modal>
  )
}

function TrendChart() {
  const gid = useId().replace(/:/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 200, padX = 44, padTop = 16, padBot = 28
  const iw = W - padX * 2, ih = H - padTop - padBot
  const max = Math.max(...TREND) * 1.1, min = Math.min(...TREND) * 0.9
  const n = TREND.length
  const x = (i: number) => padX + (i / (n - 1)) * iw
  const y = (v: number) => padTop + ih - ((v - min) / (max - min)) * ih
  const line = TREND.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L ${x(n - 1)} ${padTop + ih} L ${x(0)} ${padTop + ih} Z`
  const grid = [0, 0.5, 1].map((f) => min + (max - min) * f)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padX) / iw) * (n - 1)))))
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid.map((v, i) => (
          <g key={i}>
            <line x1={padX} x2={W - padX} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padX - 8} y={y(v) + 3} textAnchor="end" className="fill-faint" style={{ fontSize: 10 }}>{MAD(Math.round(v))}</text>
          </g>
        ))}
        {TREND_LABELS.map((l, i) => <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>{l}</text>)}
        <path d={area} fill={`url(#${gid}-fill)`} />
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + ih} stroke="var(--color-brand)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <circle cx={x(hover)} cy={y(TREND[hover])} r={5} fill="var(--color-surface)" stroke="var(--color-brand)" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] shadow-lg" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(TREND[hover]) / H) * 100}%` }}>
          <span className="font-bold tnum text-ink">{MAD(TREND[hover])} MAD</span>
          <span className="ml-1.5 text-faint">{TREND_LABELS[hover]}</span>
        </div>
      )}
    </div>
  )
}
