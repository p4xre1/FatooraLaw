import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Megaphone, Plus, Save, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, inputToIso, isoToInput, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteAnnouncement, listAnnouncements, saveAnnouncement, type CmsAnnouncement } from "./client"

const empty = (): CmsAnnouncement => ({ severity: "info", title_by_locale: {}, body_by_locale: {}, starts_at: new Date().toISOString(), ends_at: null, active: false })

export default function AnnouncementsPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsAnnouncement[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<CmsAnnouncement>(empty())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setRows(await listAnnouncements()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft(rows.find((row) => row.id === selectedId) ?? empty()) }, [rows, selectedId])
  function setLocaleCopy(field: "title_by_locale" | "body_by_locale", value: string) { setDraft({ ...draft, [field]: { ...draft[field], [locale]: value } }) }
  async function save() {
    if (!access.user?.id) return
    if (!draft.title_by_locale[locale]?.trim()) { setError(`أدخل عنوان الإعلان باللغة ${locale}.`); return }
    const startsAt = inputToIso(isoToInput(draft.starts_at))
    const endsAt = draft.ends_at ? inputToIso(isoToInput(draft.ends_at)) : null
    if (!startsAt || (draft.ends_at && !endsAt)) { setError("تحقق من تاريخ بدء الإعلان ونهايته."); return }
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) { setError("يجب أن يكون وقت الانتهاء بعد وقت البدء."); return }
    setBusy(true); setError(""); setNotice("")
    try { await saveAnnouncement({ ...draft, starts_at: startsAt, ends_at: endsAt }, access.user.id); setNotice("تم حفظ الإعلان العام."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف الإعلان العام؟")) return
    setBusy(true); setError("")
    try { await deleteAnnouncement(draft.id); setSelectedId(""); setNotice("تم حذف الإعلان."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <PanelCard title="الإعلانات العامة" description="هذه رسائل يراها زوار الموقع ضمن الصفحات العامة. الإشعارات الداخلية للمشغلين لها قسم منفصل." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-bold">الإعلانات</span><Btn size="sm" variant="outline" onClick={() => { setSelectedId(""); setDraft(empty()) }}><Plus className="h-3.5 w-3.5" /> جديد</Btn></div><div className="max-h-[480px] overflow-auto p-2">{rows.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id ?? "")} className={`mb-1 w-full rounded-lg p-2 text-start ${selectedId === row.id ? "bg-brand-50 text-brand-700" : "hover:bg-canvas"}`}><span className="block truncate text-[12px] font-semibold">{row.title_by_locale[locale] || row.title_by_locale.fr || row.title_by_locale.en || row.title_by_locale.ar || "إعلان جديد"}</span><span className="text-[10px] text-muted">{row.severity} · {row.active ? "نشط" : "مخفي"}</span></button>)}</div></Card>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="مستوى التنبيه"><Select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as CmsAnnouncement["severity"] })}><option value="info">معلومة</option><option value="warning">تحذير</option><option value="critical">حرج</option></Select></Field><label className="flex items-center gap-2 self-end pb-2 text-[12px] text-ink"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> تفعيل الإعلان عند موعده</label></div>
        <Field label={`العنوان · ${locale}`}><Input maxLength={160} value={draft.title_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("title_by_locale", event.target.value)} /></Field>
        <Field label={`نص الإعلان · ${locale}`}><Textarea rows={4} maxLength={2000} value={draft.body_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("body_by_locale", event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="يبدأ"><Input type="datetime-local" value={isoToInput(draft.starts_at)} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value ? new Date(event.target.value).toISOString() : "" })} /></Field><Field label="ينتهي (اختياري)"><Input type="datetime-local" value={isoToInput(draft.ends_at)} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></Field></div>
        <div className="flex justify-end gap-2">{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={busy}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={busy || !access.user?.id}><Megaphone className="h-4 w-4" />{busy ? "جارٍ الحفظ…" : "حفظ الإعلان"}</Btn></div>
      </div>
    </div>
  </PanelCard>
}
