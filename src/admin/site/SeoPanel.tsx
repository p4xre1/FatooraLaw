import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Save, Trash2 } from "lucide-react"
import { Btn, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteSeoSetting, listSeoSettings, saveSeoSetting, type CmsSeoSetting } from "./client"

const ROUTES = [
  ["/", "الرئيسية"], ["/features", "الميزات"], ["/assistant", "المساعد"], ["/about", "عن الموقع"],
  ["/benefits", "الفوائد"], ["/pricing", "الأسعار"], ["/blog", "المدونة"], ["/faq", "الأسئلة الشائعة"],
  ["/contact", "التواصل"], ["/privacy", "الخصوصية"], ["/terms", "الشروط"], ["/cookies", "ملفات الارتباط"],
] as const
const empty = (route_path: string, locale: LocaleId): CmsSeoSetting => ({ route_path, locale, title: "", description: "", canonical_url: "", indexable: true, published: true })

export default function SeoPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsSeoSetting[]>([])
  const [routePath, setRoutePath] = useState("/")
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [draft, setDraft] = useState<CmsSeoSetting>(empty("/", "fr"))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setRows(await listSeoSettings()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft({ ...(rows.find((row) => row.route_path === routePath && row.locale === locale) ?? empty(routePath, locale)), route_path: routePath, locale }) }, [rows, routePath, locale])
  async function save() {
    if (!access.user?.id) return
    setSaving(true); setError(""); setNotice("")
    try { await saveSeoSetting(draft, access.user.id); setNotice("تم حفظ بيانات SEO والفهرسة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  async function remove() {
    if (!window.confirm("حذف إعداد SEO لهذا المسار واللغة؟")) return
    setSaving(true); setError("")
    try { await deleteSeoSetting(routePath, locale); setNotice("تم حذف إعداد SEO."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  const existing = rows.some((row) => row.route_path === routePath && row.locale === locale)
  return <PanelCard title="SEO والروابط القانونية والفهرسة" description="يمكن تحديد عنوان ووصف وCanonical مستقل لكل مسار ولغة. خيار منع الفهرسة يضيف noindex ويستبعد عنوان المسار من sitemap عند البناء." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="المسار"><Select value={routePath} onChange={(event) => setRoutePath(event.target.value)}>{ROUTES.map(([path, label]) => <option value={path} key={path}>{label} · {path}</option>)}</Select></Field>
      <Field label="عنوان الصفحة"><Input maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="الوصف التعريفي"><Textarea rows={3} maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Canonical URL" hint="رابط مطلق يبدأ بـ https:// أو http://. اتركه فارغاً لاستخدام الرابط المحلي."><Input type="url" value={draft.canonical_url} onChange={(event) => setDraft({ ...draft, canonical_url: event.target.value })} /></Field></div>
    </div>
    <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" checked={draft.indexable} onChange={(event) => setDraft({ ...draft, indexable: event.target.checked })} /> قابلة للفهرسة</label><label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> تفعيل هذا الإعداد</label></div>
    <div className="flex justify-end gap-2">{existing && <Btn variant="danger" onClick={() => void remove()} disabled={saving}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={saving || !access.user?.id}><Save className="h-4 w-4" />{saving ? "جارٍ الحفظ…" : "حفظ إعداد SEO"}</Btn></div>
  </PanelCard>
}
