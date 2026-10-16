/**
 * CMS — رموز التفعيل والأسعار (activation codes & prices).
 *
 * The owner's subscription console, in three parts:
 *
 *  1. **رموز التفعيل** — the issuance console (`./ActivationConsole.tsx`): the
 *     readiness check, the MFA panel, the code builder and the server key
 *     ledger. The same console also renders on `/admin/subscriptions`, so an
 *     owner who goes there to manage plans finds the generator too.
 *  2. **سجل الاشتراكات** — every code ever handed out: when it started, when
 *     it ends, how many days remain, and the owner's two hands on it —
 *     تجميد (freeze: the remaining days wait) and إيقاف (stop: it ends now).
 *     The signed-in app reads the same ledger, so a freeze or stop made here
 *     applies there in the same browser immediately.
 *  3. **الأسعار والنصوص** — the prices and selling paragraphs of the three
 *     plans, per language, applied at once to the lock page, the dashboard
 *     strip and the WhatsApp buy message.
 *
 * Activation key digests are stored server-side in `activation_keys` when
 * Supabase is configured; plaintext keys are shown once at issuance only.
 * The descriptive client ledger and plan-copy editor remain local to this
 * browser and are not the server's authoritative subscription record.
 */
import { useMemo, useState } from "react"
import { Ban, Check, FileDown, KeyRound, Play, RotateCcw, Snowflake, Trash2 } from "lucide-react"
import { useSubscriptions } from "../../store/useSubscriptions"
import { usePlanCatalog } from "../../store/usePlanCatalog"
import { daysLeft, displayStatus, projectedEnd, type SubscriptionRecord } from "../../lib/subscriptionLedger"
import { PLAN_ORDER, PLANS, type PlanCode } from "../../lib/plans"
import { defaultCatalog } from "../../lib/planCatalog"
import { translations } from "../../i18n"
import type { LocaleId } from "../../lib/locales"
import ActivationConsole, { SOURCE_LABELS, inputCls, labelCls } from "./ActivationConsole"

const STATUS_LABELS = {
  pending: "بانتظار التفعيل",
  active: "نشط",
  frozen: "مجمّد",
  stopped: "موقوف",
  expired: "منتهي",
} as const

const STATUS_STYLE: Record<keyof typeof STATUS_LABELS, string> = {
  pending: "bg-warn-50 text-amber-700 ring-amber-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  frozen: "bg-sky-50 text-sky-700 ring-sky-600/20",
  stopped: "bg-rose-50 text-rose-700 ring-rose-600/20",
  expired: "bg-slate-100 text-slate-500 ring-slate-500/20",
}

const dateFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" })
const fmtDate = (iso: string | null) => {
  if (!iso) return "—"
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? iso : dateFmt.format(date)
}

export default function SubscriptionEditor() {
  const records = useSubscriptions((state) => state.records)
  const { freeze, unfreeze, stop, reactivate, remove } = useSubscriptions.getState()
  const [filter, setFilter] = useState("")

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) => [r.clientName, r.company, r.contact, r.code].some((v) => v.toLowerCase().includes(q)))
  }, [records, filter])

  function exportJson() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fatorati-subscriptions_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="h-6 w-6 text-brand" /> رموز التفعيل والأسعار</h1>
        <p className="mt-1 text-[13px] text-muted">
          أنشئ رمزاً لكل عميل، تابع بداية اشتراكه ونهايته، جمّده أو أوقفه، وعدّل الأسعار ونصوص الخطط — كل ذلك يظهر فوراً داخل التطبيق في هذا المتصفح.
        </p>
      </header>

      <ActivationConsole />

      <section className="rounded-2xl border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">سجل الاشتراكات ({records.length})</h2>
          <div className="flex items-center gap-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث: عميل، شركة، رمز…" className="rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] outline-none focus:border-brand" />
            <button type="button" onClick={exportJson} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-700">
              <FileDown className="h-3.5 w-3.5" /> تصدير JSON
            </button>
          </div>
        </div>

        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-faint">لا توجد اشتراكات بعد. أنشئ أول رمز من المنشئ أعلاه.</p>}

        <div className="space-y-2.5">
          {shown.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              onFreeze={() => freeze(record.id)}
              onUnfreeze={() => unfreeze(record.id)}
              onStop={() => stop(record.id)}
              onReactivate={() => reactivate(record.id)}
              onRemove={() => remove(record.id)}
            />
          ))}
        </div>
      </section>

      <CatalogEditor />

      <p className="rounded-xl border border-dashed bg-warn-50/60 p-3 text-[12px] leading-relaxed text-warn">
        ملاحظة: هذه السجلات محفوظة في هذا المتصفح (local-first) — التجميد والإيقاف يسريان فوراً على التطبيق في نفس المتصفح.
