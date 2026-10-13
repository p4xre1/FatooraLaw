import { useMemo, useState } from "react"
import { FileSignature, FileText, Printer, PenLine, Send, Info, Building2, Wrench } from "lucide-react"
import type { Contract, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { todayISO } from "../lib/calendarDates"
import { dashboardMoney } from "../lib/dashboardData"
import { contractDate, legalCompany, legalData } from "../lib/legalData"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Select } from "../components/kit"

const typeMeta = {
  construction: { label: "Marché de travaux", icon: Building2 },
  service: { label: "Contrat de service", icon: Wrench },
  rental: { label: "Contrat de location", icon: FileText },
}
const statusMeta = {
  draft: { label: "Brouillon", tone: "neutral" as const },
  sent: { label: "Envoyé (suivi manuel)", tone: "warn" as const },
  signed: { label: "Signé (suivi manuel)", tone: "good" as const },
}
const TEMPLATES = [
  { key: "construction" as const, title: "Marché de travaux (BTP)", desc: "Créer une fiche de contrat de travaux", icon: Building2 },
  { key: "service" as const, title: "Contrat de prestation", desc: "Créer une fiche de prestation de services", icon: Wrench },
  { key: "rental" as const, title: "Location de matériel", desc: "Créer une fiche de location", icon: FileText },
]

export default function LegalVault() {
  const { contracts, contacts, projects, expenses, audit, settings, addContract, setContractStatus } = useMizan()
  const [preview, setPreview] = useState<Contract | null>(null)
  const [creating, setCreating] = useState<Contract["type"] | null>(null)
  const [tracking, setTracking] = useState<{ contract: Contract; status: "sent" | "signed" } | null>(null)
  const view = useMemo(() => legalData({ contracts, contacts, projects, expenses, audit }), [contracts, contacts, projects, expenses, audit])
  const clientName = (id: string) => view.clients.find((client) => client.id === id)?.name ?? "Client non renseigné"

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Coffre juridique & contrats" sub="Fiches de documents enregistrées · brouillons à compléter" />
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />Les structures ci-dessous ne sont pas des contrats certifiés. Aucun contenu juridique complet, envoi par e-mail ou signature électronique n'est fourni.</p>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Créer un brouillon · ce ne sont pas des documents enregistrés</p>
        <div className="grid gap-3 sm:grid-cols-3">{TEMPLATES.map((template) => <button key={template.key} onClick={() => setCreating(template.key)} className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><template.icon className="h-5 w-5" /></span><span className="text-[13.5px] font-bold text-ink">{template.title}</span><span className="text-[12px] text-muted">{template.desc}</span></button>)}</div>
      </div>
      {view.hiddenCount > 0 && <p className="text-[12px] text-muted">{view.hiddenCount} exemple(s) préchargé(s) exclu(s) de cette vue. Les données enregistrées sont conservées dans vos sauvegardes.</p>}
      {view.invalidCount > 0 && <p role="alert" className="text-[12px] text-warn">{view.invalidCount} fiche(s) invalide(s) non affichée(s). Vérifiez les dates, montants et types de documents.</p>}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Documents ({view.contracts.length})</p>
        {!view.contracts.length && <Card className="border-dashed p-6 text-center"><p className="font-semibold">Aucun document enregistré.</p><p className="mt-1 text-[13px] text-muted">Créez une fiche avec vos propres informations. Aucun contrat d'exemple n'est ajouté automatiquement.</p></Card>}
        <div className="grid gap-3 lg:grid-cols-2">{view.contracts.map((contract) => {
          const Icon = typeMeta[contract.type].icon
          return <Card key={contract.id} className="flex flex-wrap items-center gap-4 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy text-white"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13.5px] font-bold text-ink">{contract.title}</p><Badge tone={statusMeta[contract.status].tone} dot>{statusMeta[contract.status].label}</Badge></div><p className="mt-0.5 text-[12px] text-muted">{clientName(contract.clientId)} · {contractDate(contract.date)} · <span className="tnum font-semibold text-ink">{dashboardMoney(contract.value, settings.currency)}</span></p></div>
            <div className="flex flex-wrap gap-1.5">
              {contract.status !== "signed" && <Btn variant="emerald" size="sm" aria-label={`Marquer ${contract.title} comme signé`} onClick={() => setTracking({ contract, status: "signed" })}><PenLine className="h-4 w-4" />Marquer comme signé</Btn>}
              {contract.status === "draft" && <Btn variant="outline" size="sm" aria-label={`Marquer ${contract.title} comme envoyé`} onClick={() => setTracking({ contract, status: "sent" })}><Send className="h-4 w-4" /></Btn>}
              <Btn variant="ghost" size="sm" aria-label={`Voir ${contract.title}`} onClick={() => setPreview(contract)}><FileText className="h-4 w-4" /></Btn>
            </div>
          </Card>
        })}</div>
      </div>
      {preview && <ContractPreview contract={preview} company={legalCompany(settings)} client={clientName(preview.clientId)} currency={settings.currency} onClose={() => setPreview(null)} />}
      {creating && <CreateContract type={creating} clients={view.clients} currency={settings.currency} onClose={() => setCreating(null)} onCreate={(contract) => { addContract(contract); setCreating(null) }} />}
      {tracking && <Modal title="Confirmer un statut de suivi" onClose={() => setTracking(null)}><p className="text-sm leading-relaxed text-muted">Cette action change uniquement le statut enregistré. Elle ne crée aucune signature électronique et n'envoie aucun e-mail. Confirmez seulement si vous avez effectué cette démarche en dehors de l'application.</p><div className="mt-5 flex justify-end gap-2"><Btn variant="outline" onClick={() => setTracking(null)}>Annuler</Btn><Btn onClick={() => { setContractStatus(tracking.contract.id, tracking.status); setTracking(null) }}>Confirmer le statut</Btn></div></Modal>}
    </div>
  )
}

