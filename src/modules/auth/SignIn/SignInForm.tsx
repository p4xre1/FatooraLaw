import { useRef, useState } from "react"
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
  /**
   * Navigate to the SignUp screen. Omit this entirely to hide the
   * "no account? sign up" prompt — used by the admin CMS login, which is
   * provisioned out-of-band (see supabase/schema.sql) and should never
   * advertise a public self-serve signup path.
   */
  onSignUp?: () => void
  /**
   * Called after a successful `signInWithPassword` call. Session/user state
   * itself should be read from `supabase.auth.onAuthStateChange` elsewhere
   * in the app (e.g. an app-level auth listener) — this is just a UI hook
   * (closing a modal, redirecting, etc.).
   */
  onSuccess?: () => void
  /**
   * Optional Cloudflare Turnstile response token (see
   * src/admin/lib/turnstile.ts). Forwarded to `signInWithPassword` as
   * `options.captchaToken` only when non-empty; Supabase verifies it
   * server-side. Omitted entirely for callers that don't use Turnstile
   * (e.g. the main app's sign-in), so this is fully backward compatible.
   */
  captchaToken?: string
  /**
   * Enables a hidden honeypot field. Real users never see or fill it
   * (off-screen, not tab-focusable, aria-hidden); a script that fills
   * every input on the page will. When triggered, the form reports the
   * same generic "invalid credentials" outcome as a real failed login —
   * on the same rough timing — instead of a distinct error, so a bot
   * probing the form can't use the response to tell the two apart.
   * Defaults to false so existing callers (SignUp's sibling sign-in
   * prompt, etc.) are unaffected.
   */
  honeypot?: boolean
}

export function SignInForm({ onForgotPassword, onSignUp, onSuccess, captchaToken, honeypot = false }: SignInFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [website, setWebsite] = useState("") // honeypot value — real users never see this field
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitStartedAt = useRef<number>(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    submitStartedAt.current = Date.now()

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

    // Honeypot tripped: behave exactly like a real failed login (same
    // message, and padded to a similar elapsed time) without ever
    // contacting Supabase — this costs the bot nothing to learn from and
    // doesn't burn a real auth attempt against rate limits.
    if (honeypot && website.trim().length > 0) {
      const elapsed = Date.now() - submitStartedAt.current
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 700 - elapsed) + Math.random() * 300))
      setLoading(false)
      setError(mapAuthError("invalid login credentials", t))
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
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

        {honeypot && (
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />
        )}

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

      {onSignUp && (
        <p className="mt-6 text-center text-[13px] text-muted">
          {t.signIn.noAccount}{" "}
          <button type="button" onClick={onSignUp} className="font-semibold text-brand hover:underline">
            {t.signIn.signUpLink}
          </button>
        </p>
      )}
    </form>
  )
}
