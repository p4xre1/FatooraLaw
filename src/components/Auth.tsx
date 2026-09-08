import { useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowRight, ArrowLeft, ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, Loader2,
} from "lucide-react"
import type { Role } from "../store/types"
import { roleLabels } from "../lib/mizan"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { Logo } from "./nav"
import { Btn, Field, Input, Select, Checkbox, Modal } from "./kit"

type View = "login" | "signup" | "forgot" | "reset"

const BRAND_PANEL: Record<View, { title: string; sub: string }> = {
  login: {
    title: "La gestion d'entreprise, en équilibre.",
    sub: "Projets, trésorerie, achats, stock et conformité juridique — une plateforme unique pour les professionnels et PME au Maroc.",
  },
  signup: {
    title: "Créez votre espace en quelques secondes.",
    sub: "Un seul compte pour piloter vos projets, votre trésorerie et votre conformité juridique.",
  },
  forgot: {
    title: "On vous aide à récupérer l'accès.",
    sub: "Indiquez votre e-mail professionnel et nous vous envoyons un lien de réinitialisation.",
  },
  reset: {
    title: "Choisissez un nouveau mot de passe.",
    sub: "Votre lien de réinitialisation a été vérifié. Définissez un nouveau mot de passe pour continuer.",
  },
}

/** Translate common Supabase auth error messages to French; fall back to the raw message. */
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect."
  if (m.includes("already registered") || m.includes("already exists")) return "Un compte existe déjà avec cet e-mail."
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 6 caractères."
  if (m.includes("email not confirmed")) return "Veuillez confirmer votre e-mail avant de vous connecter."
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Réessayez dans quelques minutes."
  if (m.includes("network")) return "Problème de connexion. Vérifiez votre réseau et réessayez."
  return message
}