مفاتيح التفعيل الجديدة تُحفظ خادمياً عند إعداد Supabase؛ أما هذا السجل التفصيلي وأدوات التجميد المحلية فتبقى في هذا المتصفح فقط. الخطة المستردة نفسها تُسجل في <span dir="ltr" className="font-mono">account_subscriptions</span>.
      </p>
    </div>
  )
}

/* ------------------------------- record row ------------------------------ */

function RecordRow({ record, onFreeze, onUnfreeze, onStop, onReactivate, onRemove }: {
  record: SubscriptionRecord
  onFreeze: () => void
  onUnfreeze: () => void
  onStop: () => void
  onReactivate: () => void
  onRemove: () => void
}) {
  const status = displayStatus(record)
  const left = daysLeft(record)

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-40 flex-1">
          <p className="text-[13.5px] font-bold">{record.clientName}{record.company && <span className="font-medium text-muted"> · {record.company}</span>}</p>
          <p className="text-[12px] text-muted" dir="ltr">{record.contact || "—"}</p>
          <p className="mt-0.5 font-mono text-[11.5px] text-slate-500" dir="ltr">{record.code}</p>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${record.plan === "boost" ? "bg-violet-50 text-violet-700 ring-violet-600/20" : "bg-brand-50 text-blue-700 ring-blue-600/20"}`}>
          {record.plan.toUpperCase()} · {record.period === "1M" ? "شهر" : "سنة"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${STATUS_STYLE[status]}`}>{STATUS_LABELS[status]}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-5">
        <div><p className="text-[10.5px] font-bold text-faint">المصدر</p><p>{SOURCE_LABELS[record.source]}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">البداية</p><p>{record.startsAt ? fmtDate(record.startsAt) : "لم يُفعَّل بعد"}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">النهاية{!record.endsAt && " (متوقعة)"}</p><p>{fmtDate(projectedEnd(record))}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">المتبقي</p><p>{left === null ? "—" : left === 0 ? "اليوم الأخير" : `${left} يوم`}</p></div>
        <div><p className="text-[10.5px] font-bold text-faint">أُنشئ في</p><p>{fmtDate(record.issuedAt)}</p></div>
      </div>
      {record.note && <p className="mt-1.5 text-[12px] text-muted">📝 {record.note}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {status !== "frozen" && status !== "stopped" && status !== "expired" && (
          <button type="button" onClick={onFreeze} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-sky-700">
            <Snowflake className="h-3.5 w-3.5" /> تجميد
          </button>
        )}
        {status === "frozen" && (
          <button type="button" onClick={onUnfreeze} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">
            <Play className="h-3.5 w-3.5" /> استئناف
          </button>
        )}
        {status !== "stopped" && (
          <button type="button" onClick={onStop} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700">
            <Ban className="h-3.5 w-3.5" /> إيقاف
          </button>
        )}
        {status === "stopped" && (
          <button type="button" onClick={onReactivate} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-700">
            <RotateCcw className="h-3.5 w-3.5" /> إعادة تفعيل
          </button>
        )}
        <button type="button" onClick={onRemove} aria-label="حذف السجل" className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-50">
          <Trash2 className="h-3.5 w-3.5" /> حذف
        </button>
      </div>
    </div>
  )
}

