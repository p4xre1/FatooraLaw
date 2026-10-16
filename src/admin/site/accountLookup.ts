/**
 * Support access, from the CMS side.
 *
 * The operator never types an email address to find an account, and never asks
 * a client for one: they take the `FT-XXXX-XXXX` reference the client read out.
 * Two server calls do the work, and both are gated and audited in SQL —
 * `support_lookup_account` for the masked view, `support_reveal_account_email`
 * (MFA required) for the address itself.
 *
 * Everything here just names what the server said. A refusal is not an error to
 * hide: "you are not an operator", "that reference is malformed" and "the
 * migration has not been applied" are three different problems with three
 * different fixes, and the operator is the one who can act on each.
 */
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

/** The migration that installs the lookup, quoted when the RPC is missing. */
export const SUPPORT_LOOKUP_MIGRATION = "supabase/migrations/20261020_support_account_lookup.sql"

export type SupportUsage = {
  month_start: string
  contacts_count: number
  projects_count: number
  active_users: number
  storage_bytes: number
}

export type SupportLookupRequest = {
  id: string
  name: string
  email: string
  subject: string
  status: string
  category: string
  created_at: string
  /** Null until the account has an authoritative address to compare against. */
  email_matches_account: boolean
}

export type SupportAccountLookup = {
  account_ref: string
  name: string
  email_masked: string
  email_domain: string | null
  email_source: "auth" | "profile"
  /** The address in `profiles` no longer matches the one in `auth.users`. */
  profile_email_stale: boolean
  plan: string
  plan_status: string
  seats: number
  current_period_end: string | null
  account_created_at: string
  deletion_requested_at: string | null
  workspace_erased_at: string | null
  is_content_admin: boolean
  is_platform_operator: boolean
  usage: SupportUsage | null
  cloud_backup_devices: number
  support_request_count: number
  request: SupportLookupRequest | null
}

export type SupportReveal = {
  account_ref: string
  email: string | null
  request_email: string | null
  email_matches_request: boolean
}

export type SupportLookupInput = { ref?: string; requestId?: string }

function args(input: SupportLookupInput): { p_ref: string | null; p_request_id: string | null } {
  const ref = (input.ref ?? "").trim()
  return {
    p_ref: ref === "" ? null : ref,
    p_request_id: input.requestId ?? null,
  }
}

function missingFunction(message: string): boolean {
  return /schema cache|could not find the function|does not exist|pgrst20[12]|42883/i.test(message)
}

export async function lookupSupportAccount(input: SupportLookupInput): Promise<SupportAccountLookup> {
  if (!isSupabaseConfigured) throw new Error("support_lookup_unconfigured")
  const { data, error } = await supabase.rpc("support_lookup_account", args(input))
  if (error) throw new Error(error.message)
  return data as SupportAccountLookup
}

export async function revealSupportAccountEmail(input: SupportLookupInput): Promise<SupportReveal> {
  if (!isSupabaseConfigured) throw new Error("support_lookup_unconfigured")
  const { data, error } = await supabase.rpc("support_reveal_account_email", args(input))
  if (error) throw new Error(error.message)
  return data as SupportReveal
}

/** True when this session may reveal an address at all (the server still decides). */
export async function currentSessionHasMfa(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return data?.currentLevel === "aal2"
  } catch {
    return false
  }
}

/** Whatever the server refused with, in the language the operator reads. */
export function supportLookupError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""

  if (/support_lookup_unconfigured/.test(raw)) {
    return "هذه النسخة مبنية بدون إعداد Supabase، لذا فحص الحسابات غير متاح. شغّل النسخة المتصلة بقاعدة البيانات."
  }
  if (/support_lookup_forbidden|permission denied for function/i.test(raw)) {
    return "فحص حسابات العملاء متاح لمديري المنصة فقط (جدول platform_admins). اطلب من مدير حالي إضافتك من «الأمان ← صلاحيات الوصول»."
  }
  if (/support_reveal_mfa_required/i.test(raw)) {
    return "كشف البريد الكامل يتطلب إكمال المصادقة الثنائية (AAL2) في هذه الجلسة. أكمل التحقق ثم أعد المحاولة، أو اكتفِ بالعرض المُقنَّع."
  }
  if (/support_lookup_rate_limited/i.test(raw)) {
    return "تجاوزت الحد المسموح من عمليات الفحص (30 في الدقيقة). انتظر قليلاً ثم أعد المحاولة."
  }
  if (/support_account_ref_malformed/i.test(raw)) {
    return "المعرّف غير صالح: لا يحتوي على ثمانية رموز من النمط FT-XXXX-XXXX. الحروف I و L و O و U لا تظهر في هذه المعرّفات أبداً، لذا وجود أحدها يعني خطأ في النقل."
  }
  if (/support_account_ref_conflict/i.test(raw)) {
    return "المعرّف الذي أدخلته يخص حساباً آخر غير صاحب الطلب. تحقق من الاثنين قبل المتابعة — هذا الفرق هو ما يمنع مساعدة شخص منتحل."
  }
  if (/support_account_not_found/i.test(raw)) {
    return "لا يوجد حساب بهذا المعرّف. قد يكون العميل قرأ معرّفاً قديماً بعد تدويره من «الإعدادات»."
  }
  if (/support_request_not_found/i.test(raw)) {
    return "لم يعد هذا الطلب موجوداً في صندوق الدعم. أعد تحديث القائمة."
  }
  if (/support_request_has_no_account/i.test(raw)) {
    return "هذا الطلب أرسله زائر غير مسجَّل الدخول، فلا يوجد حساب لفحصه. العنوان المكتوب في الطلب غير موثَّق؛ أجب عليه كطلب عام ولا تغيّر أي حالة."
  }
  if (/support_lookup_input_required/i.test(raw)) {
    return "أدخل معرّف الحساب أو اختر طلباً من الصندوق أولاً."
  }
  if (/authentication_required/i.test(raw)) {
    return "انتهت جلستك. أعد تسجيل الدخول إلى لوحة التحكم."
  }
  if (missingFunction(raw)) {
    return `دوال فحص الحسابات غير مثبّتة في قاعدة البيانات. شغّل في محرر SQL في Supabase الملف: ${SUPPORT_LOOKUP_MIGRATION} ثم أعد المحاولة.`
  }
  return raw.trim() || "تعذّر فحص الحساب. تحقق من الترحيل والصلاحيات."
}
