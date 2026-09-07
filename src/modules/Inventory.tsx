import { useMemo, useState } from "react"
import { Plus, Search, Minus, AlertTriangle, Package, Wrench, Boxes } from "lucide-react"
import type { StockItem } from "../store/types"
import { useMizan } from "../store/useMizan"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn, Progress } from "../components/kit"

export default function Inventory() {
  const { stock, projects, adjustStock, assignStock, addStock } = useMizan()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<"all" | StockItem["type"]>("all")
  const [creating, setCreating] = useState(false)

  const projName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? "—" : null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return stock.filter((i) =>
      (kind === "all" || i.type === kind) &&
      [i.name, i.sku].some((f) => f.toLowerCase().includes(s)),
    )
  }, [stock, q, kind])

  const lowStock = stock.filter((i) => i.qty < i.minQty)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Stock & Matériel" sub={`${stock.length} références · ${lowStock.length} sous le seuil`} action={<Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouvel article</Btn>} />

      {lowStock.length > 0 && (
        <Card className="flex items-start gap-3 border-warn/30 bg-warn-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div>
            <p className="text-[13px] font-semibold text-warn">Alerte stock faible — {lowStock.length} article(s)</p>
            <p className="mt-0.5 text-[12.5px] text-warn/90">{lowStock.map((i) => i.name).join(" · ")}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher article, SKU…" className="pl-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {([["all", "Tout"], ["material", "Matériaux"], ["equipment", "Matériel"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${kind === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<Boxes className="h-5 w-5" />} text="Aucun article." /> : (
          <Table head={<><Th>Article</Th><Th>Type</Th><Th>Niveau</Th><Th className="text-end">Seuil</Th><Th>Affectation</Th><Th className="text-center">Ajustement</Th></>}>
            {filtered.map((i) => {
              const low = i.qty < i.minQty
              const ratio = i.minQty ? (i.qty / (i.minQty * 1.5)) * 100 : 100
              return (
                <tr key={i.id} className="transition-colors hover:bg-canvas/60">
                  <Td>
                    <span className="inline-flex items-center gap-2 font-semibold text-ink">
                      {i.type === "equipment" ? <Wrench className="h-4 w-4 text-muted" /> : <Package className="h-4 w-4 text-muted" />}
                      {i.name}
                    </span>
                    <div className="text-[11px] text-muted">{i.sku}</div>
                  </Td>
                  <Td><Badge tone={i.type === "equipment" ? "brand" : "neutral"}>{i.type === "equipment" ? "Matériel" : "Matériau"}</Badge></Td>
                  <Td>
                    <div className="flex w-40 items-center gap-2">
                      <Progress value={ratio} tone={low ? "warn" : "good"} />
                      <span className={`tnum whitespace-nowrap text-[12px] font-semibold ${low ? "text-warn" : "text-ink"}`}>{i.qty} {i.unit}</span>
                    </div>
                  </Td>
                  <Td className="tnum text-end text-muted">{i.minQty} {i.unit}</Td>
                  <Td>{projName(i.assignedProjectId) ? <span className="text-[12.5px] text-ink">{projName(i.assignedProjectId)}</span> : <Select value="" onChange={(e) => assignStock(i.id, e.target.value || null)} className="w-40 py-1.5 text-[12px]"><option value="">Non affecté</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
                    {i.assignedProjectId && <button onClick={() => assignStock(i.id, null)} className="ml-2 text-[11px] font-semibold text-brand hover:underline">retirer</button>}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1">
                      <IconBtn title="Retirer" onClick={() => adjustStock(i.id, -1)}><Minus className="h-4 w-4" /></IconBtn>
                      <IconBtn title="Ajouter" onClick={() => adjustStock(i.id, +1)}><Plus className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {creating && <CreateStock onClose={() => setCreating(false)} onCreate={(s) => { addStock(s); setCreating(false) }} />}
    </div>
  )
}

function CreateStock({ onClose, onCreate }: { onClose: () => void; onCreate: (s: Omit<StockItem, "id">) => void }) {
  const [f, setF] = useState<Omit<StockItem, "id">>({ name: "", sku: "", qty: 0, minQty: 0, unit: "unité", assignedProjectId: null, type: "material" })
  return (
    <Modal title="Nouvel article" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Désignation"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU / Référence"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as StockItem["type"] })}><option value="material">Matériau</option><option value="equipment">Matériel</option></Select></Field>
          <Field label="Quantité"><Input type="number" className="tnum" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></Field>
          <Field label="Seuil minimum"><Input type="number" className="tnum" value={f.minQty} onChange={(e) => setF({ ...f, minQty: Number(e.target.value) })} /></Field>
          <Field label="Unité"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        </div>
        <Btn className="w-full" disabled={!f.name.trim()} onClick={() => onCreate(f)}>Ajouter au stock</Btn>
      </div>
    </Modal>
  )
}
