import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Archive, Eye, Loader2, RotateCcw, Save } from "lucide-react"
import { Badge, Btn, Card, Field, Input, SectionTitle, Table, Td, Th } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import type { AdminAccess } from "../lib/adminAuth"
import { createCmsBackup, listCmsBackups, listCmsRevisions, restoreCmsBackup, type CmsBackup, type CmsRevision } from "./client"

export default function BackupsView() {
  const access = useOutletContext<AdminAccess>()
  const [backups, setBackups] = useState<CmsBackup[]>([])
  const [revisions, setRevisions] = useState<CmsRevision[]>([])
  const [label, setLabel] = useState("")
  const [selectedRevision, setSelectedRevision] = useState<CmsRevision | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() {
    setLoading(true); setError("")
    try { const [nextBackups, nextRevisions] = await Promise.all([listCmsBackups(), listCmsRevisions(300)]); setBackups(nextBackups); setRevisions(nextRevisions) }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر تحميل النسخ أو سجل المراجعات.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function create() {
    if (!access.user?.id) return
    setBusy("create"); setError(""); setNotice("")
    try { const result = await createCmsBackup(label.trim()); setLabel(""); setNotice(`تم إنشاء نسخة احتياطية ${result.id.slice(0, 8)}.`); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر إنشاء النسخة.") }
    finally { setBusy(null) }
  }
  async function restore(backup: CmsBackup) {
    if (!window.confirm(`استعادة النسخة «${backup.label || backup.id.slice(0, 8)}»؟ سيُستبدل محتوى الموقع والمدونة الحالي بالكامل، وتُسجل العملية في سجل التدقيق.`)) return
    setBusy(backup.id); setError(""); setNotice("")
    try { await restoreCmsBackup(backup.id); setNotice("تمت استعادة نسخة المحتوى. تحقق من الصفحات العامة بعد إعادة البناء."); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : "تعذرت استعادة النسخة.") }
    finally { setBusy(null) }
  }
  return <div className="mz-view space-y-6">
    <SectionTitle title="المراجعات والنسخ الاحتياطية" sub="معاينة سجل التغييرات وإنشاء نسخ محتوى واستعادة snapshot كامل للموقع والمدونة." />
    {error && <FormAlert kind="error">{error}</FormAlert>}{notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[12px] text-emerald-800">{notice}</div>}
    <Card className="p-4 sm:p-5"><h2 className="text-[14px] font-bold text-ink">إنشاء نسخة جديدة</h2><p className="mt-1 text-[11px] leading-relaxed text-muted">تتضمن المحتوى والصفحات وSEO والأصول كبيانات وصفية والميزات والإصدارات والتنزيلات والمنتجات والإعلانات ومقالات المدونة وترجماتها. لا تنسخ ملفات الصور الثنائية أو الطلبات/الاشتراكات/الدفع.</p><div className="mt-4 flex flex-wrap items-end gap-3"><Field label="اسم النسخة"><Input maxLength={160} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="قبل تحديث الموقع" className="min-w-64" /></Field><Btn onClick={() => void create()} disabled={busy === "create" || !access.user?.id}>{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} إنشاء نسخة</Btn></div></Card>
    <Card className="overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="text-[14px] font-bold text-ink">النسخ المتاحة</h2></div>{loading ? <div className="grid min-h-32 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : backups.length ? <Table head={<><Th>الاسم</Th><Th>تاريخ الإنشاء</Th><Th>معرّف</Th><Th></Th></>}>
      {backups.map((backup) => <tr key={backup.id}><Td className="font-semibold">{backup.label || "نسخة بلا اسم"}</Td><Td className="text-[11px] text-muted">{safeDate(backup.created_at)}</Td><Td><code className="text-[10px] text-muted">{backup.id}</code></Td><Td><Btn size="sm" variant="outline" disabled={busy === backup.id} onClick={() => void restore(backup)}>{busy === backup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} استعادة</Btn></Td></tr>)}
    </Table> : <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد نسخ احتياطية بعد.</p>}</Card>
    <Card className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><div><h2 className="text-[14px] font-bold text-ink">سجل مراجعات المحتوى</h2><p className="mt-1 text-[11px] text-muted">لقطات قبل التغيير أو عند إنشاء سجل. المعاينة للقراءة فقط؛ لاسترجاع كامل استخدم نسخة احتياطية.</p></div><Badge tone="brand"><Eye className="h-3.5 w-3.5" /> {revisions.length} حديثة</Badge></div>{loading ? <div className="grid min-h-28 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : revisions.length ? <Table head={<><Th>النوع</Th><Th>المعرّف</Th><Th>اللغة</Th><Th>التاريخ</Th><Th></Th></>}>
      {revisions.map((revision) => <tr key={revision.id}><Td>{revision.entity_type}</Td><Td className="max-w-48 truncate font-mono text-[10px]">{revision.entity_id}</Td><Td>{revision.locale || "—"}</Td><Td className="text-[10px] text-muted">{safeDate(revision.created_at)}</Td><Td><Btn size="sm" variant="ghost" onClick={() => setSelectedRevision(revision)}><Eye className="h-3.5 w-3.5" /> معاينة</Btn></Td></tr>)}
    </Table> : <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد مراجعات بعد.</p>}</Card>
    {selectedRevision && <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" onClick={() => setSelectedRevision(null)}><div role="dialog" aria-modal="true" aria-labelledby="revision-title" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-line bg-surface p-4 shadow-2xl"><div className="flex items-center justify-between gap-3"><h2 id="revision-title" className="text-[14px] font-bold text-ink">لقطة {selectedRevision.entity_type} · {selectedRevision.entity_id}</h2><Btn size="sm" variant="outline" onClick={() => setSelectedRevision(null)}>إغلاق</Btn></div><pre dir="ltr" className="mt-4 max-h-[70vh] overflow-auto rounded-lg bg-canvas p-3 text-[10px] leading-relaxed text-muted">{JSON.stringify(selectedRevision.snapshot, null, 2)}</pre></div></div>}
  </div>
}
function safeDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(date) }
