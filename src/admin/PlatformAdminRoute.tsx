/**
 * Gate for the platform-only subtree (subscriptions, activation keys, traffic,
 * security, notifications, backups).
 *
 * This is UX, not the security boundary: Postgres RLS and the protected RPCs
 * decide what an account may actually do (`public.is_platform_admin()`, plus
 * MFA AAL2 for issuing activation keys). Deleting this component would change
 * nothing about what a request may touch — see ProtectedRoute.tsx.
 *
 * ## Why this screen explains itself in this much detail
 *
 * There are two different roles in this product and the database names one of
 * them badly:
 *
 *   - `profiles.is_admin = true` is the **content editor** role (the schema
 *     comment on that column says so). It opens blogs, site pages and the
 *     monitoring views. The column name is historical, and it reads as "the
 *     admin flag".
 *   - A row in `platform_admins` is the **platform operator** role. It opens
 *     subscriptions, activation codes, traffic, security, backups.
 *
 * So an owner who runs the bootstrap line from `schema.sql`
 * (`update public.profiles set is_admin = true where email = …`) becomes an
 * editor, opens this page, and is told "you are a content editor only" — which
 * is correct, and sounds like the product is denying a role they just set. That
 * exact confusion is what the role table and the copyable statement below are
 * for.
 */
import { useState } from "react"
import { Link, Navigate, Outlet, useOutletContext } from "react-router"
import { Check, Copy, DatabaseZap, KeyRound, ShieldAlert } from "lucide-react"
import { Btn } from "../components/kit"
import { copyText } from "../lib/copyText"
import type { AdminAccess } from "./lib/adminAuth"

export default function PlatformAdminRoute() {
  const access = useOutletContext<AdminAccess>()
  const [copied, setCopied] = useState(false)

  if (access.isPlatformAdmin) return <Outlet context={access} />
  if (!access.isContentAdmin) return <Navigate to="/admin/login" replace />

  // The signed-in address, so the statement below can be pasted as-is.
  const email = (access.user?.email ?? "").trim()
  const emailLiteral = email ? `'${email.replace(/'/g, "''")}'` : "'YOUR-EMAIL'"
  const statement = `insert into public.platform_admins (user_id)\nselect id from auth.users where email = ${emailLiteral}\non conflict do nothing;`

  async function copyStatement() {
    const ok = await copyText(statement)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-warn/30 bg-warn-50/60 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-ink">هذه الصفحة لمشغّل المنصة</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              حسابك مسجَّل كمحرِّر محتوى. صفحات الاشتراكات ورموز التفعيل والزيارات والأمان والنسخ تتطلب دور «مشغّل المنصة»
              (صف في <span dir="ltr" className="font-mono text-[12px]">platform_admins</span>).
            </p>
          </div>
        </div>
      </div>

      {/* The naming trap, stated plainly. Two columns, two different jobs. */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[14px] font-bold text-ink">لماذا يظهر «محرِّر محتوى» وقد ضبطت صلاحية المدير؟</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          في قاعدة البيانات عمودان مختلفان، واسم أحدهما مضلِّل:
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-[12px]">
            <thead>
              <tr className="border-b border-line text-[11px] text-faint">
                <th className="py-2 pe-3 text-start font-semibold">ما ضبطته</th>
                <th className="py-2 pe-3 text-start font-semibold">الدور الفعلي</th>
                <th className="py-2 text-start font-semibold">ما يفتحه</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-line/60">
                <td className="py-2 pe-3"><span dir="ltr" className="font-mono text-[11px] text-ink">profiles.is_admin</span></td>
                <td className="py-2 pe-3 font-semibold text-ink">محرِّر محتوى</td>
                <td className="py-2">المدونة، صفحات الموقع، مراقبة المحتوى</td>
              </tr>
              <tr>
                <td className="py-2 pe-3"><span dir="ltr" className="font-mono text-[11px] text-ink">platform_admins</span></td>
                <td className="py-2 pe-3 font-semibold text-ink">مشغّل منصة</td>
                <td className="py-2">الاشتراكات، رموز التفعيل، الزيارات، الأمان، النسخ</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          اسم <span dir="ltr" className="font-mono text-[11px]">profiles.is_admin</span> قديم: هو دور تحرير المحتوى وليس صلاحية
          تشغيل المنصة. الأمر الذي يمنح دور المشغّل موجود أدناه.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-ink">
          <DatabaseZap className="h-4 w-4 text-brand" /> كيف تحصل على دور مشغّل المنصة
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          إمّا أن يضيفك مشغّل منصة حالي من «النظام والسلامة ← الأمان ← إدارة الوصول»، أو — إن لم يكن هناك مشغّل بعد —
          شغّل هذا الأمر مرة واحدة في محرر SQL في Supabase. لا يمكن منح هذا الدور من الواجهة، بالتصميم: صلاحية تشغيل
          المنصة لا تُمنح ذاتياً.
        </p>
        <pre dir="ltr" className="mt-3 overflow-x-auto rounded-lg border border-line bg-canvas/70 p-3 font-mono text-[11.5px] leading-relaxed text-ink">{statement}</pre>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn variant="outline" size="sm" onClick={() => void copyStatement()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "تم النسخ" : "نسخ الأمر"}
          </Btn>
          {!email && <span className="text-[11px] text-warn">تعذّر قراءة بريد حسابك؛ استبدل YOUR-EMAIL ببريدك قبل التشغيل.</span>}
        </div>
      </div>

      {/* Issuing codes needs the role *and* a second factor, so name both now
          rather than letting the console say "AAL2 required" later. */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-ink">
          <KeyRound className="h-4 w-4 text-brand" /> لإنشاء رموز التفعيل: خطوتان لا خطوة واحدة
        </h2>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-[12.5px] leading-relaxed text-muted">
          <li>صف في <span dir="ltr" className="font-mono text-[11px]">platform_admins</span> — الأمر أعلاه.</li>
          <li>إكمال المصادقة الثنائية (AAL2) في الجلسة نفسها — الخادم يرفض الإصدار بدونها، ولوحة الرموز فيها زر الإعداد.</li>
        </ol>
        <Link
          to="/admin/blogs"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-surface hover:opacity-90"
        >
          العودة إلى صفحات المحتوى
        </Link>
      </div>
    </div>
  )
}