function ContractPreview({ contract, company, client, currency, onClose }: { contract: Contract; company: string; client: string; currency: Settings["currency"]; onClose: () => void }) {
  return <Modal title={contract.title} onClose={onClose} wide>
    <div className="rounded-xl border border-line bg-canvas p-6 text-[13px] leading-relaxed text-ink print-clean">
      <h3 className="text-lg font-bold">Fiche du document enregistré</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><dt className="text-muted">Entreprise (paramètres)</dt><dd className="font-semibold">{company || "Entreprise non renseignée"}</dd></div>
        <div><dt className="text-muted">Client</dt><dd className="font-semibold">{client}</dd></div>
        <div><dt className="text-muted">Type</dt><dd>{typeMeta[contract.type].label}</dd></div>
        <div><dt className="text-muted">Date enregistrée</dt><dd>{contractDate(contract.date)}</dd></div>
        <div><dt className="text-muted">Montant saisi (base HT/TTC non précisée)</dt><dd className="tnum font-semibold">{dashboardMoney(contract.value, currency)}</dd></div>
        <div><dt className="text-muted">Statut déclaré manuellement</dt><dd>{statusMeta[contract.status].label}</dd></div>
      </dl>
      <div className="mt-6 border-t border-line pt-4"><h4 className="font-bold">Contenu du contrat non enregistré</h4><p className="mt-2 text-muted">Seuls les champs de cette fiche sont stockés. Le texte du contrat, les clauses négociées, la juridiction et les preuves de signature ne sont pas enregistrés ici. Cette fiche ne remplace pas votre document ni une validation juridique.</p></div>
    </div>
    <div className="mt-4 flex justify-end"><Btn variant="dark" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimer la fiche / PDF</Btn></div>
  </Modal>
}

function CreateContract({ type, clients, currency, onClose, onCreate }: { type: Contract["type"]; clients: { id: string; name: string }[]; currency: Settings["currency"]; onClose: () => void; onCreate: (contract: Omit<Contract, "id">) => void }) {
  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const parsed = parseAmount(value)
  return <Modal title={typeMeta[type].label} onClose={onClose}>
    <div className="space-y-4">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-700">Enregistrez vos informations. Aucun texte de contrat certifié n'est généré.</p>
      {error && <p role="alert" className="text-sm text-serious">{error}</p>}
      <Field label="Intitulé du contrat"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Client"><Select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Client non renseigné</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></Field>
      <Field label={`Valeur (${currency})`} hint="Indiquez 0 pour un document sans montant"><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
      {value && parsed === null && <p role="alert" className="text-sm text-serious">Indiquez une valeur positive ou nulle dans la limite autorisée.</p>}
      <Btn className="w-full" disabled={!title.trim() || parsed === null} onClick={() => {
        if (parsed === null) return
        try { onCreate({ type, title, clientId, value: parsed, date: todayISO(), status: "draft" }) } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer le brouillon.") }
      }}><FileSignature className="h-4 w-4" />Enregistrer le brouillon</Btn>
    </div>
  </Modal>
}
