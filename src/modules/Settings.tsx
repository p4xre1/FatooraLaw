import { useRef, useState } from "react"
import { Save, Upload, Building2, Percent, FileText, ShieldCheck, Check } from "lucide-react"
import type { Settings as SettingsT } from "../store/types"
import { useMizan } from "../store/useMizan"
import { Card, SectionTitle, Btn, Field, Input, Textarea, Select } from "../components/kit"

export default function Settings() {
  const { settings, updateSettings } = useMizan()
  const [f, setF] = useState<SettingsT>(settings)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof SettingsT>(k: K, v: SettingsT[K]) => setF((p) => ({ ...p, [k]: v }))

  function save() {
    updateSettings(f)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set("logo", reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Paramètres & profil" sub="Configuration de l'entité, fiscalité & documents" action={
        <Btn variant={saved ? "emerald" : "primary"} onClick={save}>{saved ? <><Check className="h-4 w-4" /> Enregistré</> : <><Save className="h-4 w-4" /> Enregistrer</>}</Btn>
      } />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><Building2 className="h-4 w-4 text-brand" /> Identité de l'entreprise</h2>
          <div className="mb-4 flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
              {f.logo ? <img src={f.logo} alt="Logo" className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-faint" />}
            </span>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Charger le logo</Btn>
              {f.logo && <button onClick={() => set("logo", null)} className="ml-2 text-[12px] font-semibold text-serious hover:underline">retirer</button>}
            </div>
          </div>
          <div className="space-y-3.5">
            <Field label="Raison sociale"><Input value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="ICE"><Input className="tnum" value={f.ice} onChange={(e) => set("ice", e.target.value)} /></Field>
              <Field label="Identifiant fiscal"><Input value={f.taxId} onChange={(e) => set("taxId", e.target.value)} /></Field>
              <Field label="Registre de commerce"><Input value={f.rc} onChange={(e) => set("rc", e.target.value)} /></Field>
              <Field label="Ville"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            </div>
            <Field label="Adresse"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><Percent className="h-4 w-4 text-brand" /> Fiscalité & devise</h2>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Devise"><Select value={f.currency} onChange={(e) => set("currency", e.target.value as SettingsT["currency"])}><option value="MAD">Dirham (MAD)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar (USD)</option></Select></Field>
              <Field label="Taux de TVA (%)"><Input type="number" className="tnum" value={f.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} /></Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><FileText className="h-4 w-4 text-brand" /> En-tête & pied de document</h2>
            <div className="space-y-3.5">
              <Field label="Note d'en-tête"><Textarea rows={2} value={f.headerNote} onChange={(e) => set("headerNote", e.target.value)} /></Field>
              <Field label="Note de pied de page"><Textarea rows={2} value={f.footerNote} onChange={(e) => set("footerNote", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-good/30 bg-good-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-700">Conformité Loi 09-08 (CNDP)</p>
              <p className="mt-0.5 text-[12.5px] text-emerald-700/90">Les données d'identification (ICE, CIN) sont traitées de manière confidentielle. Les saisies sont filtrées contre les injections (XSS/SQL).</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
