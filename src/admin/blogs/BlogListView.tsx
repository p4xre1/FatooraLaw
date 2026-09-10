import { useEffect, useState } from "react"
import { Link } from "react-router"
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge, Btn, Card, EmptyState, SectionTitle, Table, Td, Th } from "../../components/kit"
import { deletePost, listPosts, setPublished, type Post } from "./client"

export default function BlogListView() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    try {
      setError(null)
      setPosts(await listPosts())
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المقالات.")
    }
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

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title="المقالات"
        sub="إدارة محتوى المدونة القانونية المنشور على الموقع."
        action={
          <Link to="/admin/blogs/new">
            <Btn>
              <Plus className="h-4 w-4" /> مقال جديد
            </Btn>
          </Link>
        }
      />

      {error && <p className="text-[13px] text-serious">{error}</p>}

      <Card>
        {posts === null ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} text="لا توجد مقالات بعد." />
        ) : (
          <Table
            head={
              <>
                <Th>العنوان</Th>
                <Th>الحالة</Th>
                <Th>آخر تحديث</Th>
                <Th className="text-end">إجراءات</Th>
              </>
            }
          >
            {posts.map((post) => (
              <tr key={post.id}>
                <Td className="max-w-xs truncate font-medium text-ink">{post.title}</Td>
                <Td>
                  <button onClick={() => onTogglePublish(post)} disabled={busyId === post.id} className="disabled:opacity-50">
                    <Badge tone={post.published ? "good" : "neutral"} dot>
                      {post.published ? "منشور" : "مسودة"}
                    </Badge>
                  </button>
                </Td>
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