function PasswordInput({
  value, onChange, autoComplete, placeholder,
}: { value: string; onChange: (v: string) => void; autoComplete?: string; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-faint transition-colors hover:text-muted"
        tabIndex={-1}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function Notice({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const styles = kind === "error"
    ? "border-serious/20 bg-serious-50 text-serious"
    : "border-good/20 bg-good-50 text-emerald-700"
  const Icon = kind === "error" ? AlertCircle : CheckCircle2
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

const PRIVACY_POLICY = `Fatorati ERP collecte les informations que vous fournissez à l'inscription (nom, e-mail) ainsi que les données de gestion que vous saisissez dans l'application (projets, contacts, dépenses, contrats). Ces données sont utilisées uniquement pour fournir et sécuriser le service, et ne sont ni vendues ni partagées avec des tiers à des fins commerciales.

Vos données sont hébergées de manière sécurisée et vous pouvez, à tout moment, demander leur export ou leur suppression en nous contactant. Nous conservons un journal d'audit des actions effectuées dans votre espace afin de garantir la traçabilité et la sécurité de votre compte.

Conformément à la Loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et d'opposition sur vos données.`

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Politique de confidentialité" onClose={onClose}>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted">{PRIVACY_POLICY}</p>
      <Btn className="mt-5 w-full" onClick={onClose}>J'ai compris</Btn>
    </Modal>
  )
}

export default function Auth({
  onBack, initialView = "login", onRecoveryDone,
}: { onBack: () => void; initialView?: View; onRecoveryDone?: () => void }) {
  const [view, setView] = useState<View>(initialView)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // Login
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Signup
  const [name, setName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<Role>("owner")
  const [agree, setAgree] = useState(false)

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("")

  // Reset
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")

  function switchView(v: View) {
    setError(null)
    setNotice(null)
    setView(v)
  }

  function requireSupabase() {
    if (isSupabaseConfigured) return true
    setError("Supabase n'est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env, puis redémarrez Vite.")
    return false
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!requireSupabase()) return
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword })
    setLoading(false)
    if (err) setError(friendlyError(err.message))
    // On success, onAuthStateChange (SIGNED_IN) hydrates the store and App.tsx moves past this screen.
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!requireSupabase()) return
    if (signupPassword.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.")
    if (signupPassword !== confirmPassword) return setError("Les mots de passe ne correspondent pas.")
    if (!agree) return setError("Veuillez accepter la politique de confidentialité pour continuer.")

    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: { name: name.trim(), role },
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)
    if (err) return setError(friendlyError(err.message))

    if (!data.session) {
      // Email confirmation is required before the account can sign in.
      setNotice("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.")
      switchViewKeepNotice("login")
      return
    }
    // If a session came back immediately (email confirmations disabled), onAuthStateChange handles the rest.
  }

  function switchViewKeepNotice(v: View) {
    setError(null)
    setView(v)
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!requireSupabase()) return
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (err) return setError(friendlyError(err.message))
    setNotice("Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé.")
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!requireSupabase()) return
    if (newPassword.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.")
    if (newPassword !== confirmNewPassword) return setError("Les mots de passe ne correspondent pas.")

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setLoading(false)
      return setError(friendlyError(err.message))
    }
    await supabase.auth.signOut()
    setLoading(false)
    onRecoveryDone?.()
    setNotice("Mot de passe mis à jour avec succès. Connectez-vous avec votre nouveau mot de passe.")
    setView("login")
  }

  const panel = BRAND_PANEL[view]

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(var(--color-brand) 1px, transparent 1px), linear-gradient(90deg, var(--color-brand) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        />
        <button onClick={onBack} className="relative text-left"><Logo light size={38} /></button>
        <div className="relative max-w-md">
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight">{panel.title}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">{panel.sub}</p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Loi 09-08 / CNDP", "Multi-rôles & audit", "Hors-ligne prêt"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-brand" /> {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-[12px] text-slate-400">© 2026 Fatorati ERP · Casablanca, Maroc</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-sm" style={{ animation: "mz-slide .3s ease-out" }}>
          {view !== "reset" && (
            <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-brand">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour au site
            </button>
          )}
          <div className="mb-8 lg:hidden"><Logo size={38} /></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
            <Lock className="h-3.5 w-3.5" /> Espace sécurisé
          </span>

          {view === "login" && (
            <>
              <h2 className="mt-3 text-[24px] font-bold tracking-tight text-ink">Connexion</h2>
              <p className="mt-1 text-[13.5px] text-muted">Accédez à votre tableau de bord.</p>
              <form className="mt-7 space-y-4" onSubmit={handleLogin}>
                {error && <Notice kind="error">{error}</Notice>}
                {notice && <Notice kind="success">{notice}</Notice>}
                <Field label="Email professionnel">
                  <Input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoComplete="email" autoFocus />
                </Field>
                <Field label="Mot de passe">
                  <PasswordInput value={loginPassword} onChange={setLoginPassword} autoComplete="current-password" />
                </Field>
                <div className="text-right">
                  <button type="button" onClick={() => switchView("forgot")} className="text-[12.5px] font-semibold text-brand hover:text-brand-700">
                    Mot de passe oublié ?
                  </button>
                </div>
                <Btn type="submit" className="w-full" disabled={loading || !loginEmail.trim() || !loginPassword}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Se connecter <ArrowRight className="h-4 w-4" /></>}
                </Btn>
              </form>
              <p className="mt-6 text-center text-[12.5px] text-muted">
                Pas encore de compte ?{" "}
                <button onClick={() => switchView("signup")} className="font-semibold text-brand hover:text-brand-700">Créer un compte</button>
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              <h2 className="mt-3 text-[24px] font-bold tracking-tight text-ink">Créer un compte</h2>
              <p className="mt-1 text-[13.5px] text-muted">Configurez votre espace en une minute.</p>
              <form className="mt-7 space-y-4" onSubmit={handleSignup}>
                {error && <Notice kind="error">{error}</Notice>}
                <Field label="Nom complet">
                  <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
                </Field>
                <Field label="Email professionnel">
                  <Input type="email" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Mot de passe" hint="6 caractères minimum.">
                  <PasswordInput value={signupPassword} onChange={setSignupPassword} autoComplete="new-password" />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                </Field>
                <Field label="Rôle" hint="Détermine les modules accessibles.">
                  <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                  </Select>
                </Field>
                <Checkbox checked={agree} onChange={setAgree} id="agree-privacy">
                  J'accepte la{" "}
                  <button type="button" onClick={() => setPrivacyOpen(true)} className="font-semibold text-brand underline underline-offset-2 hover:text-brand-700">
                    politique de confidentialité
                  </button>{" "}
                  et le traitement de mes données conformément à la Loi 09-08.
                </Checkbox>
                <Btn type="submit" className="w-full" disabled={loading || !agree || !name.trim() || !signupEmail.trim() || !signupPassword}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Créer mon compte <ArrowRight className="h-4 w-4" /></>}
                </Btn>
              </form>
              <p className="mt-6 text-center text-[12.5px] text-muted">
                Déjà un compte ?{" "}
                <button onClick={() => switchView("login")} className="font-semibold text-brand hover:text-brand-700">Se connecter</button>
              </p>
            </>
          )}

          {view === "forgot" && (
            <>
              <h2 className="mt-3 text-[24px] font-bold tracking-tight text-ink">Mot de passe oublié</h2>
              <p className="mt-1 text-[13.5px] text-muted">Recevez un lien pour réinitialiser votre mot de passe.</p>
              <form className="mt-7 space-y-4" onSubmit={handleForgot}>
                {error && <Notice kind="error">{error}</Notice>}
                {notice && <Notice kind="success">{notice}</Notice>}
                <Field label="Email professionnel">
                  <Input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoComplete="email" autoFocus />
                </Field>
                <Btn type="submit" className="w-full" disabled={loading || !forgotEmail.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Envoyer le lien <ArrowRight className="h-4 w-4" /></>}
                </Btn>
              </form>
              <p className="mt-6 text-center text-[12.5px] text-muted">
                <button onClick={() => switchView("login")} className="font-semibold text-brand hover:text-brand-700">Retour à la connexion</button>
              </p>
            </>
          )}

          {view === "reset" && (
            <>
              <span className="mt-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><KeyRound className="h-4 w-4" /></span>
              <h2 className="mt-3 text-[24px] font-bold tracking-tight text-ink">Nouveau mot de passe</h2>
              <p className="mt-1 text-[13.5px] text-muted">{panel.sub}</p>
              <form className="mt-7 space-y-4" onSubmit={handleReset}>
                {error && <Notice kind="error">{error}</Notice>}
                <Field label="Nouveau mot de passe" hint="6 caractères minimum.">
                  <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <PasswordInput value={confirmNewPassword} onChange={setConfirmNewPassword} autoComplete="new-password" />
                </Field>
                <Btn type="submit" className="w-full" disabled={loading || !newPassword || !confirmNewPassword}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mettre à jour le mot de passe <ArrowRight className="h-4 w-4" /></>}
                </Btn>
              </form>
            </>
          )}

          {view === "login" && (
            <p className="mt-6 text-center text-[11.5px] leading-relaxed text-faint">
              En continuant, vous acceptez le traitement de vos données conformément à la Loi 09-08 relative à la protection des données personnelles.
            </p>
          )}
        </div>
      </div>

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
    </div>
  )
}