/* --------------------------- prices & paragraphs -------------------------- */

const LOCALE_TABS: { id: LocaleId; label: string }[] = [
  { id: "ar", label: "العربية" },
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
]

function CatalogEditor() {
  const catalog = usePlanCatalog((state) => state.catalog)
  const { setPrice, setCopy, reset } = usePlanCatalog.getState()
  const [locale, setLocale] = useState<LocaleId>("fr")
  const [savedTick, setSavedTick] = useState(0)
  const defaults = defaultCatalog()

  const priceDraft = (plan: "pro" | "boost", field: "monthly" | "yearly") => catalog.prices[plan][field]
  const copyValue = (plan: PlanCode, field: "tagline" | "value") =>
    catalog.copy[plan]?.[locale]?.[field] ?? ""
  const copyFallback = (plan: PlanCode, field: "tagline" | "value") =>
    field === "tagline" ? translations[locale].plans.tagline[plan] : translations[locale].plans.value[plan]

  return (
    <section className="rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">الأسعار والنصوص</h2>
        <div className="flex items-center gap-2">
          {savedTick > 0 && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" /> تم الحفظ — يظهر فوراً في التطبيق</span>}
          <button type="button" onClick={() => { reset(); setSavedTick((n) => n + 1) }} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-200">
            <RotateCcw className="h-3.5 w-3.5" /> استعادة الافتراضي
          </button>
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-muted">الأسعار بالدرهم (MAD). النص المعدَّل يغلب النص الأصلي؛ اترك الحقل فارغاً لاستعمال النص الأصلي.</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {(["pro", "boost"] as const).map((plan) => (
          <div key={plan} className="rounded-xl border border-line p-3">
            <p className="mb-2 text-[13px] font-extrabold">{plan.toUpperCase()} <span className="font-medium text-muted">· الافتراضي {defaults.prices[plan].monthly}/{defaults.prices[plan].yearly}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor={`price-${plan}-m`}>شهرياً (MAD)</label>
                <input id={`price-${plan}-m`} type="number" min={0} value={priceDraft(plan, "monthly")} onChange={(e) => { setPrice(plan, "monthly", Number(e.target.value)); setSavedTick((n) => n + 1) }} className={inputCls} dir="ltr" />
              </div>
              <div>
                <label className={labelCls} htmlFor={`price-${plan}-y`}>سنوياً (MAD)</label>
                <input id={`price-${plan}-y`} type="number" min={0} value={priceDraft(plan, "yearly")} onChange={(e) => { setPrice(plan, "yearly", Number(e.target.value)); setSavedTick((n) => n + 1) }} className={inputCls} dir="ltr" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex gap-1.5" role="tablist" aria-label="لغة النصوص">
          {LOCALE_TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={locale === tab.id} onClick={() => setLocale(tab.id)} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${locale === tab.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PLAN_ORDER.map((plan: PlanCode) => (
            <div key={plan} className="space-y-2 rounded-xl border border-line p-3">
              <p className="text-[13px] font-extrabold">{PLANS[plan].code.toUpperCase()}</p>
              <div>
                <label className={labelCls} htmlFor={`copy-${plan}-tagline`}>السطر التعريفي</label>
                <input id={`copy-${plan}-tagline`} value={copyValue(plan, "tagline")} placeholder={copyFallback(plan, "tagline")} onChange={(e) => { setCopy(plan, locale, "tagline", e.target.value); setSavedTick((n) => n + 1) }} className={inputCls} dir="auto" />
              </div>
              <div>
                <label className={labelCls} htmlFor={`copy-${plan}-value`}>جملة القيمة (أعلى البطاقة)</label>
                <textarea id={`copy-${plan}-value`} rows={3} value={copyValue(plan, "value")} placeholder={copyFallback(plan, "value")} onChange={(e) => { setCopy(plan, locale, "value", e.target.value); setSavedTick((n) => n + 1) }} className={inputCls} dir="auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
