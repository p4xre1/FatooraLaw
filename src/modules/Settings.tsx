import { useEffect, useRef, useState } from "react"
import { Save, Upload, Download, Building2, Percent, FileText, HardDrive, Check, Sun, Moon, Monitor, Palette, Cloud, RefreshCw } from "lucide-react"
import type { Settings as SettingsT } from "../store/types"
import { accountStorageKey, useMizan } from "../store/useMizan"
import { exportCurrentBackup, exportLegacyBackup, hasLegacyData } from "../lib/legacyBackup"
import { downloadEncryptedBackup, downloadSelectedCsv, EXPORT_SECTIONS, type ExportSection } from "../lib/dataExport"
import { deleteSupabaseBackup, disableSupabaseBackup, enableSupabaseBackup, syncSupabaseBackupNow, useSupabaseBackup } from "../lib/supabaseBackup"
import { isTaxRate, parseAmount } from "../lib/businessValidation"
import { LOGO_TYPES, validateLogoDataURL, validateLogoFile } from "../lib/logoValidation"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Field, Input, Textarea, Select } from "../components/kit"
import { PlanActivationCard } from "../components/PlanStatus"
import { THEME_MODES, useThemeStore, type ThemeMode } from "../lib/theme"
import { supabase } from "../lib/supabase"
import { SUPPORT_EMAIL } from "../lib/contact"

