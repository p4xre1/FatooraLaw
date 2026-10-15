import { useMemo, useRef, useState } from "react"
import { Plus, Search, Download, Check, Trash2, ReceiptText, Paperclip, Clock, ArrowLeftRight, Banknote, FileCheck2, ImagePlus } from "lucide-react"
import type { Expense, ExpenseItem, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { MAX_AMOUNT, MAX_QUANTITY, isTaxRate, parseAmount } from "../lib/businessValidation"
import { expenseBreakdown, roundMoney } from "../lib/expenseCalc"
import { formatKeywords, parseKeywords } from "../lib/keywords"
import { LOGO_TYPES, validateLogoDataURL, validateLogoFile } from "../lib/logoValidation"
import { todayISO } from "../lib/calendarDates"
import { toExcel } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import type { ExpenseCategory } from "../i18n/procurement"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn, Toggle } from "../components/kit"
import PartyPicker, { NEW_PARTY, emptyPartyDraft, partyReady, resolveParty, type PartyDraft } from "../components/PartyPicker"

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
  const [viewing, setViewing] = useState<Expense | null>(null)
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
        [t.create.itemsTitle]: e.items?.length ?? 0,
        [t.create.taxRate]: e.taxRate ?? "",
        [t.create.subtotalHt]: expenseBreakdown(e).subtotalHt ?? "",
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
                  <Td><span className="font-semibold text-ink">{vendorName(e.vendorId)}</span><div className="text-[11px] text-muted">{e.note}</div>{e.items?.length ? <div className="text-[11px] font-medium text-brand">{t.create.itemsLine(e.items.length, expenseBreakdown(e).quantity)}</div> : null}
                  {e.items?.some((i) => i.keywords?.length) ? <div className="text-[10.5px] text-faint">{formatKeywords([...new Set(e.items.flatMap((i) => i.keywords ?? []))])}</div> : null}</Td>
                  <Td className="text-muted">{t.categories[e.category as ExpenseCategory] ?? e.category}</Td>
                  <Td><span className="inline-flex items-center gap-1.5 text-muted"><MethodIcon className="h-3.5 w-3.5" /> {t.method[e.method]}</span></Td>
                  <Td>{e.receiptImage ? (
                    <button type="button" onClick={() => setViewing(e)} aria-label={t.create.viewReceipt} className="block rounded-md ring-1 ring-line transition hover:ring-brand">
                      <img src={e.receiptImage} alt="" className="h-8 w-8 rounded-md object-cover" />
                    </button>
                  ) : e.receipt ? <Paperclip className="h-4 w-4 text-emerald-brand" role="img" aria-label={t.hasReceipt} /> : <span className="text-[11px] text-faint" title={t.noReceipt}>—</span>}</Td>
                  <Td className="tnum text-end"><span className="font-semibold">{formatMoney(e.amount, settings.currency)}</span>{(() => { const b = expenseBreakdown(e); return b.subtotalHt !== null && b.taxAmount !== null ? <div className="text-[10.5px] font-normal text-faint">{t.create.subtotalHt} {formatMoney(b.subtotalHt, settings.currency)} · {t.create.taxAmount} {b.taxRate}%</div> : null })()}</Td>
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

      {creating && <CreateExpense suppliers={suppliers} currency={settings.currency} defaultTaxRate={settings.taxRate} onClose={() => setCreating(false)} onCreate={(e) => { addExpense(e); setCreating(false) }} />}
      {viewing?.receiptImage && (
        <Modal title={t.table.receipt} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <img src={viewing.receiptImage} alt={t.create.viewReceipt} className="max-h-[64vh] w-full rounded-lg bg-night object-contain" />
            <p className="text-[12px] text-muted">{viewing.note} · {date(viewing.date)}</p>
            <a href={viewing.receiptImage} download="justificatif" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
              <Download className="h-3.5 w-3.5" /> {t.export}
            </a>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateExpense({ suppliers, currency, defaultTaxRate, onClose, onCreate }: {
  suppliers: { id: string; name: string }[]
  currency: Settings["currency"]
  /** The account's usual TVA rate (Paramètres), offered until changed here. */
  defaultTaxRate: number
  onClose: () => void
  onCreate: (e: Omit<Expense, "id">) => void
}) {
  const { t: copy, language } = useTranslation()
  const t = copy.procurement
  const c = t.create
  const { money: formatMoney } = useFormats()
  const [vendorId, setVendorId] = useState(suppliers[0]?.id ?? NEW_PARTY)
  const [partyDraft, setPartyDraft] = useState<PartyDraft>(emptyPartyDraft())
  const addContact = useMizan((state) => state.addContact)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [method, setMethod] = useState<Expense["method"]>("transfer")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [receipt, setReceipt] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Itemised detail: rows stay strings while typed; they become articles
  // only when complete (name, qty > 0, unit price), as one block.
  const [rows, setRows] = useState<{ label: string; qty: string; price: string; keywords: string }[]>([])
  const [taxRate, setTaxRate] = useState(String(defaultTaxRate))
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  void language

  const parsedAmount = parseAmount(amount)
  const rate = parseAmount(taxRate)
  const rateValid = rate !== null && isTaxRate(rate)

  const lines: ExpenseItem[] = []
  let itemsInvalid = false
  for (const row of rows) {
    if (!row.label.trim() && !row.qty.trim() && !row.price.trim()) continue
    const qty = parseAmount(row.qty, false, MAX_QUANTITY)
    const price = parseAmount(row.price)
    if (!row.label.trim() || qty === null || qty <= 0 || price === null) { itemsInvalid = true; break }
    lines.push({ label: row.label.trim(), qty, unitPrice: price, keywords: parseKeywords(row.keywords) })
  }
  const hasItems = rows.length > 0
  const breakdown = expenseBreakdown({
    amount: parsedAmount ?? 0,
    items: hasItems && !itemsInvalid ? lines : undefined,
    taxRate: rateValid ? rate : undefined,
  })
  const itemsTotal = hasItems && !itemsInvalid && rateValid
    ? roundMoney((breakdown.subtotalHt ?? 0) + (breakdown.taxAmount ?? 0))
    : null
  const finalAmount = hasItems ? itemsTotal : parsedAmount
  const canSave = partyReady(vendorId, partyDraft) && finalAmount !== null && !itemsInvalid && rateValid

  function setRow(index: number, patch: Partial<{ label: string; qty: string; price: string; keywords: string }>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      validateLogoFile(file)
    } catch {
      setPhotoError(c.photoError)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null
      try {
        validateLogoDataURL(value)
        setPhoto(value)
        setPhotoError(null)
      } catch {
        setPhotoError(c.photoError)
      }
    }
    reader.onerror = () => setPhotoError(c.photoError)
    reader.readAsDataURL(file)
  }

  return (
    <Modal title={c.title} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <PartyPicker label={c.supplier} kind="supplier" options={suppliers} choice={vendorId} onChoice={setVendorId} draft={partyDraft} onDraft={setPartyDraft} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={c.category}><Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{CATEGORIES.map((key) => <option key={key} value={key}>{t.categories[key]}</option>)}</Select></Field>
          <Field label={c.method}><Select value={method} onChange={(e) => setMethod(e.target.value as Expense["method"])}>{METHODS.map((key) => <option key={key} value={key}>{t.method[key]}</option>)}</Select></Field>
        </div>
        <Field label={c.note}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} /></Field>

        {/* ---- Itemised detail: articles, quantities, unit prices ---- */}
        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-ink">{c.itemsTitle}</p>
            <Btn variant="outline" size="sm" onClick={() => setRows((current) => [...current, { label: "", qty: "1", price: "", keywords: "" }])}>
              <Plus className="h-3.5 w-3.5" /> {c.addItem}
            </Btn>
          </div>
          {rows.map((row, index) => {
            const qty = parseAmount(row.qty, false, MAX_QUANTITY)
            const price = parseAmount(row.price)
            const lineTotal = qty !== null && price !== null ? roundMoney(qty * price) : null
            return (
              <div key={index} className="mb-2 grid grid-cols-[1fr_64px_92px_76px_32px] items-end gap-2">
                <Field label={index === 0 ? c.itemLabel : "\u00A0"}><Input aria-label={`${c.itemLabel} ${index + 1}`} value={row.label} onChange={(e) => setRow(index, { label: e.target.value })} /></Field>
                <Field label={index === 0 ? c.itemQty : "\u00A0"}><Input aria-label={`${c.itemQty} ${index + 1}`} type="number" min={0} step="any" className="tnum" value={row.qty} onChange={(e) => setRow(index, { qty: e.target.value })} /></Field>
                <Field label={index === 0 ? c.itemPrice : "\u00A0"}><Input aria-label={`${c.itemPrice} ${index + 1}`} type="number" min={0} step="0.01" className="tnum" value={row.price} onChange={(e) => setRow(index, { price: e.target.value })} /></Field>
                <p className="tnum pb-2 text-end text-[12.5px] font-semibold text-ink">{lineTotal !== null ? formatMoney(lineTotal, currency) : "—"}</p>
                <IconBtn title={c.removeItem} aria-label={`${c.removeItem} ${index + 1}`} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} className="mb-1 hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
                <div className="col-span-5 -mt-1">
                  <Input aria-label={`${c.itemKeywords} ${index + 1}`} value={row.keywords} onChange={(e) => setRow(index, { keywords: e.target.value })} placeholder={c.itemKeywords} className="py-1 text-[11.5px]" />
                </div>
              </div>
            )
          })}
          {itemsInvalid && <p role="alert" className="text-[12.5px] text-serious">{c.itemsError}</p>}
          {!hasItems && <p className="text-[11.5px] text-muted">{c.subtotalHt} · {c.taxAmount} · {c.totalTtc}</p>}
        </div>

        {/* ---- Amount and TVA: TTC is what was paid; HT/TVA is the split ---- */}
        <div className="grid grid-cols-2 gap-4">
          {hasItems ? (
            <Field label={c.totalTtc}>
              <p className="tnum rounded-lg border border-line bg-canvas px-3 py-2 text-[15px] font-bold text-ink">
                {itemsTotal !== null ? formatMoney(itemsTotal, currency) : "—"}
              </p>
            </Field>
          ) : (
            <Field label={c.amount(currency)}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          )}
          <Field label={c.taxRate}><Input type="number" min={0} max={100} step="0.5" className="tnum" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></Field>
        </div>
        {amount && parsedAmount === null && !hasItems && <p role="alert" className="text-sm text-serious">{c.amountError}</p>}
        {!rateValid && taxRate && <p role="alert" className="text-sm text-serious">{c.amountError}</p>}
        {breakdown.subtotalHt !== null && breakdown.taxAmount !== null && (hasItems || parsedAmount !== null) && (
          <p className="tnum -mt-2 text-[12px] text-muted">
            {c.subtotalHt} {formatMoney(breakdown.subtotalHt, currency)} · {c.taxAmount} ({breakdown.taxRate}%) {formatMoney(breakdown.taxAmount, currency)}
          </p>
        )}

        {/* ---- The receipt: a note that it exists, and the photo itself ---- */}
        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium"><Paperclip className="h-4 w-4 text-muted" /> {t.receiptAttached}</span>
          <Toggle checked={receipt} onChange={setReceipt} />
        </label>
        <p className="-mt-2 text-[11px] leading-relaxed text-muted">{t.receiptExplanation}</p>
        <input aria-label={c.attachPhoto} ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = "" }} />
        {photo ? (
          <div className="flex items-center gap-3 rounded-lg border border-line p-2.5">
            <img src={photo} alt={c.viewReceipt} className="h-14 w-14 rounded-md object-cover ring-1 ring-line" />
            <p className="flex-1 text-[12px] text-muted">{c.photoHelp}</p>
            <Btn variant="outline" size="sm" onClick={() => setPhoto(null)}>{c.removePhoto}</Btn>
          </div>
        ) : (
          <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {c.attachPhoto}</Btn>
        )}
        {photoError && <p role="alert" className="text-sm text-serious">{photoError}</p>}

        <div className="flex items-center gap-2 rounded-lg bg-warn-50 px-3 py-2 text-[12px] font-medium text-warn"><Clock className="h-4 w-4" /> {c.pendingReceipt}</div>
        <Btn className="w-full" disabled={!canSave} onClick={() => {
          if (finalAmount === null || !rateValid) return
          try {
            onCreate({
              vendorId: resolveParty(addContact, "supplier", vendorId, partyDraft), category, method, amount: finalAmount, note,
              receipt: receipt || Boolean(photo), status: "pending", date: todayISO(),
              items: hasItems ? lines : undefined,
              taxRate: rate,
              receiptImage: photo,
            })
          } catch (err) { setError(err instanceof Error ? err.message : c.error) }
        }}><ReceiptText className="h-4 w-4" /> {c.save}</Btn>
      </div>
    </Modal>
  )
}
