import { useState, useEffect } from "react"
import { Eye, EyeOff, Save, Edit3, Trash2 } from "lucide-react"

type PageEdit = {
  path: string
  title: string
  description: string
  body: string
  hidden: boolean
  lang: string
}

const DEFAULT_PAGES: PageEdit[] = [
  { path: "/", title: "Fatorati — Small Business Dashboard", description: "VAT invoicing and business management for Moroccan entrepreneurs.", body: "", hidden: false, lang: "fr" },
  { path: "/features", title: "Features", description: "Features of FatooraLaw dashboard.", body: "", hidden: false, lang: "fr" },
  { path: "/pricing", title: "Pricing", description: "Subscription plans and pricing.", body: "", hidden: false, lang: "fr" },
  { path: "/blog", title: "Blog", description: "Articles, news, legal dictionary.", body: "", hidden: false, lang: "fr" },
  { path: "/faq", title: "FAQ", description: "Frequently asked questions.", body: "", hidden: false, lang: "fr" },
  { path: "/contact", title: "Contact", description: "Contact details and support.", body: "", hidden: false, lang: "fr" },
  { path: "/privacy", title: "Privacy", description: "Privacy policy.", body: "", hidden: false, lang: "fr" },
  { path: "/terms", title: "Terms", description: "Terms of service.", body: "", hidden: false, lang: "fr" },
  { path: "/cookies", title: "Cookies", description: "Cookie policy.", body: "", hidden: false, lang: "fr" },
  { path: "/login", title: "Login", description: "Admin and user login.", body: "", hidden: false, lang: "fr" },
]

export default function PagesPanel() {
  const [pages, setPages] = useState<PageEdit[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  useEffect(() => {
    try { setPages(JSON.parse(localStorage.getItem("cms_pages") ?? JSON.stringify(DEFAULT_PAGES))) } catch (_) { setPages(DEFAULT_PAGES) }
  }, [])

  const save = () => { try { localStorage.setItem("cms_pages", JSON.stringify(pages)); setStatus("Saved to CMS") } catch (_) { setStatus("Save failed") } }
  const update = (path: string, patch: Partial<PageEdit>) => setPages(pages.map((p) => p.path === path ? { ...p, ...patch } : p))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">CMS — All Site Pages (Edit Text + Hide)</h1>
      <p className="text-xs text-muted mb-4">Edit title / description / body per page. Toggle Hidden to exclude from navigation/render. Save writes to localStorage. For true build-time exclusion: rebuild after hiding.</p>
      <div className="flex gap-2 mb-3"><button onClick={save} className="px-3 py-1 bg-blue-600 text-white text-sm rounded flex items-center gap-2"><Save size={14}/> Save All</button><span className="text-xs text-muted">Status: {status}</span></div>

      <div className="space-y-3">
        {pages.map((p) => (
          <div key={p.path} className={`rounded-xl border bg-surface p-4 shadow-sm ${p.hidden ? "opacity-60 border-dashed" : ""}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-bold text-sm flex items-center gap-2">{p.path} <span className="text-xs text-faint">({p.lang})</span> {p.hidden && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">HIDDEN</span>}</div>
              <div className="flex gap-2">
                <button onClick={() => update(p.path, { hidden: !p.hidden })} className={`px-2 py-1 text-xs rounded border ${p.hidden ? "bg-warn-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><EyeOff size={12}/> {p.hidden ? "Show" : "Hide"}</button>
                <button onClick={() => setEditId(editId === p.path ? null : p.path)} className="px-2 py-1 text-xs rounded border bg-brand-50 text-blue-700"><Edit3 size={12}/> Edit</button>
              </div>
            </div>
            {editId === p.path ? (
              <div className="space-y-2">
                <input value={p.title} onChange={(e) => update(p.path, { title: e.target.value })} className="w-full px-2 py-1 border rounded text-sm font-semibold" />
                <input value={p.description} onChange={(e) => update(p.path, { description: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                <textarea value={p.body} onChange={(e) => update(p.path, { body: e.target.value })} rows={3} className="w-full px-2 py-1 border rounded text-sm resize-none" placeholder="Page body / content (plain text for AI/SEO)" />
              </div>
            ) : (
              <div className="text-sm text-muted"><strong>Title:</strong> {p.title} | <strong>Desc:</strong> {p.description || "—"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
