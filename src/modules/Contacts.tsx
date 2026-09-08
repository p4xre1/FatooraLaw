import { useMemo, useRef, useState } from "react"
import { Plus, Search, Upload, Download, MessageCircle, Mail, Trash2, Users } from "lucide-react"
import type { Contact } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money, fmtDate, toCSV, parseCSV } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn } from "../components/kit"

export default function Contacts() {
  const { contacts, projects, contracts, addContact, removeContact, importContacts } = useMizan()
  const [q, setQ] = useState("")
  const [facet, setFacet] = useState<"all" | "client" | "supplier">("all")
  const [ledger, setLedger] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return contacts.filter((c) =>
      (facet === "all" || c.type === facet) &&
      [c.name, c.ice, c.phone, c.email, c.city].some((f) => f.toLowerCase().includes(s)),
    )
  }, [contacts, q, facet])

  function exportCsv() {
    toCSV(filtered.map((c) => ({ Nom: c.name, Type: c.type, ICE: c.ice, Téléphone: c.phone, Email: c.email, Ville: c.city, Solde: c.balance })), "fatorti-contacts.csv")
  }
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((txt) => {
      const rows = parseCSV(txt).slice(1).filter((r) => r[0])
      importContacts(rows.map((r) => ({ name: r[0] ?? "", type: (r[1] === "supplier" ? "supplier" : "client"), ice: r[2] ?? "—", phone: r[3] ?? "", email: r[4] ?? "", city: r[5] ?? "", balance: Number(r[6]) || 0 })))
    })
    e.target.value = ""
  }

  const historyFor = (id: string) => [
    ...projects.filter((p) => p.clientId === id).map((p) => ({ ts: p.start, label: p.name, amount: p.budget, kind: "Projet" })),
    ...contracts.filter((c) => c.clientId === id).map((c) => ({ ts: c.date, label: c.title, amount: c.value, kind: "Contrat" })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1))

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Clients & Fournisseurs" sub="CRM & grand livre des tiers" action={
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
          <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Importer CSV</Btn>
          <Btn variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Exporter</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Ajouter</Btn>
        </div>
      } />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher nom, ICE, ville…" className="pl-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {([["all", "Tous"], ["client", "Clients"], ["supplier", "Fournisseurs"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFacet(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${facet === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} text="Aucun contact." /> : (
          <Table head={<><Th>Nom</Th><Th>Type</Th><Th>ICE</Th><Th>Contact</Th><Th>Ville</Th><Th className="text-end">Solde</Th><Th /></>}>
            {filtered.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-canvas/60">
                <Td><button onClick={() => setLedger(c)} className="font-semibold text-ink hover:text-brand">{c.name}</button></Td>
                <Td><Badge tone={c.type === "client" ? "brand" : "neutral"}>{c.type === "client" ? "Client" : "Fournisseur"}</Badge></Td>
                <Td className="tnum text-muted">{c.ice}</Td>
                <Td className="text-muted">{c.phone}</Td>
                <Td className="text-muted">{c.city}</Td>
                <Td className={`tnum text-end font-semibold ${c.balance > 0 ? "text-warn" : c.balance < 0 ? "text-serious" : "text-muted"}`}>{money(c.balance)}</Td>
                <Td>
                  <div className="flex justify-end gap-0.5">
                    <IconBtn title="WhatsApp" onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d]/g, "")}`, "_blank")}><MessageCircle className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Email" onClick={() => window.open(`mailto:${c.email}`)}><Mail className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Supprimer" onClick={() => removeContact(c.id)} className="hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
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
            <Info label="Type" value={ledger.type === "client" ? "Client" : "Fournisseur"} />
            <Info label="ICE" value={ledger.ice} />
            <Info label="Téléphone" value={ledger.phone} />
            <Info label="Solde" value={money(ledger.balance)} accent={ledger.balance > 0} />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Historique financier</p>
          {historyFor(ledger.id).length === 0 ? <p className="py-6 text-center text-[13px] text-muted">Aucune transaction.</p> : (
            <Table head={<><Th>Date</Th><Th>Type</Th><Th>Libellé</Th><Th className="text-end">Montant</Th></>}>
              {historyFor(ledger.id).map((h, i) => (
                <tr key={i}><Td className="text-muted">{fmtDate(h.ts)}</Td><Td><Badge tone="neutral">{h.kind}</Badge></Td><Td className="font-medium">{h.label}</Td><Td className="tnum text-end font-semibold">{money(h.amount)}</Td></tr>
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
  const [f, setF] = useState<Omit<Contact, "id">>({ type: "client", name: "", ice: "", phone: "", email: "", city: "", balance: 0 })
  return (
    <Modal title="Nouveau contact" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Contact["type"] })}><option value="client">Client</option><option value="supplier">Fournisseur</option></Select></Field>
        <Field label="Nom / Raison sociale"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ICE"><Input value={f.ice} onChange={(e) => setF({ ...f, ice: e.target.value })} /></Field>
          <Field label="Ville"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+212 6…" /></Field>
          <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Btn className="w-full" disabled={!f.name.trim()} onClick={() => onCreate(f)}>Enregistrer</Btn>
      </div>
    </Modal>
  )
}
