import { Suspense, lazy, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import type { ModuleKey } from "./store/types"
import { useMizan } from "./store/useMizan"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { supabase } from "./lib/supabase"
import { NAV } from "./components/nav"
import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import Auth from "./components/Auth"
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

export default function App() {
  const { auth, team, signOut } = useMizan()
  const { recovery, clearRecovery } = useSupabaseAuth()
  const [active, setActive] = useState<ModuleKey>("dashboard")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // Permissions: match signed-in user to a team member; owners see everything.
  const allowed = useMemo(() => {
    const all = NAV.reduce((a, n) => ({ ...a, [n.key]: true }), {} as Record<ModuleKey, boolean>)
    if (!auth || auth.role === "owner") return all
    const member = team.find((m) => m.email === auth.email)
    return member ? member.permissions : all
  }, [auth, team])

  async function handleLogout() {
    await supabase.auth.signOut()
    signOut()
  }

  if (!auth) {
    // A password-reset link always takes priority, regardless of where the visitor was.
    if (recovery) return <Auth initialView="reset" onBack={clearRecovery} onRecoveryDone={clearRecovery} />
    return showLogin
      ? <Auth onBack={() => setShowLogin(false)} />
      : <Landing onEnter={() => setShowLogin(true)} />
  }

  const current: ModuleKey = allowed[active] ? active : "dashboard"
  const title = NAV.find((n) => n.key === current)?.label ?? "Mizan"

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
        <Topbar title={title} onMenu={() => setMobileOpen(true)} onNavigate={go} onLogout={handleLogout} />
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
    </div>
  )
}

