import { useEffect, useMemo, useState } from "react"
import { Activity, DatabaseZap, Download, Loader2, ShieldCheck } from "lucide-react"
import { Badge, Btn, Card, SectionTitle, Table, Td, Th } from "../../components/kit"
import { FormAlert } from "../../modules/auth/components/FormAlert"
import { useOutletContext } from "react-router"
import type { AdminAccess } from "../lib/adminAuth"
import { listPageViews, listSiteEvents, purgePageViews, type PageView, type SiteEvent } from "./client"

const RANGES = [7, 30, 90] as const

type DayCount = { day: string; count: number }

export default function AnalyticsView() {
  const access = useOutletContext<AdminAccess>()
  const [range, setRange] = useState<number>(30)
  const [visits, setVisits] = useState<PageView[]>([])
  const [events, setEvents] = useState<SiteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString()
      const [nextVisits, nextEvents] = await Promise.all([listPageViews(since), listSiteEvents(since)])
      setVisits(nextVisits)
      setEvents(nextEvents)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل إحصاءات الزيارات.")
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [range])

  const breakdown = useMemo(() => {
    const paths = new Map<string, { path: string; locale: string; count: number }>()
    const locales = new Map<string, number>()
    const referrers = new Map<string, number>()
    const days = new Map<string, number>()
    for (const view of visits) {
      const pathKey = `${view.locale}:${view.path}`
      const pathEntry = paths.get(pathKey) ?? { path: view.path, locale: view.locale, count: 0 }
      pathEntry.count += 1
      paths.set(pathKey, pathEntry)
      locales.set(view.locale, (locales.get(view.locale) ?? 0) + 1)
      if (view.referrer_host) referrers.set(view.referrer_host, (referrers.get(view.referrer_host) ?? 0) + 1)
      const day = view.created_at.slice(0, 10)
      days.set(day, (days.get(day) ?? 0) + 1)
    }
    const daily: DayCount[] = Array.from({ length: range }, (_, index) => {
      const now = new Date()
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (range - index - 1)))
      const day = date.toISOString().slice(0, 10)
      return { day, count: days.get(day) ?? 0 }
    })
    return {
      paths: [...paths.values()].sort((a, b) => b.count - a.count).slice(0, 12),
      downloads: events.filter((event) => event.event_type === "download_click").length,
      purchaseClicks: events.filter((event) => event.event_type === "purchase_click").length,
      locales: [...locales].map(([locale, count]) => ({ locale, count })).sort((a, b) => b.count - a.count),
      referrers: [...referrers].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      daily,
    }
  }, [visits, events, range])

  async function purgeOldEvents() {
    if (!access.user?.id || !window.confirm("حذف سجلات الزيارات الأقدم من 90 يوماً؟ لا يمكن التراجع عن ذلك.")) return
    setPurging(true); setError(null); setNotice(null)
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      await purgePageViews(cutoff)
      setNotice("تم حذف سجلات الزيارات الأقدم من 90 يوماً وتسجيل العملية.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف السجلات القديمة.")
    } finally { setPurging(false) }
  }

  function exportCsv() {
    const rows = [["event_type", "path", "target", "locale", "referrer_host", "created_at"], ...visits.map((visit) => ["page_view", visit.path, "", visit.locale, visit.referrer_host, visit.created_at]), ...events.map((event) => [event.event_type, event.path, event.target, event.locale, event.referrer_host, event.created_at])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url; anchor.download = `fatorati-page-views-${range}d.csv`; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const peak = Math.max(1, ...breakdown.daily.map((item) => item.count))
  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="تحليلات الزيارات" sub="قياس داخلي محدود، بعد موافقة الزائر، دون عناوين IP أو معرّفات شخصية." action={<Btn variant="outline" size="sm" onClick={exportCsv} disabled={!visits.length && !events.length}><Download className="h-3.5 w-3.5" /> تصدير CSV</Btn>} />
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {notice && <div role="status" className="rounded-lg border border-good/20 bg-good-50 px-4 py-3 text-[13px] text-emerald-800">{notice}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-1" aria-label="الفترة الزمنية">
          {RANGES.map((days) => <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)} className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${range === days ? "bg-brand text-white" : "text-muted hover:bg-canvas"}`}>{days} يوماً</button>)}
        </div>
        <Btn variant="outline" size="sm" onClick={() => void purgeOldEvents()} disabled={purging}><DatabaseZap className="h-3.5 w-3.5" />{purging ? "جارٍ الحذف…" : "حذف ما قبل 90 يوماً"}</Btn>
      </div>

      {loading ? <div className="grid min-h-44 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="مشاهدات الصفحات" value={visits.length.toLocaleString("fr-MA")} detail="آخر 5,000 حدث كحد أقصى" icon={<Activity className="h-4 w-4" />} />
          <Metric label="مسارات مختلفة" value={new Set(visits.map((item) => item.path)).size.toLocaleString("fr-MA")} detail="صفحات فريدة، وليست زواراً فريدين" icon={<ShieldCheck className="h-4 w-4" />} />
          <Metric label="نقرات التحميل" value={breakdown.downloads.toLocaleString("fr-MA")} detail="لا تؤكد اكتمال التنزيل" icon={<Download className="h-4 w-4" />} />
          <Metric label="نقرات الشراء" value={breakdown.purchaseClicks.toLocaleString("fr-MA")} detail="ليست مدفوعات أو طلبات مؤكدة" icon={<DatabaseZap className="h-4 w-4" />} />
          <Metric label="لغات مقاسة" value={String(breakdown.locales.length)} detail="فرنسية وعربية وإنجليزية" icon={<Activity className="h-4 w-4" />} />
        </div>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-[14px] font-bold text-ink">المشاهدات حسب اليوم</h2><p className="mt-1 text-[11px] text-muted">المجموع اليومي للأحداث المستلمة في الفترة المحددة.</p></div><Badge tone="brand">{range} يوماً</Badge></div>
          <div className="mt-6 flex h-44 items-end gap-1.5 border-b border-line pb-1" role="img" aria-label="مخطط أعمدة يومي لمشاهدات الصفحات">
            {breakdown.daily.map((day) => <div key={day.day} title={`${day.day}: ${day.count}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] text-faint opacity-0 group-hover:opacity-100">{day.count}</span>
              <div className="w-full max-w-5 rounded-t bg-brand/75" style={{ height: `${Math.max(2, (day.count / peak) * 130)}px` }} />
            </div>)}
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-faint"><span>{breakdown.daily[0]?.day}</span><span>{breakdown.daily.at(-1)?.day}</span></div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="text-[14px] font-bold text-ink">أكثر الصفحات مشاهدة</h2></div>
            {breakdown.paths.length ? <Table head={<><Th>المسار</Th><Th>اللغة</Th><Th>المشاهدات</Th></>}>
              {breakdown.paths.map((item) => <tr key={`${item.locale}:${item.path}`}><Td className="max-w-xs truncate text-start font-mono text-[11px] text-ink"><span dir="ltr">{item.path}</span></Td><Td>{localeLabel(item.locale)}</Td><Td>{item.count}</Td></tr>)}
            </Table> : <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد مشاهدات مسجلة في هذه الفترة.</p>}
          </Card>
          <Card className="overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="text-[14px] font-bold text-ink">اللغة ومصدر الإحالة</h2></div>
            <div className="grid gap-5 p-4 sm:grid-cols-2"><div><h3 className="mb-2 text-[11px] font-bold text-muted">حسب اللغة</h3>{breakdown.locales.map((item) => <div key={item.locale} className="flex justify-between border-b border-line py-2 text-[12px]"><span>{localeLabel(item.locale)}</span><strong>{item.count}</strong></div>)}</div>
              <div><h3 className="mb-2 text-[11px] font-bold text-muted">النطاق المرجعي فقط</h3>{breakdown.referrers.map((item) => <div key={item.host} className="flex justify-between gap-3 border-b border-line py-2 text-[12px]"><span className="truncate" dir="ltr">{item.host}</span><strong>{item.count}</strong></div>)}{!breakdown.referrers.length && <p className="py-2 text-[11px] text-faint">مباشر أو غير متاح</p>}</div>
            </div>
          </Card>
        </div>
        <Card className="overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="text-[14px] font-bold text-ink">نقرات التنزيل والشراء الأخيرة</h2><p className="mt-1 text-[11px] text-muted">هذه أحداث نقر فقط؛ يلزم مزود دفع موثوق لتأكيد الطلبات والتحصيل.</p></div>
          {events.length ? <Table head={<><Th>الحدث</Th><Th>الهدف</Th><Th>المسار</Th><Th>اللغة</Th><Th>الوقت</Th></>}>
            {events.slice(0, 100).map((event, index) => <tr key={`${event.created_at}:${event.event_type}:${index}`}><Td>{event.event_type === "download_click" ? "نقرة تنزيل" : "نقرة شراء"}</Td><Td className="max-w-48 truncate">{event.target || "—"}</Td><Td className="font-mono text-[11px]"><span dir="ltr">{event.path}</span></Td><Td>{localeLabel(event.locale)}</Td><Td className="text-[11px] text-muted">{formatDate(event.created_at)}</Td></tr>)}
          </Table> : <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد نقرات محفوظة في هذه الفترة.</p>}
        </Card>
        <p className="rounded-xl border border-line bg-canvas/70 p-4 text-[11px] leading-relaxed text-muted">القياس يعمل فقط بعد اختيار «موافقة» في شريط ملفات الارتباط، ويُوقفه مفتاح تتبع المنصة. لا يُحفظ عنوان IP أو معرّف مستخدم/جلسة أو ملف ارتباط أو مسار إحالة كامل. لا تحسب هذه اللوحة الزوار الفريدين.</p>
      </>}
    </div>
  )
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card className="p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span><p className="mt-3 text-[11px] font-medium text-muted">{label}</p><p className="mt-1 font-display text-[24px] font-bold text-ink">{value}</p><p className="mt-1 text-[10px] text-faint">{detail}</p></Card>
}
function localeLabel(locale: string): string { return locale === "ar" ? "العربية" : locale === "en" ? "English" : "Français" }
function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-MA", { dateStyle: "short", timeStyle: "short" }).format(date)
}
