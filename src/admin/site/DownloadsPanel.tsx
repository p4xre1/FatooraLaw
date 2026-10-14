import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Download, Plus, Save, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteDownload, listDownloads, saveDownload, type CmsDownload } from "./client"

const PLATFORMS: CmsDownload["platform"][] = ["web", "windows", "macos", "linux", "android", "ios", "other"]
const empty = (): CmsDownload => ({ platform: "web", version: "", label_by_locale: {}, url: "", instructions_by_locale: {}, active: false, sort_order: 0 })

export default function DownloadsPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsDownload[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<CmsDownload>(empty())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setRows(await listDownloads()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft(rows.find((row) => row.id === selectedId) ?? empty()) }, [rows, selectedId])
  function setLocaleCopy(field: "label_by_locale" | "instructions_by_locale", value: string) { setDraft({ ...draft, [field]: { ...draft[field], [locale]: value } }) }
  async function save() {
    if (!access.user?.id) return
    if (!/^https?:\/\//i.test(draft.url)) { setError("أدخل رابطاً يبدأ بـ https:// أو http://."); return }
    setBusy(true); setError(""); setNotice("")
    try { await saveDownload(draft, access.user.id); setNotice("تم حفظ رابط التنزيل."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف رابط التنزيل؟")) return
    setBusy(true); setError("")
    try { await deleteDownload(draft.id); setSelectedId(""); setNotice("تم حذف رابط التنزيل."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <PanelCard title="روابط التنزيل والتعليمات" description="أضف رابطاً لكل منصة، رقم الإصدار، التسمية والتعليمات حسب اللغة. النقر على الرابط العام يُسجل كنقرة فقط ولا يثبت اكتمال التنزيل." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-bold">روابط التنزيل</span><Btn size="sm" variant="outline" onClick={() => { setSelectedId(""); setDraft(empty()) }}><Plus className="h-3.5 w-3.5" /> جديد</Btn></div><div className="max-h-[480px] overflow-auto p-2">{rows.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id ?? "")} className={`mb-1 w-full rounded-lg p-2 text-start ${selectedId === row.id ? "bg-brand-50 text-brand-700" : "hover:bg-canvas"}`}><span className="block text-[12px] font-semibold">{row.platform} {row.version}</span><span className="text-[10px] text-muted">{row.label_by_locale[locale] || row.url} · {row.active ? "نشط" : "مخفي"}</span></button>)}</div></Card>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3"><Field label="المنصة"><Select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value as CmsDownload["platform"] })}>{PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</Select></Field><Field label="الإصدار"><Input maxLength={40} dir="ltr" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} /></Field><Field label="الترتيب"><Input type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) || 0 })} /></Field></div>
        <Field label={`التسمية · ${locale}`}><Input maxLength={240} value={draft.label_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("label_by_locale", event.target.value)} /></Field>
        <Field label="رابط التنزيل"><Input type="url" dir="ltr" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></Field>
        <Field label={`تعليمات التثبيت · ${locale}`}><Textarea rows={4} value={draft.instructions_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("instructions_by_locale", event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> إظهار رابط التنزيل للعامة</label>
        <div className="flex justify-end gap-2">{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={busy}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={busy || !access.user?.id}><Download className="h-4 w-4" /> حفظ رابط التنزيل</Btn></div>
      </div>
    </div>
  </PanelCard>
}
