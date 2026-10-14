import { useMemo, useState } from "react"
import { FileSignature, FileText, Printer, PenLine, Send, Info, Building2, Wrench } from "lucide-react"
import type { Contract, Settings } from "../store/types"
import { useMizan } from "../store/useMizan"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { todayISO } from "../lib/calendarDates"
import { dashboardMoney } from "../lib/dashboardData"
import { contractDate, legalCompany, legalData } from "../lib/legalData"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Select } from "../components/kit"

type ContractType = Contract["type"]
type ContractStatus = Contract["status"]
const TEMPLATE_KEYS: ContractType[] = ["construction", "service", "rental"]
const TYPE_ICON: Record<ContractType, typeof Building2> = {
  construction: Building2,
  service: Wrench,
  rental: FileText,
}
const STATUS_TONE: Record<ContractStatus, "neutral" | "warn" | "good"> = {
  draft: "neutral",
  sent: "warn",
  signed: "good",
}

export default function LegalVault() {
  const { tag, t: copy } = useTranslation()
  const t = copy.legal
  const common = copy.common
  const modules = copy.shared.modules
  const { contracts, contacts, projects, expenses, audit, settings, addContract, setContractStatus } = useMizan()
  const [preview, setPreview] = useState<Contract | null>(null)
  const [creating, setCreating] = useState<ContractType | null>(null)
  const [tracking, setTracking] = useState<{ contract: Contract; status: "sent" | "signed" } | null>(null)
  const view = useMemo(() => legalData({ contracts, contacts, projects, expenses, audit }), [contracts, contacts, projects, expenses, audit])
  const clientName = (id: string) => view.clients.find((client) => client.id === id)?.name ?? t.clientUnknown

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.legal} sub={t.subtitle} />
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />{t.warning}</p>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.draftSection}</p>
        <div className="grid gap-3 sm:grid-cols-3">{TEMPLATE_KEYS.map((key) => {
          const Icon = TYPE_ICON[key]
          const template = t.templates[key]
          return <button key={key} type="button" onClick={() => setCreating(key)} className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><span className="text-[13.5px] font-bold text-ink">{template.title}</span><span className="text-[12px] text-muted">{template.description}</span></button>
        })}</div>
      </div>
      {view.hiddenCount > 0 && <p className="text-[12px] text-muted">{t.hiddenSamples(view.hiddenCount)}</p>}
      {view.invalidCount > 0 && <p role="alert" className="text-[12px] text-warn">{t.invalidRecords(view.invalidCount)}</p>}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.documents(view.contracts.length)}</p>
        {!view.contracts.length && <Card className="border-dashed p-6 text-center"><p className="font-semibold">{t.emptyTitle}</p><p className="mt-1 text-[13px] text-muted">{t.emptyBody}</p></Card>}
        <div className="grid gap-3 lg:grid-cols-2">{view.contracts.map((contract) => {
          const Icon = TYPE_ICON[contract.type]
          return <Card key={contract.id} className="flex flex-wrap items-center gap-4 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy text-white"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[13.5px] font-bold text-ink">{contract.title}</p><Badge tone={STATUS_TONE[contract.status]} dot>{t.status[contract.status]}</Badge></div><p className="mt-0.5 text-[12px] text-muted">{clientName(contract.clientId)} · {contractDate(contract.date, tag, t.missingDate)} · <span className="tnum font-semibold text-ink">{dashboardMoney(contract.value, settings.currency)}</span></p></div>
            <div className="flex flex-wrap gap-1.5">
              {contract.status !== "signed" && <Btn variant="emerald" size="sm" aria-label={t.markSigned(contract.title)} onClick={() => setTracking({ contract, status: "signed" })}><PenLine className="h-4 w-4" />{t.markSignedButton}</Btn>}
              {contract.status === "draft" && <Btn variant="outline" size="sm" aria-label={t.markSent(contract.title)} onClick={() => setTracking({ contract, status: "sent" })}><Send className="h-4 w-4" /></Btn>}
              <Btn variant="ghost" size="sm" aria-label={t.view(contract.title)} onClick={() => setPreview(contract)}><FileText className="h-4 w-4" /></Btn>
            </div>
          </Card>
        })}</div>
      </div>
      {preview && <ContractPreview contract={preview} company={legalCompany(settings)} client={clientName(preview.clientId)} currency={settings.currency} onClose={() => setPreview(null)} />}
      {creating && <CreateContract type={creating} clients={view.clients} currency={settings.currency} onClose={() => setCreating(null)} onCreate={(contract) => { addContract(contract); setCreating(null) }} />}
      {tracking && <Modal title={t.trackingTitle} onClose={() => setTracking(null)}><p className="text-sm leading-relaxed text-muted">{t.trackingNotice}</p><div className="mt-5 flex justify-end gap-2"><Btn variant="outline" onClick={() => setTracking(null)}>{common.cancel}</Btn><Btn onClick={() => { setContractStatus(tracking.contract.id, tracking.status); setTracking(null) }}>{t.confirmStatus}</Btn></div></Modal>}
    </div>
  )
}

