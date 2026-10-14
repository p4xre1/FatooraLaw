import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Bell, CheckCheck, Loader2, Plus, RotateCcw } from "lucide-react"
import { Badge, Btn, Card, Field, Input, SectionTitle, Select, Textarea } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { useOutletContext } from "react-router"
import type { AdminAccess } from "../lib/adminAuth"
import {
  createSystemNotification,
  listSystemNotifications,
  setSystemNotificationActive,
  type Severity,
  type SystemNotification,
} from "./client"

const SEVERITY_LABEL: Record<Severity, string> = { info: "معلومة", warning: "تحذير", critical: "حرج" }
const SEVERITY_TONE: Record<Severity, "neutral" | "warn" | "serious"> = { info: "neutral", warning: "warn", critical: "serious" }

export default function NotificationsView() {
  const access = useOutletContext<AdminAccess>()
  const [items, setItems] = useState<SystemNotification[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [severity, setSeverity] = useState<Severity>("info")
  const [expiresAt, setExpiresAt] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    setLoading(true); setError(null)
    try { setItems(await listSystemNotifications()) }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر تحميل الإشعارات.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!access.user?.id || !title.trim() || !message.trim()) return
    setBusy("create"); setError(null); setNotice(null)
    try {
      await createSystemNotification({
        title: title.trim(), message: message.trim(), severity,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }, access.user.id)
      setTitle(""); setMessage(""); setSeverity("info"); setExpiresAt(""); setShowForm(false)
      setNotice("تم نشر الإشعار وتسجيل الإجراء في سجل التدقيق.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الإشعار.")
    } finally { setBusy(null) }
  }

  async function toggle(item: SystemNotification, active: boolean) {
    if (!access.user?.id) return
    setBusy(item.id); setError(null); setNotice(null)
    try {
      await setSystemNotificationActive(item.id, active)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الإشعار.")
    } finally { setBusy(null) }
  }

  const now = Date.now()
  const activeItems = items.filter((item) => item.active && (!item.expires_at || new Date(item.expires_at).getTime() > now))
  const resolvedItems = items.filter((item) => !activeItems.includes(item))

  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="إشعارات النظام" sub="رسائل تشغيلية خاصة بمشغلي المنصة. لا تُعرض هذه التنبيهات لمستخدمي الموقع العام." action={<Btn onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> إشعار جديد</Btn>} />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}

      {showForm && <Card className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold text-ink">إنشاء تنبيه داخلي</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="العنوان"><Input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} autoFocus /></Field>
            <Field label="مستوى الأهمية"><Select value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}><option value="info">معلومة</option><option value="warning">تحذير</option><option value="critical">حرج</option></Select></Field>
            <Field label="نهاية الصلاحية (اختياري)"><Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="التفاصيل"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={2000} rows={4} /></Field></div>
          </div>
          <div className="flex justify-end gap-2"><Btn type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Btn><Btn type="submit" disabled={busy === "create" || !title.trim() || !message.trim()}>{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إنشاء الإشعار</Btn></div>
        </form>
      </Card>}

      {loading ? <div className="grid min-h-40 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
        <section className="space-y-3"><div className="flex items-center gap-2"><h2 className="text-[15px] font-bold text-ink">الإشعارات النشطة</h2><Badge tone={activeItems.length ? "warn" : "good"}>{activeItems.length}</Badge></div>
          {activeItems.length ? <div className="grid gap-3 xl:grid-cols-2">{activeItems.map((item) => <NotificationCard key={item.id} item={item} busy={busy === item.id} onAction={() => void toggle(item, false)} />)}</div> : <Card className="px-5 py-10 text-center text-[13px] text-muted">لا توجد إشعارات نشطة حالياً.</Card>}
        </section>
        <section className="space-y-3"><h2 className="text-[15px] font-bold text-ink">السجل السابق</h2>
          {resolvedItems.length ? <div className="grid gap-3 xl:grid-cols-2">{resolvedItems.map((item) => <NotificationCard key={item.id} item={item} busy={busy === item.id} onAction={() => void toggle(item, !item.active)} />)}</div> : <Card className="px-5 py-8 text-center text-[12px] text-muted">لا توجد إشعارات سابقة.</Card>}
        </section>
      </>}
    </div>
  )
}

function NotificationCard({ item, busy, onAction }: { item: SystemNotification; busy: boolean; onAction: () => void }) {
  const expired = !!item.expires_at && new Date(item.expires_at).getTime() <= Date.now()
  const active = item.active && !expired
  return <Card className="p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge><Badge tone={active ? "good" : "neutral"}>{active ? "نشط" : expired ? "منتهي" : "مغلق"}</Badge><time className="text-[10px] text-faint">{formatDate(item.created_at)}</time></div><h3 className="mt-3 text-[14px] font-bold text-ink">{item.title}</h3></div>
      {(!expired || item.active) && <Btn size="sm" variant="outline" disabled={busy} onClick={onAction}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.active ? <CheckCheck className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}{item.active ? "إغلاق" : "إعادة التفعيل"}</Btn>}
    </div>
    <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">{item.message}</p>
    {item.expires_at && <p className="mt-2 text-[10px] text-faint">ينتهي: {formatDate(item.expires_at)}</p>}
  </Card>
}
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) }
