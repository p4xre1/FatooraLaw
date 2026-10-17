import { useEffect, useMemo, useState } from "react"
import { Download, FileText, Plus, Save, Trash2 } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn } from "../components/kit"
import { pendingInvoiceKey, readPendingInvoicePrefill, type OrderInvoicePrefill } from "../lib/invoiceHandoff"
import { roundMoney } from "../lib/expenseCalc"

type Line = { description: string; quantity: number; unitPrice: number; vat: number }
type Invoice = { id?: string; orderId?: string; number: string; date: string; due: string; tp: string; client: string; clientAddress: string; clientIce: string; lines: Line[]; payment: string; color: string; logo: string | null; notes: string; amountPaid: number }
type Template = Pick<Invoice, "lines" | "payment" | "color" | "notes">
type SavedInvoice = Invoice & { id: string; savedAt: string }
const KEY = "fatorati.invoices.v1"
const palette = ["#176b62", "#3157a4", "#8a4f87", "#b45e32", "#263246"]
const newInvoice = (number = `FAC-${new Date().getFullYear()}-001`): Invoice => ({ id: undefined, orderId: undefined, number, date: new Date().toISOString().slice(0, 10), due: "", tp: "", client: "", clientAddress: "", clientIce: "", lines: [{ description: "", quantity: 1, unitPrice: 0, vat: 20 }], payment: "Virement bancaire", color: palette[0], logo: null, notes: "", amountPaid: 0 })
const text = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
const money = (n: number, currency: string) => new Intl.NumberFormat("fr-MA", { style: "currency", currency }).format(n)

function normalizeInvoice<T extends Partial<Invoice>>(invoice: T): T & Invoice {
  const defaults = newInvoice()
  const lines = Array.isArray(invoice.lines)
    ? invoice.lines.map((line) => ({
        description: typeof line.description === "string" ? line.description : "",
        quantity: Number.isFinite(line.quantity) && line.quantity >= 0 ? line.quantity : 1,
        unitPrice: Number.isFinite(line.unitPrice) && line.unitPrice >= 0 ? line.unitPrice : 0,
        vat: Number.isFinite(line.vat) && line.vat >= 0 && line.vat <= 100 ? line.vat : 20,
      }))
    : defaults.lines
  const amountPaid = Number.isFinite(invoice.amountPaid) ? Math.max(0, invoice.amountPaid ?? 0) : 0
  return { ...defaults, ...invoice, lines, amountPaid } as T & Invoice
}

function readInvoiceStore(storageKey: string): { invoice?: Invoice; templates?: { name: string; value: Template }[]; savedInvoices?: SavedInvoice[] } {
  if (typeof window === "undefined") return {}
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as {
      invoice?: Invoice
      templates?: { name: string; value: Template }[]
      savedInvoices?: SavedInvoice[]
    } | null
    if (!stored || typeof stored !== "object") return {}
    return {
      invoice: stored.invoice ? normalizeInvoice(stored.invoice) : undefined,
      templates: Array.isArray(stored.templates) ? stored.templates : [],
      savedInvoices: Array.isArray(stored.savedInvoices) ? stored.savedInvoices.map(normalizeInvoice) : [],
    }
  } catch { return {} }
}

function nextInvoiceNumber(savedInvoices: readonly SavedInvoice[], year: number): string {
  const pattern = new RegExp(`^FAC-${year}-(\\d+)$`)
  const highest = savedInvoices.reduce((max, row) => {
    const match = row.number.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `FAC-${year}-${String(highest + 1).padStart(3, "0")}`
}

function invoiceFromOrder(prefill: OrderInvoicePrefill, savedInvoices: readonly SavedInvoice[], logo: string | null): Invoice {
  const year = Number(prefill.issuedOn.slice(0, 4)) || new Date().getFullYear()
  const vat = prefill.taxRate
  const lines = prefill.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: roundMoney(item.unitPriceTtc / (1 + vat / 100)),
    vat,
  }))
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (1 + line.vat / 100), 0)
  return {
    ...newInvoice(nextInvoiceNumber(savedInvoices, year)),
    orderId: prefill.orderId,
    date: prefill.issuedOn,
    client: prefill.client.name,
    clientAddress: prefill.client.address,
    clientIce: prefill.client.ice,
    lines,
    amountPaid: Math.min(prefill.amountPaid, roundMoney(total)),
    logo,
  }
}

