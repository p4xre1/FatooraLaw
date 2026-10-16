import { supabase } from "../../lib/supabase"
import type { LocaleId } from "../../lib/locales"

export type PlanCode = "starter" | "pro" | "business" | "enterprise" | "boost"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "canceled"
export type PurchaseStatus = "new" | "contacted" | "paid" | "rejected"
export type Severity = "info" | "warning" | "critical"

export type Plan = {
  code: PlanCode
  name: string
  monthly_price: number
  max_users: number
  max_contacts: number
  max_projects: number
  max_storage_mb: number
  features: Record<string, unknown>
  active: boolean
}
export type AccountSubscription = {
  user_id: string
  plan: PlanCode
  status: SubscriptionStatus
  seats: number
  current_period_end: string | null
  updated_at: string
  name: string
  email: string
  usage: { contacts_count: number; projects_count: number; active_users: number; storage_bytes: number } | null
}
export type PurchaseRequest = {
  id: string
  user_id: string | null
  email: string
  plan: PlanCode
  company: string
  seats: number
  message: string
  status: PurchaseStatus
  created_at: string
}
export type PageView = { path: string; locale: LocaleId; referrer_host: string; created_at: string }
export type SiteEvent = { event_type: "download_click" | "purchase_click"; path: string; target: string; locale: LocaleId; referrer_host: string; created_at: string }
export type PlatformSettings = {
  singleton: true
  tracking_enabled: boolean
  require_translations: boolean
  require_seo_metadata: boolean
  updated_by: string | null
  updated_at: string
}
export type SystemNotification = {
  id: string
  severity: Severity
  title: string
  message: string
  active: boolean
  expires_at: string | null
  created_by: string
  created_at: string
}
export type AdminAuditEvent = {
  id: string
  actor_id: string
  actor_email: string
  action: string
  target: string
  details: Record<string, unknown>
  created_at: string
}
export type AccessAccount = {
  id: string
  name: string
  email: string
  is_content_admin: boolean
  is_platform_admin: boolean
}

function unwrapError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from("platform_settings").select("*").eq("singleton", true).maybeSingle()
  unwrapError(error)
  if (!data) throw new Error("إعدادات المنصة غير موجودة. طبّق ترحيل CMS Control Center أولاً.")
  return data as PlatformSettings
}

export async function getBlogPublishRules(): Promise<Pick<PlatformSettings, "require_translations" | "require_seo_metadata">> {
  const { data, error } = await supabase.rpc("blog_publish_rules")
  unwrapError(error)
  const rules = data as { require_translations?: unknown; require_seo_metadata?: unknown } | null
  return {
    require_translations: rules?.require_translations !== false,
    require_seo_metadata: rules?.require_seo_metadata !== false,
  }
}

export async function savePlatformSettings(
  patch: Pick<PlatformSettings, "tracking_enabled" | "require_translations" | "require_seo_metadata">,
  actorId: string,
): Promise<void> {
  const { error } = await supabase.from("platform_settings").update({ ...patch, updated_by: actorId }).eq("singleton", true)
  unwrapError(error)
}

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from("plan_catalog").select("*").order("monthly_price", { ascending: true })
  unwrapError(error)
  return (data ?? []) as Plan[]
}

export async function savePlan(code: PlanCode, patch: Pick<Plan, "monthly_price" | "max_users" | "max_contacts" | "max_projects" | "max_storage_mb" | "active">): Promise<void> {
  const { error } = await supabase.from("plan_catalog").update(patch).eq("code", code)
  unwrapError(error)
}

export async function listSubscriptions(): Promise<AccountSubscription[]> {
  // PostgREST caps each response. Page so the operator sees every registered
  // account instead of an arbitrary first 500.
  const subscriptions: Record<string, unknown>[] = []
  for (let from = 0; ; from += 500) {
    const result = await supabase.from("account_subscriptions").select("*")
      .order("updated_at", { ascending: false }).range(from, from + 499)
    unwrapError(result.error)
    const page = (result.data ?? []) as Record<string, unknown>[]
    subscriptions.push(...page)
    if (page.length < 500) break
  }
  const ids = subscriptions.map((row) => String(row.user_id))
  const profileRows: { id: string; name: string; email: string }[] = []
  for (let from = 0; from < ids.length; from += 500) {
    const result = await supabase.from("profiles").select("id,name,email").in("id", ids.slice(from, from + 500))
    unwrapError(result.error)
    profileRows.push(...((result.data ?? []) as typeof profileRows))
  }
  const profiles = new Map(profileRows.map((profile) => [profile.id, profile]))
  const currentMonth = new Date()
  const monthStart = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const usageResult = ids.length
    ? await supabase.from("usage_monthly").select("user_id,active_users,contacts_count,projects_count,storage_bytes")
      .in("user_id", ids).eq("month_start", monthStart)
    : { data: [], error: null }
  unwrapError(usageResult.error)
  const usage = new Map<string, { contacts_count: number; projects_count: number; active_users: number; storage_bytes: number }>()
  for (const row of (usageResult.data ?? []) as Record<string, unknown>[]) {
    const id = String(row.user_id)
    if (usage.has(id)) continue
    usage.set(id, {
      contacts_count: Number(row.contacts_count ?? 0),
      projects_count: Number(row.projects_count ?? 0),
      active_users: Number(row.active_users ?? 0),
      storage_bytes: Number(row.storage_bytes ?? 0),
    })
  }
  return subscriptions.map((row) => {
    const id = String(row.user_id)
    const profile = profiles.get(id)
    return {
      user_id: id,
      plan: row.plan as PlanCode,
      status: row.status as SubscriptionStatus,
      seats: Number(row.seats ?? 1),
      current_period_end: typeof row.current_period_end === "string" ? row.current_period_end : null,
      updated_at: String(row.updated_at ?? ""),
      name: profile?.name || "—",
      email: profile?.email || "—",
      usage: usage.get(id) ?? null,
    }
  })
}

