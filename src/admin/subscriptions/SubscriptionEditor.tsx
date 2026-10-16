/**
 * CMS — رموز التفعيل والأسعار (activation codes & prices).
 *
 * The owner's subscription console, in three parts:
 *
 *  1. **منشئ الرموز** — mint a per-client code (`PRO-1M-K7Q2-…`) for a named
 *     client, with how they found Fatorati, and send it over WhatsApp.
 *  2. **سجل الاشتراكات** — every code ever handed out: when it started, when
 *     it ends, how many days remain, and the owner's two hands on it —
 *     تجميد (freeze: the remaining days wait) and إيقاف (stop: it ends now).
 *     The signed-in app reads the same ledger, so a freeze or stop made here
 *     applies there in the same browser immediately.
 *  3. **الأسعار والنصوص** — the prices and selling paragraphs of the three
 *     plans, per language, applied at once to the lock page, the dashboard
 *     strip and the WhatsApp buy message.
 *
 * Activation key digests are stored server-side in `activation_keys` when
 * Supabase is configured; plaintext keys are shown once at issuance only.
 * The descriptive client ledger and plan-copy editor remain local to this
 * browser and are not the server's authoritative subscription record.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Ban, Check, Copy, FileDown, KeyRound, MessageCircle, Play, RotateCcw, ShieldAlert, ShieldCheck, Snowflake, Trash2,
} from "lucide-react"
import { useSubscriptions } from "../../store/useSubscriptions"
import { usePlanCatalog } from "../../store/usePlanCatalog"
import {
  SUBSCRIPTION_SOURCES, daysLeft, displayStatus, projectedEnd,
  type SubscriptionRecord, type SubscriptionSource,
} from "../../lib/subscriptionLedger"
import { activationKeyHash, codeForSerial, randomActivationKey, randomSerial } from "../../lib/planCodes"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"
import { PLAN_ORDER, PLANS, type PlanCode, type PlanPeriod } from "../../lib/plans"
import { defaultCatalog } from "../../lib/planCatalog"
import { translations } from "../../i18n"
import type { LocaleId } from "../../lib/locales"

const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  whatsapp: "واتساب",
  instagram: "إنستغرام",
  facebook: "فيسبوك",
  google: "غوغل",
  referral: "إحالة / صديق",
  other: "أخرى",
}

const STATUS_LABELS = {
  pending: "بانتظار التفعيل",
  active: "نشط",
  frozen: "مجمّد",
  stopped: "موقوف",
  expired: "منتهي",
} as const

const STATUS_STYLE: Record<keyof typeof STATUS_LABELS, string> = {
  pending: "bg-warn-50 text-amber-700 ring-amber-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  frozen: "bg-sky-50 text-sky-700 ring-sky-600/20",
  stopped: "bg-rose-50 text-rose-700 ring-rose-600/20",
  expired: "bg-slate-100 text-slate-500 ring-slate-500/20",
}

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" })
const fmtDate = (iso: string | null) => {
  if (!iso) return "—"
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? iso : dateFmt.format(date)
}

/** wa.me needs digits only; a Moroccan local number gets its country code. */
function whatsappNumber(contact: string): string {
  const digits = contact.replace(/\D/g, "")
  if (digits.startsWith("0")) return `212${digits.slice(1)}`
  if (digits.length === 9) return `212${digits}`
  return digits
}

const inputCls = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
const labelCls = "mb-1 block text-[11px] font-bold text-muted"

export default function SubscriptionEditor() {
  const records = useSubscriptions((state) => state.records)
  const { issue, freeze, unfreeze, stop, reactivate, remove } = useSubscriptions.getState()
  const [filter, setFilter] = useState("")

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => [r.clientName, r.company, r.contact, r.code].some((v) => v.toLowerCase().includes(q)))
  }, [records, filter])

  function exportJson() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fatorati-subscriptions_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="h-6 w-6 text-brand" /> رموز التفعيل والأسعار</h1>
        <p className="mt-1 text-[13px] text-muted">
          أنشئ رمزاً لكل عميل، تابع بداية اشتراكه ونهايته، جمّده أو أوقفه، وعدّل الأسعار ونصوص الخطط — كل ذلك يظهر فوراً داخل التطبيق في هذا المتصفح.
        </p>
      </header>

      <AdminMfaPanel />
      <CodeBuilder />
      <ActivationKeyLedger />

      <section className="rounded-2xl border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">سجل الاشتراكات ({records.length})</h2>
          <div className="flex items-center gap-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث: عميل، شركة، رمز…" className="rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] outline-none focus:border-brand" />
            <button type="button" onClick={exportJson} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-700">
              <FileDown className="h-3.5 w-3.5" /> تصدير JSON
            </button>
          </div>
        </div>

        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-faint">لا توجد اشتراكات بعد. أنشئ أول رمز من المنشئ أعلاه.</p>}

        <div className="space-y-2.5">
          {shown.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              onFreeze={() => freeze(record.id)}
              onUnfreeze={() => unfreeze(record.id)}
              onStop={() => stop(record.id)}
              onReactivate={() => reactivate(record.id)}
              onRemove={() => remove(record.id)}
            />
          ))}
        </div>
      </section>

      <CatalogEditor />

      <p className="rounded-xl border border-dashed bg-warn-50/60 p-3 text-[12px] leading-relaxed text-warn">
        ملاحظة: هذه السجلات محفوظة في هذا المتصفح (local-first) — التجميد والإيقاف يسريان فوراً على التطبيق في نفس المتصفح.
