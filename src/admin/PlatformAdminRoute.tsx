import { Link, Navigate, Outlet, useOutletContext } from "react-router"
import { ShieldAlert } from "lucide-react"
import type { AdminAccess } from "./lib/adminAuth"

/**
 * Gate for the platform-only subtree (subscriptions, activation keys, traffic,
 * security, notifications, backups).
 *
 * This is UX, not the security boundary: Postgres RLS and the protected RPCs
 * decide what an account may actually do (`public.is_platform_admin()`, plus
 * MFA AAL2 for issuing activation keys). Deleting this component would change
 * nothing about what a request may touch — see ProtectedRoute.tsx.
 *
 * A signed-in content editor who follows a platform link used to be bounced to
 * /admin/blogs without a word, which reads as "the feature does not exist" —
 * e.g. an owner who cannot find the activation-code generator anywhere in the
 * CMS. They now get the reason and the one action that fixes it.
 */
export default function PlatformAdminRoute() {
  const access = useOutletContext<AdminAccess>()
  if (access.isPlatformAdmin) return <Outlet context={access} />
  if (!access.isContentAdmin) return <Navigate to="/admin/login" replace />

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-warn/30 bg-warn-50/60 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-ink">هذه الصفحة لمشغّل المنصة</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            حسابك مسجَّل كمحرِّر محتوى فقط. صفحات الاشتراكات ورموز التفعيل والزيارات والأمان والنسخ تتطلب دور «مشغّل المنصة»
            (صف في <span dir="ltr" className="font-mono text-[12px]">platform_admins</span>)، وإنشاء رموز التفعيل يتطلب
            أيضاً مصادقة ثنائية مكتملة (AAL2) في الجلسة نفسها — والخادم هو الذي يتحقق من الاثنين.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            للحصول على الوصول: يطلب مشغّل منصة حالي إضافتك من «النظام والسلامة ← الأمان ← إدارة الوصول»، ثم أعد تحميل هذه الصفحة.
          </p>
          <Link
            to="/admin/blogs"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-surface hover:opacity-90"
          >
            العودة إلى صفحات المحتوى
          </Link>
        </div>
      </div>
    </div>
  )
}
