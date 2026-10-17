/**
 * CMS — activation-code console (the one implementation, two homes).
 *
 * Issuing a code needs three things to line up, and until now a failure in any
 * of them surfaced as a raw PostgREST string under the button — which reads as
 * "the generator does not work":
 *
 *  1. the account must be a **platform admin** (`public.platform_admins`),
 *  2. the session must have completed **MFA (AAL2)**,
 *  3. the server objects must exist — `activation_keys` plus the
 *     `issue_activation_key` / `redeem_activation_key` RPCs from migrations
 *     `20261017_single_use_activation_codes.sql` and
 *     `20261018_activation_key_security.sql`.
 *
 * `probeIssuanceReadiness()` checks all three up front and the banner says
 * which one is missing and how to fix it, before the owner types a client's
 * name. `issuanceErrorMessage()` maps whatever the server still returns onto
 * the same plain language.
 *
 * Rendered by `/admin/subscriptions` (where an owner managing plans looks) and
 * by `/admin/subscription-editor` (the codes-and-prices console): one builder,
 * one MFA panel, one server ledger, so the two pages cannot drift apart.
 *
 * Unconfigured builds (no Supabase pair at build time) keep the local demo
 * behaviour — a deterministic per-client code that only this browser accepts —
 * and the banner says so out loud instead of implying the key is server-backed.
 */
import { useCallback, useEffect, useState } from "react"
import { Check, Copy, KeyRound, MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react"
import { useSubscriptions } from "../../store/useSubscriptions"
import { SUBSCRIPTION_SOURCES, type SubscriptionRecord, type SubscriptionSource } from "../../lib/subscriptionLedger"
import { activationKeyHash, codeForSerial, randomActivationKey, randomSerial } from "../../lib/planCodes"
import { formatSetupKey, isUsableSetupKey, normalizeSetupKey, qrImageDataUrl, secretFromUri } from "../lib/totpEnrollment"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"
import type { PlanPeriod } from "../../lib/plans"

export const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  whatsapp: "واتساب",
  instagram: "إنستغرام",
  facebook: "فيسبوك",
  google: "غوغل",
  referral: "إحالة / صديق",
  other: "أخرى",
}

/** wa.me needs digits only; a Moroccan local number gets its country code. */
export function whatsappNumber(contact: string): string {
  const digits = contact.replace(/\D/g, "")
  if (digits.startsWith("0")) return `212${digits.slice(1)}`
  if (digits.length === 9) return `212${digits}`
  return digits
}

export const inputCls = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
export const labelCls = "mb-1 block text-[11px] font-bold text-muted"

/* --------------------------- issuance readiness -------------------------- */

/** The two scripts that install the server side, in the order they must run. */
export const ACTIVATION_MIGRATIONS = [
  "supabase/migrations/20261017_single_use_activation_codes.sql",
  "supabase/migrations/20261018_activation_key_security.sql",
] as const

export type IssuanceReadiness =
  | { state: "checking" }
  /** No Supabase pair in this build: local demo codes, this browser only. */
  | { state: "local" }
  /** Web Crypto is unavailable outside a secure context (plain HTTP). */
  | { state: "insecure" }
  | { state: "signed-out" }
  | { state: "not-platform-admin" }
  | { state: "needs-mfa"; verifiedFactor: boolean }
  | { state: "missing-migration"; detail: string }
  /** The probe itself failed (offline, unexpected error): try anyway. */
  | { state: "unknown"; detail: string }
  | { state: "ready" }

/** States where clicking can only fail, so the button says why instead. */
export const BLOCKING_READINESS: ReadonlySet<IssuanceReadiness["state"]> = new Set([
  "insecure", "signed-out", "not-platform-admin", "needs-mfa", "missing-migration",
])

/** PostgREST/Postgres wording for "this table or function was never created". */
function isMissingSchemaObject(message: string): boolean {
  return /schema cache|could not find the (table|function)|does not exist|pgrst20[125]|42p01|42883/i.test(message)
}

/**
 * Ask the server whether this session can issue a key right now.
 *
 * Every step is a read the signed-in admin is already allowed to make (their
 * own `platform_admins` row, their own assurance level, one row of the key
 * ledger). Nothing here decides anything — `issue_activation_key` re-checks the
 * same conditions server-side — it exists so the CMS can name the missing piece.
 */
