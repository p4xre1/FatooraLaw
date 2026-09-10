import { useState } from "react"
import type { FormEvent } from "react"
import { UserPlus, Loader2 } from "lucide-react"
import { supabase, isSupabaseConfigured } from "../../../lib/supabase"
import { Btn, Checkbox, Field, Input } from "../../../components/kit"
import { useTranslation } from "../language/useLanguage"
import { PasswordField } from "../components/PasswordField"
import { FormAlert } from "../components/FormAlert"
import { checkPassword, isNonEmpty, isValidEmail, sanitizeInput, MAX_NAME_LENGTH } from "../lib/validation"
import { mapAuthError } from "../lib/authErrors"

export type SignUpFormProps = {
  /** Navigate back to the SignIn screen (e.g. an existing-account link). */
  onSignIn: () => void
  /** Optional link handler for a Privacy Policy / Terms document. */
  onViewPrivacyPolicy?: () => void
  /**
   * Called once the account has been created (whether or not email
   * confirmation is required). The form shows its own success state
   * regardless — use this for analytics or to pre-select the SignIn view.
   */
  onSuccess?: () => void
}

export function SignUpForm({ onSignIn, onViewPrivacyPolicy, onSuccess }: SignUpFormProps) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)

    const cleanName = sanitizeInput(fullName)
    const cleanEmail = sanitizeInput(email)

    if (!isNonEmpty(cleanName)) {
      setError(t.errors.requiredField)
      return
    }
    if (!isValidEmail(cleanEmail)) {
      setError(t.errors.invalidEmail)
      return
    }
    const passwordIssue = checkPassword(password)
    if (passwordIssue === "required") {
      setError(t.errors.requiredField)
      return
    }
    if (passwordIssue === "tooShort") {
      setError(t.errors.passwordTooShort)
      return
    }
    if (passwordIssue === "tooLong") {
      setError(t.errors.passwordTooLong)
      return
    }
    if (password !== confirmPassword) {
      setError(t.errors.passwordMismatch)
      return
    }
    if (!agree) {
      setError(t.errors.agreeRequired)
      return
    }
    if (!isSupabaseConfigured) {
      setError(t.errors.notConfigured)
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName },
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)

    if (authError) {
      setError(mapAuthError(authError.message, t))
      return
    }

    setDone(true)
    onSuccess?.()
    // If email confirmation is disabled on the Supabase project, a session
    // is created immediately and picked up by the app's auth listener; the
    // success screen below still gives the user clear confirmation either way.
  }

  if (done) {
    return (
      <div>
        <FormAlert kind="success">
          <strong className="block font-semibold">{t.signUp.successTitle}</strong>
          {t.signUp.successBody}
        </FormAlert>
        <Btn onClick={onSignIn} className="mt-5 w-full justify-center">
          {t.signUp.continueToSignIn}
        </Btn>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <h2 className="font-display text-[22px] font-bold text-ink">{t.signUp.title}</h2>
      <p className="mt-1.5 text-[13.5px] text-muted">{t.signUp.subtitle}</p>

      <div className="mt-5 space-y-4">
        {error && <FormAlert kind="error">{error}</FormAlert>}

        <Field label={t.common.fullNameLabel}>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder={t.common.fullNamePlaceholder}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            required
          />
        </Field>

        <Field label={t.common.emailLabel}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder={t.common.emailPlaceholder}
            maxLength={254}
            required
          />
        </Field>

        <PasswordField label={t.common.passwordLabel} value={password} onChange={setPassword} autoComplete="new-password" />

        <PasswordField
          label={t.common.confirmPasswordLabel}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        <Checkbox checked={agree} onChange={setAgree}>
          {onViewPrivacyPolicy ? (
            <button type="button" onClick={onViewPrivacyPolicy} className="font-semibold text-brand hover:underline">
              {t.signUp.agreeLabel}
            </button>
          ) : (
            t.signUp.agreeLabel
          )}
        </Checkbox>

        <Btn type="submit" disabled={loading} className="w-full justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          {t.signUp.submit}
        </Btn>
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        {t.signUp.haveAccount}{" "}
        <button type="button" onClick={onSignIn} className="font-semibold text-brand hover:underline">
          {t.signUp.signInLink}
        </button>
      </p>
    </form>
  )
}
