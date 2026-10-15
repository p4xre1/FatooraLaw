import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { ImagePlus, Loader2, Save, Upload } from "lucide-react"
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABELS, blogCategory, type BlogCategory, type BlogContent, type BlogTranslationLocale } from "../../lib/blog"
import type { LocaleId } from "../../lib/locales"
import { supabase } from "../../lib/supabase"
import { Btn, Card, Field, Input, Select, Textarea, Toggle } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { createPost, getPost, updatePost, type PostInput } from "./client"
import ViralChecklist from "./ViralChecklist"
import { getBlogPublishRules } from "../platform/client"
import {
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_SLUG_LENGTH,
  isValidSlug,
  sanitizeContent,
  sanitizeTitle,
  slugify,
} from "../lib/security"

type EditableLocale = LocaleId
type PublishRules = { require_translations: boolean; require_seo_metadata: boolean }
const EMPTY_CONTENT: BlogContent = { title: "", slug: "", content: "", excerpt: "", seo_title: "", seo_description: "", keywords: [] }
const LOCALE_META: Record<EditableLocale, { label: string; short: string; direction: "ltr" | "rtl" }> = {
  fr: { label: "Français", short: "FR", direction: "ltr" },
  ar: { label: "العربية", short: "AR", direction: "rtl" },
  en: { label: "English", short: "EN", direction: "ltr" },
}
const DEFAULT_RULES: PublishRules = { require_translations: true, require_seo_metadata: true }

function blankLocales(): Record<EditableLocale, BlogContent> {
  return { fr: { ...EMPTY_CONTENT }, ar: { ...EMPTY_CONTENT }, en: { ...EMPTY_CONTENT } }
}

function fromPost(post: Awaited<ReturnType<typeof getPost>>): Record<EditableLocale, BlogContent> {
  return {
    fr: { title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, seo_title: post.seo_title, seo_description: post.seo_description, keywords: post.keywords },
    ar: post.translations.ar ? { ...post.translations.ar } : { ...EMPTY_CONTENT },
    en: post.translations.en ? { ...post.translations.en } : { ...EMPTY_CONTENT },
  }
}

function cleanLocales(locales: Record<EditableLocale, BlogContent>): Record<EditableLocale, BlogContent> {
  return Object.fromEntries((Object.keys(LOCALE_META) as EditableLocale[]).map((locale) => {
    const value = locales[locale]
    return [locale, {
      title: sanitizeTitle(value.title),
      slug: value.slug.trim().toLowerCase(),
      content: sanitizeContent(value.content),
      excerpt: value.excerpt.trim(),
      seo_title: value.seo_title.trim(),
      seo_description: value.seo_description.trim(),
      keywords: [...new Set(value.keywords.map((keyword) => keyword.trim()).filter(Boolean))].slice(0, 20),
      image_url: value.image_url ? value.image_url.trim() : "",
      image_alt: value.image_alt ? value.image_alt.trim() : "",
      image_source: (value.image_source as any) || "none",
    }]
  })) as Record<EditableLocale, BlogContent>
}

/**
 * Three-locale editor for the French base post and Arabic/English translations.
 * Drafts may have incomplete translations; the database publish trigger is
 * authoritative and enforces whatever language/SEO policy the platform uses.
 */
/** Uploads a device image to the public `blog-media` bucket and returns its URL. */
async function uploadCoverImage(file: File, slug: string): Promise<string> {
  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const base = (slug || "cover").replace(/[^a-z0-9-]/gi, "-").slice(0, 60)
  const path = `posts/${Date.now()}-${base}.${extension}`
  const { error } = await supabase.storage.from("blog-media").upload(path, file, { cacheControl: "31536000", upsert: false })
  if (error) throw new Error(`تعذر رفع الصورة: ${error.message}`)
  const { data } = supabase.storage.from("blog-media").getPublicUrl(path)
  return data.publicUrl
}

