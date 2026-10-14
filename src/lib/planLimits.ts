/**
 * Plan feature gates — Essential / Pro / Pro Max (Équipe)
 * Read from localStorage user plan or profiles subscription.
 */
export type PlanTier = "none" | "essential" | "pro" | "pro_max"

export const PLAN_FEATURES = {
  none: ["dashboard", "contacts"],
  essential: ["dashboard", "contacts", "calendar", "calendar_deadlines"],
  pro: ["dashboard", "contacts", "calendar", "calendar_deadlines", "contracts", "legal_vault", "reports", "exports", "roles_permissions", "blog_cms"],
  pro_max: ["dashboard", "contacts", "calendar", "calendar_deadlines", "contracts", "legal_vault", "reports", "exports", "roles_permissions", "blog_cms", "multi_user", "advanced_audit", "priority_support", "monitor_site", "content_improvement"],
} as const

export function getUserPlan(): PlanTier {
  try {
    const stored = JSON.parse(localStorage.getItem("user_plan") ?? "{}")
    if (stored && stored.tier) return stored.tier as PlanTier
    // Fallback: check subscriptions store for active highest tier
    const subs = JSON.parse(localStorage.getItem("subscriptions") ?? "[]")
    const active = subs.filter((s: any) => s.status === "active")
    if (active.some((s: any) => s.name?.toLowerCase().includes("max") || s.name?.toLowerCase().includes("équipe") || s.cost >= 400)) return "pro_max"
    if (active.some((s: any) => s.name?.toLowerCase().includes("pro") || s.cost >= 100)) return "pro"
    if (active.length > 0) return "essential"
  } catch (_) {}
  return "none"
}

export function hasFeature(tier: PlanTier, feature: string): boolean {
  return (PLAN_FEATURES[tier] ?? []).includes(feature)
}
