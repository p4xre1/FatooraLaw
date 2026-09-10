import { Suspense, lazy, useMemo, useState } from "react"
import { Loader2, ArrowRight, ArrowLeft, ShieldCheck, Lock, ShieldAlert } from "lucide-react"
import type { ModuleKey, Role } from "./store/types"
import { useMizan } from "./store/useMizan"
import { NAV, Logo } from "./components/nav"
import Auth from "./components/Auth"
import OnboardingModal from "./components/OnboardingModal"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { useOnboarding } from "./hooks/useOnboarding"
import { roleLabels } from "./lib/mizan"
import { useIdleLogout } from "./lib/useIdleLogout"
import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import { Btn, Field, Input, Select } from "./components/kit"
import Landing from "./marketing/Landing"

const Dashboard = lazy(() => import("./modules/Dashboard"))
const Projects = lazy(() => import("./modules/Projects"))
const Contacts = lazy(() => import("./modules/Contacts"))
const Procurement = lazy(() => import("./modules/Procurement"))
const Inventory = lazy(() => import("./modules/Inventory"))
const LegalVault = lazy(() => import("./modules/LegalVault"))
const Reports = lazy(() => import("./modules/Reports"))
const Calendar = lazy(() => import("./modules/Calendar"))
const Risk = lazy(() => import("./modules/Risk"))
const Tools = lazy(() => import("./modules/Tools"))
const Team = lazy(() => import("./modules/Team"))
const AuditLog = lazy(() => import("./modules/AuditLog"))
const Settings = lazy(() => import("./modules/Settings"))

function Fallback() {
  return (
    <div className="grid place-items-center py-32 text-muted">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
    </div>
  )
}

/** Auto sign-out after this long with no mouse/keyboard/touch activity. */
const IDLE_TIMEOUT_MS = 20 * 60 * 1000

export default function App() {
  const { auth, team, signIn, signOut } = useMizan()
  const { ready, recovery, clearRecovery, logout } = useSupabaseAuth()
  const { needsOnboarding, submitting: onboardingSubmitting, error: onboardingError, submit: submitOnboarding } = useOnboarding(!!auth)
  const [active, setActive] = useState<ModuleKey>("dashboard")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [idleSignedOut, setIdleSignedOut] = useState(false)

  useIdleLogout(!!auth, IDLE_TIMEOUT_MS, () => {
    void logout()
    setShowLogin(true)
    setIdleSignedOut(true)
  })

  // Permissions: match signed-in user to a team member; owners see everything.
  const allowed = useMemo(() => {
    const all = NAV.reduce((a, n) => ({ ...a, [n.key]: true }), {} as Record<ModuleKey, boolean>)
    if (!auth || auth.role === "owner") return all
    const member = team.find((m) => m.email === auth.email)
    return member ? member.permissions : all
  }, [auth, team])

  if (!ready) {
    return <Fallback />
  }

  if (recovery) {
    return <Auth onBack={() => { clearRecovery(); void logout() }} initialView="reset" onRecoveryDone={clearRecovery} />
  }

  if (!auth) {
    return showLogin
      ? <Auth onBack={() => { setShowLogin(false); setIdleSignedOut(false) }} />
      : <Landing onEnter={() => setShowLogin(true)} />
  }

  const current: ModuleKey = allowed[active] ? active : "dashboard"
  const title = NAV.find((n) => n.key === current)?.label ?? "Fatorati"

  function go(m: ModuleKey) {
    setActive(m)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        active={current}
        onNavigate={go}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        allowed={allowed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setMobileOpen(true)} onNavigate={go} onLogout={() => { void logout() }} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<Fallback />}>
            {current === "dashboard" && <Dashboard onNavigate={go} />}
            {current === "projects" && <Projects />}
            {current === "contacts" && <Contacts />}
            {current === "procurement" && <Procurement />}
            {current === "inventory" && <Inventory />}
            {current === "legal" && <LegalVault />}
            {current === "reports" && <Reports />}
            {current === "calendar" && <Calendar />}
            {current === "risk" && <Risk />}
            {current === "tools" && <Tools />}
            {current === "team" && <Team />}
            {current === "audit" && <AuditLog />}
            {current === "settings" && <Settings />}
          </Suspense>
        </main>
      </div>
      {needsOnboarding && (
        <OnboardingModal submitting={onboardingSubmitting} error={onboardingError} onSubmit={submitOnboarding} />
      )}
    </div>
  )
}

function Login({ onSignIn, onBack, idleSignedOut }: { onSignIn: (name: string, email: string, role?: Role) => void; onBack: () => void; idleSignedOut?: boolean }) {
  const [name, setName] = useState("Karim Benjelloun")
  const [email, setEmail] = useState("karim@atlas.ma")
  const [role, setRole] = useState<Role>("owner")

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
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight">La gestion d'entreprise, en équilibre.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Projets, trésorerie, achats, stock et conformité juridique — une plateforme unique pour les professionnels et PME au Maroc.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Loi 09-08 / CNDP", "Multi-rôles & audit", "Hors-ligne prêt"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-brand" /> {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-[12px] text-slate-400">© 2026 Fatorati · Casablanca, Maroc</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-sm" style={{ animation: "mz-slide .3s ease-out" }}>
          <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-brand">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour au site
          </button>
          <div className="mb-8 lg:hidden"><Logo size={38} /></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700"><Lock className="h-3.5 w-3.5" /> Espace sécurisé</span>
          <h2 className="mt-3 text-[24px] font-bold tracking-tight text-ink">Connexion</h2>
          <p className="mt-1 text-[13.5px] text-muted">Accédez à votre tableau de bord.</p>

          {idleSignedOut && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-50 px-3 py-2.5 text-[12.5px] text-warn">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Vous avez été déconnecté automatiquement après une période d'inactivité, pour protéger vos données.</span>
            </div>
          )}

          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (name.trim() && email.trim()) onSignIn(name, email, role) }}
          >
            <Field label="Nom complet"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label="Email professionnel"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Rôle (démonstration)" hint="Détermine les modules accessibles.">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </Select>
            </Field>
            <Btn type="submit" className="w-full" disabled={!name.trim() || !email.trim()}>
              Se connecter <ArrowRight className="h-4 w-4" />
            </Btn>
          </form>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-faint">
            En continuant, vous acceptez le traitement de vos données conformément à la Loi 09-08 relative à la protection des données personnelles.
          </p>
        </div>
      </div>
    </div>
  )
}