export async function probeIssuanceReadiness(): Promise<IssuanceReadiness> {
  if (!isSupabaseConfigured) return { state: "local" }
  // `crypto.subtle` (the SHA-256 digest the server stores) only exists in a
  // secure context; over plain HTTP the browser leaves it undefined and the
  // failure would otherwise surface as a TypeError under the button.
  if (typeof crypto === "undefined" || !crypto.subtle) return { state: "insecure" }
  try {
    const { data: session, error: sessionError } = await supabase.auth.getUser()
    if (sessionError) return { state: "unknown", detail: sessionError.message }
    const user = session?.user
    if (!user) return { state: "signed-out" }

    const { data: adminRow, error: adminError } = await supabase.from("platform_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle()
    if (adminError) return { state: "unknown", detail: adminError.message }
    if ((adminRow as { user_id?: string } | null)?.user_id !== user.id) return { state: "not-platform-admin" }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) return { state: "unknown", detail: assuranceError.message }
    if (assurance?.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      return { state: "needs-mfa", verifiedFactor: Boolean(factors?.totp?.some((factor) => factor.status === "verified")) }
    }

    const { error: ledgerError } = await supabase.from("activation_keys").select("id").limit(1)
    if (ledgerError) {
      return isMissingSchemaObject(ledgerError.message)
        ? { state: "missing-migration", detail: ledgerError.message }
        : { state: "unknown", detail: ledgerError.message }
    }
    return { state: "ready" }
  } catch (reason) {
    return { state: "unknown", detail: reason instanceof Error ? reason.message : String(reason) }
  }
}

/** Whatever the server threw, in the language the owner reads. */
export function issuanceErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  if (/platform_admin_mfa_required|42501|permission denied for function/i.test(raw)) {
    return "رفض الخادم الإصدار: يلزم أن يكون الحساب مدير منصة وأن تكتمل المصادقة الثنائية (AAL2) في هذه الجلسة."
  }
  if (isMissingSchemaObject(raw)) {
    return `دوال مفاتيح التفعيل غير مثبّتة في قاعدة البيانات. شغّل في محرر SQL في Supabase، بالترتيب: ${ACTIVATION_MIGRATIONS[0]} ثم ${ACTIVATION_MIGRATIONS[1]}.`
  }
  if (/duplicate key value|unique constraint/i.test(raw)) return "هذا المفتاح موجود مسبقاً في السجل. أنشئ رمزاً جديداً."
  if (/invalid_activation_key_request|22023/i.test(raw)) return "رفض الخادم طلب الإصدار (بيانات غير صالحة). تحقّق من اسم العميل ومن طول الحقول."
  return raw.trim() || "تعذر إنشاء الرمز. تحقق من ترحيل قاعدة البيانات والصلاحيات."
}

const READINESS_COPY: Record<IssuanceReadiness["state"], { title: string; body: string }> = {
  checking: { title: "جارٍ فحص جاهزية الإصدار…", body: "" },
  ready: {
    title: "جاهز لإنشاء مفاتيح التفعيل",
    body: "الحساب مدير منصة، وجلسة MFA (AAL2) مكتملة، ودوال الخادم مثبّتة.",
  },
  local: {
    title: "وضع محلي: رموز تجريبية في هذا المتصفح فقط",
    body: "هذه النسخة مبنية بدون إعداد Supabase، لذا الرمز المُنشأ رمز تحقق محلي يقبله هذا المتصفح وحده ولا يُسجَّل في الخادم. لإنشاء مفاتيح حقيقية أعد البناء بـ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.",
  },
  insecure: {
    title: "المتصفح يمنع إنشاء المفاتيح على اتصال غير آمن",
    body: "تلخيص المفتاح يحتاج Web Crypto وهو متاح عبر HTTPS أو localhost فقط. افتح لوحة التحكم بعنوان آمن ثم اضغط «إعادة الفحص».",
  },
  "signed-out": { title: "لا توجد جلسة دخول", body: "سجّل الدخول من جديد في لوحة التحكم ثم أعد الفحص." },
  "not-platform-admin": {
    title: "إنشاء المفاتيح متاح لمدير المنصة فقط",
    body: "حسابك غير مسجَّل في platform_admins. يطلب مدير منصة حالي إضافتك من «الأمان ← صلاحيات الوصول»، ثم أعد الفحص.",
  },
  "needs-mfa": {
    title: "يلزم إكمال المصادقة الثنائية (AAL2) لهذه الجلسة",
    body: "استعمل اللوحة أدناه: أعدِد تطبيق المصادقة إن لم يكن مربوطاً، ثم أدخل الرمز المكوّن من 6 أرقام. الخادم يرفض الإصدار بدون AAL2.",
  },
  "missing-migration": {
    title: "جداول ودوال مفاتيح التفعيل غير مثبّتة في قاعدة البيانات",
    body: `شغّل في محرر SQL في Supabase، بالترتيب وكل واحد على حدة: ${ACTIVATION_MIGRATIONS[0]} ثم ${ACTIVATION_MIGRATIONS[1]}، ثم اضغط «إعادة الفحص».`,
  },
  unknown: {
    title: "تعذّر فحص الجاهزية",
    body: "يمكنك محاولة الإنشاء على أي حال؛ إن رفضه الخادم فستظهر الرسالة الدقيقة أدناه.",
  },
}

