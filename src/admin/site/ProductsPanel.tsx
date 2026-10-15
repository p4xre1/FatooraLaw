import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { ExternalLink, Plus, Save, ShoppingBag, Trash2 } from "lucide-react"
import { Btn, Card, Field, Input, Select, Textarea } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import type { AdminAccess } from "../lib/adminAuth"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteProduct, listProducts, saveProduct, type CmsProduct } from "./client"

const empty = (locale: LocaleId): CmsProduct => ({ product_key: "", locale, name: "", description: "", price_amount: 0, currency: "MAD", purchase_url: "", active: false, sort_order: 0 })

export default function ProductsPanel() {
  const access = useOutletContext<AdminAccess>()
  const [rows, setRows] = useState<CmsProduct[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<CmsProduct>(empty("fr"))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const products = rows.filter((row) => row.locale === locale)
  async function refresh() { setLoading(true); try { setRows(await listProducts()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setDraft({ ...(products.find((row) => row.id === selectedId) ?? empty(locale)), locale }) }, [rows, selectedId, locale])
  function changeLocale(value: LocaleId) { setLocale(value); setSelectedId("") }
  async function save() {
    if (!access.user?.id) return
    if (!/^[a-z0-9-]{1,80}$/.test(draft.product_key)) { setError("مفتاح المنتج يقبل أحرفاً لاتينية صغيرة وأرقاماً وشرطة فقط."); return }
    if (draft.purchase_url && !/^https?:\/\//i.test(draft.purchase_url)) { setError("رابط الشراء يجب أن يبدأ بـ https:// أو http://."); return }
    setBusy(true); setError(""); setNotice("")
    try { await saveProduct({ ...draft, locale, price_amount: Number(draft.price_amount) || 0 }, access.user.id); setNotice("تم حفظ المنتج والسعر والرابط الخارجي."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!draft.id || !window.confirm("حذف المنتج لهذه اللغة؟")) return
    setBusy(true); setError("")
    try { await deleteProduct(draft.id); setSelectedId(""); setNotice("تم حذف سجل المنتج."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <PanelCard title="المنتجات والأسعار لمرة واحدة" description="هذه المنتجات تحفظ السعر ورابط الشراء الخارجي وتعدّ نقرات CTA فقط. لا يوجد حالياً مزود دفع أو webhooks لتأكيد الطلبات أو المدفوعات؛ لا تعرضها كتجارة إلكترونية متحققة." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={changeLocale} />}>
    <div className="rounded-lg border border-amber-400/25 bg-warn-50 px-3 py-2 text-[11px] leading-relaxed text-warn">لا يُحفظ رقم البطاقة أو بيانات الدفع هنا. تتبع الطلبات وحالة التحصيل يتطلب ربط مزود موثوق وإعداد webhook على الخادم.</div>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-bold">المنتجات · {products.length}</span><Btn size="sm" variant="outline" onClick={() => { setSelectedId(""); setDraft(empty(locale)) }}><Plus className="h-3.5 w-3.5" /> جديد</Btn></div><div className="max-h-[480px] overflow-auto p-2">{products.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id ?? "")} className={`mb-1 w-full rounded-lg p-2 text-start ${selectedId === row.id ? "bg-brand-50 text-brand-700" : "hover:bg-canvas"}`}><span className="block truncate text-[12px] font-semibold">{row.name || row.product_key}</span><span className="text-[10px] text-muted">{row.product_key} · {row.price_amount} {row.currency} · {row.active ? "نشط" : "مسودة"}</span></button>)}</div></Card>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="مفتاح المنتج"><Input dir="ltr" maxLength={80} disabled={Boolean(draft.id)} value={draft.product_key} onChange={(event) => setDraft({ ...draft, product_key: event.target.value })} placeholder="setup-guide" /></Field><Field label="اسم المنتج"><Input maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="السعر"><Input type="number" min={0} step="0.01" value={draft.price_amount} onChange={(event) => setDraft({ ...draft, price_amount: Number(event.target.value) || 0 })} /></Field><Field label="العملة"><Select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value as CmsProduct["currency"] })}><option value="MAD">MAD</option><option value="EUR">EUR</option><option value="USD">USD</option></Select></Field></div>
        <Field label="الوصف"><Textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
        <Field label="رابط الشراء الخارجي" hint="رابط checkout لدى مزود دفع موثوق. إدخال الرابط وحده لا يثبت الدفع."><Input type="url" dir="ltr" maxLength={2000} value={draft.purchase_url} onChange={(event) => setDraft({ ...draft, purchase_url: event.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="الترتيب"><Input type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) || 0 })} /></Field><label className="flex items-center gap-2 self-end pb-2 text-[12px] text-ink"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> إظهار المنتج للعامة</label></div>
        <div className="flex justify-end gap-2">{draft.purchase_url && <a href={draft.purchase_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-muted"><ExternalLink className="h-3.5 w-3.5" /> فتح الرابط</a>}{draft.id && <Btn variant="danger" onClick={() => void remove()} disabled={busy}><Trash2 className="h-4 w-4" /> حذف</Btn>}<Btn onClick={() => void save()} disabled={busy || !access.user?.id}><ShoppingBag className="h-4 w-4" />{busy ? "جارٍ الحفظ…" : "حفظ المنتج"}</Btn></div>
      </div>
    </div>
  </PanelCard>
}