const EMPTY_COVER = { url: "", alt: "", source: "none" as "none" | "url" | "upload" }

export default function BlogEditorView() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [locales, setLocales] = useState<Record<EditableLocale, BlogContent>>(blankLocales)
  const [activeLocale, setActiveLocale] = useState<EditableLocale>("fr")
  const [authorName, setAuthorName] = useState("Fatorati")
  // One section per post (shared by the translations); arriving from a section
  // page in the CMS (`/admin/blogs/category/tips`) pre-selects it.
  const [category, setCategory] = useState<BlogCategory>(() => blogCategory(searchParams.get("category")))
  const [cover, setCover] = useState(EMPTY_COVER)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [published, setPublished] = useState(false)
  const [rules, setRules] = useState<PublishRules>(DEFAULT_RULES)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getBlogPublishRules().then((publishRules) => {
      if (!cancelled) setRules(publishRules)
    }).catch(() => {
      // Unknown rules must fail closed in the form; Postgres is still final.
      if (!cancelled) setRules(DEFAULT_RULES)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setLocales(blankLocales())
    setAuthorName("Fatorati")
    setCategory(blogCategory(searchParams.get("category")))
    setCover(EMPTY_COVER)
    setPublished(false)
    setError(null)
    setNotice(null)
    setLoading(!isNew)
    if (isNew || !id) return
    let cancelled = false
    getPost(id).then((post) => {
      if (cancelled) return
      setLocales(fromPost(post))
      setAuthorName(post.author_name)
      setCategory(post.category)
      setCover({ url: post.image_url ?? "", alt: post.image_alt ?? "", source: post.image_url ? "url" : "none" })
      setPublished(post.published)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل المقال.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, isNew])

  function updateLocale(locale: EditableLocale, key: keyof BlogContent, value: string) {
    const fieldValue = key === "keywords" ? value.split(",").map((keyword) => keyword.trim()).filter(Boolean) : value
    setLocales((current) => {
      const localized = { ...current[locale], [key]: fieldValue } as BlogContent
      if (key === "title" && !current[locale].slug.trim()) localized.slug = slugify(value)
      return { ...current, [locale]: localized }
    })
  }

  function validate(input: Record<EditableLocale, BlogContent>, shouldPublish: boolean): string | null {
    const base = input.fr
    if (!base.title.trim()) return "أضف عنوان المقال بالفرنسية."
    if (!isValidSlug(base.slug)) return "رابط المقال الفرنسي مطلوب، ويجب أن يتكوّن من أحرف لاتينية صغيرة وأرقام وشرطات."
    for (const locale of ["ar", "en"] as const satisfies BlogTranslationLocale[]) {
      if (input[locale].slug && !isValidSlug(input[locale].slug)) return `رابط ${LOCALE_META[locale].label} غير صالح.`
    }
    if (!shouldPublish) return null
    if (!base.content.trim()) return "أضف نص المقال الفرنسي قبل النشر."
    if (rules.require_translations) {
      for (const locale of ["ar", "en"] as const satisfies BlogTranslationLocale[]) {
        const item = input[locale]
        if (!item.title.trim() || !item.slug || !item.content.trim()) return "أكمل العنوان والرابط والنص باللغتين العربية والإنجليزية قبل النشر."
      }
    }
    if (rules.require_seo_metadata) {
      const requiredLocales: EditableLocale[] = ["fr"]
      if (rules.require_translations) requiredLocales.push("ar", "en")
      else {
        for (const locale of ["ar", "en"] as const satisfies BlogTranslationLocale[]) {
          const item = input[locale]
          if (item.title.trim() || item.slug || item.content.trim()) requiredLocales.push(locale)
        }
      }
      for (const locale of requiredLocales) {
        const item = input[locale]
        if (item.seo_title.trim().length < 5 || item.seo_description.trim().length < 30) {
          return `أضف عنوان SEO ووصفاً لا يقل عن 30 حرفاً للنسخة ${LOCALE_META[locale].label}.`
        }
      }
    }
    return null
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving || loading) return
    setError(null)
    setNotice(null)
    const input: PostInput = {
      locales: cleanLocales(locales),
      author_name: authorName.trim() || "Fatorati",
      published,
      category,
      image_url: cover.url.trim(),
      image_alt: cover.alt.trim(),
    }
    const validationError = validate(input.locales, published)
    if (validationError) { setError(validationError); return }

    setSaving(true)
    try {
      if (isNew) {
        const post = await createPost(input)
        navigate(`/admin/blogs/${post.id}`, { replace: true, state: { saved: true } })
      } else if (id) {
        await updatePost(id, input)
        setNotice("تم حفظ المقال بنجاح.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ المقال.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" /></div>
  const active = locales[activeLocale]
  const isFrench = activeLocale === "fr"

  return (
    <form onSubmit={handleSubmit} className="mz-view space-y-5" noValidate>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-ink">{isNew ? "مقال جديد" : "تحرير المقال"}</h1>
          <p className="mt-1 text-[13px] text-muted">أنشئ نسخة فرنسية وأضف ترجمتي العربية والإنجليزية، مع بيانات SEO مستقلة لكل لغة.</p>
        </div>
        {!isNew && <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${published ? "bg-good-50 text-emerald-700" : "bg-canvas text-muted"}`}>{published ? "منشور" : "مسودة"}</span>}
      </div>

      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}

      <Card className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="لغة المقال">
          {(Object.keys(LOCALE_META) as EditableLocale[]).map((locale) => {
            const activeTab = activeLocale === locale
            const complete = !!locales[locale].title.trim() && !!locales[locale].slug && !!locales[locale].content.trim()
            return <button key={locale} type="button" role="tab" aria-selected={activeTab} onClick={() => setActiveLocale(locale)}
              className={`rounded-lg border px-4 py-2 text-[13px] font-semibold transition-colors ${activeTab ? "border-brand bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-canvas"}`}>
              {LOCALE_META[locale].label}<span className={`ms-2 text-[10px] ${complete ? "text-emerald-600" : "text-faint"}`}>{complete ? "✓" : "—"}</span>
            </button>
          })}
        </div>

        <div dir={LOCALE_META[activeLocale].direction} lang={activeLocale} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={isFrench ? "Titre français" : activeLocale === "ar" ? "عنوان المقال بالعربية" : "English article title"}>
              <Input value={active.title} onChange={(event) => updateLocale(activeLocale, "title", event.target.value)} maxLength={MAX_TITLE_LENGTH} required={isFrench} autoFocus />
            </Field>
            <Field label="Slug / رابط المقال" hint="Latin lowercase letters, numbers and hyphens. Used in the public URL.">
              <Input value={active.slug} onChange={(event) => updateLocale(activeLocale, "slug", event.target.value)} maxLength={MAX_SLUG_LENGTH} dir="ltr" className="text-start" required={isFrench} />
            </Field>
          </div>
          <Field label={activeLocale === "ar" ? "مقدمة قصيرة" : activeLocale === "en" ? "Short excerpt" : "Résumé"}>
            <Textarea value={active.excerpt} onChange={(event) => updateLocale(activeLocale, "excerpt", event.target.value)} rows={3} maxLength={500} />
          </Field>
          <Field label={activeLocale === "ar" ? "نص المقال" : activeLocale === "en" ? "Article content" : "Contenu de l’article"} hint="Plain text with Markdown-style headings (#, ##) and lists (- item) supported. HTML is displayed as text for safety.">
            <Textarea value={active.content} onChange={(event) => updateLocale(activeLocale, "content", event.target.value)} rows={15} maxLength={MAX_CONTENT_LENGTH} className="leading-loose" />
          </Field>
          <div className="rounded-xl border border-line bg-canvas/60 p-4">
            <div className="mb-3">
              <h2 className="text-[13px] font-bold text-ink">SEO / GEO</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">اكتب عنواناً واضحاً ووصفاً دقيقاً يسهل على محركات البحث ومحركات الإجابة فهم المقال. استخدم كلمات مفتاحية حقيقية فقط.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="SEO title" hint="5–80 characters">
                <Input value={active.seo_title} onChange={(event) => updateLocale(activeLocale, "seo_title", event.target.value)} maxLength={80} />
              </Field>
              <Field label="Keywords / كلمات مفتاحية" hint="Separate terms with commas; up to 20">
                <Input value={active.keywords.join(", ")} onChange={(event) => updateLocale(activeLocale, "keywords", event.target.value)} placeholder="VAT Morocco, small business" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Meta description" hint="30–320 characters">
                  <Textarea value={active.seo_description} onChange={(event) => updateLocale(activeLocale, "seo_description", event.target.value)} rows={3} maxLength={320} />
                </Field>
              </div>
            </div>
            <div className="mt-4">
              <ViralChecklist post={{ ...active, image_url: cover.url, image_alt: cover.alt, brandName: "Fatorati", siteHost: "fatorati.tech" }} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="القسم / Section" hint="يظهر المقال في صفحة هذا القسم على الموقع (/blog/…) وفي شارة القسم على البطاقات والقائمة الجانبية.">
            <Select value={category} onChange={(event) => setCategory(blogCategory(event.target.value))}>
              {BLOG_CATEGORIES.map((key) => (
                <option key={key} value={key}>{BLOG_CATEGORY_LABELS[key].ar} — {BLOG_CATEGORY_LABELS[key].fr} ({key})</option>
              ))}
            </Select>
          </Field>
          <Field label="اسم الكاتب">
            <Input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={120} dir="auto" />
          </Field>
        </div>

        {/* Cover image: URL or upload from the device, plus alt text (falls
            back to the title when left empty — both persisted post-level). */}
        <div className="rounded-xl border border-line bg-canvas/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-brand" aria-hidden="true" />
            <h2 className="text-[13px] font-bold text-ink">صورة الغلاف (اختياري)</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="رابط الصورة">
              <Input value={cover.url} onChange={(event) => setCover({ ...cover, url: event.target.value, source: event.target.value ? "url" : "none" })} placeholder="https://…" dir="ltr" className="text-start" />
            </Field>
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  try {
                    const url = await uploadCoverImage(file, locales.fr.slug)
                    setCover((current) => ({ ...current, url, source: "upload" }))
                  } catch (uploadError) {
                    setError(uploadError instanceof Error ? uploadError.message : "تعذر رفع الصورة.")
                  } finally {
                    setUploading(false)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }
                }}
              />
              <Btn type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                رفع صورة — اختر صورة من جهازك
              </Btn>
            </div>
          </div>
          <Field label="النص البديل للصورة (Alt Text) — لتحسين ظهورها في نتائج بحث الصور" hint="إن تُرك فارغاً، سيُستخدم العنوان الرئيسي تلقائياً كنص بديل.">
            <Input value={cover.alt} onChange={(event) => setCover({ ...cover, alt: event.target.value })} maxLength={300} dir="auto" />
          </Field>
          {cover.url && <img src={cover.url} alt={cover.alt.trim() || locales.fr.title || "معاينة الغلاف"} className="mt-3 max-h-48 w-full rounded-lg border border-line object-cover" />}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3.5 py-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">نشر المقال</p>
            <p className="text-[12px] text-muted">المسودات لا تظهر للزوار. سيُعاد التحقق من الترجمات وبيانات SEO عند النشر.</p>
          </div>
          <Toggle checked={published} onChange={setPublished} />
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Btn type="button" variant="outline" onClick={() => navigate("/admin/blogs")}>إلغاء</Btn>
        <Btn type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ المقال
        </Btn>
      </div>
    </form>
  )
}
