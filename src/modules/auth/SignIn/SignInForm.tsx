import { useState } from "react"
import type { FormEvent } from "react"
import { LogIn, Loader2 } from "lucide-react"
import { supabase, isSupabaseConfigured } from "../../../lib/supabase"
import { Btn, Field, Input } from "../../../components/kit"
import { useTranslation } from "../language/useLanguage"
import { PasswordField } from "../components/PasswordField"
import { FormAlert } from "../components/FormAlert"
import { isValidEmail, sanitizeInput } from "../lib/validation"
import { mapAuthError } from "../lib/authErrors"

export type SignInFormProps = {
  /** Navigate to the ForgotPassword screen. */
  onForgotPassword: () => void
  /** Navigate to the SignUp screen. */
  onSignUp: () => void
  /**
   * Called after a successful `signInWithPassword` call. Session/user state
   * itself should be read from `supabase.auth.onAuthStateChange` elsewhere
   * in the app (e.g. an app-level auth listener) — this is just a UI hook
   * (closing a modal, redirecting, etc.).
   */
  onSuccess?: () => void
}

export function SignInForm({ onForgotPassword, onSignUp, onSuccess }: SignInFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)

    const cleanEmail = sanitizeInput(email)
    if (!isValidEmail(cleanEmail)) {
      setError(t.errors.invalidEmail)
      return
    }
    if (password.length === 0) {
      setError(t.errors.requiredField)
      return
    }
    if (!isSupabaseConfigured) {
      setError(t.errors.notConfigured)
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })
    setLoading(false)

    if (authError) {
      setError(mapAuthError(authError.message, t))
      return
    }
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <h2 className="font-display text-[22px] font-bold text-ink">{t.signIn.title}</h2>
      <p className="mt-1.5 text-[13.5px] text-muted">{t.signIn.subtitle}</p>

      <div className="mt-5 space-y-4">
        {error && <FormAlert kind="error">{error}</FormAlert>}

        <Field label={t.common.emailLabel}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder={t.common.emailPlaceholder}
            maxLength={254}
            autoFocus
            required
          />
        </Field>

        <PasswordField
          label={t.common.passwordLabel}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[12.5px] font-semibold text-brand hover:underline"
          >
            {t.signIn.forgotLink}
          </button>
        </div>

        <Btn type="submit" disabled={loading} className="w-full justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
          {t.signIn.submit}
        </Btn>
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        {t.signIn.noAccount}{" "}
        <button type="button" onClick={onSignUp} className="font-semibold text-brand hover:underline">
          {t.signIn.signUpLink}
        </button>
      </p>
    </form>
  )
}
