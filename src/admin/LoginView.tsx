import { useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { ShieldAlert } from "lucide-react"
import { AuthShell, SignInForm, ForgotPasswordForm } from "../modules/auth"
import { isTurnstileConfigured, useTurnstile } from "./lib/turnstile"

type View = "signIn" | "forgotPassword"

type LocationState = {
  from?: { pathname?: string }
  forbidden?: boolean
}

/**
 * The CMS admin login view (`/admin/login`).
 *
 * Deliberately reuses AuthShell / SignInForm / ForgotPasswordForm from
 * src/modules/auth rather than re-implementing email/password handling,
 * validation, and error-message mapping a second time — that logic is
 * already production-tested there (and already Arabic-first + RTL, see
 * AuthShell), so duplicating it here would just be a second place for the
 * same bugs to hide. What *is* specific to the admin surface:
 *
 *  - No sign-up prompt (`onSignUp` omitted) — admin accounts are
 *    provisioned out-of-band, see supabase/schema.sql's bootstrap comment.
 *  - A honeypot field, always on.
 *  - Optional Cloudflare Turnstile, on only when VITE_TURNSTILE_SITE_KEY
 *    is configured (src/admin/lib/turnstile.ts).
 *  - A clear, honest notice when ProtectedRoute redirects here because
 *    the signed-in account isn't an admin, instead of a silent bounce.
 */
export default function LoginView() {
  const [view, setView] = useState<View>("signIn")
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? null
  const turnstile = useTurnstile()

  const destination = state?.from?.pathname || "/admin"

  return (
    <AuthShell
      title="لوحة تحكم المحتوى"
      subtitle="مساحة مخصّصة لفريق النشر لإدارة مقالات ومحتوى الموقع بأمان."
    >
      {state?.forbidden && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-serious/20 bg-serious-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-serious">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            تم تسجيل الدخول بنجاح، لكن هذا الحساب لا يملك صلاحيات المسؤول اللازمة للوصول إلى لوحة التحكم. تواصل مع
            مسؤول النظام إذا كنت تعتقد أن هذا خطأ.
          </span>
        </div>
      )}

      {view === "signIn" && (
        <>
          <SignInForm
            onForgotPassword={() => setView("forgotPassword")}
            onSuccess={() => navigate(destination, { replace: true })}
            captchaToken={turnstile.token ?? undefined}
            honeypot
          />
          {isTurnstileConfigured && <div ref={turnstile.containerRef} className="mt-4 flex justify-center" />}
        </>
      )}

      {view === "forgotPassword" && <ForgotPasswordForm onBack={() => setView("signIn")} />}
    </AuthShell>
  )
}
