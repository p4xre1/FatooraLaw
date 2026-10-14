/**
 * PlanGate — show feature only if account tier allows
 */
import { getUserPlan, hasFeature, type PlanTier } from "../lib/planLimits"

export default function PlanGate({ feature, children, fallback }: { feature: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  const tier = getUserPlan()
  const allowed = hasFeature(tier, feature)
  if (allowed) return <>{children}</>
  return <>{fallback ?? <div className="rounded-xl border bg-red-50 p-4 text-red-700 text-sm">Feature locked — plan <strong>{tier === "none" ? "None" : tier}</strong> does not include <strong>{feature}</strong>. Upgrade to Pro / Pro Max.</div>}</>
}
