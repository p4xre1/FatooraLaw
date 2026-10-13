import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import type { ModuleKey } from "./store/types"
import { useMizan } from "./store/useMizan"
import { NAV } from "./components/nav"
import Auth from "./components/Auth"
import OnboardingModal from "./components/OnboardingModal"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { useOnboarding } from "./hooks/useOnboarding"
import { allowedModules } from "./lib/permissions"
import { useIdleLogout } from "./lib/useIdleLogout"
import { forgetLocalDevSession, localDevSessionRequested, signInLocally } from "./lib/localDevMode"
import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import LocalSaveNotice from "./components/LocalSaveNotice"
import { Btn } from "./components/kit"
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
  const { auth, team } = useMizan()
  const { ready, recovery, clearRecovery, logout } = useSupabaseAuth()
  const { needsOnboarding, submitting: onboardingSubmitting, error: onboardingError, submit: submitOnboarding } = useOnboarding(auth?.id ?? null)
  const [active, setActive] = useState<ModuleKey>("dashboard")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [idleSignedOut, setIdleSignedOut] = useState(false)

  // Leaving a local development session must also clear its opt-in marker,
  // otherwise the next reload would sign the same tab straight back in.
  function signOut() {
    forgetLocalDevSession()
    return logout()
  }

  // Development-only: restore the opt-in local session in this tab (no-op in
  // production builds and whenever Supabase is configured — see lib/localDevMode).
  useEffect(() => {
    if (localDevSessionRequested()) signInLocally()
  }, [])

  useIdleLogout(!!auth, IDLE_TIMEOUT_MS, () => {
    void signOut()
    setShowLogin(true)
    setIdleSignedOut(true)
  })

  const allowed = useMemo(() => allowedModules(auth, team), [auth, team])

  if (!ready) {
    return <Fallback />
  }

  if (recovery) {
    return <Auth onBack={() => { clearRecovery(); void signOut() }} initialView="reset" onRecoveryDone={clearRecovery} />
  }

  if (!auth) {
    return showLogin
      ? <Auth idleSignedOut={idleSignedOut} onBack={() => { setShowLogin(false); setIdleSignedOut(false) }} />
      : <Landing onEnter={() => setShowLogin(true)} />
  }

  const current = allowed[active] ? active : NAV.find((n) => allowed[n.key])?.key
  if (!current) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="max-w-md space-y-4 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warn" />
          <h1 className="text-xl font-bold">Aucun accès disponible</h1>
          <p className="text-sm text-muted">Ce compte est désactivé ou aucun module ne lui est attribué. Contactez le propriétaire de votre espace.</p>
          <Btn onClick={() => { void signOut() }}>Se déconnecter</Btn>
        </div>
      </div>
    )
  }
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
        <Topbar title={title} onMenu={() => setMobileOpen(true)} onNavigate={go} onLogout={() => { void signOut() }} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <LocalSaveNotice />
          <Suspense key={auth.id} fallback={<Fallback />}>
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
