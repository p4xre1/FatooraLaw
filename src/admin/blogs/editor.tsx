import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate, useParams } from "react-router"
import { Loader2, Save } from "lucide-react"
import { Btn, Card, Field, Input, Textarea, Toggle } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { createPost, getPost, updatePost } from "./client"
import {
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  isValidSlug,
  sanitizeContent,
  sanitizeTitle,
  slugify,
} from "../lib/security"

/**
 * Create/edit view for a single post — the "editor" module referenced in
 * the CMS requirements. Reachable at /admin/blogs/new (create) and
 * /admin/blogs/:id (edit).
 *
 * RTL: the parent <AdminLayout/> already renders `dir="rtl" lang="ar"`,
 * which this form simply inherits — no per-field `dir` overrides needed
 * except on the slug input, which stays LTR on purpose (URL slugs are
 * Latin characters read left-to-right even inside an Arabic-language
 * page). The Arabic Tajawal font comes from the same global
 * `[dir='rtl']` CSS rule the rest of the app already uses — nothing new
 * to configure here.
 *
 * Sanitization: title/slug/content are re-sanitized client-side right
 * before submit (src/admin/lib/security.ts) purely for UX — trimming
 * stray whitespace, rejecting an invalid slug before spending a network
 * round trip, etc. The database CHECK constraints and RLS policies in
 * supabase/schema.sql are what actually enforce these rules.
 */
export default function BlogEditorView() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [content, setContent] = useState("")
  const [published, setPublishedState] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    getPost(id)
      .then((post) => {
        if (cancelled) return
        setTitle(post.title)
        setSlug(post.slug)
        setSlugTouched(true)
        setContent(post.content)
        setPublishedState(post.published)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "تعذر تحميل المقال."))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  function onTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanTitle = sanitizeTitle(title)
    const cleanSlug = slug.trim().toLowerCase()
    const cleanContent = sanitizeContent(content)

    if (!cleanTitle) {
      setError("العنوان مطلوب.")
      return
    }
    if (!isValidSlug(cleanSlug)) {
      setError("الرابط المختصر يجب أن يحتوي على أحرف لاتينية صغيرة وأرقام وشرطات فقط، مثل: my-article-title.")
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const post = await createPost({ title: cleanTitle, slug: cleanSlug, content: cleanContent, published })
        navigate(`/admin/blogs/${post.id}`, { replace: true })
      } else if (id) {
        await updatePost(id, { title: cleanTitle, slug: cleanSlug, content: cleanContent, published })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ المقال.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mz-view space-y-5" noValidate>
      <h1 className="text-[20px] font-bold text-ink">{isNew ? "مقال جديد" : "تعديل المقال"}</h1>

      {error && <FormAlert kind="error">{error}</FormAlert>}

      <Card className="space-y-4 p-5">
        <Field label="العنوان">
          <Input value={title} onChange={(e) => onTitleChange(e.target.value)} maxLength={MAX_TITLE_LENGTH} required autoFocus />
        </Field>

        <Field label="الرابط المختصر (Slug)" hint="يُستخدم في رابط المقال — أحرف لاتينية صغيرة وأرقام وشرطات فقط.">
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            dir="ltr"
            className="text-start"
            required
          />
        </Field>

        <Field label="المحتوى">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            maxLength={MAX_CONTENT_LENGTH}
            className="leading-loose"
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3.5 py-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">نشر المقال</p>
            <p className="text-[12px] text-muted">المقالات غير المنشورة تبقى كمسودة، ولا يراها إلا المسؤولون.</p>
          </div>
          <Toggle checked={published} onChange={setPublishedState} />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Btn type="button" variant="outline" onClick={() => navigate("/admin/blogs")}>
          إلغاء
        </Btn>
        <Btn type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ
        </Btn>
      </div>
    </form>
  )
}
