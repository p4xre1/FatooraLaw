import { useMemo, useState } from "react"
import { Plus, Search, Minus, AlertTriangle, Package, Wrench, Boxes, ScanBarcode } from "lucide-react"
import type { StockItem } from "../store/types"
import { MAX_QUANTITY, parseAmount } from "../lib/businessValidation"
import { formatKeywords, parseKeywords } from "../lib/keywords"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn, Progress } from "../components/kit"
import StockScanner from "../components/StockScanner"

const FILTERS: ("all" | StockItem["type"])[] = ["all", "material", "equipment"]

export default function Inventory() {
  const { t: copy } = useTranslation()
  const t = copy.inventory
  const modules = copy.shared.modules
  const { stock, projects, adjustStock, assignStock, addStock } = useMizan()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<(typeof FILTERS)[number]>("all")
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  /** A scanned code with no article yet: the create form opens with it filled. */
  const [scannedSku, setScannedSku] = useState<string | null>(null)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  function adjust(id: string, delta: number) {
    try { adjustStock(id, delta); setAdjustError(null) }
    catch (err) { setAdjustError(err instanceof Error ? err.message : t.addError) }
  }

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
      <SectionTitle title={modules.inventory} sub={t.subtitle(stock.length, lowStock.length)} action={(
        <span className="flex flex-wrap gap-2">
          <Btn variant="outline" onClick={() => setScanning(true)}><ScanBarcode className="h-4 w-4" /> {t.scan.button}</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.newItem}</Btn>
        </span>
      )} />

      {adjustError && <p role="alert" className="text-sm text-serious">{adjustError}</p>}
      {lowStock.length > 0 && (
        <Card className="flex items-start gap-3 border-warn/30 bg-warn-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div>
            <p className="text-[13px] font-semibold text-warn">{t.lowStock(lowStock.length)}</p>
            <p className="mt-0.5 text-[12.5px] text-warn/90">{lowStock.map((i) => i.name).join(" · ")}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="ps-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {FILTERS.map((key) => (
            <button key={key} type="button" aria-pressed={kind === key} onClick={() => setKind(key)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${kind === key ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{t.filters[key]}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<Boxes className="h-5 w-5" />} text={t.empty} /> : (
          <Table head={<><Th>{t.table.item}</Th><Th>{t.table.type}</Th><Th>{t.table.level}</Th><Th className="text-end">{t.table.threshold}</Th><Th>{t.table.assignment}</Th><Th className="text-center">{t.table.adjustment}</Th></>}>
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
                    {i.keywords?.length ? <div className="mt-1 flex flex-wrap gap-1">{i.keywords.map((word) => <span key={word} className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700">{word}</span>)}</div> : null}
                  </Td>
                  <Td><Badge tone={i.type === "equipment" ? "brand" : "neutral"}>{t.itemType[i.type]}</Badge></Td>
                  <Td>
                    <div className="flex w-40 items-center gap-2">
                      <Progress value={ratio} tone={low ? "warn" : "good"} />
                      <span className={`tnum whitespace-nowrap text-[12px] font-semibold ${low ? "text-warn" : "text-ink"}`}>{i.qty} {i.unit}</span>
                    </div>
                  </Td>
                  <Td className="tnum text-end text-muted">{i.minQty} {i.unit}</Td>
                  <Td>{projName(i.assignedProjectId) ? <span className="text-[12.5px] text-ink">{projName(i.assignedProjectId)}</span> : <Select aria-label={`${t.table.assignment}: ${i.name}`} value="" onChange={(e) => assignStock(i.id, e.target.value || null)} className="w-40 py-1.5 text-[12px]"><option value="">{t.unassigned}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
                    {i.assignedProjectId && <button type="button" onClick={() => assignStock(i.id, null)} className="ms-2 text-[11px] font-semibold text-brand hover:underline">{t.unassign}</button>}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1">
                      <IconBtn title={t.subtract} aria-label={`${t.subtract}: ${i.name}`} disabled={i.qty <= 0} onClick={() => adjust(i.id, -1)}><Minus className="h-4 w-4" /></IconBtn>
                      <IconBtn title={t.addOne} aria-label={`${t.addOne}: ${i.name}`} disabled={i.qty + 1 > MAX_QUANTITY} onClick={() => adjust(i.id, +1)}><Plus className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {creating && <CreateStock initialSku={scannedSku ?? undefined} onClose={() => { setCreating(false); setScannedSku(null) }} onCreate={(s) => { addStock(s); setCreating(false); setScannedSku(null) }} />}
      {scanning && (
        <StockScanner
          onClose={() => setScanning(false)}
          onCreateWithSku={(sku) => { setScanning(false); setScannedSku(sku); setCreating(true) }}
        />
      )}
    </div>
  )
}

function CreateStock({ onClose, onCreate, initialSku }: { onClose: () => void; onCreate: (s: Omit<StockItem, "id">) => void; initialSku?: string }) {
  const { t: copy } = useTranslation()
  const t = copy.inventory
  const common = copy.common
  const [f, setF] = useState<Omit<StockItem, "id">>(() => ({ name: "", sku: initialSku ?? "", qty: 0, minQty: 0, unit: t.defaultUnit, assignedProjectId: null, type: "material", keywords: [] }))
  const [keywordsText, setKeywordsText] = useState("")
  const [qty, setQty] = useState("0")
  const [minQty, setMinQty] = useState("0")
  const [error, setError] = useState<string | null>(null)
  const quantity = parseAmount(qty, false, MAX_QUANTITY)
  const minimum = parseAmount(minQty, false, MAX_QUANTITY)
  return (
    <Modal title={t.createTitle} onClose={onClose}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={t.designation}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.sku}><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label={t.table.type}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as StockItem["type"] })}><option value="material">{t.itemType.material}</option><option value="equipment">{t.itemType.equipment}</option></Select></Field>
          <Field label={t.quantity}><Input type="number" min={0} max={MAX_QUANTITY} step="0.001" className="tnum" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label={t.minimum}><Input type="number" min={0} max={MAX_QUANTITY} step="0.001" className="tnum" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></Field>
          <Field label={t.unit}><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        </div>
        <Field label={t.keywords}><Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder={t.keywordsPlaceholder} /></Field>
        {(quantity === null || minimum === null) && <p role="alert" className="text-sm text-serious">{t.amountError}</p>}
        <Btn className="w-full" disabled={!f.name.trim() || quantity === null || minimum === null} onClick={() => {
          if (quantity === null || minimum === null) return
          try { onCreate({ ...f, qty: quantity, minQty: minimum, keywords: parseKeywords(keywordsText) }) }
          catch (err) { setError(err instanceof Error ? err.message : t.addError) }
        }}>{t.save}</Btn>
      </div>
    </Modal>
  )
}
