import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge, Btn, Card, EmptyState, SectionTitle, Table, Td, Th } from "../../components/kit"
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABELS, blogCategory, type BlogCategory } from "../../lib/blog"
import type { Post } from "./client"
import { deletePost, listPosts, setPublished } from "./client"

/**
 * The posts table, organised by section. `/admin/blogs` lists everything;
 * `/admin/blogs/category/:category` is the per-section page — the tabs below
 * are those same routes, so every section has its own address to work in.
 */
export default function BlogListView() {
  const params = useParams<{ category?: string }>()
  const routeCategory: BlogCategory | null = params.category ? blogCategory(params.category) : null
  const [searchParams] = useSearchParams()
  const activeCategory: BlogCategory | null = routeCategory ?? (searchParams.get("category") ? blogCategory(searchParams.get("category")) : null)
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setError(null)
      setPosts(await listPosts())
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المقالات.")
    } finally { setLoading(false) }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onTogglePublish(post: Post) {
    setBusyId(post.id)
    try {
      await setPublished(post.id, !post.published)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث حالة النشر.")
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(post: Post) {
    if (!window.confirm(`حذف "${post.title}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return
    setBusyId(post.id)
    try {
      await deletePost(post.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف المقال.")
    } finally {
      setBusyId(null)
    }
  }

  const visible = activeCategory && posts ? posts.filter((post) => post.category === activeCategory) : posts
  const counts = new Map<BlogCategory, number>()
  for (const post of posts ?? []) counts.set(post.category, (counts.get(post.category) ?? 0) + 1)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title={activeCategory ? `المقالات — ${BLOG_CATEGORY_LABELS[activeCategory].ar}` : "المقالات"}
        sub={activeCategory ? `قسم «${BLOG_CATEGORY_LABELS[activeCategory].ar}» (${activeCategory}) على الموقع: /blog/${activeCategory}` : "إدارة محتوى المدونة، منظمة حسب الأقسام: نصائح، أخبار، مقالات، منتجات وأدلة."}
        action={
          <Link to={activeCategory ? `/admin/blogs/new?category=${activeCategory}` : "/admin/blogs/new"}>
            <Btn>
              <Plus className="h-4 w-4" /> {activeCategory ? `مقال جديد في ${BLOG_CATEGORY_LABELS[activeCategory].ar}` : "مقال جديد"}
            </Btn>
          </Link>
        }
      />

      {/* Section tabs — each one is its own CMS page address. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="أقسام المدونة">
        <Link to="/admin/blogs">
          <button type="button" role="tab" aria-selected={activeCategory === null} className={`rounded-lg border px-3.5 py-2 text-[12px] font-semibold ${activeCategory === null ? "border-brand bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-canvas"}`}>
            الكل {posts ? `(${posts.length})` : ""}
          </button>
        </Link>
        {BLOG_CATEGORIES.map((category) => (
          <Link key={category} to={`/admin/blogs/category/${category}`}>
            <button type="button" role="tab" aria-selected={activeCategory === category} className={`rounded-lg border px-3.5 py-2 text-[12px] font-semibold ${activeCategory === category ? "border-brand bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-canvas"}`}>
              {BLOG_CATEGORY_LABELS[category].ar} {posts ? `(${counts.get(category) ?? 0})` : ""}
            </button>
          </Link>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-[13px] text-serious">
          <p>{error}</p>
          <Btn variant="outline" size="sm" disabled={loading} onClick={() => { void refresh() }}>إعادة المحاولة</Btn>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
          </div>
        ) : visible === null || visible.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} text={activeCategory ? `لا توجد مقالات في قسم ${BLOG_CATEGORY_LABELS[activeCategory].ar} بعد.` : "لا توجد مقالات بعد."} />
        ) : (
          <Table
            head={
              <>
                <Th>العنوان</Th>
                <Th>القسم</Th>
                <Th>الحالة</Th>
                <Th>الترجمات</Th>
                <Th>SEO</Th>
                <Th>آخر تحديث</Th>
                <Th className="text-end">إجراءات</Th>
              </>
            }
          >
            {visible.map((post) => (
              <tr key={post.id}>
                <Td className="max-w-xs"><p className="truncate font-medium text-ink">{post.title}</p><p className="mt-0.5 truncate font-mono text-[10px] text-faint">/blog/{post.slug}</p></Td>
                <Td><Badge tone="neutral">{BLOG_CATEGORY_LABELS[post.category].ar}</Badge></Td>
                <Td>
                  <button onClick={() => onTogglePublish(post)} disabled={busyId === post.id} className="disabled:opacity-50">
                    <Badge tone={post.published ? "good" : "neutral"} dot>
                      {post.published ? "منشور" : "مسودة"}
                    </Badge>
                  </button>
                </Td>
                <Td><div className="flex gap-1"><LocaleStatus label="FR" ready={!!(post.title && post.slug && post.content)} /><LocaleStatus label="AR" ready={!!(post.translations.ar?.title && post.translations.ar.slug && post.translations.ar.content)} /><LocaleStatus label="EN" ready={!!(post.translations.en?.title && post.translations.en.slug && post.translations.en.content)} /></div></Td>
                <Td><div className="flex gap-1"><LocaleStatus label="FR" ready={!!(post.seo_title.trim() && post.seo_description.trim())} /><LocaleStatus label="AR" ready={!!(post.translations.ar?.seo_title && post.translations.ar.seo_description)} /><LocaleStatus label="EN" ready={!!(post.translations.en?.seo_title && post.translations.en.seo_description)} /></div></Td>
                <Td className="text-muted">{new Date(post.updated_at).toLocaleDateString("ar-MA")}</Td>
                <Td className="text-end">
                  <div className="flex justify-end gap-1">
                    <Link to={`/admin/blogs/${post.id}`}>
                      <Btn variant="ghost" size="sm">
                        <Pencil className="h-3.5 w-3.5" />
                      </Btn>
                    </Link>
                    <Btn variant="ghost" size="sm" onClick={() => onDelete(post)} disabled={busyId === post.id}>
                      <Trash2 className="h-3.5 w-3.5 text-serious" />
                    </Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}

function LocaleStatus({ label, ready }: { label: string; ready: boolean }) {
  return <Badge tone={ready ? "good" : "neutral"}>{label}</Badge>
}
