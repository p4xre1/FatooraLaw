import { useEffect, useRef, useState } from "react"
import { Save, Upload, Download, Building2, Percent, FileText, HardDrive, Check } from "lucide-react"
import type { Settings as SettingsT } from "../store/types"
import { useMizan } from "../store/useMizan"
import { exportCurrentBackup, exportLegacyBackup, hasLegacyData } from "../lib/legacyBackup"
import { isTaxRate, parseAmount } from "../lib/businessValidation"
import { LOGO_TYPES, validateLogoDataURL, validateLogoFile } from "../lib/logoValidation"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import { Card, SectionTitle, Btn, Field, Input, Textarea, Select } from "../components/kit"

export default function Settings() {
  const { settings, updateSettings } = useMizan()
  const [f, setF] = useState<SettingsT>(settings)
  const [taxRateInput, setTaxRateInput] = useState(String(settings.taxRate))
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [legacy] = useState(hasLegacyData)
  const [backupError, setBackupError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rate = parseAmount(taxRateInput)
  const validRate = rate !== null && isTaxRate(rate)

  function cancelLogoRead() {
    const reader = readerRef.current
    readerRef.current = null
    if (reader) {
      reader.onload = reader.onerror = reader.onabort = null
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }
  useEffect(() => () => {
    cancelLogoRead()
    if (savedTimer.current !== null) clearTimeout(savedTimer.current)
  }, [])

  function clearFeedback() {
    setSaved(false)
    setSaveError(null)
    if (savedTimer.current !== null) clearTimeout(savedTimer.current)
  }
  const set = <K extends keyof SettingsT>(key: K, value: SettingsT[K]) => {
    clearFeedback()
    setF((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    if (!validRate || rate === null || logoLoading) return
    clearFeedback()
    try {
      updateSettings({ ...f, taxRate: rate })
      if (useLocalSaveStatus.getState().issue?.key === useMizan.persist.getOptions().name) {
        setSaveError("La sauvegarde locale a échoué. Exportez vos données avant de quitter cet onglet.")
        return
      }
      setF(useMizan.getState().settings)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Impossible d'enregistrer les paramètres.") }
  }

  function onLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // allow retrying the same file after an error
    if (!file) return
    cancelLogoRead()
    clearFeedback()
    setLogoLoading(false)
    setLogoError(null)
    try { validateLogoFile(file) }
    catch (err) { setLogoError(err instanceof Error ? err.message : "Logo invalide."); return }
    const reader = new FileReader()
    readerRef.current = reader
    setLogoLoading(true)
    reader.onload = () => {
      if (readerRef.current !== reader) return
      readerRef.current = null
      setLogoLoading(false)
      try {
        if (typeof reader.result !== "string") throw new Error("Logo illisible.")
        validateLogoDataURL(reader.result)
        set("logo", reader.result)
      } catch (err) { setLogoError(err instanceof Error ? err.message : "Logo invalide.") }
    }
    reader.onerror = reader.onabort = () => {
      if (readerRef.current !== reader) return
      readerRef.current = null
      setLogoLoading(false)
      setLogoError("Lecture du logo impossible. Réessayez avec un autre fichier.")
    }
    try { reader.readAsDataURL(file) }
    catch {
      cancelLogoRead()
      setLogoLoading(false)
      setLogoError("Lecture du logo impossible. Réessayez avec un autre fichier.")
    }
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Paramètres & profil" sub="Configuration de l'entité, fiscalité & documents" action={
        <Btn variant={saved ? "emerald" : "primary"} disabled={!validRate || logoLoading} onClick={save}>{saved ? <><Check className="h-4 w-4" /> Enregistré</> : <><Save className="h-4 w-4" /> Enregistrer</>}</Btn>
      } />
      {saveError && <p role="alert" className="text-sm text-serious">{saveError}</p>}

      <Card className="space-y-3 p-4">
        <p className="text-[13px] text-muted">Les données métier sont enregistrées dans ce navigateur, séparément pour chaque compte. Exportez régulièrement une copie avant de changer d'appareil ou d'effacer le stockage du navigateur.</p>
        <Btn variant="outline" size="sm" onClick={() => {
          try { exportCurrentBackup(); setBackupError(null) }
          catch { setBackupError("Impossible d'exporter la sauvegarde. Vos données restent dans cet onglet.") }
        }}><Download className="h-4 w-4" /> Exporter mes données locales</Btn>
        {legacy && <>
          <p className="text-[13px] text-warn">Les données de l'ancienne version sont conservées sur cet appareil. Elles ne sont pas attribuées automatiquement à un compte, pour éviter de partager les données d'un autre utilisateur.</p>
          <Btn variant="outline" size="sm" onClick={() => {
            try { exportLegacyBackup(); setBackupError(null) }
            catch { setBackupError("Impossible de lire la sauvegarde locale. Les données originales sont conservées.") }
          }}>Exporter la sauvegarde ancienne</Btn>
        </>}
        {backupError && <p role="alert" className="text-sm text-serious">{backupError}</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><Building2 className="h-4 w-4 text-brand" /> Identité de l'entreprise</h2>
          <div className="mb-4 flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
              {f.logo ? <img src={f.logo} alt="Logo" className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-faint" />}
            </span>
            <div>
              <input aria-label="Fichier du logo" ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={onLogo} />
              <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {logoLoading ? "Lecture du logo…" : "Charger le logo"}</Btn>
              {f.logo && <button type="button" onClick={() => { cancelLogoRead(); setLogoLoading(false); setLogoError(null); set("logo", null) }} className="ml-2 text-[12px] font-semibold text-serious hover:underline">retirer</button>}
              <p className="mt-1 text-[11px] text-faint">PNG, JPEG, WebP ou GIF · 512 Ko maximum</p>
            </div>
          </div>
          {logoError && <p role="alert" className="mb-3 text-sm text-serious">{logoError}</p>}
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
              <Field label="Taux de TVA (%)"><Input type="number" min={0} max={100} step="any" className="tnum" value={taxRateInput} onChange={(e) => { clearFeedback(); setTaxRateInput(e.target.value) }} /></Field>
            </div>
            {!validRate && <p role="alert" className="mt-2 text-sm text-serious">Indiquez un taux de TVA entre 0 et 100 % (0 est autorisé).</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><FileText className="h-4 w-4 text-brand" /> En-tête & pied de document</h2>
            <div className="space-y-3.5">
              <Field label="Note d'en-tête"><Textarea rows={2} value={f.headerNote} onChange={(e) => set("headerNote", e.target.value)} /></Field>
              <Field label="Note de pied de page"><Textarea rows={2} value={f.footerNote} onChange={(e) => set("footerNote", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="flex items-start gap-3 p-4">
            <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <p className="text-[13px] font-semibold text-ink">Données locales sur cet appareil</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Ces données ne sont pas chiffrées par l'application. Une sauvegarde JSON est une copie sensible : conservez-la dans un emplacement sécurisé. L'export ne remplace pas une procédure de restauration.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