function ContractPreview({ contract, company, client, currency, onClose }: { contract: Contract; company: string; client: string; currency: Settings["currency"]; onClose: () => void }) {
  const { tag, t: copy } = useTranslation()
  const t = copy.legal
  const p = t.preview
  return <Modal title={contract.title} onClose={onClose} wide>
    <div className="rounded-xl border border-line bg-canvas p-6 text-[13px] leading-relaxed text-ink print-clean">
      <h3 className="text-lg font-bold">{p.recordedTitle}</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><dt className="text-muted">{p.companySettings}</dt><dd className="font-semibold">{company || p.companyUnknown}</dd></div>
        <div><dt className="text-muted">{p.client}</dt><dd className="font-semibold">{client}</dd></div>
        <div><dt className="text-muted">{p.type}</dt><dd>{t.type[contract.type]}</dd></div>
        <div><dt className="text-muted">{p.date}</dt><dd>{contractDate(contract.date, tag, t.missingDate)}</dd></div>
        <div><dt className="text-muted">{p.amount}</dt><dd className="tnum font-semibold">{dashboardMoney(contract.value, currency)}</dd></div>
        <div><dt className="text-muted">{p.status}</dt><dd>{t.status[contract.status]}</dd></div>
      </dl>
      <div className="mt-6 border-t border-line pt-4"><h4 className="font-bold">{p.contentTitle}</h4><p className="mt-2 text-muted">{p.contentBody}</p></div>
    </div>
    <div className="mt-4 flex justify-end"><Btn variant="dark" onClick={() => window.print()}><Printer className="h-4 w-4" />{p.print}</Btn></div>
  </Modal>
}

function CreateContract({ type, clients, currency, onClose, onCreate }: { type: ContractType; clients: { id: string; name: string }[]; currency: Settings["currency"]; onClose: () => void; onCreate: (contract: Omit<Contract, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.legal
  const common = copy.common
  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const parsed = parseAmount(value)
  return <Modal title={t.type[type]} onClose={onClose}>
    <div className="space-y-4">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-700">{t.create.draftNote}</p>
      {error && <p role="alert" className="text-sm text-serious">{error}</p>}
      <Field label={t.create.title}><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label={t.create.client}><Select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">{t.create.unknownClientOption}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></Field>
      <Field label={t.create.value(currency)} hint={t.create.zeroValueHint}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" className="tnum" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
      {value && parsed === null && <p role="alert" className="text-sm text-serious">{t.create.invalidValue}</p>}
      <Btn className="w-full" disabled={!title.trim() || parsed === null} onClick={() => {
        if (parsed === null) return
        try { onCreate({ type, title, clientId, value: parsed, date: todayISO(), status: "draft" }) } catch (reason) { setError(reason instanceof Error ? reason.message : t.create.error) }
      }}><FileSignature className="h-4 w-4" />{t.create.save}</Btn>
    </div>
  </Modal>
}
