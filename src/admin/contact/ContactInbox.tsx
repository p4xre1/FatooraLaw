/**
 * CMS Contact / Email Inbox — mirrors Mizan mail panel
 * Reads from site config contact email and local message store.
 */
import { useState, useEffect } from "react"
import { Mail, Search, Send } from "lucide-react"
import { CONTACT_EMAIL } from "../../lib/contact"

type Msg = { id: string; from: string; subject: string; body: string; time: string; read: boolean }

export default function ContactInbox() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [search, setSearch] = useState("")
  const [draftTo, setDraftTo] = useState(CONTACT_EMAIL)
  const [draftSubj, setDraftSubj] = useState("")
  const [draftBody, setDraftBody] = useState("")

  useEffect(() => {
    try { setMsgs(JSON.parse(localStorage.getItem("contact_inbox") ?? "[]")) } catch (_) {}
  }, [])

  const save = () => { try { localStorage.setItem("contact_inbox", JSON.stringify(msgs)) } catch (_) {} }
  const markRead = (id: string) => { setMsgs(msgs.map((m) => m.id === id ? { ...m, read: true } : m)); save() }

  const filtered = msgs.filter((m) => m.from.toLowerCase().includes(search.toLowerCase()) || m.subject.toLowerCase().includes(search.toLowerCase()) || m.body.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2"><Mail /> Contact / Email Inbox</h1>
      <div className="text-xs text-muted mb-4">Site email: <strong>{CONTACT_EMAIL || "not configured"}</strong> | MCP: gmail_list_messages / gmail_search_contact_messages ready</div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1"><Search className="absolute left-2 top-2 text-faint" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages..." className="w-full pl-8 pr-2 py-1 border rounded text-sm" /></div>
        <button onClick={() => setMsgs([...msgs, { id: crypto.randomUUID(), from: draftTo || "external", subject: draftSubj || "New message", body: draftBody || "", time: new Date().toISOString(), read: false }])} className="px-3 py-1 bg-emerald-600 text-white text-sm rounded flex items-center gap-2"><Send size={14}/> Send Draft</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border bg-surface shadow-sm overflow-auto max-h-[28rem]">
          <table className="w-full text-sm"><thead className="bg-canvas sticky top-0"><tr><th className="text-left px-3 py-2">From</th><th className="text-left px-3 py-2">Subject</th><th className="text-left px-3 py-2">Time</th></tr></thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} onClick={() => markRead(m.id)} className={`border-t cursor-pointer hover:bg-brand-50 ${m.read ? "bg-surface" : "bg-warn-50 font-medium"}`}>
                <td className="px-3 py-2 whitespace-nowrap">{m.from}</td>
                <td className="px-3 py-2">{m.subject}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{new Date(m.time).toLocaleString()}</td>
              </tr>
            ))}
          </tbody></table>
          {filtered.length === 0 && <div className="p-4 text-faint text-sm">No messages</div>}
        </div>

        <div className="rounded-xl border bg-gradient-to-b from-warn-50 to-surface p-4 shadow-sm h-fit">
          <h3 className="font-bold mb-2">New Message / Draft</h3>
          <input value={draftTo} onChange={(e) => setDraftTo(e.target.value)} placeholder="To (email)" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <input value={draftSubj} onChange={(e) => setDraftSubj(e.target.value)} placeholder="Subject" className="w-full px-2 py-1 border rounded text-sm mb-2" />
          <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="Body..." rows={6} className="w-full px-2 py-1 border rounded text-sm mb-2 resize-none" />
          <div className="text-xs text-faint">Uses site contact email from .figma/site.json. For real Gmail sync: connect MCP / OAuth.</div>
        </div>
      </div>
    </div>
  )
}