function ReadinessBanner({ readiness, onRecheck }: { readiness: IssuanceReadiness; onRecheck: () => void }) {
  if (readiness.state === "checking") {
    return <p role="status" className="rounded-xl border border-line bg-canvas px-3 py-2 text-[12px] text-muted">{READINESS_COPY.checking.title}</p>
  }
  const good = readiness.state === "ready" || readiness.state === "local"
  const copy = READINESS_COPY[readiness.state]
  const detail = "detail" in readiness ? readiness.detail : ""
  return (
    <section
      aria-live="polite"
      aria-label="جاهزية إنشاء رموز التفعيل"
      className={`rounded-xl border px-4 py-3 ${good ? "border-good/30 bg-good-50/60" : "border-warn/30 bg-warn-50/70"}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {good
          ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">{copy.title}</p>
          {copy.body && <p className="mt-1 text-[12px] leading-relaxed text-muted">{copy.body}</p>}
          {detail && <p dir="ltr" className="mt-1.5 break-all rounded bg-surface/70 p-2 font-mono text-[11px] text-muted">{detail}</p>}
        </div>
        <button type="button" onClick={onRecheck} className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[12px] font-semibold hover:bg-canvas">
          إعادة الفحص
        </button>
      </div>
    </section>
  )
}

/* --------------------------- admin MFA enrollment ------------------------ */

/**
 * TOTP enrollment + challenge for the AAL2 panel. `onChanged` lets the console
 * re-probe readiness once the session reaches AAL2.
 *
 * The factor can be added to an authenticator app two ways, both made reliable
 * here: the QR image (GoTrue sends raw SVG markup — it is turned into a
 * browser-safe data URL) and the manual setup key (shown in groups of four with
 * one click that copies the whole key; a partial copy is what Google
 * Authenticator reports as "the key value is too short").
 */
function AdminMfaPanel({ onChanged }: { onChanged?: () => void }) {
  const [aal2, setAal2] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  /** An unverified factor holds no recoverable setup key once the page reloads. */
  async function dropPendingFactors(): Promise<void> {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const factor of factors?.totp ?? []) {
      if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
  }

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
      if (pending && !verified && !factorId) {
        // Without the enroll response there is no key left to show or scan, and
        // the code box would sit with nothing to enter: clear the leftover and
        // offer the setup button again instead.
        await supabase.auth.mfa.unenroll({ factorId: pending.id })
        setFactorId(null)
      } else {
        setFactorId(verified?.id ?? pending?.id ?? null)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر التحقق من المصادقة متعددة العوامل.")
    }
  }
  useEffect(() => { void refresh() }, [])

  async function enroll() {
    setBusy(true); setError(null)
    try {
      // GoTrue refuses a second factor with the same friendly name until the
      // unverified one expires (~5 minutes): clear leftovers first so a retry
      // works immediately.
      await dropPendingFactors()
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fatorati CMS" })
      if (enrollError) throw enrollError
      const totp = data?.totp
      // The `secret` field and the otpauth URI carry the same key and the QR
      // encodes the URI: prefer the field, fall back to the URI when the field
      // is empty or unusable, refuse only when neither yields a usable key.
      const fromField = normalizeSetupKey(totp?.secret ?? "")
      const setupKey = isUsableSetupKey(fromField) ? fromField : normalizeSetupKey(secretFromUri(totp?.uri ?? ""))
      if (!data?.id || !totp?.qr_code || !isUsableSetupKey(setupKey)) {
        // Never show a key the authenticator app would reject as too short —
        // say so here and let the owner start over.
        throw new Error("أعاد الخادم مفتاح إعداد غير صالح أو ناقص. اضغط «إعداد تطبيق المصادقة» مرة أخرى.")
      }
      setFactorId(data.id)
      setQr(totp.qr_code)
      setSecret(setupKey)
      setUri(totp.uri ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إعداد المصادقة متعددة العوامل.")
    } finally {
      setBusy(false)
    }
  }

  async function copySecret() {
    if (!secret) return
    try {
      // The whole key, ungrouped: a partial copy is what the app calls "too short".
      await navigator.clipboard.writeText(normalizeSetupKey(secret))
      setCopied(true)
    } catch { /* clipboard unavailable: the key is on screen to copy by hand */ }
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code.trim())) { setError("أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة."); return }
    setBusy(true); setError(null)
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
      if (verifyError) throw verifyError
      setQr(null); setSecret(null); setUri(null); setCode(""); setCopied(false)
      await refresh()
      // The session just reached AAL2: the builder can issue now, so let the
      // console re-probe instead of leaving a stale "MFA required" banner.
      onChanged?.()
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
        {!aal2 && qr && secret && <div className="mt-3 rounded-lg border bg-surface p-3">
          <div className="flex flex-wrap items-start gap-3">
            {/* The white quiet zone (`.qr-scan`, kept white in both themes):
                scanners fail on edge-to-edge art or dark surroundings. */}
            <div className="qr-scan shrink-0 rounded-md p-2">
              <img alt="رمز QR للمصادقة متعددة العوامل" className="h-44 w-44" src={qrImageDataUrl(qr)} />
            </div>
            <div className="min-w-56 flex-1">
              <p className="text-xs font-semibold">امسح الرمز بتطبيق المصادقة (مثل Google Authenticator)، أو أدخل المفتاح يدوياً:</p>
              <code dir="ltr" className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">{formatSetupKey(secret)}</code>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void copySecret()} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-canvas">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "تم نسخ المفتاح" : "نسخ المفتاح كاملاً"}
                </button>
                {uri && uri.startsWith("otpauth://") && (
                  <a href={uri} className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-canvas">إضافة مباشرة إلى تطبيق المصادقة</a>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">المفتاح مكوّن من {normalizeSetupKey(secret).length} حرفاً. انسخه كاملاً دفعة واحدة — المفتاح الناقص يرفضه التطبيق برسالة «المفتاح قصير جداً».</p>
            </div>
          </div>
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

function CodeBuilder({ readiness, onIssued }: { readiness: IssuanceReadiness; onIssued?: () => void }) {
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
  /**
   * In these states the server would refuse the issue, so the button says why
   * (in the readiness banner above) instead of failing after the owner typed a
   * client's name. `unknown` and `checking` deliberately do not block: the
   * probe may be wrong, the server's answer is the truth.
   */
  const blocked = BLOCKING_READINESS.has(readiness.state)

  async function generate() {
    if (!clientName.trim() || busy || blocked) return
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
      // The server ledger gained a row and the session's assurance may have
      // moved: let the console re-probe and reload.
      onIssued?.()
    } catch (error) {
      setGenerationError(issuanceErrorMessage(error))
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
        <button type="button" onClick={() => void generate()} disabled={!clientName.trim() || busy || blocked} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
          <KeyRound className="h-4 w-4" /> إنشاء رمز التفعيل
        </button>
        <span className="text-[12px] text-muted">تبدأ المدة من يوم إدخال العميل للرمز، لا من يوم إنشائه. الرمز صالح لحساب واحد فقط ويُستهلك عند أول تفعيل.</span>
      </div>
      {blocked && (
        <p className="mt-2 rounded-lg bg-warn-50/70 p-3 text-[12px] leading-relaxed text-warn">
          لا يمكن إنشاء رمز الآن: {READINESS_COPY[readiness.state].title}. خطوات الحل في شريط الجاهزية أعلاه.
        </p>
      )}
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

/* ------------------------------- the console ----------------------------- */

/**
 * Readiness banner + MFA panel + code builder + server key ledger, sharing one
 * probe. Drop it anywhere in the CMS where the owner manages subscriptions.
 *
 * In an unconfigured build only the banner and the builder render: there is no
 * server to enroll MFA against and no server ledger to read.
 */
export default function ActivationConsole() {
  const [readiness, setReadiness] = useState<IssuanceReadiness>({ state: "checking" })
  const [ledgerKey, setLedgerKey] = useState(0)

  const recheck = useCallback(() => { void probeIssuanceReadiness().then(setReadiness) }, [])
  useEffect(() => { recheck() }, [recheck])

  /** A key was issued: re-probe (AAL can lapse) and reload the server ledger. */
  const onIssued = useCallback(() => { recheck(); setLedgerKey((key) => key + 1) }, [recheck])

  const local = readiness.state === "local"
  return (
    <div className="space-y-4">
      <ReadinessBanner readiness={readiness} onRecheck={recheck} />
      {!local && <AdminMfaPanel onChanged={recheck} />}
      <CodeBuilder readiness={readiness} onIssued={onIssued} />
      {!local && <ActivationKeyLedger key={ledgerKey} />}
    </div>
  )
}
