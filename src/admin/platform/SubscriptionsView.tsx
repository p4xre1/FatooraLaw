import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, Pencil, Save, X } from "lucide-react"
import { Badge, Btn, Card, Input, SectionTitle, Select, Table, Td, Th } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { useOutletContext } from "react-router"
import type { AdminAccess } from "../lib/adminAuth"
import {
  PLAN_LABELS,
  PLAN_STATUS_LABELS,
  listPlans,
  listPurchaseRequests,
  listSubscriptions,
  savePlan,
  updatePurchaseRequest,
  updateSubscription,
  type AccountSubscription,
  type Plan,
  type PlanCode,
  type PurchaseRequest,
  type PurchaseStatus,
  type SubscriptionStatus,
} from "./client"

type DraftAccount = { plan: PlanCode; status: SubscriptionStatus; seats: string; current_period_end: string }
const PURCHASE_LABELS: Record<PurchaseStatus, string> = { new: "جديد", contacted: "تم التواصل", paid: "مدفوع", rejected: "مرفوض" }
export default function SubscriptionsView() {
  const access = useOutletContext<AdminAccess>()
  const actorId = access.user?.id ?? ""
  const [plans, setPlans] = useState<Plan[]>([])
  const [accounts, setAccounts] = useState<AccountSubscription[]>([])
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftAccount>>({})
  const [editingPlan, setEditingPlan] = useState<PlanCode | null>(null)
  const [planDraft, setPlanDraft] = useState<Plan | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all")
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "pro" | "boost" | "enterprise">("all")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [nextPlans, nextAccounts, nextRequests] = await Promise.all([listPlans(), listSubscriptions(), listPurchaseRequests()])
      setPlans(nextPlans)
      setAccounts(nextAccounts)
      setRequests(nextRequests)
      setDrafts(Object.fromEntries(nextAccounts.map((account) => [account.user_id, {
        plan: account.plan,
        status: account.status,
        seats: String(account.seats),
        current_period_end: account.current_period_end?.slice(0, 10) ?? "",
      }])))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الاشتراكات.")
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => accounts.filter((account) => {
    const matchesSearch = `${account.name} ${account.email} ${account.user_id}`.toLowerCase().includes(search.trim().toLowerCase())
    const normalizedPlan = account.plan === "starter" ? "free" : account.plan === "business" ? "boost" : account.plan
    return matchesSearch && (statusFilter === "all" || account.status === statusFilter)
      && (planFilter === "all" || normalizedPlan === planFilter)
  }), [accounts, search, statusFilter, planFilter])

  function patchAccount(id: string, patch: Partial<DraftAccount>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  async function saveAccount(account: AccountSubscription) {
    if (!actorId) return
    const draft = drafts[account.user_id]
    const seats = Number(draft.seats)
    if (!Number.isInteger(seats) || seats < 1) { setError("عدد المقاعد يجب أن يكون عدداً صحيحاً أكبر من صفر."); return }
    setBusy(account.user_id); setError(null); setNotice(null)
    try {
      await updateSubscription(account.user_id, {
        plan: draft.plan,
        status: draft.status,
        seats,
        current_period_end: draft.current_period_end ? new Date(`${draft.current_period_end}T23:59:59.000Z`).toISOString() : null,
      })
      setNotice("تم تحديث الاشتراك وتسجيل الإجراء في سجل التدقيق.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الاشتراك.")
    } finally { setBusy(null) }
  }

  async function savePlanDraft() {
    if (!actorId || !planDraft || !editingPlan) return
    setBusy(`plan-${editingPlan}`); setError(null); setNotice(null)
    try {
      await savePlan(editingPlan, {
        monthly_price: Number(planDraft.monthly_price),
        max_users: Number(planDraft.max_users),
        max_contacts: Number(planDraft.max_contacts),
        max_projects: Number(planDraft.max_projects),
        max_storage_mb: Number(planDraft.max_storage_mb),
        active: planDraft.active,
      })
      setEditingPlan(null); setPlanDraft(null)
      setNotice("تم تحديث الخطة.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الخطة.")
    } finally { setBusy(null) }
  }

  async function changeRequestStatus(request: PurchaseRequest, status: PurchaseStatus) {
    if (!actorId) return
    setBusy(request.id); setError(null)
    try {
      await updatePurchaseRequest(request.id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الطلب.")
    } finally { setBusy(null) }
  }

  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="الاشتراكات والخطط" sub="إدارة الخطط وحالات الحسابات والطلبات. لا تُعالج هذه الشاشة المدفوعات؛ حالة «مدفوع» في الطلبات تُسجل يدوياً ولا تؤكدها بوابة دفع." />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}
      {loading && <div className="grid min-h-28 place-items-center text-[13px] text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>}

      {!loading && <>
        <section aria-label="ملخص الحسابات حسب الخطة" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([['all', 'كل الحسابات', accounts.length], ['free', 'FREE', accounts.filter((a) => a.plan === 'starter').length], ['pro', 'PRO', accounts.filter((a) => a.plan === 'pro').length], ['boost', 'BOOST', accounts.filter((a) => a.plan === 'boost' || a.plan === 'business').length]] as const).map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={planFilter === key} onClick={() => setPlanFilter(key)} className={`rounded-xl border p-4 text-start transition-colors ${planFilter === key ? 'border-brand bg-brand-50' : 'bg-surface hover:bg-canvas'}`}>
              <span className="block text-[11px] font-bold text-muted">{label}</span><span className="mt-1 block text-2xl font-extrabold text-ink">{count}</span>
            </button>
          ))}
        </section>
        <section aria-label="كتالوج الخطط" className="space-y-3">
          <div><h2 className="text-[15px] font-bold text-ink">كتالوج الخطط</h2><p className="mt-1 text-[12px] text-muted">الأسعار بالدرهم المغربي شهرياً. حدود الاستخدام مُسجلة في قاعدة البيانات، لكنها لا تُطبق على بيانات مساحة العمل المحلية غير المتزامنة سحابياً.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => <Card key={plan.code} className="p-4">
              {editingPlan === plan.code && planDraft ? <PlanForm plan={planDraft} onChange={setPlanDraft} onCancel={() => { setEditingPlan(null); setPlanDraft(null) }} onSave={() => void savePlanDraft()} saving={busy === `plan-${plan.code}`} /> : <>
                <div className="flex items-start justify-between gap-2"><div><h3 className="text-[14px] font-bold text-ink">{PLAN_LABELS[plan.code]}</h3><p className="mt-1 text-[10px] text-muted">{plan.code}</p></div><Badge tone={plan.active ? "good" : "neutral"}>{plan.active ? "متاحة" : "مخفية"}</Badge></div>
                <p className="mt-4 font-display text-[23px] font-bold text-ink">{Number(plan.monthly_price).toLocaleString("fr-MA")} <span className="text-[11px] font-medium text-muted">MAD / شهر</span></p>
                <div className="mt-3 space-y-1 text-[11px] text-muted"><p>{plan.max_users} مستخدم · {plan.max_contacts.toLocaleString("fr-MA")} جهة اتصال</p><p>{plan.max_projects.toLocaleString("fr-MA")} مشروع · {plan.max_storage_mb.toLocaleString("fr-MA")} MB</p></div>
                <Btn variant="outline" size="sm" className="mt-4" onClick={() => { setEditingPlan(plan.code); setPlanDraft({ ...plan }) }}><Pencil className="h-3.5 w-3.5" /> تعديل الحدود</Btn>
              </>}
            </Card>)}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-[15px] font-bold text-ink">حسابات العملاء</h2><p className="mt-1 text-[12px] text-muted">تغيير الخطة أو الحالة أو عدد المقاعد لكل حساب.</p></div><span className="text-[11px] text-muted">{filtered.length} من {accounts.length}</span></div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-line p-3">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالاسم أو البريد أو المعرّف…" className="max-w-sm" />
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SubscriptionStatus)} className="max-w-48">
                <option value="all">كل الحالات</option>{Object.entries(PLAN_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </Select>
            </div>
            {accounts.length ? <Table head={<><Th>الحساب</Th><Th>الخطة</Th><Th>الحالة</Th><Th>المقاعد</Th><Th>نهاية الفترة</Th><Th>الاستخدام الحالي</Th><Th></Th></>}>
              {filtered.map((account) => {
                const draft = drafts[account.user_id] ?? { plan: account.plan, status: account.status, seats: String(account.seats), current_period_end: "" }
                const saving = busy === account.user_id
                return <tr key={account.user_id}>
                  <Td className="min-w-52"><p className="font-semibold text-ink">{account.name}</p><p className="mt-0.5 max-w-52 truncate text-[11px] text-muted">{account.email}</p></Td>
                  <Td><Select value={draft.plan} onChange={(event) => patchAccount(account.user_id, { plan: event.target.value as PlanCode })} className="min-w-32">{plans.map((plan) => <option key={plan.code} value={plan.code}>{PLAN_LABELS[plan.code]}</option>)}</Select></Td>
                  <Td><Select value={draft.status} onChange={(event) => patchAccount(account.user_id, { status: event.target.value as SubscriptionStatus })} className="min-w-32">{Object.entries(PLAN_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</Select></Td>
                  <Td><Input type="number" min={1} step={1} value={draft.seats} onChange={(event) => patchAccount(account.user_id, { seats: event.target.value })} className="w-20" /></Td>
                  <Td><Input type="date" value={draft.current_period_end} onChange={(event) => patchAccount(account.user_id, { current_period_end: event.target.value })} className="min-w-36" /></Td>
                  <Td className="min-w-40 text-[11px] leading-5 text-muted">{account.usage ? <>{account.usage.contacts_count} contacts · {account.usage.projects_count} projects<br />{account.usage.active_users} users · {formatBytes(account.usage.storage_bytes)}</> : "لا توجد بيانات لهذا الشهر"}</Td>
                  <Td><Btn size="sm" disabled={saving} onClick={() => void saveAccount(account)}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ</Btn></Td>
                </tr>
              })}
              {!filtered.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">لا توجد حسابات مطابقة.</td></tr>}
            </Table> : <div className="px-4 py-10 text-center text-[13px] text-muted">لا توجد اشتراكات حتى الآن.</div>}
          </Card>
        </section>

        <section className="space-y-3">
          <div><h2 className="text-[15px] font-bold text-ink">طلبات الاشتراك</h2><p className="mt-1 text-[12px] text-muted">طلبات الخطة المقدمة من الموقع العام.</p></div>
          <Card className="overflow-hidden">
            {requests.length ? <Table head={<><Th>الشركة والبريد</Th><Th>الخطة</Th><Th>المقاعد</Th><Th>الرسالة</Th><Th>التاريخ</Th><Th>الحالة</Th></>}>
              {requests.map((request) => <tr key={request.id}>
                <Td><p className="font-semibold text-ink">{request.company || "—"}</p><p className="text-[11px] text-muted">{request.email}</p></Td>
                <Td>{PLAN_LABELS[request.plan]}</Td><Td>{request.seats}</Td><Td className="max-w-64 truncate text-muted">{request.message || "—"}</Td>
                <Td className="text-[11px] text-muted">{formatDate(request.created_at)}</Td>
                <Td><Select aria-label={`حالة طلب ${request.email}`} disabled={busy === request.id} value={request.status} onChange={(event) => void changeRequestStatus(request, event.target.value as PurchaseStatus)} className="min-w-32">{Object.entries(PURCHASE_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</Select></Td>
              </tr>)}
            </Table> : <div className="px-4 py-10 text-center text-[13px] text-muted">لا توجد طلبات شراء.</div>}
          </Card>
        </section>
      </>}
    </div>
  )
}

function PlanForm({ plan, onChange, onCancel, onSave, saving }: { plan: Plan; onChange: (plan: Plan) => void; onCancel: () => void; onSave: () => void; saving: boolean }) {
  const setNumber = (key: "monthly_price" | "max_users" | "max_contacts" | "max_projects" | "max_storage_mb", value: string) => onChange({ ...plan, [key]: value === "" ? 0 : Number(value) })
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold text-ink">{PLAN_LABELS[plan.code]}</h3><button type="button" onClick={onCancel} aria-label="إلغاء التعديل"><X className="h-4 w-4 text-muted" /></button></div>
    <NumberField label="السعر الشهري (MAD)" value={plan.monthly_price} step="0.01" onChange={(value) => setNumber("monthly_price", value)} />
    <NumberField label="المستخدمون" value={plan.max_users} onChange={(value) => setNumber("max_users", value)} />
    <NumberField label="جهات الاتصال" value={plan.max_contacts} onChange={(value) => setNumber("max_contacts", value)} />
    <NumberField label="المشاريع" value={plan.max_projects} onChange={(value) => setNumber("max_projects", value)} />
    <NumberField label="التخزين (MB)" value={plan.max_storage_mb} onChange={(value) => setNumber("max_storage_mb", value)} />
    <label className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] font-medium text-ink">إظهار الخطة للعامة<input type="checkbox" checked={plan.active} onChange={(event) => onChange({ ...plan, active: event.target.checked })} /></label>
    <div className="flex gap-2"><Btn size="sm" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} حفظ</Btn><Btn size="sm" variant="outline" onClick={onCancel}>إلغاء</Btn></div>
  </div>
}

function NumberField({ label, value, step = "1", onChange }: { label: string; value: number; step?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold text-muted">{label}</span><Input type="number" min={0} step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(value)) }
function formatBytes(value: number): string { return value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }
