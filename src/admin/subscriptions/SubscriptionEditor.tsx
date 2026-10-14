/**
 * CMS Subscription / Plan Editor
 * Edit subscription tools (plan name, cost, start/expiry, status) and export.
 */
import { useState, useEffect } from "react"
import { Plus, Trash2, Save, FileDown } from "lucide-react"

type Tool = { id: string; name: string; cost: number; start: string; expiry: string; status: string }

export default function SubscriptionEditor() {
  const [list, setList] = useState<Tool[]>([])
  const [status, setStatus] = useState("")

  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem("subscriptions") ?? "[]")) } catch (_) { setList([]) }
  }, [])

  const save = () => { try { localStorage.setItem("subscriptions", JSON.stringify(list)); setStatus("Saved") } catch (_) { setStatus("Save failed") } }

  const add = () => setList([...list, { id: crypto.randomUUID(), name: "Plan", cost: 0, start: new Date().toISOString().slice(0, 10), expiry: new Date(Date.now() + 30*86400000).toISOString().slice(0, 10), status: "active" }])
  const remove = (id: string) => setList(list.filter((t) => t.id !== id))
  const update = (id: string, patch: Partial<Tool>) => setList(list.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `subscriptions_${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Subscription / Plan Editor</h1>
      <div className="flex gap-2 mb-4"><button onClick={add} className="px-3 py-2 bg-emerald-600 text-white rounded text-sm flex items-center gap-2"><Plus size={14}/> Add Plan</button><button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-2"><Save size={14}/> Save</button><button onClick={exportJson} className="px-3 py-2 bg-amber-600 text-white rounded text-sm flex items-center gap-2"><FileDown size={14}/> Export JSON</button></div>
      <div className="text-xs text-gray-500 mb-3">Status: {status}</div>
      <div className="space-y-3">
        {list.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-3 shadow-sm flex flex-wrap gap-2 items-center">
            <input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} className="px-2 py-1 border rounded text-sm min-w-[140px]" placeholder="Plan name" />
            <input type="number" value={t.cost} onChange={(e) => update(t.id, { cost: Number(e.target.value) })} className="px-2 py-1 border rounded text-sm w-24" placeholder="Cost" />
            <input type="date" value={t.start} onChange={(e) => update(t.id, { start: e.target.value })} className="px-2 py-1 border rounded text-sm" />
            <input type="date" value={t.expiry} onChange={(e) => update(t.id, { expiry: e.target.value })} className="px-2 py-1 border rounded text-sm" />
            <select value={t.status} onChange={(e) => update(t.id, { status: e.target.value })} className="px-2 py-1 border rounded text-sm"><option>active</option><option>expired</option><option>scheduled</option></select>
            <button onClick={() => remove(t.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
      {list.length === 0 && <div className="text-gray-400 text-sm">No plans configured. Click Add Plan.</div>}
    </div>
  )
}
