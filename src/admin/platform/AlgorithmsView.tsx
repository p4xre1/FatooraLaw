import { useEffect, useState } from "react"
import { RotateCcw, Save, SlidersHorizontal } from "lucide-react"
import { Btn, Card, SectionTitle, Toggle } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { useOutletContext } from "react-router"
import type { AdminAccess } from "../lib/adminAuth"
import { getPlatformSettings, savePlatformSettings, type PlatformSettings } from "./client"

type ControlValues = Pick<PlatformSettings, "tracking_enabled" | "require_translations" | "require_seo_metadata">
const DEFAULTS: ControlValues = { tracking_enabled: true, require_translations: true, require_seo_metadata: true }

export default function AlgorithmsView() {
  const access = useOutletContext<AdminAccess>()
  const [saved, setSaved] = useState<ControlValues>(DEFAULTS)
  const [draft, setDraft] = useState<ControlValues>(DEFAULTS)
  const [updatedAt, setUpdatedAt] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    setLoading(true); setError(null)
    try {
      const settings = await getPlatformSettings()
      const values = { tracking_enabled: settings.tracking_enabled, require_translations: settings.require_translations, require_seo_metadata: settings.require_seo_metadata }
      setSaved(values); setDraft(values); setUpdatedAt(settings.updated_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل إعدادات النظام.")
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  async function save() {
    if (!access.user?.id) return
    setSaving(true); setError(null); setNotice(null)
    try {
      await savePlatformSettings(draft, access.user.id)
      setSaved(draft)
      setUpdatedAt(new Date().toISOString())
      setNotice("تم حفظ الضوابط وتسجيل التغيير في سجل التدقيق.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الضوابط.")
    } finally { setSaving(false) }
  }

  const changed = Object.keys(draft).some((key) => draft[key as keyof ControlValues] !== saved[key as keyof ControlValues])
  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="قواعد النظام والتحكم" sub="ضوابط التشغيل الحالية لسلوك النشر وقياس الزيارات." />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}
      {loading ? <div className="min-h-40 animate-pulse rounded-xl bg-canvas" /> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/15 bg-brand-50/60 p-4">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white"><SlidersHorizontal className="h-4 w-4" /></span><div><p className="text-[13px] font-bold text-ink">نطاق التحكم الآمن</p><p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">هذه المفاتيح تتحكم في نشر المقالات وقياس الزيارات فقط. وحدة المخاطر الحالية تعرض سجلات تجريبية ثابتة ولا تحتوي على نموذج تقييم قابل للضبط؛ لذلك لا نعرض مفاتيح تغيّر حسابات المخاطر قبل تعريف قواعدها ومالكها.</p></div></div>
          <span className="rounded-full bg-surface/70 px-3 py-1 text-[10px] font-semibold text-muted">آخر تحديث: {updatedAt ? new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short" }).format(new Date(updatedAt)) : "—"}</span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ControlCard title="قياس زيارات الموقع" description="يسمح بتسجيل مشاهدة صفحة أول-طرف بعد موافقة الزائر فقط. تعطيله يوقف الإدخال من قاعدة البيانات فوراً." checked={draft.tracking_enabled} onChange={(value) => setDraft((current) => ({ ...current, tracking_enabled: value }))} enabledLabel="مفعّل" disabledLabel="متوقف" />
          <ControlCard title="اشتراط الترجمات" description="يطلب نصاً وعنواناً ورابطاً فرنسياً وعربياً وإنجليزياً عند نشر المقال. المسودات تظل قابلة للحفظ قبل اكتمال اللغات." checked={draft.require_translations} onChange={(value) => setDraft((current) => ({ ...current, require_translations: value }))} enabledLabel="كل اللغات مطلوبة" disabledLabel="الفرنسية إلزامية فقط" />
          <ControlCard title="اشتراط بيانات SEO" description="يفرض عنوان SEO ووصفاً مفيداً لكل نسخة منشورة. تغيير هذا الخيار يؤثر على المقالات التي ستُنشر لاحقاً." checked={draft.require_seo_metadata} onChange={(value) => setDraft((current) => ({ ...current, require_seo_metadata: value }))} enabledLabel="مطلوبة" disabledLabel="اختيارية" />
        </div>

        <Card className="p-4 sm:p-5">
          <h2 className="text-[14px] font-bold text-ink">ما الذي لا يتم التحكم به هنا؟</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-[12px] leading-relaxed text-muted">
            <li>لا تُغيّر هذه الشاشة أسعار الخطط أو صلاحيات الوصول؛ لكل منها قسم محمي منفصل.</li>
            <li>لا توجد حالياً درجات مخاطر ديناميكية في المنتج لتهيئتها. لن نختلق أوزاناً أو قرارات آلية غير معرّفة.</li>
            <li>كل تغيير محفوظ يُسجّل مع هوية مشغل المنصة في سجل التدقيق.</li>
          </ul>
        </Card>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={() => setDraft(saved)} disabled={!changed || saving}><RotateCcw className="h-4 w-4" /> تراجع</Btn>
          <Btn onClick={() => void save()} disabled={!changed || saving}>{saving ? "جارٍ الحفظ…" : <><Save className="h-4 w-4" /> حفظ الضوابط</>}</Btn>
        </div>
      </>}
    </div>
  )
}

function ControlCard({ title, description, checked, onChange, enabledLabel, disabledLabel }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; enabledLabel: string; disabledLabel: string }) {
  return <Card className="flex items-start justify-between gap-5 p-5"><div className="min-w-0"><h2 className="text-[14px] font-bold text-ink">{title}</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">{description}</p><p className={`mt-3 text-[11px] font-bold ${checked ? "text-emerald-700" : "text-muted"}`}>{checked ? enabledLabel : disabledLabel}</p></div><Toggle checked={checked} onChange={onChange} /></Card>
}
