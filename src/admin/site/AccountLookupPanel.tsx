/**
 * CMS — account lookup by reference.
 *
 * The client never sends an address, a password or a document: they read out
 * `FT-XXXX-XXXX` and describe the problem. This panel turns that reference into
 * the account behind a ticket, and it is deliberately shaped by one rule:
 *
 *   **The reference proves nothing.** It is a search hint for a human. The
 *   panel therefore shows a *masked* address by default, says out loud whether
 *   the address on the ticket matches the address on the account, and puts the
 *   full address behind a second, MFA-gated, separately audited click.
 *
 * The verification that matters happens after this panel: reply to the address
 * on file, never to the address written in the ticket. Nothing here changes an
 * account's state — no plan, no quota, no deletion — so a lookup can never be
 * the thing that went wrong.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, BadgeCheck, Copy, Loader2, Mail, Search, ShieldAlert } from "lucide-react"
import { Badge, Btn, Card, Field, Input } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import {
  currentSessionHasMfa,
  lookupSupportAccount,
  revealSupportAccountEmail,
  supportLookupError,
  type SupportAccountLookup,
  type SupportReveal,
} from "./accountLookup"

export default function AccountLookupPanel({ requestId }: { requestId: string | null }) {
  const [reference, setReference] = useState("")
  const [result, setResult] = useState<SupportAccountLookup | null>(null)
  const [reveal, setReveal] = useState<SupportReveal | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")
  const [hasMfa, setHasMfa] = useState<boolean | null>(null)

  const panelRef = useRef<HTMLDivElement | null>(null)
  /** The request this panel already resolved, so a re-render does not re-query. */
  const handledRequest = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void currentSessionHasMfa().then((value) => { if (active) setHasMfa(value) })
    return () => { active = false }
  }, [])

  const run = useCallback(async (input: { ref?: string; requestId?: string }) => {
    setLoading(true)
    setError("")
    setReveal(null)
    try {
      const data = await lookupSupportAccount(input)
      setResult(data)
      setReference(data.account_ref)
    } catch (reason) {
      setResult(null)
      setError(supportLookupError(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  // Opened from a ticket: resolve that ticket's account without the operator
  // copying an id by hand.
  useEffect(() => {
    if (!requestId || handledRequest.current === requestId) return
    handledRequest.current = requestId
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    void run({ requestId })
  }, [requestId, run])

  async function onReveal() {
    if (!result) return
    setRevealing(true)
    setError("")
    try {
      setReveal(await revealSupportAccountEmail({ ref: result.account_ref }))
      setHasMfa(true)
    } catch (reason) {
      setError(supportLookupError(reason))
    } finally {
      setRevealing(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(value)
      window.setTimeout(() => setCopied(""), 2000)
    } catch {
      setError("تعذّر النسخ تلقائياً. حدّد المعرّف يدوياً وانسخه.")
    }
  }

  const usage = result?.usage ?? null
  const request = result?.request ?? null

  return <div ref={panelRef}><Card className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-ink"><Search className="h-4 w-4 text-brand" /> فحص حساب عميل</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
          اطلب من العميل معرّف الحساب الظاهر في «الإعدادات ← المساعدة» ثم ابحث به هنا. لا تطلب كلمة المرور ولا صورة بطاقة ولا رمز دخول، ولا تطلب بريده الإلكتروني: المعرّف يكفي.
        </p>
      </div>
    </div>

    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void run({ ref: reference }) }}>
      <div className="min-w-56 flex-1">
        <Field label="معرّف الحساب" hint="مثال: FT-7K4M-92QD">
          <Input
            value={reference}
            dir="ltr"
            className="font-mono tracking-wider"
            placeholder="FT-XXXX-XXXX"
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
      </div>
      <Btn type="submit" size="sm" disabled={loading || reference.trim() === ""}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} فحص
      </Btn>
    </form>

    {error && <div className="mt-3"><FormAlert kind="error">{error}</FormAlert></div>}

    {result && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copy(result.account_ref)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas/60 px-2.5 py-1 font-mono text-[12px] font-bold text-ink hover:bg-canvas">
          {result.account_ref}
          <Copy className="h-3.5 w-3.5 text-faint" />
        </button>
        {copied === result.account_ref && <span className="text-[11px] text-good">تم النسخ</span>}
        <Badge tone={result.plan_status === "active" || result.plan_status === "trialing" ? "good" : "warn"}>{PLAN_STATUS[result.plan_status] ?? result.plan_status}</Badge>
        <Badge tone="brand">{result.plan.toUpperCase()}</Badge>
        {result.is_platform_operator && <Badge tone="warn">حساب مشغّل منصة</Badge>}
        {result.is_content_admin && <Badge tone="neutral">محرر محتوى</Badge>}
        {result.deletion_requested_at && <Badge tone="serious">طلب حذف مسجَّل</Badge>}
      </div>

      {request && <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${request.email_matches_account ? "border-good/30 bg-good-50 text-emerald-800" : "border-warn/40 bg-warn-50 text-amber-900"}`}>
        {request.email_matches_account ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {request.email_matches_account
            ? "بريد الطلب مطابق للبريد المسجَّل في الحساب — الطلب صادر من صاحب الحساب."
            : "تنبيه: البريد المكتوب في الطلب لا يطابق البريد المسجَّل في الحساب. لا تنفّذ أي إجراء على الحساب قبل التحقق، وأجب على البريد المسجَّل لا على بريد الطلب."}
        </span>
      </div>}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Row label="الاسم" value={result.name || "—"} />
        <Row label="البريد" value={result.email_masked} ltr />
        <Row label="النطاق" value={result.email_domain ?? "—"} ltr />
        <Row label="تاريخ إنشاء الحساب" value={safeDate(result.account_created_at)} />
        <Row label="عدد المقاعد" value={String(result.seats)} />
        <Row label="انتهاء الفترة الحالية" value={result.current_period_end ? safeDate(result.current_period_end) : "—"} />
        <Row label="طلبات الدعم من هذا الحساب" value={String(result.support_request_count)} />
        <Row label="أجهزة النسخة السحابية" value={String(result.cloud_backup_devices)} />
        {usage && <Row label="جهات الاتصال (الشهر)" value={String(usage.contacts_count)} />}
        {usage && <Row label="المشاريع (الشهر)" value={String(usage.projects_count)} />}
        {usage && <Row label="المستخدمون النشطون" value={String(usage.active_users)} />}
        {usage && <Row label="حجم التخزين" value={formatBytes(usage.storage_bytes)} />}
      </dl>

      {result.workspace_erased_at && <p className="rounded-lg border border-line bg-canvas/60 p-3 text-[12px] text-muted">
        أُفرغت مساحة هذا الحساب بتاريخ {safeDate(result.workspace_erased_at)}. الترميم غير ممكن؛ لا تعد العميل بغير ذلك.
      </p>}

      {result.profile_email_stale && <p className="rounded-lg border border-warn/30 bg-warn-50/60 p-3 text-[12px] text-amber-900">
        البريد المخزَّن في الملف الشخصي يخالف البريد الحالي لدى مزوّد الدخول. المعروض أعلاه هو البريد الفعلي. إن كان العميل يشتكي من عدم وصول رسائل الاستعادة فهذا هو السبب المرجَّح.
      </p>}

      <div className="rounded-lg border border-line bg-canvas/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <p className="text-[12px] font-semibold text-ink">البريد الكامل</p>
              <p className="text-[11px] leading-relaxed text-muted">كشف البريد يُسجَّل في سجل التدقيق باسمك. لا تكشفه إلا إذا احتجته فعلاً؛ العرض المُقنَّع يكفي في معظم الحالات.</p>
            </div>
          </div>
          {!reveal && (hasMfa === false
            ? <span className="inline-flex items-center gap-2 text-[11px] text-amber-800"><ShieldAlert className="h-4 w-4" /> يتطلب المصادقة الثنائية (AAL2)</span>
            : <Btn variant="outline" size="sm" disabled={revealing} onClick={() => void onReveal()}>{revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} كشف البريد</Btn>)}
        </div>
        {reveal && <p className="mt-2 break-all font-mono text-[13px] text-ink" dir="ltr">{reveal.email ?? "—"}</p>}
      </div>

      {request && <p className="text-[11px] leading-relaxed text-faint">
        الطلب: «{request.subject}» · {REQUEST_STATUS[request.status] ?? request.status} · {safeDate(request.created_at)}
      </p>}
    </div>}
  </Card></div>
}

const PLAN_STATUS: Record<string, string> = {
  trialing: "تجريبي", active: "نشط", past_due: "متأخر", paused: "موقوف", canceled: "ملغى",
}

const REQUEST_STATUS: Record<string, string> = {
  new: "جديد", triaged: "تم الفرز", in_progress: "قيد المعالجة", resolved: "تم الحل", closed: "مغلق",
}

function Row({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div>
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</dt>
    <dd className={`mt-0.5 text-[12.5px] text-ink ${ltr ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</dd>
  </div>
}

function safeDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(date)
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0"
  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
