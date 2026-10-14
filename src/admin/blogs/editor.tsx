import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate, useParams } from "react-router"
import { Loader2, Save } from "lucide-react"
import type { BlogContent, BlogTranslationLocale } from "../../lib/blog"
import type { LocaleId } from "../../lib/locales"
import { Btn, Card, Field, Input, Textarea, Toggle } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { createPost, getPost, updatePost, type PostInput } from "./client"
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
    }]
  })) as Record<EditableLocale, BlogContent>
}

/**
 * Three-locale editor for the French base post and Arabic/English translations.
 * Drafts may have incomplete translations; the database publish trigger is
 * authoritative and enforces whatever language/SEO policy the platform uses.
 */
export default function BlogEditorView() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [locales, setLocales] = useState<Record<EditableLocale, BlogContent>>(blankLocales)
  const [activeLocale, setActiveLocale] = useState<EditableLocale>("fr")
  const [authorName, setAuthorName] = useState("Fatorati")
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
    const input: PostInput = { locales: cleanLocales(locales), author_name: authorName.trim() || "Fatorati", published }
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
          </div>
        </div>

        <Field label="اسم الكاتب">
          <Input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={120} dir="auto" />
        </Field>
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