export async function updateSubscription(
  userId: string,
  patch: Pick<AccountSubscription, "plan" | "status" | "seats" | "current_period_end">,
): Promise<void> {
  const { error } = await supabase.from("account_subscriptions").update(patch).eq("user_id", userId)
  unwrapError(error)
}

export async function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }).limit(300)
  unwrapError(error)
  return (data ?? []) as PurchaseRequest[]
}

export async function updatePurchaseRequest(id: string, status: PurchaseStatus): Promise<void> {
  const { error } = await supabase.from("purchase_requests").update({ status }).eq("id", id)
  unwrapError(error)
}

export async function listPageViews(since: string): Promise<PageView[]> {
  const { data, error } = await supabase.from("site_page_views")
    .select("path,locale,referrer_host,created_at").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(5000)
  unwrapError(error)
  return (data ?? []) as PageView[]
}

export async function listSiteEvents(since: string): Promise<SiteEvent[]> {
  const { data, error } = await supabase.from("site_analytics_events")
    .select("event_type,path,target,locale,referrer_host,created_at").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(5000)
  unwrapError(error)
  return (data ?? []) as SiteEvent[]
}

export async function purgePageViews(before: string): Promise<void> {
  const { error } = await supabase.rpc("purge_site_analytics", { p_before: before })
  unwrapError(error)
}

export async function listAdminAuditEvents(limit = 100): Promise<AdminAuditEvent[]> {
  const { data, error } = await supabase.from("admin_audit_events").select("*").order("created_at", { ascending: false }).limit(limit)
  unwrapError(error)
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = [...new Set(rows.map((row) => String(row.actor_id)))]
  const profilesResult = ids.length
    ? await supabase.from("profiles").select("id,email").in("id", ids)
    : { data: [], error: null }
  unwrapError(profilesResult.error)
  const emails = new Map(((profilesResult.data ?? []) as { id: string; email: string }[]).map((row) => [row.id, row.email]))
  return rows.map((row) => ({
    id: String(row.id),
    actor_id: String(row.actor_id),
    actor_email: emails.get(String(row.actor_id)) ?? "مشغل المنصة",
    action: String(row.action),
    target: String(row.target ?? ""),
    details: row.details as Record<string, unknown>,
    created_at: String(row.created_at),
  }))
}

export async function listAccessAccounts(emailQuery = ""): Promise<AccessAccount[]> {
  const operatorsResult = await supabase.from("platform_admins").select("user_id")
  unwrapError(operatorsResult.error)
  const platformIds = new Set(((operatorsResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id))
  const base = supabase.from("profiles").select("id,name,email,is_admin").order("email", { ascending: true })
  let profiles: { id: string; name: string; email: string; is_admin: boolean }[]
  if (emailQuery.trim()) {
    const { data, error } = await base.ilike("email", `%${emailQuery.trim()}%`).limit(50)
    unwrapError(error)
    profiles = (data ?? []) as typeof profiles
  } else {
    const [contentResult, operatorProfilesResult] = await Promise.all([
      base.eq("is_admin", true).limit(100),
      platformIds.size ? supabase.from("profiles").select("id,name,email,is_admin").in("id", [...platformIds]).order("email", { ascending: true }).limit(100) : Promise.resolve({ data: [], error: null }),
    ])
    unwrapError(contentResult.error)
    unwrapError(operatorProfilesResult.error)
    const unique = new Map<string, { id: string; name: string; email: string; is_admin: boolean }>()
    for (const profile of [...(contentResult.data ?? []), ...(operatorProfilesResult.data ?? [])] as typeof profiles) unique.set(profile.id, profile)
    profiles = [...unique.values()].sort((a, b) => a.email.localeCompare(b.email))
  }
  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name || "—",
    email: profile.email || "—",
    is_content_admin: profile.is_admin === true,
    is_platform_admin: platformIds.has(profile.id),
  }))
}

export async function updateAccessRole(userId: string, role: "content" | "platform", enabled: boolean): Promise<void> {
  const rpc = role === "platform" ? "set_platform_admin" : "set_content_admin"
  const { error } = await supabase.rpc(rpc, { p_user_id: userId, p_enabled: enabled })
  unwrapError(error)
}

export async function listSystemNotifications(): Promise<SystemNotification[]> {
  const { data, error } = await supabase.from("system_notifications").select("*").order("created_at", { ascending: false }).limit(200)
  unwrapError(error)
  return (data ?? []) as SystemNotification[]
}

export async function createSystemNotification(input: Pick<SystemNotification, "severity" | "title" | "message" | "expires_at">, actorId: string): Promise<void> {
  const { error } = await supabase.from("system_notifications").insert({ ...input, created_by: actorId })
  unwrapError(error)
}

export async function setSystemNotificationActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("system_notifications").update({ active }).eq("id", id)
  unwrapError(error)
}

export const PLAN_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "تجربة",
  active: "نشطة",
  past_due: "متأخرة",
  paused: "موقوفة",
  canceled: "ملغاة",
}
export const PLAN_LABELS: Record<PlanCode, string> = {
  starter: "FREE",
  pro: "PRO",
  business: "BOOST",
  boost: "BOOST",
  enterprise: "Enterprise",
}