export default function Settings() {
  const { t: copy, language } = useTranslation()
  const t = copy.settings
  const { settings, updateSettings, auth } = useMizan()
  const backupSync = useSupabaseBackup()
  const [f, setF] = useState<SettingsT>(settings)
  const [taxRateInput, setTaxRateInput] = useState(String(settings.taxRate))
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [legacy] = useState(hasLegacyData)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [cloudBackupError, setCloudBackupError] = useState<string | null>(null)
  const [backupConsent, setBackupConsent] = useState(false)
  const [selectedExports, setSelectedExports] = useState<ExportSection[]>([])
  const [backupPassphrase, setBackupPassphrase] = useState("")
  const [encryptingBackup, setEncryptingBackup] = useState(false)
  const [eraseWorkspace, setEraseWorkspace] = useState(false)
  const [deletionMessage, setDeletionMessage] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
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
        {auth && auth.id !== "local-dev" && <div className="space-y-3 rounded-lg border border-brand/20 bg-brand-50/40 p-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold"><Cloud className="h-4 w-4 text-brand" />{t.localData.cloudTitle}</div>
          <p className="text-[12px] text-muted">{t.localData.cloudWarning}</p>
          <p className="text-[12px] text-muted">
            {backupSync.status === "syncing" ? t.localData.cloudSyncing : backupSync.status === "synced" ? `${t.localData.cloudSynced} ${backupSync.updatedAt ? new Date(backupSync.updatedAt).toLocaleString() : ""}` : backupSync.status === "error" ? t.localData.cloudFailed : backupSync.status === "unavailable" ? t.localData.cloudUnavailable : t.localData.cloudDisabled}
          </p>
          {cloudBackupError && <p role="alert" className="text-sm text-serious">{cloudBackupError}</p>}
          {!backupSync.enabled && <>
            <label className="flex items-start gap-2 text-[12px] text-ink">
              <input className="mt-0.5" type="checkbox" checked={backupConsent} onChange={(event) => setBackupConsent(event.target.checked)} />
              <span>{t.localData.cloudConsent}</span>
            </label>
            <Btn variant="outline" size="sm" disabled={!backupConsent || backupSync.status === "syncing"} onClick={async () => {
              if (!auth) return
              setCloudBackupError(null)
              try { await enableSupabaseBackup(auth.id); setBackupConsent(false) }
              catch (error) { setCloudBackupError(error instanceof Error ? error.message : t.localData.cloudFailed) }
            }}><Cloud className="h-4 w-4" /> {t.localData.cloudEnable}</Btn>
          </>}
          {backupSync.enabled && <span className="flex flex-wrap gap-2">
            <Btn variant="outline" size="sm" disabled={backupSync.status === "syncing"} onClick={async () => {
              if (!auth) return
              setCloudBackupError(null)
              try { await syncSupabaseBackupNow(auth.id) }
              catch (error) { setCloudBackupError(error instanceof Error ? error.message : t.localData.cloudFailed) }
            }}><RefreshCw className="h-4 w-4" /> {t.localData.cloudSyncNow}</Btn>
            <Btn variant="outline" size="sm" onClick={async () => {
              if (!auth) return
              setCloudBackupError(null)
              try { await disableSupabaseBackup(auth.id) }
              catch (error) { setCloudBackupError(error instanceof Error ? error.message : t.localData.cloudFailed) }
            }}>{t.localData.cloudDisable}</Btn>
            <Btn variant="danger" size="sm" onClick={async () => {
              if (!auth || !window.confirm(t.localData.cloudDeleteConfirm)) return
              setCloudBackupError(null)
              try { await deleteSupabaseBackup(auth.id) }
              catch (error) { setCloudBackupError(error instanceof Error ? error.message : t.localData.cloudFailed) }
            }}>{t.localData.cloudDelete}</Btn>
          </span>}
        </div>}
        <div className="space-y-3 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold">{t.localData.chooseData}</p>
            <button type="button" className="text-[12px] font-semibold text-brand hover:underline" onClick={() => setSelectedExports(selectedExports.length === EXPORT_SECTIONS.length ? [] : [...EXPORT_SECTIONS])}>{selectedExports.length === EXPORT_SECTIONS.length ? t.localData.clearSelection : t.localData.selectAll}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXPORT_SECTIONS.map((key) => <label key={key} className="flex items-center gap-2 text-[12px] text-ink">
              <input type="checkbox" checked={selectedExports.includes(key)} onChange={(event) => setSelectedExports((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} />
              {t.localData.sections[key]}
            </label>)}
          </div>
          <Btn variant="outline" size="sm" disabled={!selectedExports.length} onClick={() => {
            try { downloadSelectedCsv(selectedExports); setBackupError(null) }
            catch (error) { setBackupError(error instanceof Error ? error.message : t.localData.exportError) }
          }}><Download className="h-4 w-4" /> {t.localData.exportSelectedCsv}</Btn>
        </div>
        <div className="space-y-2 rounded-lg border border-line p-3">
          <Field label={t.localData.passphrase} hint={t.localData.passphraseHint}><Input type="password" autoComplete="new-password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} /></Field>
          <Btn variant="outline" size="sm" disabled={encryptingBackup || backupPassphrase.length < 12} onClick={async () => {
            setEncryptingBackup(true)
            try { await downloadEncryptedBackup(backupPassphrase); setBackupError(null) }
            catch (error) { setBackupError(error instanceof Error ? error.message : t.localData.exportError) }
            finally { setEncryptingBackup(false) }
          }}><Download className="h-4 w-4" /> {encryptingBackup ? t.localData.encryptedBusy : t.localData.encryptedBackup}</Btn>
        </div>
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
        <Card className="mt-5 border border-rose-300/40 p-5">
          <h2 className="text-[14px] font-bold text-rose-600">Delete account</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Your account will be scheduled for permanent deletion after 30 days. You can sign in and reactivate it before then. Access is stopped as soon as you submit this request. If you select immediate workspace erasure, business records on this device and any opted-in cloud mirror are deleted now and cannot be restored, even if you reactivate. Other devices are not reachable from here; erase their local copies separately.</p>
          <label className="mt-3 flex items-start gap-2 text-[12px] text-ink"><input type="checkbox" checked={eraseWorkspace} onChange={(e) => setEraseWorkspace(e.target.checked)} className="mt-0.5" />Erase my workspace and cloud backup immediately (irreversible)</label>
          {deletionMessage && <p role="alert" className="mt-3 text-[12px] text-rose-600">{deletionMessage}</p>}
          <Btn variant="danger" size="sm" disabled={deletingAccount || !auth} className="mt-4" onClick={async () => {
            if (!auth || !window.confirm("Request account deletion? You will be signed out immediately.")) return
            setDeletingAccount(true); setDeletionMessage("")
            try {
              const { error } = await supabase.rpc("request_account_deletion", { p_erase_workspace: eraseWorkspace })
              if (error) throw error
              if (eraseWorkspace) localStorage.removeItem(accountStorageKey(auth.id))
              await supabase.auth.signOut({ scope: "local" })
            } catch (error) { setDeletionMessage(error instanceof Error ? error.message : "Could not submit the deletion request.") }
            finally { setDeletingAccount(false) }
          }}>{deletingAccount ? "Submitting…" : "Request account deletion"}</Btn>
        </Card>
        <Card className="mt-4 p-5">
          <h2 className="text-[14px] font-bold text-ink">{language === "fr" ? "Aide et assistance" : language === "ar" ? "المساعدة والدعم" : "Help and support"}</h2>
          <p className="mt-2 text-[12px] text-muted">{language === "fr" ? "Écrivez à notre équipe d’assistance :" : language === "ar" ? "راسل فريق الدعم:" : "Email our support team:"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25D366] px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#1fbd5b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2" href="https://wa.me/212772966980" target="_blank" rel="noopener noreferrer" aria-label={language === "fr" ? "Contacter l’assistance sur WhatsApp au +212 772 966 980" : language === "ar" ? "تواصل مع الدعم عبر واتساب على الرقم +212 772 966 980" : "Contact support on WhatsApp at +212 772 966 980"}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .15 5.34.15 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.92-5.35 11.93-11.92a11.85 11.85 0 0 0-3.48-8.42ZM12.07 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98 1-3.64-.24-.37a9.88 9.88 0 0 1-1.52-5.26c0-5.46 4.44-9.9 9.9-9.9a9.84 9.84 0 0 1 7 2.9 9.84 9.84 0 0 1 2.9 7c0 5.46-4.45 9.9-9.91 9.9Zm5.43-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35Z" /></svg>
              <span>{language === "fr" ? "WhatsApp" : language === "ar" ? "واتساب" : "WhatsApp"} · +212 772 966 980</span>
            </a>
            <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-[12px] font-bold text-ink shadow-sm transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" href={`mailto:${SUPPORT_EMAIL}`} aria-label={`${language === "fr" ? "Envoyer un e-mail de support à" : language === "ar" ? "إرسال بريد للدعم إلى" : "Email support at"} ${SUPPORT_EMAIL}`}>
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.7-3.5-11.3-8.2H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8l6.9-5.2Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.9 5.2c1.6-4.7 6.1-8.2 11.3-8.2Z"/></svg>
              <span>{language === "fr" ? "E-mail" : language === "ar" ? "البريد الإلكتروني" : "Gmail"}<span className="ml-1 font-normal text-muted">{SUPPORT_EMAIL}</span></span>
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">{language === "fr" ? "Forfaits payants : assistance 24 h/24. Offre gratuite : tous les jours de 12 h à 19 h (heure du Maroc)." : language === "ar" ? "الخطط المدفوعة: دعم 24/24. الخطة المجانية: يومياً من 12:00 إلى 19:00 بتوقيت المغرب." : "Paid plans: support 24/24. Free plan: daily, 12:00–19:00 Morocco time."}</p>
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[11px] font-semibold text-ink">{language === "fr" ? "Lire nos politiques" : language === "ar" ? "اقرأ السياسات" : "Read our policies"}</p>
            <nav aria-label={language === "fr" ? "Politiques juridiques" : language === "ar" ? "السياسات القانونية" : "Legal policies"} className="flex flex-wrap gap-x-3 gap-y-2 text-[11px]">
              <a className="text-brand underline" href="/terms">{language === "fr" ? "Conditions" : language === "ar" ? "الشروط" : "Terms"}</a>
              <a className="text-brand underline" href="/privacy">{language === "fr" ? "Confidentialité" : language === "ar" ? "الخصوصية" : "Privacy"}</a>
              <a className="text-brand underline" href="/cookies">{language === "fr" ? "Cookies" : language === "ar" ? "ملفات تعريف الارتباط" : "Cookies"}</a>
              <a className="text-brand underline" href="/refund">{language === "fr" ? "Remboursements" : language === "ar" ? "الاسترداد" : "Refunds"}</a>
            </nav>
          </div>
        </Card>
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
