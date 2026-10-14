import { getUserPlan, hasFeature } from "../lib/planLimits"

export default function PlanGate({ feature, children, fallback }: { feature: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  const tier = getUserPlan()
  const allowed = hasFeature(tier, feature)
  if (allowed) return <>{children}</>
  return <>{fallback ?? (
    <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-red-50 p-5 shadow-sm text-center">
      <div className="text-xl font-extrabold text-red-600">مقفول — Locked</div>
      <div className="text-sm text-gray-700 mt-2">Plan <strong className="text-amber-700">{tier === "none" ? "None" : tier}</strong> does not include <strong>{feature}</strong>.</div>
      <div className="text-xs text-gray-500 mt-1">Upgrade to <strong>Pro</strong> (199 MAD/mo) or <strong>Pro Max / Équipe</strong> (499 MAD/mo)</div>
      <a href="https://wa.me/212772966980" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 px-5 py-2 bg-emerald-600 text-white rounded-full font-bold text-sm shadow hover:bg-emerald-700">💬 ادفع عبر واتساب / Pay via WhatsApp 0772966980</a>
      <div className="text-[11px] text-gray-400 mt-1">Send receipt / RIP — then I activate your plan manually</div>
    </div>
  )}</>
}
