import { useEffect, useState } from "react"
import { Copy, ImagePlus, Trash2, UploadCloud } from "lucide-react"
import { Badge, Btn, Card, Field, Input } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { copyText } from "../../lib/copyText"
import type { LocaleId } from "../../lib/locales"
import { errorMessage, LocaleSelect, PanelCard } from "./SitePanelKit"
import { deleteCmsAsset, listAssets, updateCmsAsset, uploadCmsAsset, type CmsAsset } from "./client"

export default function AssetsPanel() {
  const [assets, setAssets] = useState<CmsAsset[]>([])
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function refresh() { setLoading(true); try { setAssets(await listAssets()); setError("") } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  async function upload() {
    if (!file) { setError("اختر صورة أولاً."); return }
    setBusy(true); setError(""); setNotice("")
    try { await uploadCmsAsset(file, locale, alt); setFile(null); setAlt(""); setNotice("تم رفع الصورة وإضافتها إلى المكتبة."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function toggle(asset: CmsAsset) {
    setBusy(true); setError("")
    try { await updateCmsAsset({ ...asset, active: !asset.active }); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function remove(asset: CmsAsset) {
    if (!window.confirm(`حذف الصورة ${asset.file_name}؟`)) return
    setBusy(true); setError("")
    try { await deleteCmsAsset(asset); setNotice("تم حذف سجل الصورة والملف من التخزين."); await refresh() }
    catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function copy(url: string) {
    if (await copyText(url)) setNotice("تم نسخ الرابط العام.")
    else setError("تعذر نسخ الرابط. انسخه يدوياً من الحقل.")
  }
  return <PanelCard title="مكتبة الصور والرسوم" description="تحميل لقطات الشاشة والرسوم التي ستظهر للعامة. الملفات عامة بعد النشر، حد أقصى 10 MB، والصيغ PNG وJPEG وWebP وSVG." loading={loading} error={error} notice={notice} action={<LocaleSelect value={locale} onChange={setLocale} />}>
    <div className="grid gap-3 rounded-xl border border-line bg-canvas/50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <Field label="ملف الصورة"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12px]" /></Field>
      <Field label={`النص البديل (${locale})`}><Input maxLength={500} value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="وصف مختصر للصورة" /></Field>
      <Btn onClick={() => void upload()} disabled={busy || !file}><UploadCloud className="h-4 w-4" />{busy ? "جارٍ الرفع…" : "رفع الصورة"}</Btn>
    </div>
    {!assets.length ? <p className="py-8 text-center text-[12px] text-muted">لا توجد صور محفوظة بعد.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <Card key={asset.id} className="overflow-hidden">
      <div className="grid aspect-[16/9] place-items-center bg-canvas">{asset.mime_type === "image/svg+xml" ? <img src={asset.public_url} alt={asset.alt_by_locale[locale] ?? ""} className="max-h-full max-w-full object-contain" /> : <img src={asset.public_url} alt={asset.alt_by_locale[locale] ?? ""} className="h-full w-full object-cover" />}</div>
      <div className="space-y-2 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-[12px] font-semibold text-ink" title={asset.file_name}>{asset.file_name}</p><Badge tone={asset.active ? "good" : "neutral"}>{asset.active ? "نشطة" : "مخفية"}</Badge></div><p className="text-[10px] text-muted">{formatSize(asset.byte_size)} · {asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.mime_type}</p><Input readOnly value={asset.public_url} className="text-[10px]" dir="ltr" /><div className="flex justify-end gap-2"><Btn size="sm" variant="outline" onClick={() => void copy(asset.public_url)}><Copy className="h-3.5 w-3.5" /> نسخ الرابط</Btn><Btn size="sm" variant="outline" onClick={() => void toggle(asset)} disabled={busy}>{asset.active ? "إخفاء" : "إظهار"}</Btn><Btn size="sm" variant="danger" onClick={() => void remove(asset)} disabled={busy}><Trash2 className="h-3.5 w-3.5" /></Btn></div></div>
    </Card>)}</div>}
  </PanelCard>
}
function formatSize(bytes: number): string { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
