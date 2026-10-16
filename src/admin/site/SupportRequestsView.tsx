import { useEffect, useState } from "react"
import { Check, Loader2, Save, Search } from "lucide-react"
import { Badge, Btn, Card, SectionTitle, Select, Table, Td, Th, Textarea } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { updateSupportRequest, listSupportRequests, type CmsSupportRequest } from "./client"
import AccountLookupPanel from "./AccountLookupPanel"

const STATUSES: Record<CmsSupportRequest["status"], string> = { new: "جديد", triaged: "تم الفرز", in_progress: "قيد المعالجة", resolved: "تم الحل", closed: "مغلق" }
const CATEGORIES: Record<CmsSupportRequest["category"], string> = { contact: "استفسار", bug: "خلل", feedback: "ملاحظات", feature_request: "اقتراح ميزة" }

export default function SupportRequestsView() {
  const [rows, setRows] = useState<CmsSupportRequest[]>([])
  const [drafts, setDrafts] = useState<Record<string, Pick<CmsSupportRequest, "status" | "internal_note">>>({})
  const [filter, setFilter] = useState("all")
  /** Which ticket the lookup panel should resolve; a fresh id re-runs the query. */
  const [lookupRequestId, setLookupRequestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() {
    setLoading(true); setError("")
    try { const data = await listSupportRequests(); setRows(data); setDrafts(Object.fromEntries(data.map((row) => [row.id, { status: row.status, internal_note: row.internal_note }])))}
    catch (err) { setError(err instanceof Error ? err.message : "تعذر تحميل صندوق الدعم.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter)
  async function save(row: CmsSupportRequest) {
    const draft = drafts[row.id]
    setBusy(row.id); setError(""); setNotice("")
    try { await updateSupportRequest({ id: row.id, status: draft.status, internal_note: draft.internal_note }); setNotice("تم حفظ تحديث الطلب والملاحظة الداخلية."); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر تحديث الطلب.") }
    finally { setBusy(null) }
  }
  return <div className="mz-view space-y-5">
    <SectionTitle title="صندوق الدعم والبلاغات" sub="طلبات التواصل، الإبلاغ عن الأخطاء، الملاحظات واقتراحات الميزات. لا يرى هذه البيانات إلا مشغلو المنصة." />
    {error && <FormAlert kind="error">{error}</FormAlert>}{notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[12px] text-emerald-800">{notice}</div>}
    <AccountLookupPanel requestId={lookupRequestId} />
    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3"><p className="text-[12px] font-bold text-ink">{visible.length} طلب</p><Select aria-label="تصفية الحالة" className="max-w-48" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.entries(STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></div>
      {loading ? <div className="grid min-h-40 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : visible.length ? <div className="divide-y divide-line">{visible.map((row) => {
        const draft = drafts[row.id] ?? { status: row.status, internal_note: row.internal_note }
        return <article key={row.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={row.status === "new" ? "warn" : row.status === "resolved" ? "good" : "neutral"}>{STATUSES[row.status]}</Badge><Badge tone="brand">{CATEGORIES[row.category]}</Badge><time className="text-[10px] text-faint">{safeDate(row.created_at)}</time></div><h2 className="mt-2 text-[14px] font-bold text-ink">{row.subject}</h2><p className="mt-1 text-[11px] text-muted">{row.name} · <a href={`mailto:${encodeURIComponent(row.email)}`} className="text-brand-700 underline">{row.email}</a></p><p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-canvas/70 p-3 text-[12px] leading-relaxed text-ink">{row.message}</p><p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-faint">{row.user_id
          ? <><span>طلب من حساب مسجَّل</span><button type="button" onClick={() => setLookupRequestId(row.id)} className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface px-2 py-1 text-[10px] font-bold text-ink hover:border-muted"><Search className="h-3 w-3" /> فحص حساب صاحب الطلب</button></>
          : <span>طلب زائر — لا يوجد حساب لفحصه، والبريد المكتوب غير موثَّق</span>}</p></div>
          <div className="space-y-3 rounded-lg border border-line bg-canvas/40 p-3"><label className="block"><span className="mb-1 block text-[10px] font-semibold text-muted">الحالة</span><Select value={draft.status} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, status: event.target.value as CmsSupportRequest["status"] } })}>{Object.entries(STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></label><label className="block"><span className="mb-1 block text-[10px] font-semibold text-muted">ملاحظة داخلية (لا تظهر للعميل)</span><Textarea rows={4} maxLength={4000} value={draft.internal_note} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, internal_note: event.target.value } })} /></label><div className="flex justify-end"><Btn size="sm" onClick={() => void save(row)} disabled={busy === row.id}>{busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ</Btn></div></div>
        </article>
      })}</div> : <div className="px-4 py-10 text-center text-[12px] text-muted">لا توجد طلبات بهذه الحالة.</div>}
    </Card>
  </div>
}
function safeDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(date) }
