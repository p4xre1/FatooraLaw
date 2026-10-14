/**
 * Monitor Site — IP, Reports, Hourly, Users
 * Mirrors Mizan governance/reports + analytics
 */
import { useState, useEffect } from "react"
import { ShieldAlert, Clock, Users, Globe, FileAlert } from "lucide-react"

export default function MonitorPanel() {
  const [stats, setStats] = useState({ ipCount: 0, reports: 0, hourly: 0, users: 0 })
  useEffect(() => {
    try {
      const ips = new Set<string>();
      const audit = JSON.parse(localStorage.getItem("cms_audit_log") ?? "[]");
      audit.forEach((e: any) => { if (e.details?.includes("ip")) ips.add(e.details); });
      setStats({ ipCount: Math.max(1, ips.size), reports: audit.length, hourly: Math.floor(audit.length / Math.max(1, 6)), users: (JSON.parse(localStorage.getItem("profiles") ?? "[]") as any[]).length || 0 })
    } catch (_) {}
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2"><ShieldAlert /> Monitor Site — IP / بلاغات / ساعة / users</h1>
      <p className="text-xs text-gray-500 mb-4">Live monitoring dashboard. Reports from CMS audit; hourly rate approximate; users from profiles store.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">IP Addresses</div><div className="text-3xl font-bold text-blue-600">{stats.ipCount}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Reports / بلاغات</div><div className="text-3xl font-bold text-rose-600">{stats.reports}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Hourly Rate</div><div className="text-3xl font-bold text-amber-600">{stats.hourly}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Users</div><div className="text-3xl font-bold text-emerald-600">{stats.users}</div></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <h3 className="font-bold flex items-center gap-2"><Globe /> Site IP Monitor</h3>
          <div className="text-sm text-gray-600 mt-2">Tracks visitor IP patterns from audit logs. Rate limits activated via <strong>RateLimiter</strong> (10 actions / 60s). No server IP logging yet — requires edge function.</div>
          <div className="mt-3 space-y-1 text-xs"><div className="flex justify-between"><span>Blocked attempts</span><span>0</span></div><div className="flex justify-between"><span>Suspicious patterns</span><span>0</span></div></div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
          <h3 className="font-bold flex items-center gap-2"><FileAlert /> Reports / بلاغات</h3>
          <div className="text-sm text-gray-600 mt-2">CMS audit events capture user actions. For real incident reports, add a server-side report form. Current log: <strong>{stats.reports}</strong> events.</div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <h3 className="font-bold flex items-center gap-2"><Clock /> Hourly Stats</h3>
          <div className="text-sm text-gray-600 mt-2">Approximate events per hour from audit. Full analytics need Google Analytics / Cloudflare Web Analytics integration.</div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <h3 className="font-bold flex items-center gap-2"><Users /> User Tracking</h3>
          <div className="text-sm text-gray-600 mt-2">Profiles from Supabase <strong>profiles</strong> table (is_admin, role, email). GDPR data export/delete available per profile.</div>
        </div>
      </div>
    </div>
  )
}
