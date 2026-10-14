import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Plus, Save, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteFeature, listFeatures, saveFeature, type CmsFeature } from "./client"

const empty = (locale: LocaleId): CmsFeature => ({ feature_key: "", locale, title: "", description: "", details: "", icon: "sparkles", image_url: "", sort_order: 0, published: false })
const ICONS = [["calendar", "تقويم"], ["shield", "درع"], ["tools", "أدوات"], ["dashboard", "لوحة"], ["legal", "قانون"], ["speed", "سرعة"], ["sparkles", "نجمة"]]

export default function FeaturesPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsFeature[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<CmsFeature>(empty("fr"))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const features = rows.filter((row) => row.locale === locale)
  async function refresh() { setLoading(true); try { const data = await listFeatures(); setRows(data); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft({ ...(features.find((row) => row.id === selectedId) ?? empty(locale)), locale }) }, [rows, selectedId, locale])
  function changeLocale(value: LocaleId) { setLocale(value); setSelectedId("") }
  async function save() {
    if (!access.user?.id) return
    if (!/^[a-z0-9-]{1,80}$/.test(draft.feature_key)) { setError("مفتاح الميزة يقبل أحرفاً لاتينية صغيرة وأرقاماً وشرطة فقط."); return }
    setBusy(true); setError(""); setNotice("")
    try { await saveFeature({ ...draft, locale }, access.user.id); setNotice("تم حفظ الميزة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف ترجمة هذه الميزة؟")) return
    setBusy(true); setError("")
    try { await deleteFeature(draft.id); setSelectedId(""); setNotice("تم حذف الميزة من هذه اللغة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <PanelCard title="وصف الميزات" description="كل مفتاح ميزة له سجل مستقل لكل لغة؛ المنشور فقط يظهر للزوار. أضف صورة اختيارية من مكتبة الأصول." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={changeLocale} />}>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-bold">الميزات · {features.length}</span><Btn size="sm" variant="outline" onClick={() => { setSelectedId(""); setDraft(empty(locale)) }}><Plus className="h-3.5 w-3.5" /> جديد</Btn></div><div className="max-h-[500px] overflow-auto p-2">{features.map((row) => <button type="button" key={row.id ?? row.feature_key} onClick={() => setSelectedId(row.id ?? "")} className={`mb-1 w-full rounded-lg p-2 text-start text-[11px] ${selectedId === row.id ? "bg-brand-50 text-brand-700" : "hover:bg-canvas"}`}><span className="block truncate font-semibold">{row.title}</span><span className="text-[10px] text-muted">{row.feature_key} · {row.published ? "منشورة" : "مسودة"}</span></button>)}{!features.length && <p className="px-2 py-5 text-center text-[11px] text-muted">لم تضف ميزات بهذه اللغة.</p>}</div></Card>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><Field label="مفتاح ثابت"><Input maxLength={80} disabled={Boolean(draft.id)} dir="ltr" value={draft.feature_key} onChange={(event) => setDraft({ ...draft, feature_key: event.target.value })} placeholder="deadline-calendar" /></Field><Field label="العنوان"><Input maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field><Field label="الأيقونة"><Select value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })}>{ICONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field><Field label="الترتيب"><Input type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) || 0 })} /></Field></div>
        <Field label="وصف مختصر"><Textarea rows={3} maxLength={1200} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
        <Field label="تفاصيل إضافية"><Textarea rows={5} maxLength={10000} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} /></Field>
        <Field label="رابط صورة / لقطة شاشة"><Input type="url" value={draft.image_url} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} /></Field>
        <label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> نشر هذه الترجمة</label>
        <div className="flex justify-end gap-2">{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={busy}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={busy || !access.user?.id}><Save className="h-4 w-4" /> حفظ الميزة</Btn></div>
      </div>
    </div>
  </PanelCard>
}
