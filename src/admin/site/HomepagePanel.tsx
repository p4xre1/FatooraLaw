import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Save } from "lucide-react"
import { Btn, Card, Field, Input, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { listHomepageContent, saveHomepageContent, type CmsHomepage } from "./client"

const empty = (locale: LocaleId): CmsHomepage => ({ locale, headline: "", subheadline: "", primary_cta: "", feature_cards: [], hero_image_url: "", published: false })

export default function HomepagePanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsHomepage[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [draft, setDraft] = useState<CmsHomepage>(empty("fr"))
  const [cardsText, setCardsText] = useState("[]")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function refresh() {
    setLoading(true)
    try { setRows(await listHomepageContent()); setError("") }
    catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    const row = rows.find((item) => item.locale === locale) ?? empty(locale)
    setDraft({ ...row, locale })
    setCardsText(JSON.stringify(row.feature_cards ?? [], null, 2))
  }, [rows, locale])

  async function save() {
    if (!access.user?.id) return
    let featureCards: Record<string, unknown>[]
    try {
      const parsed: unknown = JSON.parse(cardsText)
      if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new Error("اكتب مصفوفة JSON من كائنات الميزات.")
      featureCards = parsed as Record<string, unknown>[]
    } catch (err) { setError(errorMessage(err)); return }
    setSaving(true); setError(""); setNotice("")
    try {
      await saveHomepageContent({ ...draft, locale, feature_cards: featureCards }, access.user.id)
      setNotice("تم حفظ محتوى الصفحة الرئيسية.")
      await refresh()
    } catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return <PanelCard title="محرر الصفحة الرئيسية" description="يتم عرض العنوان والوصف وزر الدعوة والصورة والبطاقات للغة المنشورة. اترك النشر مغلقاً لحفظ مسودة داخلية فقط." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label="العنوان الرئيسي"><Input maxLength={240} value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} /></Field>
      <Field label="نص زر الدعوة"><Input maxLength={80} value={draft.primary_cta} onChange={(event) => setDraft({ ...draft, primary_cta: event.target.value })} /></Field>
      <div className="lg:col-span-2"><Field label="الوصف"><Textarea rows={3} maxLength={1200} value={draft.subheadline} onChange={(event) => setDraft({ ...draft, subheadline: event.target.value })} /></Field></div>
      <div className="lg:col-span-2"><Field label="رابط صورة المقدمة" hint="رابط عام من مكتبة الصور. الملفات المرفوعة في هذا القسم متاحة للزوار."><Input type="url" value={draft.hero_image_url} onChange={(event) => setDraft({ ...draft, hero_image_url: event.target.value })} /></Field></div>
      <div className="lg:col-span-2"><Field label="بطاقات الصفحة الرئيسية (JSON)" hint={'مثال: [{"title":"ميزة","description":"شرح مختصر"}]'}><Textarea rows={5} dir="ltr" className="font-mono text-[12px]" value={cardsText} onChange={(event) => setCardsText(event.target.value)} /></Field></div>
    </div>
    <label className="flex items-center gap-2 text-[12px] font-semibold text-ink"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> نشر محتوى هذه اللغة للعامة</label>
    <Card className="bg-canvas/70 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">معاينة النص</p><h3 className="mt-2 text-[20px] font-bold text-ink">{draft.headline || "العنوان سيظهر هنا"}</h3><p className="mt-2 text-[12px] leading-relaxed text-muted">{draft.subheadline || "وصف المقدمة"}</p>{draft.hero_image_url && <img src={draft.hero_image_url} alt="معاينة الصورة" className="mt-3 max-h-44 rounded-lg object-cover" />}</Card>
    <div className="flex justify-end"><Btn onClick={() => void save()} disabled={saving || !access.user?.id}><Save className="h-4 w-4" />{saving ? "جارٍ الحفظ…" : "حفظ الصفحة الرئيسية"}</Btn></div>
  </PanelCard>
}
