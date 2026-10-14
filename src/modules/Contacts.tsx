import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search, Upload, Download, MessageCircle, Mail, Trash2, Users } from "lucide-react"
import type { Contact } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money, toCSV, parseCSV } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn } from "../components/kit"

const FACETS: ("all" | "client" | "supplier")[] = ["all", "client", "supplier"]
type HistoryKind = "project" | "contract"

export default function Contacts() {
  const { date } = useFormats()
  const { t: copy } = useTranslation()
  const t = copy.contacts
  const common = copy.common
  const modules = copy.shared.modules
  const { auth, contacts, projects, contracts, addContact, removeContact, importContacts } = useMizan()
  const [q, setQ] = useState("")
  const [facet, setFacet] = useState<(typeof FACETS)[number]>("all")
  const [ledger, setLedger] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const importRevision = useRef(0)
  useEffect(() => {
    importRevision.current++
    setImporting(false)
    setImportError(null)
    return () => { importRevision.current++ }
  }, [auth?.id])
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return contacts.filter((c) =>
      (facet === "all" || c.type === facet) &&
      [c.name, c.ice, c.phone, c.email, c.city].some((f) => f.toLowerCase().includes(s)),
    )
  }, [contacts, q, facet])

  function exportCsv() {
    try {
      toCSV(filtered.map((c) => ({
        [t.table.name]: c.name,
        [t.table.type]: c.type,
        [t.table.ice]: c.ice,
        [t.phone]: c.phone,
        [t.email]: c.email,
        [t.table.city]: c.city,
        [t.table.balance]: c.balance,
      })), "fatorati-contacts.csv")
      setExportError(null)
    } catch { setExportError(t.exportError) }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const revision = ++importRevision.current
    const ownerId = auth?.id
    setImportError(null)
    setImporting(true)
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(t.fileTooLarge)
      const text = await file.text()
      if (revision !== importRevision.current || useMizan.getState().auth?.id !== ownerId) return
      const rows = parseCSV(text).slice(1).filter((r) => r[0]?.trim())
      if (rows.length > 10_000) throw new Error(t.tooManyRows(10_000))
      const contacts = rows.map((r) => {
        if (r.length !== 7) throw new Error(t.columnError(t.csvColumns))
        const balance = Number(r[6])
        if (!Number.isFinite(balance)) throw new Error(t.invalidBalance)
        return { name: r[0], type: r[1] === "supplier" ? "supplier" as const : "client" as const, ice: r[2], phone: r[3], email: r[4], city: r[5], balance }
      })
      importContacts(contacts)
    } catch (error) {
      if (revision === importRevision.current && useMizan.getState().auth?.id === ownerId) {
        setImportError(error instanceof Error ? error.message : t.readFailure)
      }
    } finally {
      if (revision === importRevision.current) setImporting(false)
    }
  }

  const historyFor = (id: string) => [
    ...projects.filter((p) => p.clientId === id).map((p) => ({ ts: p.start, label: p.name, amount: p.budget, kind: "project" as const })),
    ...contracts.filter((c) => c.clientId === id).map((c) => ({ ts: c.date, label: c.title, amount: c.value, kind: "contract" as const })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1))

  return (
    <div className="mz-view space-y-5">
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      {importError && <p role="alert" className="text-sm text-serious">{importError}</p>}
      <SectionTitle title={modules.contacts} sub={t.subtitle} action={
        <div className="flex flex-wrap gap-2">
          <input aria-label={t.fileInput} ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
          <Btn variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {importing ? t.importing : t.import}</Btn>
          <Btn variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> {t.export}</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.add}</Btn>
        </div>
      } />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="ps-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {FACETS.map((k) => (
            <button key={k} type="button" aria-pressed={facet === k} onClick={() => setFacet(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${facet === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{t.filters[k]}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} text={t.empty} /> : (
          <Table head={<><Th>{t.table.name}</Th><Th>{t.table.type}</Th><Th>{t.table.ice}</Th><Th>{t.table.contact}</Th><Th>{t.table.city}</Th><Th className="text-end">{t.table.balance}</Th><Th /></>}>
            {filtered.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-canvas/60">
                <Td><button type="button" onClick={() => setLedger(c)} className="font-semibold text-ink hover:text-brand">{c.name}</button></Td>
                <Td><Badge tone={c.type === "client" ? "brand" : "neutral"}>{t.type[c.type]}</Badge></Td>
                <Td className="tnum text-muted">{c.ice}</Td>
                <Td className="text-muted">{c.phone}</Td>
                <Td className="text-muted">{c.city}</Td>
                <Td className={`tnum text-end font-semibold ${c.balance > 0 ? "text-warn" : c.balance < 0 ? "text-serious" : "text-muted"}`}>{money(c.balance)}</Td>
                <Td>
                  <div className="flex justify-end gap-0.5">
                    <IconBtn title={t.whatsapp} onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d]/g, "")}`, "_blank")}><MessageCircle className="h-4 w-4" /></IconBtn>
                    <IconBtn title={t.emailAction} onClick={() => window.open(`mailto:${c.email}`)}><Mail className="h-4 w-4" /></IconBtn>
                    <IconBtn title={common.delete} aria-label={`${t.deleteAria} ${c.name}`} onClick={() => removeContact(c.id)} className="hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {ledger && (
        <Modal title={ledger.name} onClose={() => setLedger(null)} wide>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label={t.table.type} value={t.type[ledger.type]} />
            <Info label={t.table.ice} value={ledger.ice} />
            <Info label={t.phone} value={ledger.phone} />
            <Info label={t.table.balance} value={money(ledger.balance)} accent={ledger.balance > 0} />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.history}</p>
          {historyFor(ledger.id).length === 0 ? <p className="py-6 text-center text-[13px] text-muted">{t.noTransactions}</p> : (
            <Table head={<><Th>{common.date}</Th><Th>{t.table.type}</Th><Th>{common.name}</Th><Th className="text-end">{common.amount}</Th></>}>
              {historyFor(ledger.id).map((h, i) => (
                <tr key={i}><Td className="text-muted">{date(h.ts)}</Td><Td><Badge tone="neutral">{t.historyKind[h.kind as HistoryKind]}</Badge></Td><Td className="font-medium">{h.label}</Td><Td className="tnum text-end font-semibold">{money(h.amount)}</Td></tr>
              ))}
            </Table>
          )}
        </Modal>
      )}

      {creating && <CreateContact onClose={() => setCreating(false)} onCreate={(c) => { addContact(c); setCreating(false) }} />}
    </div>
  )
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg bg-canvas p-3"><p className="text-[11px] text-muted">{label}</p><p className={`tnum mt-0.5 text-[13.5px] font-bold ${accent ? "text-warn" : "text-ink"}`}>{value}</p></div>
}

function CreateContact({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Omit<Contact, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.contacts
  const common = copy.common
  const [f, setF] = useState<Omit<Contact, "id">>({ type: "client", name: "", ice: "", phone: "", email: "", city: "", balance: 0 })
  return (
    <Modal title={t.newContact} onClose={onClose}>
      <div className="space-y-4">
        <Field label={t.table.type}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Contact["type"] })}><option value="client">{t.type.client}</option><option value="supplier">{t.type.supplier}</option></Select></Field>
        <Field label={t.nameOrCompany}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.table.ice}><Input value={f.ice} onChange={(e) => setF({ ...f, ice: e.target.value })} /></Field>
          <Field label={t.table.city}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label={t.phone}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={t.phonePlaceholder} /></Field>
          <Field label={t.email}><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Btn className="w-full" disabled={!f.name.trim()} onClick={() => onCreate(f)}>{common.save}</Btn>
      </div>
    </Modal>
  )
}
