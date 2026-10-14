import { useMemo, useState } from "react"
import { Plus, Search, Download, Check, Trash2, ReceiptText, Paperclip, Clock, ArrowLeftRight, Banknote, FileCheck2 } from "lucide-react"
import type { Expense, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { todayISO } from "../lib/calendarDates"
import { toExcel } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import type { ExpenseCategory } from "../i18n/procurement"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn, Toggle } from "../components/kit"

const METHODS: Expense["method"][] = ["transfer", "check", "cash"]
const STATUSES: Expense["status"][] = ["pending", "approved"]
const CATEGORIES: ExpenseCategory[] = ["Matériaux", "Quincaillerie", "Location", "Carburant", "Main d'œuvre", "Transport", "Autre"]

export default function Procurement() {
  const { date, money: formatMoney } = useFormats()
  const { language, t: copy } = useTranslation()
  const t = copy.procurement
  const modules = copy.shared.modules
  const { expenses, contacts, settings, addExpense, setExpenseStatus, removeExpense } = useMizan()
  const suppliers = contacts.filter((c) => c.type === "supplier")
  const [q, setQ] = useState("")
  const [method, setMethod] = useState<"all" | Expense["method"]>("all")
  const [statusF, setStatusF] = useState<"all" | Expense["status"]>("all")
  const [creating, setCreating] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const vendorName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—"

  const filtered = useMemo(() => {
    const s = q.toLocaleLowerCase(language)
    return expenses.filter((e) =>
      (method === "all" || e.method === method) &&
      (statusF === "all" || e.status === statusF) &&
      [e.note, t.categories[e.category as ExpenseCategory] ?? e.category, vendorName(e.vendorId)].some((f) => f.toLocaleLowerCase(language).includes(s)),
    )
  }, [expenses, contacts, q, method, statusF, language, t])

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const pending = expenses.filter((e) => e.status === "pending")
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0)

  function exportXls() {
    try {
      toExcel(filtered.map((e) => ({
        [t.table.date]: date(e.date),
        [t.table.supplier]: vendorName(e.vendorId),
        [t.table.category]: t.categories[e.category as ExpenseCategory] ?? e.category,
        [t.table.method]: t.method[e.method],
        [t.table.amount]: e.amount,
        [t.table.status]: t.status[e.status],
      })), "fatorati-depenses.xls")
      setExportError(null)
    } catch { setExportError(t.exportError) }
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.procurement} sub={t.subtitle} action={
        <div className="flex flex-wrap gap-2">
          <Btn variant="outline" size="sm" onClick={exportXls}><Download className="h-4 w-4" /> {t.export}</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.newExpense}</Btn>
        </div>
      } />

      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[12px] text-muted">{t.summary.filteredTotal}</p><p className="tnum mt-1 text-[20px] font-bold">{formatMoney(total, settings.currency)}</p></Card>
        <Card className="p-4"><p className="text-[12px] text-muted">{t.summary.pendingAmount}</p><p className="tnum mt-1 text-[20px] font-bold text-warn">{formatMoney(pendingTotal, settings.currency)}</p></Card>
        <Card className="flex items-center justify-between p-4">
          <div><p className="text-[12px] text-muted">{t.summary.pendingCount}</p><p className="tnum mt-1 text-[20px] font-bold">{pending.length}</p></div>
          {pending.length > 0 && <Btn variant="emerald" size="sm" onClick={() => pending.forEach((e) => setExpenseStatus(e.id, "approved"))}><Check className="h-4 w-4" /> {t.summary.approveAll}</Btn>}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="ps-9" />
        </div>
        <Select aria-label={t.methodFilter} value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="w-auto">
          <option value="all">{t.methodFilter}</option>
          {METHODS.map((key) => <option key={key} value={key}>{t.method[key]}</option>)}
        </Select>
        <Select aria-label={t.statusFilter} value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className="w-auto">
          <option value="all">{t.statusFilter}</option>
          {STATUSES.map((key) => <option key={key} value={key}>{t.status[key]}</option>)}
        </Select>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<ReceiptText className="h-5 w-5" />} text={t.empty} /> : (
          <Table head={<><Th>{t.table.date}</Th><Th>{t.table.supplier}</Th><Th>{t.table.category}</Th><Th>{t.table.method}</Th><Th>{t.table.receipt}</Th><Th className="text-end">{t.table.amount}</Th><Th>{t.table.status}</Th><Th /></>}>
            {filtered.map((e) => {
              const MethodIcon = e.method === "transfer" ? ArrowLeftRight : e.method === "check" ? FileCheck2 : Banknote
              return (
                <tr key={e.id} className="transition-colors hover:bg-canvas/60">
                  <Td className="text-muted">{date(e.date)}</Td>
                  <Td><span className="font-semibold text-ink">{vendorName(e.vendorId)}</span><div className="text-[11px] text-muted">{e.note}</div></Td>
                  <Td className="text-muted">{t.categories[e.category as ExpenseCategory] ?? e.category}</Td>
                  <Td><span className="inline-flex items-center gap-1.5 text-muted"><MethodIcon className="h-3.5 w-3.5" /> {t.method[e.method]}</span></Td>
                  <Td>{e.receipt ? <Paperclip className="h-4 w-4 text-emerald-brand" role="img" aria-label={t.hasReceipt} /> : <span className="text-[11px] text-faint" title={t.noReceipt}>—</span>}</Td>
                  <Td className="tnum text-end font-semibold">{formatMoney(e.amount, settings.currency)}</Td>
                  <Td><Badge tone={e.status === "approved" ? "good" : "warn"} dot>{t.status[e.status]}</Badge></Td>
                  <Td>
                    <div className="flex justify-end gap-0.5">
                      {e.status === "pending" && <IconBtn title={t.approve} aria-label={`${t.approve}: ${e.note}`} onClick={() => setExpenseStatus(e.id, "approved")} className="hover:bg-good-50 hover:text-emerald-700"><Check className="h-4 w-4" /></IconBtn>}
                      <IconBtn title={t.delete} aria-label={`${t.delete}: ${e.note}`} onClick={() => removeExpense(e.id)} className="hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {creating && <CreateExpense suppliers={suppliers} currency={settings.currency} onClose={() => setCreating(false)} onCreate={(e) => { addExpense(e); setCreating(false) }} />}
    </div>
  )
}

function CreateExpense({ suppliers, currency, onClose, onCreate }: { suppliers: { id: string; name: string }[]; currency: Settings["currency"]; onClose: () => void; onCreate: (e: Omit<Expense, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.procurement
  const c = t.create
  const [vendorId, setVendorId] = useState(suppliers[0]?.id ?? "")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [method, setMethod] = useState<Expense["method"]>("transfer")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [receipt, setReceipt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = parseAmount(amount)

  return (
    <Modal title={c.title} onClose={onClose}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={c.supplier}><Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={c.category}><Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{CATEGORIES.map((key) => <option key={key} value={key}>{t.categories[key]}</option>)}</Select></Field>
          <Field label={c.method}><Select value={method} onChange={(e) => setMethod(e.target.value as Expense["method"])}>{METHODS.map((key) => <option key={key} value={key}>{t.method[key]}</option>)}</Select></Field>
        </div>
        <Field label={c.amount(currency)}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        {amount && parsed === null && <p role="alert" className="text-sm text-serious">{c.amountError}</p>}
        <Field label={c.note}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} /></Field>
        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium"><Paperclip className="h-4 w-4 text-muted" /> {t.receiptAttached}</span>
          <Toggle checked={receipt} onChange={setReceipt} />
        </label>
        <p className="-mt-2 text-[11px] leading-relaxed text-muted">{t.receiptExplanation}</p>
        <div className="flex items-center gap-2 rounded-lg bg-warn-50 px-3 py-2 text-[12px] font-medium text-warn"><Clock className="h-4 w-4" /> {c.pendingReceipt}</div>
        <Btn className="w-full" disabled={!vendorId || parsed === null} onClick={() => {
          if (parsed === null) return
          try { onCreate({ vendorId, category, method, amount: parsed, note, receipt, status: "pending", date: todayISO() }) }
          catch (err) { setError(err instanceof Error ? err.message : c.error) }
        }}><ReceiptText className="h-4 w-4" /> {c.save}</Btn>
      </div>
    </Modal>
  )
}
