import { useMemo, useState } from "react"
import { Plus, Search, Download, Check, Trash2, ReceiptText, Paperclip, Clock, ArrowLeftRight, Banknote, FileCheck2 } from "lucide-react"
import type { Expense } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money, fmtDate, toExcel } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn, Toggle } from "../components/kit"

const methodMeta = {
  transfer: { label: "Virement", icon: ArrowLeftRight },
  check: { label: "Chèque", icon: FileCheck2 },
  cash: { label: "Espèces", icon: Banknote },
}

const CATEGORIES = ["Matériaux", "Quincaillerie", "Location", "Carburant", "Main d'œuvre", "Transport", "Autre"]

export default function Procurement() {
  const { expenses, contacts, addExpense, setExpenseStatus, removeExpense } = useMizan()
  const suppliers = contacts.filter((c) => c.type === "supplier")
  const [q, setQ] = useState("")
  const [method, setMethod] = useState<"all" | Expense["method"]>("all")
  const [statusF, setStatusF] = useState<"all" | Expense["status"]>("all")
  const [creating, setCreating] = useState(false)

  const vendorName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—"

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return expenses.filter((e) =>
      (method === "all" || e.method === method) &&
      (statusF === "all" || e.status === statusF) &&
      [e.note, e.category, vendorName(e.vendorId)].some((f) => f.toLowerCase().includes(s)),
    )
  }, [expenses, q, method, statusF])

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const pending = expenses.filter((e) => e.status === "pending")
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0)

  function exportXls() {
    toExcel(filtered.map((e) => ({
      Date: e.date, Fournisseur: vendorName(e.vendorId), Catégorie: e.category,
      Mode: methodMeta[e.method].label, Montant: e.amount, Statut: e.status === "approved" ? "Approuvé" : "En attente",
    })), "fatorti-depenses.xls")
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Achats & Dépenses" sub="Suivi des transactions par fournisseur & mode de paiement" action={
        <div className="flex flex-wrap gap-2">
          <Btn variant="outline" size="sm" onClick={exportXls}><Download className="h-4 w-4" /> Excel</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouvelle dépense</Btn>
        </div>
      } />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[12px] text-muted">Total filtré</p><p className="tnum mt-1 text-[20px] font-bold">{money(total)}</p></Card>
        <Card className="p-4"><p className="text-[12px] text-muted">En attente d'approbation</p><p className="tnum mt-1 text-[20px] font-bold text-warn">{money(pendingTotal)}</p></Card>
        <Card className="flex items-center justify-between p-4">
          <div><p className="text-[12px] text-muted">À approuver</p><p className="tnum mt-1 text-[20px] font-bold">{pending.length}</p></div>
          {pending.length > 0 && <Btn variant="emerald" size="sm" onClick={() => pending.forEach((e) => setExpenseStatus(e.id, "approved"))}><Check className="h-4 w-4" /> Tout approuver</Btn>}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher libellé, catégorie, fournisseur…" className="pl-9" />
        </div>
        <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="w-auto">
          <option value="all">Tous modes</option>
          <option value="transfer">Virement</option>
          <option value="check">Chèque</option>
          <option value="cash">Espèces</option>
        </Select>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className="w-auto">
          <option value="all">Tous statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvé</option>
        </Select>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<ReceiptText className="h-5 w-5" />} text="Aucune dépense." /> : (
          <Table head={<><Th>Date</Th><Th>Fournisseur</Th><Th>Catégorie</Th><Th>Mode</Th><Th>Reçu</Th><Th className="text-end">Montant</Th><Th>Statut</Th><Th /></>}>
            {filtered.map((e) => {
              const M = methodMeta[e.method].icon
              return (
                <tr key={e.id} className="transition-colors hover:bg-canvas/60">
                  <Td className="text-muted">{fmtDate(e.date)}</Td>
                  <Td><span className="font-semibold text-ink">{vendorName(e.vendorId)}</span><div className="text-[11px] text-muted">{e.note}</div></Td>
                  <Td className="text-muted">{e.category}</Td>
                  <Td><span className="inline-flex items-center gap-1.5 text-muted"><M className="h-3.5 w-3.5" /> {methodMeta[e.method].label}</span></Td>
                  <Td>{e.receipt ? <Paperclip className="h-4 w-4 text-emerald-brand" /> : <span className="text-[11px] text-faint">—</span>}</Td>
                  <Td className="tnum text-end font-semibold">{money(e.amount)}</Td>
                  <Td>{e.status === "approved" ? <Badge tone="good" dot>Approuvé</Badge> : <Badge tone="warn" dot>En attente</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-0.5">
                      {e.status === "pending" && <IconBtn title="Approuver" onClick={() => setExpenseStatus(e.id, "approved")} className="hover:bg-good-50 hover:text-emerald-700"><Check className="h-4 w-4" /></IconBtn>}
                      <IconBtn title="Supprimer" onClick={() => removeExpense(e.id)} className="hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {creating && <CreateExpense suppliers={suppliers} onClose={() => setCreating(false)} onCreate={(e) => { addExpense(e); setCreating(false) }} />}
    </div>
  )
}

function CreateExpense({ suppliers, onClose, onCreate }: { suppliers: { id: string; name: string }[]; onClose: () => void; onCreate: (e: Omit<Expense, "id">) => void }) {
  const [vendorId, setVendorId] = useState(suppliers[0]?.id ?? "")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [method, setMethod] = useState<Expense["method"]>("transfer")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [receipt, setReceipt] = useState(false)

  return (
    <Modal title="Nouvelle dépense" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Fournisseur"><Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Catégorie"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Mode de paiement"><Select value={method} onChange={(e) => setMethod(e.target.value as Expense["method"])}><option value="transfer">Virement</option><option value="check">Chèque</option><option value="cash">Espèces</option></Select></Field>
        </div>
        <Field label="Montant (MAD)"><Input type="number" className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Libellé"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description de l'achat…" /></Field>
        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium"><Paperclip className="h-4 w-4 text-muted" /> Reçu / facture joint (prêt OCR)</span>
          <Toggle checked={receipt} onChange={setReceipt} />
        </label>
        <div className="flex items-center gap-2 rounded-lg bg-warn-50 px-3 py-2 text-[12px] font-medium text-warn"><Clock className="h-4 w-4" /> Enregistrée « en attente » — approbation requise.</div>
        <Btn className="w-full" disabled={!vendorId || !amount} onClick={() => onCreate({
          vendorId, category, method, amount: Number(amount) || 0, note, receipt,
          status: "pending", date: new Date().toISOString().slice(0, 10),
        })}><ReceiptText className="h-4 w-4" /> Enregistrer</Btn>
      </div>
    </Modal>
  )
}