مفاتيح التفعيل الجديدة تُحفظ خادمياً عند إعداد Supabase؛ أما هذا السجل التفصيلي وأدوات التجميد المحلية فتبقى في هذا المتصفح فقط. الخطة المستردة نفسها تُسجل في <span dir="ltr" className="font-mono">account_subscriptions</span>.
      </p>
    </div>
  )
}

/* --------------------------- admin MFA enrollment ------------------------ */

function AdminMfaPanel() {
  const [aal2, setAal2] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const [{ data: assurance }, { data: factors, error: factorError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      if (factorError) throw factorError
      setAal2(assurance?.currentLevel === "aal2")
      const verified = factors?.totp.find((factor) => factor.status === "verified")
      const pending = factors?.totp.find((factor) => factor.status !== "verified")
      setFactorId(verified?.id ?? pending?.id ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر التحقق من المصادقة متعددة العوامل.")
    }
  }
  useEffect(() => { void refresh() }, [])

  async function enroll() {
    setBusy(true); setError(null)
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fatorati CMS" })
      if (enrollError) throw enrollError
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر إعداد المصادقة متعددة العوامل.") }
    finally { setBusy(false) }
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code.trim())) { setError("أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة."); return }
    setBusy(true); setError(null)
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
      if (verifyError) throw verifyError
      setQr(null); setSecret(null); setCode("")
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "رمز المصادقة غير صحيح.") }
    finally { setBusy(false) }
  }

  return <section className={`rounded-xl border p-4 ${aal2 ? "border-good/30 bg-good-50/60" : "border-warn/30 bg-warn-50/70"}`}>
    <div className="flex items-start gap-3">
      {aal2 ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /> : <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold">{aal2 ? "المصادقة متعددة العوامل مفعّلة لهذه الجلسة" : "يلزم إكمال المصادقة متعددة العوامل"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">إنشاء مفاتيح التفعيل وعرضها وإلغاؤها محمي بمستوى MFA من الخادم (AAL2). لا تدخل رمزك إلا بعد ربط تطبيق مصادقة موثوق.</p>
        {!aal2 && !factorId && <button type="button" disabled={busy} onClick={() => void enroll()} className="mt-3 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "جارٍ الإعداد…" : "إعداد تطبيق المصادقة"}</button>}
        {!aal2 && qr && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-3">
          <img alt="رمز QR للمصادقة متعددة العوامل" className="h-36 w-36" src={`data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`} />
          <div className="min-w-56 flex-1"><p className="text-xs font-semibold">امسح الرمز بتطبيق المصادقة أو أدخل السر يدوياً:</p><code dir="ltr" className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">{secret}</code></div>
        </div>}
        {!aal2 && factorId && <div className="mt-3 flex flex-wrap gap-2"><input aria-label="رمز تطبيق المصادقة" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="w-44 rounded-lg border bg-surface px-3 py-2 text-sm tracking-[0.25em]" placeholder="000000" /><button type="button" disabled={busy || code.length !== 6} onClick={() => void verify()} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "جارٍ التحقق…" : "تأكيد الرمز"}</button></div>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </div>
  </section>
}

/* ---------------------------- server key ledger -------------------------- */

type KeyRow = { id: string; plan: string; period: string; status: string; issued_to: string; redeemed_by: string | null; redeemed_at: string | null; starts_at: string | null; ends_at: string | null; created_at: string }

function ActivationKeyLedger() {
  const [rows, setRows] = useState<KeyRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  async function refresh() {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) { setError(assuranceError.message); return }
    if (assurance?.currentLevel !== "aal2") { setRows([]); setError("أكمل تحقق MFA (AAL2) لعرض سجل المفاتيح."); return }
    const { data, error: queryError } = await supabase.from("activation_keys")
      .select("id,plan,period,status,issued_to,redeemed_by,redeemed_at,starts_at,ends_at,created_at")
      .order("created_at", { ascending: false }).limit(200)
    if (queryError) setError(queryError.message)
    else { setRows((data ?? []) as KeyRow[]); setError(null) }
  }
  useEffect(() => { void refresh() }, [])
  async function revoke(row: KeyRow) {
    if (row.status !== "unused" || !window.confirm("إلغاء هذا الرمز نهائياً؟")) return
    setBusy(row.id)
    const { error: updateError } = await supabase.from("activation_keys").update({ status: "revoked" }).eq("id", row.id)
    if (updateError) setError(updateError.message)
    else await refresh()
    setBusy(null)
  }
  return <section className="rounded-2xl border bg-surface p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between"><div><h2 className="text-[15px] font-bold">سجل مفاتيح التفعيل للخادم ({rows.length})</h2><p className="mt-1 text-[11px] text-muted">المفتاح الكامل لا يُخزَّن بعد إنشائه. يظهر هنا فقط ما إذا استُخدم والحساب الذي استرده.</p></div><button type="button" onClick={() => void refresh()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">تحديث</button></div>
    {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    {!rows.length ? <p className="py-4 text-center text-xs text-muted">لا توجد مفاتيح خادمية بعد. قد يلزم تطبيق ترحيل مفاتيح التفعيل أولاً.</p> : <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"><div><strong>{row.plan.toUpperCase()} · {row.period}</strong><span className="ms-2 text-muted">{row.issued_to || "بدون اسم"}</span><p className="mt-1 text-muted">{row.status === "unused" ? "غير مستخدم" : row.status === "redeemed" ? `مستخدم · الحساب ${row.redeemed_by ?? "—"} · ${row.ends_at ?? ""}` : "ملغى"}</p></div>{row.status === "unused" && <button type="button" disabled={busy === row.id} onClick={() => void revoke(row)} className="rounded-md border border-rose-200 px-2 py-1 font-semibold text-rose-700 disabled:opacity-50">إلغاء المفتاح</button>}</div>)}</div>}
  </section>
}

/* ------------------------------ code builder ----------------------------- */

function CodeBuilder() {
  const records = useSubscriptions((state) => state.records)
  const issue = useSubscriptions((state) => state.issue)
  const [clientName, setClientName] = useState("")
  const [company, setCompany] = useState("")
  const [contact, setContact] = useState("")
  const [source, setSource] = useState<SubscriptionSource>("whatsapp")
  const [plan, setPlan] = useState<"pro" | "boost">("pro")
  const [period, setPeriod] = useState<PlanPeriod>("1M")
  const [note, setNote] = useState("")
  const [created, setCreated] = useState<SubscriptionRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  async function generate() {
    if (!clientName.trim() || busy) return
    setBusy(true)
    setGenerationError(null)
    try {
      // The database stores only a digest. Unique random key material is
      // generated per issue; redemption on the server atomically consumes it.
      let serial = randomSerial()
      while (records.some((r) => r.serial === serial)) serial = randomSerial()
      const code = isSupabaseConfigured ? randomActivationKey(plan, period) : await codeForSerial(plan, period, serial)
      if (isSupabaseConfigured) {
        const key_hash = await activationKeyHash(code)
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        if (assurance?.currentLevel !== "aal2") throw new Error("أكمل تحقق MFA (AAL2) قبل إصدار مفاتيح التفعيل.")
        const { error } = await supabase.rpc("issue_activation_key", {
          p_key_hash: key_hash, p_plan: plan, p_period: period,
          p_issued_to: [clientName.trim(), company.trim(), contact.trim()].filter(Boolean).join(" · "),
        })
        if (error) throw new Error(error.message)
      }
      const record = issue({
        // In production, never persist the plaintext bearer key in the local
        // CMS ledger. It remains only in component memory for the one-time
        // copy/send flow below; Supabase receives its digest only.
        code: isSupabaseConfigured ? "[key shown once]" : code,
        serial, plan, period,
        clientName: clientName.trim(), company: company.trim(), contact: contact.trim(),
        source, note: note.trim(), issuedAt: new Date().toISOString().slice(0, 10),
      })
      setCreated({ ...record, code })
      setCopied(false)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "تعذر إنشاء الرمز. تحقق من ترحيل قاعدة البيانات والصلاحيات.")
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.code)
      setCopied(true)
    } catch { /* clipboard unavailable: the code is on screen to copy by hand */ }
  }

  const waNumber = created ? whatsappNumber(created.contact) : ""
  const waText = created
    ? encodeURIComponent(`Fatorati — code d'activation ${created.plan.toUpperCase()} (${created.period === "1M" ? "1 mois" : "1 an"}) : ${created.code}\nEntrez-le dans Paramètres → Plan & activation.`)
    : ""

  return (
    <section className="rounded-2xl border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-[15px] font-bold">منشئ الرموز — رمز جديد لعميل</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className={labelCls} htmlFor="cms-name">اسم العميل *</label><input id="cms-name" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="مثال: كريم بنجلون" /></div>
        <div><label className={labelCls} htmlFor="cms-company">الشركة</label><input id="cms-company" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="مثال: Atlas BTP" /></div>
        <div><label className={labelCls} htmlFor="cms-contact">الهاتف / واتساب</label><input id="cms-contact" value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="06 XX XX XX XX" dir="ltr" /></div>
        <div>
          <label className={labelCls} htmlFor="cms-source">منين عرفنا؟ (المصدر)</label>
          <select id="cms-source" value={source} onChange={(e) => setSource(e.target.value as SubscriptionSource)} className={inputCls}>
            {SUBSCRIPTION_SOURCES.map((value) => <option key={value} value={value}>{SOURCE_LABELS[value]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>الخطة</label>
          <div className="flex gap-1.5">
            {(["pro", "boost"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={plan === value} onClick={() => setPlan(value)} className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors ${plan === value ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>المدة</label>
          <div className="flex gap-1.5">
            {(["1M", "1Y"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors ${period === value ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {value === "1M" ? "شهر واحد" : "سنة كاملة"}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls} htmlFor="cms-note">ملاحظة</label><input id="cms-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="مثال: دفع بالتحويل — المرجع…" /></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void generate()} disabled={!clientName.trim() || busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
          <KeyRound className="h-4 w-4" /> إنشاء رمز التفعيل
        </button>
        <span className="text-[12px] text-muted">تبدأ المدة من يوم إدخال العميل للرمز، لا من يوم إنشائه. الرمز صالح لحساب واحد فقط ويُستهلك عند أول تفعيل.</span>
      </div>
      {generationError && <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-[12px] text-rose-700">{generationError}</p>}

      {created && (
        <div className="mt-4 rounded-xl bg-ink p-4 text-white" dir="ltr">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            {created.plan.toUpperCase()} · {created.period === "1M" ? "1 month" : "1 year"} · {created.clientName}
          </p>
          <p className="mt-1 font-mono text-[20px] font-bold tracking-wider">{created.code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyCode()} className="inline-flex items-center gap-1.5 rounded-lg bg-surface/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-surface/20">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copié" : "Copier"}
            </button>
            {waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-600">
                <MessageCircle className="h-3.5 w-3.5" /> Envoyer sur WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------- record row ------------------------------ */

function RecordRow({ record, onFreeze, onUnfreeze, onStop, onReactivate, onRemove }: {
  record: SubscriptionRecord
  onFreeze: () => void
  onUnfreeze: () => void
  onStop: () => void
  onReactivate: () => void
  onRemove: () => void
}) {
  const status = displayStatus(record)
  const left = daysLeft(record)

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-40 flex-1">
          <p className="text-[13.5px] font-bold">{record.clientName}{record.company && <span className="font-medium text-muted"> · {record.company}</span>}</p>
          <p className="text-[12px] text-muted" dir="ltr">{record.contact || "—"}</p>
          <p className="mt-0.5 font-mono text-[11.5px] text-slate-500" dir="ltr">{record.code}</p>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${record.plan === "boost" ? "bg-violet-50 text-violet-700 ring-violet-600/20" : "bg-brand-50 text-blue-700 ring-blue-600/20"}`}>
          {record.plan.toUpperCase()} · {record.period === "1M" ? "شهر" : "سنة"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${STATUS_STYLE[status]}`}>{STATUS_LABELS[status]}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-5">
        <div><p className="text-[10.5px] font-bold text-faint">المصدر</p><p>{SOURCE_LABELS[record.source]}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">البداية</p><p>{record.startsAt ? fmtDate(record.startsAt) : "لم يُفعَّل بعد"}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">النهاية{!record.endsAt && " (متوقعة)"}</p><p>{fmtDate(projectedEnd(record))}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">المتبقي</p><p>{left === null ? "—" : left === 0 ? "اليوم الأخير" : `${left} يوم`}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">أُنشئ في</p><p>{fmtDate(record.issuedAt)}</p></div>
      </div>
      {record.note && <p className="mt-1.5 text-[12px] text-muted">📝 {record.note}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {status !== "frozen" && status !== "stopped" && status !== "expired" && (
          <button type="button" onClick={onFreeze} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-sky-700">
            <Snowflake className="h-3.5 w-3.5" /> تجميد
          </button>
        )}
        {status === "frozen" && (
          <button type="button" onClick={onUnfreeze} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">
            <Play className="h-3.5 w-3.5" /> استئناف
          </button>
        )}
        {status !== "stopped" && (
          <button type="button" onClick={onStop} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700">
            <Ban className="h-3.5 w-3.5" /> إيقاف
          </button>
        )}
        {status === "stopped" && (
          <button type="button" onClick={onReactivate} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-700">
            <RotateCcw className="h-3.5 w-3.5" /> إعادة تفعيل
          </button>
        )}
        <button type="button" onClick={onRemove} aria-label="حذف السجل" className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-50">
          <Trash2 className="h-3.5 w-3.5" /> حذف
        </button>
      </div>
    </div>
  )
}

/* --------------------------- prices & paragraphs -------------------------- */

const LOCALE_TABS: { id: LocaleId; label: string }[] = [
  { id: "ar", label: "العربية" },
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
]

function CatalogEditor() {
  const catalog = usePlanCatalog((state) => state.catalog)
  const { setPrice, setCopy, reset } = usePlanCatalog.getState()
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [savedTick, setSavedTick] = useState(0)
  const defaults = defaultCatalog()

  const priceDraft = (plan: "pro" | "boost", field: "monthly" | "yearly") => catalog.prices[plan][field]
  const copyValue = (plan: PlanCode, field: "tagline" | "value") =>
    catalog.copy[plan]?.[locale]?.[field] ?? ""
  const copyFallback = (plan: PlanCode, field: "tagline" | "value") =>
    field === "tagline" ? translations[locale].plans.tagline[plan] : translations[locale].plans.value[plan]

  return (
    <section className="rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">الأسعار والنصوص</h2>
        <div className="flex items-center gap-2">
          {savedTick > 0 && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" /> تم الحفظ — يظهر فوراً في التطبيق</span>}
          <button type="button" onClick={() => { reset(); setSavedTick((n) => n + 1) }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-200">
            <RotateCcw className="h-3.5 w-3.5" /> استعادة الافتراضي
          </button>
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-muted">الأسعار بالدرهم (MAD). النص المعدَّل يغلب النص الأصلي؛ اترك الحقل فارغاً لاستعمال النص الأصلي.</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {(["pro", "boost"] as const).map((plan) => (
          <div key={plan} className="rounded-xl border border-line p-3">
            <p className="mb-2 text-[13px] font-extrabold">{plan.toUpperCase()} <span className="font-medium text-muted">· الافتراضي {defaults.prices[plan].monthly}/{defaults.prices[plan].yearly}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor={`price-${plan}-m`}>شهرياً (MAD)</label>
                <input id={`price-${plan}-m`} type="number" min={0} value={priceDraft(plan, "monthly")} onChange={(e) => { setPrice(plan, "monthly", Number(e.target.value)); setSavedTick((n) => n + 1) }} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls} htmlFor={`price-${plan}-y`}>سنوياً (MAD)</label>
                <input id={`price-${plan}-y`} type="number" min={0} value={priceDraft(plan, "yearly")} onChange={(e) => { setPrice(plan, "yearly", Number(e.target.value)); setSavedTick((n) => n + 1) }} className={inputCls} dir="ltr" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex gap-1.5" role="tablist" aria-label="لغة النصوص">
          {LOCALE_TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={locale === tab.id} onClick={() => setLocale(tab.id)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${locale === tab.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PLAN_ORDER.map((plan: PlanCode) => (
            <div key={plan} className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-[13px] font-extrabold">{PLANS[plan].code.toUpperCase()}</p>
              <div>
                <label className={labelCls} htmlFor={`copy-${plan}-tagline`}>السطر التعريفي</label>
                <input id={`copy-${plan}-tagline`} value={copyValue(plan, "tagline")} placeholder={copyFallback(plan, "tagline")} onChange={(e) => { setCopy(plan, locale, "tagline", e.target.value); setSavedTick((n) => n + 1) }} className={inputCls} dir="auto" />
              </div>
              <div>
                <label className={labelCls} htmlFor={`copy-${plan}-value`}>جملة القيمة (أعلى البطاقة)</label>
                <textarea id={`copy-${plan}-value`} rows={3} value={copyValue(plan, "value")} placeholder={copyFallback(plan, "value")} onChange={(e) => { setCopy(plan, locale, "value", e.target.value); setSavedTick((n) => n + 1) }} className={inputCls} dir="auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
