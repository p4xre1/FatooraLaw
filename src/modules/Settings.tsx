import { useEffect, useRef, useState } from "react"
import { Save, Upload, Download, Building2, Percent, FileText, HardDrive, Check, Sun, Moon, Monitor, Palette } from "lucide-react"
import type { Settings as SettingsT } from "../store/types"
import { useMizan } from "../store/useMizan"
import { exportCurrentBackup, exportLegacyBackup, hasLegacyData } from "../lib/legacyBackup"
import { isTaxRate, parseAmount } from "../lib/businessValidation"
import { LOGO_TYPES, validateLogoDataURL, validateLogoFile } from "../lib/logoValidation"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Field, Input, Textarea, Select } from "../components/kit"
import { PlanActivationCard } from "../components/PlanStatus"
import { THEME_MODES, useThemeStore, type ThemeMode } from "../lib/theme"

export default function Settings() {
  const { t: copy } = useTranslation()
  const t = copy.settings
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

  function logoMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : ""
    if (/512|exceed|size/i.test(message)) return t.identity.logoSize
    if (/(PNG|JPEG|WebP|GIF|format|image\/)/i.test(message)) return t.identity.logoFormat
    if (/vide|empty/i.test(message)) return t.identity.logoEmpty
    if (/contenu|content/i.test(message)) return t.identity.logoContent
    return t.identity.logoInvalid
  }

  function save() {
    if (!validRate || rate === null || logoLoading) return
    clearFeedback()
    try {
      updateSettings({ ...f, taxRate: rate })
      if (useLocalSaveStatus.getState().issue?.key === useMizan.persist.getOptions().name) {
        setSaveError(t.localSaveError)
        return
      }
      setF(useMizan.getState().settings)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch { setSaveError(t.saveError) }
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
    catch (err) { setLogoError(logoMessage(err)); return }
    const reader = new FileReader()
    readerRef.current = reader
    setLogoLoading(true)
    reader.onload = () => {
      if (readerRef.current !== reader) return
      readerRef.current = null
      setLogoLoading(false)
      try {
        if (typeof reader.result !== "string") throw new Error("Unreadable image")
        validateLogoDataURL(reader.result)
        set("logo", reader.result)
      } catch (err) { setLogoError(logoMessage(err)) }
    }
    reader.onerror = reader.onabort = () => {
      if (readerRef.current !== reader) return
      readerRef.current = null
      setLogoLoading(false)
      setLogoError(t.identity.logoRead)
    }
    try { reader.readAsDataURL(file) }
    catch {
      cancelLogoRead()
      setLogoLoading(false)
      setLogoError(t.identity.logoRead)
    }
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={copy.shared.modules.settings} sub={t.subtitle} action={
        <Btn variant={saved ? "emerald" : "primary"} disabled={!validRate || logoLoading} onClick={save}>{saved ? <><Check className="h-4 w-4" /> {t.saved}</> : <><Save className="h-4 w-4" /> {t.save}</>}</Btn>
      } />
      {saveError && <p role="alert" className="text-sm text-serious">{saveError}</p>}

      <Card className="space-y-3 p-4">
        <p className="text-[13px] text-muted">{t.localData.body}</p>
        <Btn variant="outline" size="sm" onClick={() => {
          try { exportCurrentBackup(); setBackupError(null) }
          catch { setBackupError(t.localData.exportError) }
        }}><Download className="h-4 w-4" /> {t.localData.export}</Btn>
        {legacy && <>
          <p className="text-[13px] text-warn">{t.localData.legacy}</p>
          <Btn variant="outline" size="sm" onClick={() => {
            try { exportLegacyBackup(); setBackupError(null) }
            catch { setBackupError(t.localData.legacyError) }
          }}>{t.localData.exportLegacy}</Btn>
        </>}
        {backupError && <p role="alert" className="text-sm text-serious">{backupError}</p>}
      </Card>

      {/* Which plan this account is on, and where the code that changes it is
          typed in. Full width, above the settings cards: it is the one card on
          this screen a client comes here for. */}
      <PlanActivationCard />

      {/* Appearance: light, dark, or the OS's own choice. A device preference
          (lib/theme.ts), applied the moment it is clicked — no save button,
          because there is nothing here that a half-typed form could lose. */}
      <Card className="p-5">
        <h2 className="mb-1 inline-flex items-center gap-2 text-[14px] font-bold"><Palette className="h-4 w-4 text-brand" /> {t.appearance.title}</h2>
        <p className="mb-4 text-[12.5px] text-muted">{t.appearance.hint}</p>
        <ThemeChoice />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><Building2 className="h-4 w-4 text-brand" /> {t.identity.title}</h2>
          <div className="mb-4 flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
              {f.logo ? <img src={f.logo} alt={t.identity.logoAlt} className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-faint" />}
            </span>
            <div>
              <input aria-label={t.identity.logoFile} ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={onLogo} />
              <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {logoLoading ? t.identity.loadingLogo : t.identity.uploadLogo}</Btn>
              {f.logo && <button type="button" onClick={() => { cancelLogoRead(); setLogoLoading(false); setLogoError(null); set("logo", null) }} className="ms-2 text-[12px] font-semibold text-serious hover:underline">{t.identity.removeLogo}</button>}
              <p className="mt-1 text-[11px] text-faint">{t.identity.logoHelp}</p>
            </div>
          </div>
          {logoError && <p role="alert" className="mb-3 text-sm text-serious">{logoError}</p>}
          <div className="space-y-3.5">
            <Field label={t.identity.company}><Input value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t.identity.ice}><Input className="tnum" value={f.ice} onChange={(e) => set("ice", e.target.value)} /></Field>
              <Field label={t.identity.taxId}><Input value={f.taxId} onChange={(e) => set("taxId", e.target.value)} /></Field>
              <Field label={t.identity.rc}><Input value={f.rc} onChange={(e) => set("rc", e.target.value)} /></Field>
              <Field label={t.identity.city}><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            </div>
            <Field label={t.identity.address}><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><Percent className="h-4 w-4 text-brand" /> {t.fiscal.title}</h2>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t.fiscal.currency}><Select value={f.currency} onChange={(e) => set("currency", e.target.value as SettingsT["currency"])}><option value="MAD">{t.fiscal.currencies.MAD}</option><option value="EUR">{t.fiscal.currencies.EUR}</option><option value="USD">{t.fiscal.currencies.USD}</option></Select></Field>
              <Field label={t.fiscal.vat}><Input type="number" min={0} max={100} step="any" className="tnum" value={taxRateInput} onChange={(e) => { clearFeedback(); setTaxRateInput(e.target.value) }} /></Field>
            </div>
            {!validRate && <p role="alert" className="mt-2 text-sm text-serious">{t.fiscal.vatError}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><FileText className="h-4 w-4 text-brand" /> {t.documents.title}</h2>
            <div className="space-y-3.5">
              <Field label={t.documents.header}><Textarea rows={2} value={f.headerNote} onChange={(e) => set("headerNote", e.target.value)} /></Field>
              <Field label={t.documents.footer}><Textarea rows={2} value={f.footerNote} onChange={(e) => set("footerNote", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="flex items-start gap-3 p-4">
            <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <p className="text-[13px] font-semibold text-ink">{t.localData.title}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{t.localData.security}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const THEME_ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

function ThemeChoice() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)
  const labels: Record<ThemeMode, string> = {
    light: t.settings.appearance.light,
    dark: t.settings.appearance.dark,
    system: t.settings.appearance.system,
  }
  return (
    <div role="radiogroup" aria-label={t.settings.appearance.title} className="inline-flex flex-wrap gap-1 rounded-xl bg-canvas p-1">
      {THEME_MODES.map((value) => {
        const Icon = THEME_ICONS[value]
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {labels[value]}
          </button>
        )
      })}
    </div>
  )
}
