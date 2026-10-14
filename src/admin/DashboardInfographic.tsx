/**
 * Dashboard Infographic / Export — CMS admin view
 * Shows projects / contacts / expenses / audit counts and exports JSON + PNG text summary.
 */
import { useState, useEffect } from "react"
import { BarChart3, FileDown, Image } from "lucide-react"

export default function DashboardInfographic() {
  const [stats, setStats] = useState({ projects: 0, contacts: 0, expenses: 0, audit: 0, totalAmount: 0 })

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("projects") ?? "[]")
      const c = JSON.parse(localStorage.getItem("contacts") ?? "[]")
      const e = JSON.parse(localStorage.getItem("expenses") ?? "[]")
      const a = JSON.parse(localStorage.getItem("cms_audit_log") ?? "[]")
      const total = (e as any[]).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0)
      setStats({ projects: p.length, contacts: c.length, expenses: e.length, audit: a.length, totalAmount: total })
    } catch (_) {}
  }, [])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `dashboard_${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
      <h3 className="font-bold flex items-center gap-2"><BarChart3 /> Dashboard Infographic</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        {[
          { label: "Projects", value: stats.projects, color: "text-blue-600" },
          { label: "Contacts", value: stats.contacts, color: "text-emerald-600" },
          { label: "Expenses", value: stats.expenses, color: "text-amber-600" },
          { label: "Audit Events", value: stats.audit, color: "text-rose-600" },
          { label: "Total Amount", value: stats.totalAmount.toFixed(2), color: "text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-3 shadow-sm text-center"><div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={exportJson} className="px-3 py-2 bg-blue-600 text-white text-sm rounded flex items-center gap-2"><FileDown size={14}/> Export JSON</button>
        <button onClick={() => { const d = document.createElement("div"); d.innerHTML = `<h2>Dashboard</h2><p>Projects: ${stats.projects}</p><p>Contacts: ${stats.contacts}</p><p>Expenses: ${stats.expenses}</p><p>Audit: ${stats.audit}</p><p>Total: ${stats.totalAmount}</p>`; const win = window.open("","_blank"); win?.document.write(d.innerHTML); }} className="px-3 py-2 bg-gray-800 text-white text-sm rounded flex items-center gap-2"><Image size={14}/> Open Infographic</button>
      </div>
    </div>
  )
}
