/**
 * CMS SECURITY CONTROL PANEL — Core Monitor + Controls
 * Import into /admin/layout or as standalone /admin/security page.
 */
import { useState, useEffect } from "react"
import { Shield, LogIn, AlertTriangle, Lock, Unlock, FileDown } from "lucide-react"
import { logEvent, getAuditLog, exportEncryptedAudit, clearAudit, detectAnomaly, type AuditEvent } from "../../lib/security/cmsMonitor"
import { verifyCsrf, storeCsrf, getCsrf } from "../../lib/security/csrf"
import { RateLimiter } from "../../lib/security/rateLimiter"
import { cryptoAvailable } from "../../lib/security/encryption"

export default function CmsSecurityControl() {
  const [log, setLog] = useState<AuditEvent[]>([])
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const limiter = new RateLimiter(60_000, 10)

  useEffect(() => {
    refresh()
    // Initial audit entry
    logEvent({ time: new Date().toISOString(), action: "login", target: "cms_security_panel", user: "admin", details: "Security control accessed" })
  }, [])

  const refresh = () => setLog(getAuditLog())

  const handleExport = async () => {
    if (limiter.isLimited("export_audit")) return setStatus("Rate limited — wait")
    if (!password || password.length < 8) return setStatus("Password must be >= 8 chars")
    try {
      const encrypted = await exportEncryptedAudit(password)
      const blob = new Blob([encrypted], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cms_audit_${new Date().toISOString().slice(0, 10)}.enc`
      a.click()
      URL.revokeObjectURL(url)
      setStatus("Encrypted audit exported")
      logEvent({ time: new Date().toISOString(), action: "update", target: "audit_export", user: "admin", details: "Encrypted export" })
    } catch (e) {
      setStatus("Export failed")
    }
    refresh()
  }

  const handleClear = () => {
    if (!verifyCsrf(getCsrf() ?? "")) return setStatus("CSRF verification failed")
    clearAudit()
    setStatus("Audit cleared")
    refresh()
  }

  const anomalyCount = log.filter((e) => detectAnomaly(e.action, e.target)).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Shield className="text-amber-500" /> CMS Security Control</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Audit Events</div><div className="text-3xl font-bold">{log.length}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Anomalies Detected</div><div className="text-3xl font-bold text-red-500">{anomalyCount}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">Crypto Ready</div><div className="text-xl font-bold text-emerald-600">{cryptoAvailable() ? "YES" : "NO"}</div></div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={() => { storeCsrf(); refresh(); setStatus("CSRF refreshed") }} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Refresh CSRF</button>
        <button onClick={handleClear} className="px-3 py-2 rounded bg-red-600 text-white text-sm">Clear Audit</button>
        <button onClick={handleExport} className="px-3 py-2 rounded bg-amber-600 text-white text-sm flex items-center gap-2"><FileDown size={14}/> Export Encrypted Audit</button>
      </div>

      <input type="password" placeholder="Encryption password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full md:w-72 mb-3 px-3 py-2 border rounded text-sm" />
      <div className="text-xs text-gray-500 mb-4">Status: {status}</div>

      <h2 className="font-bold mb-2">Recent Audit Log</h2>
      <div className="max-h-96 overflow-auto rounded border bg-white text-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-100 sticky top-0"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Details</th></tr></thead>
          <tbody>
            {log.slice().reverse().map((e, i) => (
              <tr key={i} className="border-t hover:bg-amber-50"><td className="px-3 py-2 whitespace-nowrap">{new Date(e.time).toLocaleString()}</td><td className="px-3 py-2">{e.action}</td><td className="px-3 py-2">{e.target}</td><td className="px-3 py-2">{e.user}</td><td className="px-3 py-2 text-xs text-gray-600">{e.details}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
