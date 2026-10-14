import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Eye, Save, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteManagedPage, listManagedPages, saveManagedPage, type CmsPage, type CmsPageSlug } from "./client"

const SLUGS: CmsPageSlug[] = ["about", "faq", "contact", "terms", "privacy"]
const NAMES: Record<CmsPageSlug, string> = { about: "À propos / عن الموقع", faq: "FAQ / الأسئلة الشائعة", contact: "Contact / التواصل", terms: "Terms / الشروط", privacy: "Privacy / الخصوصية" }
const empty = (slug: CmsPageSlug, locale: LocaleId): CmsPage => ({ slug, locale, title: "", excerpt: "", body: "", seo_title: "", seo_description: "", canonical_url: "", noindex: false, published: false, published_at: null })

export default function PagesPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsPage[]>([])
  const [slug, setSlug] = useState<CmsPageSlug>("about")
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [draft, setDraft] = useState<CmsPage>(empty("about", "fr"))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setRows(await listManagedPages()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft({ ...(rows.find((row) => row.slug === slug && row.locale === locale) ?? empty(slug, locale)), slug, locale }) }, [rows, slug, locale])

  async function save() {
    if (!access.user?.id) return
    setSaving(true); setError(""); setNotice("")
    try { await saveManagedPage(draft, access.user.id); setNotice("تم حفظ الصفحة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف مسودة الصفحة نهائياً؟")) return
    setSaving(true); setError("")
    try { await deleteManagedPage(draft.id); setNotice("تم حذف سجل الصفحة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return <PanelCard title="صفحات الموقع" description="إدارة صفحات «عن الموقع» والأسئلة الشائعة والتواصل والشروط والخصوصية بالفرنسية والعربية والإنجليزية. محتوى النص يُعرض كنص آمن ولا يُفسّر كـ HTML." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="الصفحة"><Select value={slug} onChange={(event) => setSlug(event.target.value as CmsPageSlug)}>{SLUGS.map((item) => <option key={item} value={item}>{NAMES[item]}</option>)}</Select></Field>
      <Field label="العنوان"><Input maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="مقتطف موجز"><Textarea rows={2} maxLength={1000} value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="المحتوى" hint="استخدم فقرات منفصلة بعناوين تبدأ بـ ## أو قوائم تبدأ بـ -."><Textarea rows={13} maxLength={200000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></Field></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="عنوان SEO"><Input maxLength={80} value={draft.seo_title} onChange={(event) => setDraft({ ...draft, seo_title: event.target.value })} /></Field>
      <Field label="الوصف التعريفي"><Textarea rows={2} maxLength={320} value={draft.seo_description} onChange={(event) => setDraft({ ...draft, seo_description: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="الرابط القانوني Canonical" hint="اتركه فارغاً لاستخدام رابط الصفحة المحلي."><Input type="url" value={draft.canonical_url} onChange={(event) => setDraft({ ...draft, canonical_url: event.target.value })} /></Field></div>
    </div>
    <div className="flex flex-wrap gap-5">
      <label className="flex items-center gap-2 text-[12px] font-medium text-ink"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> منشورة</label>
      <label className="flex items-center gap-2 text-[12px] font-medium text-ink"><input type="checkbox" checked={draft.noindex} onChange={(event) => setDraft({ ...draft, noindex: event.target.checked })} /> منع الفهرسة</label>
    </div>
    <Card className="bg-canvas/70 p-4"><div className="flex items-center gap-2 text-[11px] font-bold text-muted"><Eye className="h-4 w-4" /> معاينة مسودة</div><h3 className="mt-2 text-[18px] font-bold text-ink">{draft.title || "عنوان الصفحة"}</h3><p className="mt-1 text-[11px] text-muted">{draft.excerpt}</p><pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-muted">{draft.body || "سيظهر محتوى الصفحة هنا."}</pre></Card>
    <div className="flex flex-wrap justify-end gap-2">{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={saving}><Trash2 className="h-4 w-4" /> حذف الصفحة</Btn>}<Btn onClick={() => void save()} disabled={saving || !access.user?.id}><Save className="h-4 w-4" />{saving ? "جارٍ الحفظ…" : "حفظ الصفحة"}</Btn></div>
  </PanelCard>
}
