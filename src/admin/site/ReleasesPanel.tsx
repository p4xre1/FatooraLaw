import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { Plus, Save, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteRelease, listReleases, saveRelease, type CmsRelease } from "./client"

const empty = (): CmsRelease => ({ version: "", channel: "stable", title_by_locale: {}, notes_by_locale: {}, fixes: [], compatibility: "", release_date: new Date().toISOString().slice(0, 10), published: false })

export default function ReleasesPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsRelease[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<CmsRelease>(empty())
  const [fixesText, setFixesText] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setRows(await listReleases()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { const row = rows.find((item) => item.id === selectedId) ?? empty(); setDraft(row); setFixesText((row.fixes ?? []).join("\n")) }, [rows, selectedId])
  function setLocaleCopy(field: "title_by_locale" | "notes_by_locale", value: string) { setDraft({ ...draft, [field]: { ...draft[field], [locale]: value } }) }
  async function save() {
    if (!access.user?.id) return
    if (!/^\d+\.\d+\.\d+([+-][a-zA-Z0-9.-]+)?$/.test(draft.version)) { setError("أدخل إصداراً بصيغة مثل 1.2.3 أو 1.2.3-beta.1."); return }
    setBusy(true); setError(""); setNotice("")
    try { await saveRelease({ ...draft, fixes: fixesText.split("\n").map((value) => value.trim()).filter(Boolean) }, access.user.id); setNotice("تم حفظ الإصدار وملاحظاته."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف سجل الإصدار؟")) return
    setBusy(true); setError("")
    try { await deleteRelease(draft.id); setSelectedId(""); setNotice("تم حذف الإصدار."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <PanelCard title="إصدارات المنتج" description="إدارة رقم الإصدار والقناة والملاحظات والإصلاحات ومتطلبات التوافق. الإصدار المنشور يظهر مع روابط التنزيل العامة." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-bold">الإصدارات</span><Btn size="sm" variant="outline" onClick={() => { setSelectedId(""); setDraft(empty()); setFixesText("") }}><Plus className="h-3.5 w-3.5" /> جديد</Btn></div><div className="max-h-[480px] overflow-auto p-2">{rows.map((row) => <button key={row.id ?? row.version} type="button" onClick={() => setSelectedId(row.id ?? "")} className={`mb-1 w-full rounded-lg p-2 text-start ${selectedId === row.id ? "bg-brand-50 text-brand-700" : "hover:bg-canvas"}`}><span className="block text-[12px] font-semibold">v{row.version} · {row.channel}</span><span className="text-[10px] text-muted">{row.release_date} · {row.published ? "منشور" : "مسودة"}</span></button>)}</div></Card>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="رقم الإصدار"><Input dir="ltr" placeholder="1.2.3" disabled={Boolean(draft.id)} value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} /></Field><Field label="القناة"><Select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as CmsRelease["channel"] })}><option value="stable">Stable</option><option value="beta">Beta</option><option value="preview">Preview</option></Select></Field><Field label="تاريخ الإصدار"><Input type="date" value={draft.release_date} onChange={(event) => setDraft({ ...draft, release_date: event.target.value })} /></Field><Field label="التوافق"><Input maxLength={1000} value={draft.compatibility} onChange={(event) => setDraft({ ...draft, compatibility: event.target.value })} /></Field></div>
        <Field label={`عنوان الإصدار · ${locale}`}><Input maxLength={240} value={draft.title_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("title_by_locale", event.target.value)} /></Field>
        <Field label={`ملاحظات الإصدار · ${locale}`}><Textarea rows={5} value={draft.notes_by_locale[locale] ?? ""} onChange={(event) => setLocaleCopy("notes_by_locale", event.target.value)} /></Field>
        <Field label="الإصلاحات (سطر لكل عنصر)"><Textarea rows={4} value={fixesText} onChange={(event) => setFixesText(event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-[12px] text-ink"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> نشر الإصدار</label>
        <div className="flex justify-end gap-2">{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={busy}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={busy || !access.user?.id}><Save className="h-4 w-4" /> حفظ الإصدار</Btn></div>
      </div>
    </div>
  </PanelCard>
}
