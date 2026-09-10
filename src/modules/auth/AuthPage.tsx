import { useState } from "react"
import { AuthShell } from "./components/AuthShell"
import { SignInForm } from "./SignIn"
import { SignUpForm } from "./SignUp"
import { ForgotPasswordForm } from "./ForgotPassword"
import { useTranslation } from "./language/useLanguage"

type View = "signIn" | "signUp" | "forgotPassword"

export function AuthPage({
  onSuccess,
  onViewPrivacyPolicy,
}: {
  /** Called after a successful sign-in or sign-up submission. */
  onSuccess?: () => void
  /** Optional handler for the "Privacy Policy" link on the SignUp screen. */
  onViewPrivacyPolicy?: () => void
}) {
  const [view, setView] = useState<View>("signIn")
  const { t } = useTranslation()

  const brand = {
    signIn: t.brand.signIn,
    signUp: t.brand.signUp,
    forgotPassword: t.brand.forgotPassword,
  }[view]

  return (
    <AuthShell title={brand.title} subtitle={brand.subtitle}>
      {view === "signIn" && (
        <SignInForm onForgotPassword={() => setView("forgotPassword")} onSignUp={() => setView("signUp")} onSuccess={onSuccess} />
      )}
      {view === "signUp" && (
        <SignUpForm onSignIn={() => setView("signIn")} onViewPrivacyPolicy={onViewPrivacyPolicy} onSuccess={onSuccess} />
      )}
      {view === "forgotPassword" && <ForgotPasswordForm onBack={() => setView("signIn")} />}
    </AuthShell>
  )
}
