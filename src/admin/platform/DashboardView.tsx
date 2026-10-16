import { useEffect, useMemo, useState } from "react"
import { Activity, Bell, CreditCard, FileText, KeyRound, ShieldCheck, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router"
import { Badge, Card, SectionTitle } from "../../components/kit"
import {
  PLAN_LABELS,
  PLAN_STATUS_LABELS,
  listAdminAuditEvents,
  listPageViews,
  listSiteEvents,
  listPlans,
  listPurchaseRequests,
  listSubscriptions,
  listSystemNotifications,
  type AccountSubscription,
  type AdminAuditEvent,
  type PageView,
  type Plan,
  type PurchaseRequest,
  type SystemNotification,
  type SiteEvent,
} from "./client"

type DashboardData = {
  plans: Plan[]
  subscriptions: AccountSubscription[]
  requests: PurchaseRequest[]
  visits: PageView[]
  events: SiteEvent[]
  notifications: SystemNotification[]
  audit: AdminAuditEvent[]
}

export default function AdminDashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    void Promise.all([listPlans(), listSubscriptions(), listPurchaseRequests(), listPageViews(since), listSiteEvents(since), listSystemNotifications(), listAdminAuditEvents(8)])
      .then(([plans, subscriptions, requests, visits, events, notifications, audit]) => {
        if (active) setData({ plans, subscriptions, requests, visits, events, notifications, audit })
      }).catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "تعذر تحميل لوحة التحكم.")
      }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const priceByPlan = new Map(data.plans.map((plan) => [plan.code, Number(plan.monthly_price)]))
    const paying = data.subscriptions.filter((account) => account.status === "active" || account.status === "trialing")
    return {
      accounts: data.subscriptions.length,
      active: paying.length,
      nominalMonthlyValue: paying.reduce((total, account) => total + (priceByPlan.get(account.plan) ?? 0), 0),
      requests: data.requests.filter((request) => request.status === "new").length,
      visits: data.visits.length,
      downloads: data.events.filter((event) => event.event_type === "download_click").length,
      purchaseClicks: data.events.filter((event) => event.event_type === "purchase_click").length,
      alerts: data.notifications.filter((notification) => notification.active && (!notification.expires_at || new Date(notification.expires_at).getTime() > Date.now())).length,
    }
  }, [data])

  return (
    <div className="mz-view space-y-6">
      <SectionTitle title="مركز التحكم" sub="نظرة عامة على الاشتراكات والمحتوى والزيارات وإشعارات المنصة." />
      {error && <div role="alert" className="rounded-lg border border-serious/20 bg-serious-50 px-4 py-3 text-[13px] text-serious">{error}</div>}

      {/* The reason an operator opens the console, reachable before any metric
          loads (and even when the reads below fail). */}
      <section aria-label="إجراءات سريعة" className="flex flex-wrap gap-2">
        <Link to="/admin/subscriptions" className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">
          <KeyRound className="h-4 w-4" aria-hidden="true" /> إنشاء رمز تفعيل
        </Link>
        <Link to="/admin/subscription-editor" className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-canvas">
          <CreditCard className="h-4 w-4" aria-hidden="true" /> رموز التفعيل والأسعار
        </Link>
      </section>

      {loading && <div className="grid min-h-48 place-items-center text-[13px] text-muted">جارٍ تحميل مؤشرات المنصة…</div>}
      {!loading && !data && !error && <div className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-[13px] text-muted">لا توجد بيانات لعرضها.</div>}
      {stats && data && <>
        <section aria-label="مؤشرات المنصة" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<CreditCard className="h-4 w-4" />} label="الحسابات النشطة" value={`${stats.active} / ${stats.accounts}`} detail="اشتراكات نشطة أو تجريبية" tone="brand" />
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="القيمة الشهرية الاسمية" value={`${stats.nominalMonthlyValue.toLocaleString("fr-MA")} MAD`} detail="تقدير من الخطط المسجلة؛ ليس تحصيلاً مؤكداً" tone="good" />
          <Metric icon={<FileText className="h-4 w-4" />} label="طلبات الاشتراك الجديدة" value={String(stats.requests)} detail="تنتظر المتابعة" tone="warn" />
          <Metric icon={<Activity className="h-4 w-4" />} label="زيارات آخر 30 يوماً" value={data.visits.length.toLocaleString("fr-MA")} detail="حتى آخر 5,000 حدث" tone="brand" />
          <Metric icon={<FileText className="h-4 w-4" />} label="نقرات التحميل" value={stats.downloads.toLocaleString("fr-MA")} detail="نقرات على رابط، وليست تنزيلات مؤكدة" tone="brand" />
          <Metric icon={<CreditCard className="h-4 w-4" />} label="نقرات الشراء" value={stats.purchaseClicks.toLocaleString("fr-MA")} detail="نقرات خروج فقط، وليست مدفوعات مثبتة" tone="warn" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <div><h2 className="text-[14px] font-bold text-ink">آخر إجراءات المشغلين</h2><p className="mt-0.5 text-[11px] text-muted">سجل تغييرات الاشتراكات والإعدادات والصلاحيات.</p></div>
              <Badge tone="neutral"><ShieldCheck className="h-3.5 w-3.5" /> تدقيق</Badge>
            </div>
            {data.audit.length ? <ul className="divide-y divide-line">
              {data.audit.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-ink">{auditLabel(event.action)} <span className="font-normal text-muted">— {event.target}</span></p><p className="mt-0.5 truncate text-[11px] text-muted">{event.actor_email}</p></div>
                <time className="shrink-0 text-[11px] text-faint">{formatDate(event.created_at)}</time>
              </li>)}
            </ul> : <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد إجراءات مسجلة بعد.</p>}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <div><h2 className="text-[14px] font-bold text-ink">مركز الإشعارات</h2><p className="mt-0.5 text-[11px] text-muted">حالة التنبيهات التي أنشأها مشغلو المنصة.</p></div>
              <Badge tone={stats.alerts ? "warn" : "good"}><Bell className="h-3.5 w-3.5" /> {stats.alerts} نشط</Badge>
            </div>
            {data.notifications.filter((item) => item.active).slice(0, 4).map((item) => <div key={item.id} className="border-b border-line px-4 py-3 last:border-0">
              <div className="flex items-center gap-2"><Badge tone={item.severity === "critical" ? "serious" : item.severity === "warning" ? "warn" : "neutral"}>{severityLabel(item.severity)}</Badge><p className="truncate text-[12px] font-semibold text-ink">{item.title}</p></div>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted">{item.message}</p>
            </div>)}
            {!data.notifications.some((item) => item.active) && <p className="px-4 py-8 text-center text-[12px] text-muted">لا توجد إشعارات نشطة.</p>}
          </Card>
        </section>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <div><h2 className="text-[14px] font-bold text-ink">الاشتراكات حسب الخطة</h2><p className="mt-0.5 text-[11px] text-muted">توزيع الخطط وحالة الحسابات حالياً.</p></div>
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.plans.map((plan) => {
              const members = data.subscriptions.filter((account) => account.plan === plan.code)
              const active = members.filter((account) => account.status === "active" || account.status === "trialing").length
              return <div key={plan.code} className="rounded-xl border border-line bg-canvas/60 p-4">
                <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-bold text-ink">{PLAN_LABELS[plan.code]}</p><Badge tone={plan.active ? "good" : "neutral"}>{plan.active ? "متاحة" : "مخفية"}</Badge></div>
                <p className="mt-3 font-display text-[22px] font-bold text-ink">{Number(plan.monthly_price).toLocaleString("fr-MA")} <span className="text-[11px] font-medium text-muted">MAD / شهر</span></p>
                <p className="mt-2 text-[11px] text-muted">{members.length} حساباً · {active} نشط أو تجريبي</p>
                <p className="mt-1 text-[10px] text-faint">{PLAN_STATUS_LABELS.active} تُدار من قسم الاشتراكات.</p>
              </div>
            })}
          </div>
        </Card>
      </>}
    </div>
  )
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "brand" | "good" | "warn" }) {
  const colors = { brand: "bg-brand-50 text-brand-700", good: "bg-good-50 text-emerald-700", warn: "bg-warn-50 text-warn" }
  return <Card className="p-4"><span className={`grid h-9 w-9 place-items-center rounded-lg ${colors[tone]}`}>{icon}</span><p className="mt-3 text-[11px] font-medium text-muted">{label}</p><p className="mt-1 font-display text-[23px] font-bold text-ink">{value}</p><p className="mt-1 text-[10px] text-faint">{detail}</p></Card>
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    "platform.settings.updated": "تعديل إعدادات المنصة",
    "subscription.account.updated": "تعديل اشتراك حساب",
    "subscription.plan.updated": "تعديل خطة",
    "subscription.request.status": "تحديث طلب اشتراك",
    "analytics.retention.purged": "حذف بيانات زيارات قديمة",
    "notification.created": "إنشاء إشعار نظام",
    "notification.resolved": "إغلاق إشعار",
    "content.admin.enabled": "منح صلاحية تحرير المحتوى",
    "content.admin.disabled": "إلغاء صلاحية تحرير المحتوى",
    "platform.admin.enabled": "منح صلاحية تشغيل المنصة",
    "platform.admin.disabled": "إلغاء صلاحية تشغيل المنصة",
  }
  if (action.startsWith("cms.")) {
    const [, table, operation] = action.split(".")
    const nouns: Record<string, string> = {
      cms_homepage_content: "محتوى الصفحة الرئيسية",
      cms_pages: "صفحة موقع",
      cms_seo_settings: "بيانات SEO",
      cms_assets: "أصل/صورة",
      cms_features: "ميزة",
      cms_releases: "إصدار",
      cms_downloads: "رابط تنزيل",
      cms_products: "منتج/رابط شراء",
      cms_support_requests: "طلب دعم",
      cms_announcements: "إعلان عام",
      posts: "مقال",
      post_translations: "ترجمة مقال",
      platform_settings: "إعدادات المنصة",
      plan_catalog: "خطة اشتراك",
      account_subscriptions: "اشتراك حساب",
      purchase_requests: "طلب اشتراك",
      system_notifications: "إشعار داخلي",
      platform_admins: "صلاحية مشغل",
    }
    const verbs: Record<string, string> = { insert: "إنشاء", update: "تعديل", delete: "حذف" }
    return `${verbs[operation] ?? "تغيير"} ${nouns[table] ?? table}`
  }
  if (action === "content.admin.role.changed") return "تغيير صلاحية محرر المحتوى"
  return labels[action] ?? action
}
function severityLabel(value: SystemNotification["severity"]): string { return value === "critical" ? "حرج" : value === "warning" ? "تنبيه" : "معلومة" }
