import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { KeyRound, Loader2, Search, Shield, ShieldCheck, UserCog } from "lucide-react"
import { Badge, Btn, Card, Input, SectionTitle, Table, Td, Th } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { useOutletContext } from "react-router"
import type { AdminAccess } from "../lib/adminAuth"
import { AdminMfaPanel } from "../subscriptions/ActivationConsole"
import { isSupabaseConfigured } from "../../lib/supabase"
import { listAccessAccounts, listAdminAuditEvents, updateAccessRole, type AccessAccount, type AdminAuditEvent } from "./client"

export default function SecurityView() {
  const access = useOutletContext<AdminAccess>()
  const [accounts, setAccounts] = useState<AccessAccount[]>([])
  const [audit, setAudit] = useState<AdminAuditEvent[]>([])
  const [search, setSearch] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh(query = activeQuery) {
    setLoading(true); setError(null)
    try {
      const [nextAccounts, nextAudit] = await Promise.all([listAccessAccounts(query), listAdminAuditEvents(100)])
      setAccounts(nextAccounts); setAudit(nextAudit)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل إعدادات الأمان.")
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh("") }, [])

  async function searchAccounts(event: FormEvent) {
    event.preventDefault()
    const query = search.trim()
    setActiveQuery(query)
    await refresh(query)
  }

  async function changeRole(account: AccessAccount, role: "content" | "platform", enabled: boolean) {
    if (!access.user?.id) return
    const roleLabel = role === "platform" ? "مشغل منصة" : "محرر محتوى"
    const verb = enabled ? "منح" : "إلغاء"
    if (!window.confirm(`${verb} صلاحية ${roleLabel} للحساب ${account.email}؟`)) return
    setBusyKey(`${account.id}:${role}`); setError(null); setNotice(null)
    try {
      await updateAccessRole(account.id, role, enabled)
      setNotice(`تم ${enabled ? "منح" : "إلغاء"} صلاحية ${roleLabel} وتسجيلها في سجل التدقيق.`)
      await refresh(activeQuery)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الصلاحية.")
    } finally { setBusyKey(null) }
  }

  const platformAdmins = useMemo(() => accounts.filter((account) => account.is_platform_admin), [accounts])
  const contentAdmins = useMemo(() => accounts.filter((account) => account.is_content_admin), [accounts])
  const actors = new Set(audit.map((item) => item.actor_id)).size

  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="الأمان والصلاحيات" sub="إدارة مشغلي المنصة ومحرري المحتوى بشكل منفصل ومراجعة سجل الإجراءات." />
      {isSupabaseConfigured && <AdminMfaPanel onChanged={() => { void refresh() }} />}
      <p className="text-[12px] text-muted">منح صلاحيات المشغل أو المحرر وإلغاؤها يتطلب التحقق الثنائي MFA (AAL2). يتحقق الخادم من مستوى الجلسة، وليس من هذه الشاشة فقط.</p>
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <SecurityMetric icon={<ShieldCheck className="h-4 w-4" />} title="مشغلو المنصة" value={String(platformAdmins.length)} detail="صلاحية منفصلة لإدارة الاشتراكات والإعدادات" />
        <SecurityMetric icon={<UserCog className="h-4 w-4" />} title="محررو المحتوى" value={String(contentAdmins.length)} detail="إدارة مقالات الموقع فقط" />
        <SecurityMetric icon={<KeyRound className="h-4 w-4" />} title="مشغلو سجل التدقيق" value={String(actors)} detail="هويات مميزة في آخر 100 حدث" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5"><div><h2 className="text-[14px] font-bold text-ink">إدارة الوصول</h2><p className="mt-1 text-[11px] text-muted">ابحث بالبريد لإضافة محرر أو مشغل. لن يظهر هنا سوى أصحاب الصلاحيات إلا عند البحث.</p></div><Badge tone="brand"><Shield className="h-3.5 w-3.5" /> RLS + أدوار منفصلة</Badge></div>
        <form onSubmit={searchAccounts} className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} type="email" placeholder="البريد الإلكتروني للحساب…" className="max-w-sm" />
          <Btn type="submit" variant="outline" disabled={loading}><Search className="h-3.5 w-3.5" /> بحث</Btn>
          {activeQuery && <Btn type="button" variant="ghost" onClick={() => { setSearch(""); setActiveQuery(""); void refresh("") }}>عرض أصحاب الصلاحيات</Btn>}
        </form>
        {loading ? <div className="grid min-h-32 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : accounts.length ? <Table head={<><Th>الحساب</Th><Th>محرر محتوى</Th><Th>مشغل منصة</Th><Th>المعرّف</Th></>}>
          {accounts.map((account) => <tr key={account.id}>
            <Td className="min-w-56"><p className="font-semibold text-ink">{account.name}</p><p className="mt-0.5 text-[11px] text-muted">{account.email}</p></Td>
            <Td><RoleToggle label="محرر محتوى" checked={account.is_content_admin} busy={busyKey === `${account.id}:content`} onChange={(value) => void changeRole(account, "content", value)} /></Td>
            <Td><RoleToggle label="مشغل منصة" checked={account.is_platform_admin} busy={busyKey === `${account.id}:platform`} onChange={(value) => void changeRole(account, "platform", value)} /></Td>
            <Td><code className="rounded bg-canvas px-2 py-1 text-[10px] text-muted">{account.id}</code></Td>
          </tr>)}
        </Table> : <div className="px-4 py-9 text-center text-[12px] text-muted">{activeQuery ? "لم يتم العثور على حساب بهذا البريد." : "لا يوجد مشغلون أو محررون مسجلون في النتيجة الأولى."}</div>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700" /><h2 className="text-[14px] font-bold text-ink">حدود الصلاحيات</h2></div><ul className="mt-4 list-disc space-y-2 ps-5 text-[12px] leading-relaxed text-muted">
          <li>محرر المحتوى يقرأ ويدير المقالات والترجمات، ولا يملك صلاحيات المشغل.</li>
          <li>مشغل المنصة يدير الاشتراكات والخطط والتحليلات والإعدادات والإشعارات.</li>
          <li>Postgres RLS والسياسات الأمنية هي الحاجز الفعلي؛ هذه الشاشة ليست بديلاً عنها.</li>
          <li>تُدار صلاحيات المنصة عبر RPC محمي، ويمنع النظام حذف آخر مشغل.</li>
        </ul></Card>
        <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold text-ink">حالة سجل التدقيق</h2></div><p className="mt-3 text-[12px] leading-relaxed text-muted">يُسجَّل الفاعل والعملية والهدف والبيانات المساندة عند تعديل الاشتراك أو الخطة أو إعدادات القياس والنشر أو الإشعارات أو الأدوار. السجل للقراءة من مشغلي المنصة فقط.</p><p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[11px] text-faint">يُعرض أحدث {audit.length} حدثاً. يحتفظ النظام بسجلات الإجراءات دون حذف تلقائي حالياً.</p></Card>
      </div>

      <Card className="overflow-hidden"><div className="border-b border-line px-4 py-3.5"><h2 className="text-[14px] font-bold text-ink">سجل الأمان والإدارة</h2><p className="mt-1 text-[11px] text-muted">أحدث 100 عملية محمية.</p></div>
        {audit.length ? <Table head={<><Th>الفاعل</Th><Th>العملية</Th><Th>الهدف</Th><Th>الوقت</Th></>}>
          {audit.map((event) => <tr key={event.id}><Td>{event.actor_email}</Td><Td className="font-mono text-[11px]">{event.action}</Td><Td className="max-w-56 truncate text-muted">{event.target}</Td><Td className="text-[11px] text-muted">{formatDate(event.created_at)}</Td></tr>)}
        </Table> : <p className="px-4 py-9 text-center text-[12px] text-muted">لا توجد أحداث مسجلة بعد.</p>}
      </Card>
    </div>
  )
}

function RoleToggle({ label, checked, busy, onChange }: { label: string; checked: boolean; busy: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={`${label}: ${checked ? "مفعّل" : "متوقف"}`} aria-checked={checked} disabled={busy} onClick={() => onChange(!checked)} className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${checked ? "border-good/20 bg-good-50 text-emerald-700" : "border-line bg-surface text-muted"}`}>
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : checked ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}{checked ? "مفعّل" : "غير مفعّل"}
  </button>
}
function SecurityMetric({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: string; detail: string }) {
  return <Card className="p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span><p className="mt-3 text-[11px] font-medium text-muted">{title}</p><p className="mt-1 font-display text-[23px] font-bold text-ink">{value}</p><p className="mt-1 text-[10px] text-faint">{detail}</p></Card>
}
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) }
