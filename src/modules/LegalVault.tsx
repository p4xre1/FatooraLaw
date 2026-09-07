import { useState } from "react"
import { FileSignature, FileText, Printer, PenLine, Send, ShieldCheck, Scale, Building2, Wrench } from "lucide-react"
import type { Contract } from "../store/types"
import { useMizan } from "../store/useMizan"
import { money, fmtDate } from "../lib/mizan"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Select } from "../components/kit"

const typeMeta = {
  construction: { label: "Marché de travaux", icon: Building2 },
  service: { label: "Contrat de service", icon: Wrench },
  rental: { label: "Contrat de location", icon: FileText },
}
const statusMeta = {
  draft: { label: "Brouillon", tone: "neutral" as const },
  sent: { label: "Envoyé", tone: "warn" as const },
  signed: { label: "Signé", tone: "good" as const },
}

const TEMPLATES = [
  { key: "construction" as const, title: "Marché de travaux (BTP)", desc: "Contrat d'entreprise — art. 723 DOC", icon: Building2 },
  { key: "service" as const, title: "Contrat de prestation", desc: "Louage d'ouvrage & de services", icon: Wrench },
  { key: "rental" as const, title: "Location de matériel", desc: "Bail de matériel & engins", icon: FileText },
]

export default function LegalVault() {
  const { contracts, contacts, settings, addContract, setContractStatus } = useMizan()
  const [preview, setPreview] = useState<Contract | null>(null)
  const [creating, setCreating] = useState<Contract["type"] | null>(null)
  const clients = contacts.filter((c) => c.type === "client")
  const clientName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—"

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Coffre juridique & contrats" sub="Génération de documents conformes au droit marocain" action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-good-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-inset ring-good/20"><ShieldCheck className="h-4 w-4" /> Conforme Loi 09-08 · DOC</span>
      } />

      {/* Template library */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Bibliothèque de modèles</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => setCreating(t.key)} className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><t.icon className="h-5 w-5" /></span>
              <span className="text-[13.5px] font-bold text-ink">{t.title}</span>
              <span className="text-[12px] text-muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contracts */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Documents ({contracts.length})</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {contracts.map((c) => {
            const T = typeMeta[c.type].icon
            return (
              <Card key={c.id} className="flex items-center gap-4 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy text-white"><T className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="truncate text-[13.5px] font-bold text-ink">{c.title}</p><Badge tone={statusMeta[c.status].tone} dot>{statusMeta[c.status].label}</Badge></div>
                  <p className="mt-0.5 text-[12px] text-muted">{clientName(c.clientId)} · {fmtDate(c.date)} · <span className="tnum font-semibold text-ink">{money(c.value, settings.currency)}</span></p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {c.status !== "signed" && <Btn variant="emerald" size="sm" onClick={() => setContractStatus(c.id, "signed")}><PenLine className="h-4 w-4" /> Signer</Btn>}
                  {c.status === "draft" && <Btn variant="outline" size="sm" onClick={() => setContractStatus(c.id, "sent")}><Send className="h-4 w-4" /></Btn>}
                  <Btn variant="ghost" size="sm" onClick={() => setPreview(c)}><FileText className="h-4 w-4" /></Btn>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {preview && <ContractPreview c={preview} company={settings.company} clientName={clientName(preview.clientId)} currency={settings.currency} onClose={() => setPreview(null)} />}
      {creating && <CreateContract type={creating} clients={clients} onClose={() => setCreating(null)} onCreate={(c) => { addContract(c); setCreating(null) }} />}
    </div>
  )
}

function ContractPreview({ c, company, clientName, currency, onClose }: { c: Contract; company: string; clientName: string; currency: "MAD" | "EUR" | "USD"; onClose: () => void }) {
  return (
    <Modal title={c.title} onClose={onClose} wide>
      <div className="rounded-xl border border-line bg-canvas p-6 text-[13px] leading-relaxed text-ink print-clean">
        <div className="mb-4 flex items-center justify-between border-b border-line-strong pb-3">
          <div><p className="text-[15px] font-bold">{company}</p><p className="text-[11px] text-muted">{typeMeta[c.type].label}</p></div>
          <Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>
        </div>
        <h3 className="mb-2 text-center text-[15px] font-bold uppercase tracking-wide">{c.title}</h3>
        <p className="mb-3 text-muted">Entre les soussignés, <strong className="text-ink">{company}</strong> (« le Prestataire ») et <strong className="text-ink">{clientName}</strong> (« le Client »), il a été convenu ce qui suit, conformément au Dahir des Obligations et Contrats (DOC).</p>
        <p className="mb-1.5"><strong>Article 1 — Objet.</strong> Le présent contrat a pour objet la réalisation des prestations décrites ci-dessus.</p>
        <p className="mb-1.5"><strong>Article 2 — Montant.</strong> La valeur du marché est fixée à <span className="tnum font-semibold">{money(c.value, currency)}</span> hors taxes, payable selon l'échéancier convenu.</p>
        <p className="mb-1.5"><strong>Article 3 — Données personnelles.</strong> Les données collectées sont traitées conformément à la Loi 09-08 relative à la protection des personnes physiques.</p>
        <p className="mb-4"><strong>Article 4 — Litiges.</strong> Tout différend relève de la compétence des tribunaux de Casablanca.</p>
        <div className="mt-6 grid grid-cols-2 gap-6 text-[12px]">
          <div className="border-t border-line-strong pt-2"><p className="font-semibold">Le Prestataire</p><p className="text-muted">Fait à Casablanca, le {fmtDate(c.date)}</p></div>
          <div className="border-t border-line-strong pt-2"><p className="font-semibold">Le Client</p><p className="text-muted">Signature précédée de « Lu et approuvé »</p></div>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Btn variant="dark" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer / PDF</Btn></div>
    </Modal>
  )
}

function CreateContract({ type, clients, onClose, onCreate }: { type: Contract["type"]; clients: { id: string; name: string }[]; onClose: () => void; onCreate: (c: Omit<Contract, "id">) => void }) {
  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [value, setValue] = useState("")
  return (
    <Modal title={`Nouveau — ${typeMeta[type].label}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-[12px] font-medium text-brand-700"><Scale className="h-4 w-4" /> Modèle conforme au DOC & à la Loi 09-08.</div>
        <Field label="Intitulé du contrat"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Marché travaux — …" /></Field>
        <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Valeur (MAD)"><Input type="number" className="tnum" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        <Btn className="w-full" disabled={!title.trim() || !clientId} onClick={() => onCreate({ type, title, clientId, value: Number(value) || 0, date: new Date().toISOString().slice(0, 10), status: "draft" })}>
          <FileSignature className="h-4 w-4" /> Générer le brouillon
        </Btn>
      </div>
    </Modal>
  )
}