export default function Invoices() {
  const { settings, auth, updateSettings } = useMizan()
  const storageKey = `${KEY}.${auth?.id ?? "local"}`
  const { t } = useTranslation()
  const [pendingPrefill] = useState(() => readPendingInvoicePrefill(auth?.id))
  const [invoice, setInvoice] = useState<Invoice>(() => {
    const stored = readInvoiceStore(storageKey)
    if (pendingPrefill) {
      const saved = stored.savedInvoices?.find((row) => row.orderId === pendingPrefill.orderId)
      return saved ?? invoiceFromOrder(pendingPrefill, stored.savedInvoices ?? [], settings.logo)
    }
    return stored.invoice ?? newInvoice()
  })
  const [templates, setTemplates] = useState<{ name: string; value: Template }[]>(() => readInvoiceStore(storageKey).templates ?? [])
  const [templateName, setTemplateName] = useState("")
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(() => readInvoiceStore(storageKey).savedInvoices ?? [])
  const [screen, setScreen] = useState<"home" | "editor">(pendingPrefill ? "editor" : "home")
  const [legalOpen, setLegalOpen] = useState(false)
  useEffect(() => {
    if (!pendingPrefill) return
    try { localStorage.removeItem(pendingInvoiceKey(auth?.id)) } catch { /* Browser storage may be unavailable. */ }
  }, [pendingPrefill, auth?.id])
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ invoice, templates, savedInvoices })) } catch { /* Browser storage may be unavailable. */ } }, [invoice, templates, savedInvoices, storageKey])
  const subtotal = useMemo(() => roundMoney(invoice.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)), [invoice.lines])
  const vat = useMemo(() => roundMoney(invoice.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (Number(l.vat) || 0) / 100, 0)), [invoice.lines])
  const total = roundMoney(subtotal + vat)
  const remaining = roundMoney(Math.max(0, total - (Number(invoice.amountPaid) || 0)))
  const vatRates = [...new Set([0, 10, 14, 20, settings.taxRate])].sort((a, b) => a - b)
  const set = <K extends keyof Invoice>(key: K, value: Invoice[K]) => setInvoice(v => ({ ...v, [key]: value }))
  const updateLine = (i: number, patch: Partial<Line>) => set("lines", invoice.lines.map((line, n) => n === i ? { ...line, ...patch } : line))
  const saveTemplate = () => { if (!templateName.trim()) return; setTemplates(v => [...v, { name: templateName.trim(), value: { lines: invoice.lines, payment: invoice.payment, color: invoice.color, notes: invoice.notes } }]); setTemplateName("") }
  const uploadLogo = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { const logo = String(reader.result); updateSettings({ logo }); set("logo", logo) }; reader.readAsDataURL(file) }
  const startNew = (template?: Template) => {
    const draft = newInvoice(nextInvoiceNumber(savedInvoices, new Date().getFullYear()))
    setInvoice({ ...draft, logo: settings.logo, lines: [{ ...draft.lines[0], vat: settings.taxRate }], ...(template ?? {}) })
    setScreen("editor")
  }
  const saveInvoice = () => {
    const record: SavedInvoice = {
      ...invoice,
      id: invoice.id ?? savedInvoices.find((row) => row.number === invoice.number)?.id ?? crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    }
    setInvoice(record)
    setSavedInvoices((list) => [record, ...list.filter((row) => row.id !== record.id)])
    setScreen("home")
  }
  const editInvoice = (record: SavedInvoice) => { setInvoice({ ...record, amountPaid: record.amountPaid ?? 0 }); setScreen("editor") }
  return <div className="mz-view space-y-5">
    {screen === "home" ? <>
      <SectionTitle title={t.shared.modules.invoices} sub="Vos factures, modèles et informations d’entreprise au même endroit." action={<Btn onClick={() => startNew()}><Plus className="h-4 w-4"/> Créer une facture</Btn>} />
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-16 w-24 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-canvas">{settings.logo ? <img src={settings.logo} alt="Logo de l’entreprise" className="max-h-full max-w-full object-contain"/> : <FileText className="h-6 w-6 text-muted"/>}</div>
        <div className="min-w-48 flex-1"><h2 className="font-bold">Logo de l’entreprise</h2><p className="text-xs text-muted">Ajoutez-le ici une fois : il sera repris sur vos prochaines factures.</p></div>
        <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">{settings.logo ? "Changer le logo" : "Importer le logo"}<input type="file" accept="image/*" className="sr-only" onChange={e => uploadLogo(e.target.files?.[0])}/></label>
        {settings.logo && <Btn variant="ghost" onClick={() => updateSettings({ logo: null })}>Retirer</Btn>}
      </Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold">Modèles de facture</h2><p className="text-xs text-muted">Réutilisez une mise en page, des lignes types et vos conditions.</p></div><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{templates.length}</span></div>
        {templates.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{templates.map((item,i)=><div key={`${item.name}-${i}`} className="flex items-center justify-between rounded-xl border border-line p-4"><button className="flex-1 text-left" onClick={()=>startNew(item.value)}><span className="block font-semibold">{item.name}</span><span className="text-xs text-muted">Cliquer pour utiliser ce modèle</span></button><button aria-label={`Supprimer ${item.name}`} onClick={()=>setTemplates(v=>v.filter((_,n)=>n!==i))}><Trash2 className="h-4 w-4 text-muted"/></button></div>)}</div> : <p className="rounded-lg bg-canvas p-4 text-sm text-muted">Aucun modèle enregistré. Après avoir créé votre première facture, choisissez « Enregistrer comme modèle ».</p>}
      </Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold">Factures récentes</h2><p className="text-xs text-muted">Les factures que vous avez enregistrées sur cet appareil.</p></div><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{savedInvoices.length}</span></div>
        {savedInvoices.length ? <div className="divide-y divide-line">{savedInvoices.map(row=><div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{row.number} · {row.client || "Client sans nom"}</p><p className="text-xs text-muted">{row.date} · {money(row.lines.reduce((sum,l)=>sum+l.quantity*l.unitPrice*(1+l.vat/100),0), settings.currency)}</p></div><Btn size="sm" variant="outline" onClick={()=>editInvoice(row)}>Ouvrir</Btn><button aria-label={`Supprimer ${row.number}`} onClick={()=>setSavedInvoices(v=>v.filter(x=>x.id!==row.id))}><Trash2 className="h-4 w-4 text-muted"/></button></div>)}</div> : <p className="rounded-lg bg-canvas p-4 text-sm text-muted">Aucune facture enregistrée pour le moment. Cliquez sur « Créer une facture » pour commencer.</p>}
      </Card>
    </> : <>
      <SectionTitle title="Créer une facture" sub="Modifiez les détails : l’aperçu se met à jour automatiquement." action={<span className="flex gap-2"><Btn variant="outline" onClick={()=>setScreen("home")}>← Factures</Btn><Btn onClick={saveInvoice}><Save className="h-4 w-4"/> Enregistrer la facture</Btn></span>} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.9fr)]">
      <Card className="space-y-5 p-5 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="N° de facture"><input className={text} value={invoice.number} onChange={e=>set("number",e.target.value)}/></Field><Field label="Date d’émission"><input type="date" className={text} value={invoice.date} onChange={e=>set("date",e.target.value)}/></Field><Field label="Échéance (facultative)"><input type="date" className={text} value={invoice.due} onChange={e=>set("due",e.target.value)}/></Field><Field label="Mode de paiement"><input className={text} value={invoice.payment} onChange={e=>set("payment",e.target.value)}/></Field><Field label="Montant déjà encaissé"><input aria-label="Montant déjà encaissé" type="number" min="0" step="0.01" className={text} value={invoice.amountPaid ?? 0} onChange={e=>set("amountPaid",Math.max(0,Number(e.target.value)||0))}/></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="N° Taxe professionnelle (TP)"><input className={text} value={invoice.tp} onChange={e=>set("tp",e.target.value)}/></Field><Field label="Client / raison sociale"><input className={text} value={invoice.client} onChange={e=>set("client",e.target.value)}/></Field><Field label="Adresse du client"><input className={text} value={invoice.clientAddress} onChange={e=>set("clientAddress",e.target.value)}/></Field><Field label="ICE du client"><input className={text} value={invoice.clientIce} onChange={e=>set("clientIce",e.target.value)}/></Field></div>
        <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Articles & services</h3><Btn size="sm" variant="outline" onClick={()=>set("lines",[...invoice.lines,{description:"",quantity:1,unitPrice:0,vat:settings.taxRate}])}><Plus className="h-3.5 w-3.5"/> Ajouter une ligne</Btn></div><div className="space-y-2">{invoice.lines.map((l,i)=><div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_90px_34px]"><input aria-label="Description" className={text} placeholder="Description détaillée" value={l.description} onChange={e=>updateLine(i,{description:e.target.value})}/><input aria-label="Quantité" type="number" min="0" className={text} value={l.quantity} onChange={e=>updateLine(i,{quantity:Number(e.target.value)})}/><input aria-label="Prix unitaire HT" type="number" min="0" className={text} value={l.unitPrice} onChange={e=>updateLine(i,{unitPrice:Number(e.target.value)})}/><select aria-label="TVA" className={text} value={l.vat} onChange={e=>updateLine(i,{vat:Number(e.target.value)})}>{vatRates.map(rate=><option key={rate} value={rate}>TVA {rate}%</option>)}</select><button className="text-muted hover:text-red-600" aria-label="Supprimer la ligne" onClick={()=>set("lines",invoice.lines.filter((_,n)=>n!==i))}><Trash2 className="h-4 w-4"/></button></div>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-3"><div className="grid h-12 w-16 place-items-center overflow-hidden rounded border border-line">{invoice.logo ? <img src={invoice.logo} alt="Logo de l’entreprise" className="max-h-full max-w-full object-contain"/> : <span className="text-xs text-muted">Logo</span>}</div><Field label="Logo sur cette facture"><input type="file" accept="image/*" className="block w-full text-xs" onChange={e=>uploadLogo(e.target.files?.[0])}/></Field></div><Field label="Note / conditions de paiement"><input className={text} value={invoice.notes} onChange={e=>set("notes",e.target.value)}/></Field></div>
        <div><p className="mb-2 text-xs font-semibold">Couleur de la facture</p><div className="flex gap-2">{palette.map(color=><button key={color} aria-label={`Couleur ${color}`} onClick={()=>set("color",color)} className={`h-8 w-8 rounded-full ring-offset-2 ${invoice.color===color?"ring-2 ring-brand":""}`} style={{backgroundColor:color}}/>)}</div></div>
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4"><input className={`${text} max-w-56`} placeholder="Nom du modèle" value={templateName} onChange={e=>setTemplateName(e.target.value)}/><Btn variant="outline" onClick={saveTemplate}><Save className="h-4 w-4"/> Enregistrer comme modèle</Btn></div>
        <div className="flex flex-wrap gap-2"><Btn onClick={()=>window.print()}><Download className="h-4 w-4"/> Exporter en PDF</Btn><Btn variant="outline" onClick={()=>setLegalOpen(v=>!v)}><FileText className="h-4 w-4"/> Mentions & repères Maroc</Btn></div>
        {legalOpen&&<div className="rounded-xl bg-canvas p-4 text-xs leading-5 text-muted"><b className="text-ink">Repères à vérifier avant émission</b><p>Le CGI marocain (édition 2026), notamment l’article 145, prévoit des mentions d’identification et de transaction : identité et adresse du fournisseur, IF, numéro de taxe professionnelle, ICE, identification du client (dont ICE selon le cas), date, désignation/quantité/prix, TVA séparée ou mention du régime applicable, ainsi que références et mode de paiement. Le numéro doit suivre une série de facturation cohérente. Les obligations varient selon le régime et l’opération : confirmez les mentions et le traitement TVA avec votre comptable ou la DGI. Cet outil ne certifie pas la conformité fiscale. Source officielle : <a className="underline" target="_blank" rel="noreferrer" href="https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES&CACHEID=ROOTWORKSPACE-08712531-1e81-4e28-a38b-2bd9edf8e09e-pM5DEs1">CGI 2026 – DGI</a>.</p></div>}
      </Card>
      <div className="invoice-paper overflow-hidden rounded-xl border border-line bg-white shadow-sm" id="invoice-preview"><div className="h-2" style={{background:invoice.color}}/><div className="space-y-7 p-7 sm:p-10"><header className="flex justify-between gap-4"><div>{invoice.logo&&<img src={invoice.logo} alt="Logo" className="mb-3 max-h-16 max-w-40 object-contain"/>}<h2 className="text-lg font-bold">{settings.company||"Votre entreprise"}</h2><p className="whitespace-pre-line text-xs leading-5 text-muted">{settings.address}{settings.city?`, ${settings.city}`:""}<br/>{settings.ice&&`ICE : ${settings.ice}`}<br/>{settings.taxId&&`IF : ${settings.taxId}`}<br/>{settings.rc&&`RC : ${settings.rc}`}<br/>{invoice.tp&&`TP : ${invoice.tp}`}</p></div><div className="text-end"><h1 className="text-3xl font-extrabold tracking-tight" style={{color:invoice.color}}>FACTURE</h1><p className="mt-2 text-sm font-semibold">{invoice.number||"—"}</p><p className="text-xs text-muted">Émise le {invoice.date||"—"}{invoice.due&&<><br/>Échéance : {invoice.due}</>}</p></div></header><section className="rounded-lg bg-slate-50 p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Facturé à</p><p className="font-bold">{invoice.client||"Nom du client"}</p><p className="whitespace-pre-line text-xs text-muted">{invoice.clientAddress}{invoice.clientIce&&<><br/>ICE : {invoice.clientIce}</>}</p></section><table className="w-full text-left text-xs"><thead><tr style={{color:invoice.color}} className="border-b border-line"><th className="py-2">Désignation</th><th className="py-2 text-end">Qté</th><th className="py-2 text-end">P.U. HT</th><th className="py-2 text-end">TVA</th><th className="py-2 text-end">Total HT</th></tr></thead><tbody>{invoice.lines.map((l,i)=><tr key={i} className="border-b border-line"><td className="py-3">{l.description||"—"}</td><td className="py-3 text-end">{l.quantity}</td><td className="py-3 text-end">{money(l.unitPrice,settings.currency)}</td><td className="py-3 text-end">{l.vat}%</td><td className="py-3 text-end font-semibold">{money(l.quantity*l.unitPrice,settings.currency)}</td></tr>)}</tbody></table><div className="ml-auto max-w-64 space-y-2 text-xs"><div className="flex justify-between"><span>Sous-total HT</span><b>{money(subtotal,settings.currency)}</b></div><div className="flex justify-between"><span>TVA</span><b>{money(vat,settings.currency)}</b></div><div className="flex justify-between border-t-2 pt-3 text-base" style={{borderColor:invoice.color}}><span>Total TTC</span><b style={{color:invoice.color}}>{money(total,settings.currency)}</b></div><div className="flex justify-between"><span>Déjà encaissé</span><b>{money(invoice.amountPaid ?? 0,settings.currency)}</b></div><div className="flex justify-between font-semibold"><span>Reste dû</span><b>{money(remaining,settings.currency)}</b></div></div><footer className="border-t border-line pt-4 text-xs text-muted"><p><b>Mode de paiement :</b> {invoice.payment}</p>{invoice.notes&&<p className="mt-2">{invoice.notes}</p>}{settings.footerNote&&<p className="mt-2">{settings.footerNote}</p>}</footer></div></div>
    </div>
    </>}
  </div>
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block space-y-1.5"><span className="text-xs font-semibold text-muted">{label}</span>{children}</label> }
