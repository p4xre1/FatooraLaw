import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, ArrowLeft, Loader2, Mail } from "lucide-react"
import { supabase, isSupabaseConfigured } from "../../../lib/supabase"
import { Btn, Field, Input } from "../../../components/kit"
import { useTranslation } from "../language/useLanguage"
import { FormAlert } from "../components/FormAlert"
import { isValidEmail, sanitizeInput } from "../lib/validation"
import { mapAuthError } from "../lib/authErrors"

export type ForgotPasswordFormProps = {
  /** Navigate back to the SignIn screen. */
  onBack: () => void
  /**
   * Where Supabase should redirect the user after they click the emailed
   * reset link. Defaults to the current origin; point this at a dedicated
   * "update password" route if/when one exists.
   */
  redirectTo?: string
}

export function ForgotPasswordForm({ onBack, redirectTo }: ForgotPasswordFormProps) {
  const { t, dir } = useTranslation()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)

    const cleanEmail = sanitizeInput(email)
    if (!isValidEmail(cleanEmail)) {
      setError(t.errors.invalidEmail)
      return
    }
    if (!isSupabaseConfigured) {
      setError(t.errors.notConfigured)
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectTo ?? window.location.origin,
    })
    setLoading(false)

    if (authError) {
      // Note: Supabase already avoids confirming/denying account existence
      // for this endpoint, so surfacing real errors (e.g. rate limiting)
      // here does not leak whether a given email is registered.
      setError(mapAuthError(authError.message, t))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div>
        <FormAlert kind="success">
          <strong className="block font-semibold">{t.forgotPassword.successTitle}</strong>
          {t.forgotPassword.successBody}
        </FormAlert>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline"
        >
          <BackIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t.forgotPassword.backToSignIn}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <h2 className="font-display text-[22px] font-bold text-ink">{t.forgotPassword.title}</h2>
      <p className="mt-1.5 text-[13.5px] text-muted">{t.forgotPassword.subtitle}</p>

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

        <Btn type="submit" disabled={loading} className="w-full justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
          {t.forgotPassword.submit}
        </Btn>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <BackIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {t.forgotPassword.backToSignIn}
      </button>
    </form>
  )
}
