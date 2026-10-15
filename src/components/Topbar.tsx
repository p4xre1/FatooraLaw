import { useEffect, useRef, useState } from "react"
import { Menu, Plus, ChevronDown, LogOut, ShieldCheck, FolderPlus, ReceiptText, FileSignature, Lock } from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { LOCAL_DEV_USER } from "../lib/localDevMode"
import { planIncludes, requiredPlan } from "../lib/plans"
import { usePlanStatus } from "../store/usePlan"
import { useToday } from "../hooks/useToday"

export default function Topbar({
  title, onMenu, onNavigate, onLogout,
}: {
  title: string
  onMenu: () => void
  onNavigate: (m: ModuleKey) => void
  onLogout: () => void
}) {
  const auth = useMizan((s) => s.auth)
  const { t: copy } = useTranslation()
  const t = copy.topbar
  const { roles } = copy.shared
  const [qa, setQa] = useState(false)
  const [pm, setPm] = useState(false)
  const qaRef = useRef<HTMLDivElement>(null)
  const pmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (qaRef.current && !qaRef.current.contains(e.target as Node)) setQa(false)
      if (pmRef.current && !pmRef.current.contains(e.target as Node)) setPm(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setQa(false)
        setPm(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  // Same plan rule as the rail: a quick action whose module the plan does not
  // include stays clickable and lands on the plan page, but it carries the lock
  // mark so it never reads as available.
  const plan = usePlanStatus(useToday()).plan
  const quick = [
    { id: "project", icon: FolderPlus, label: t.newProject, to: "projects" as ModuleKey },
    { id: "expense", icon: ReceiptText, label: t.newExpense, to: "procurement" as ModuleKey },
    { id: "contract", icon: FileSignature, label: t.generateContract, to: "legal" as ModuleKey },
  ].map((action) => ({
    ...action,
    lockedBy: planIncludes(plan, action.to) ? null : requiredPlan(action.to),
  }))

  const initials = auth?.name.split(" ").slice(0, 2).map((w) => w[0]).join("") ?? "U"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 no-print">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenu} aria-label={t.openNavigation} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-ink/5 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-[16px] font-bold tracking-tight text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Quick actions */}
        <div className="relative" ref={qaRef}>
          <button type="button" onClick={() => setQa((o) => !o)} aria-label={t.quickActions} aria-haspopup="menu" aria-expanded={qa} aria-controls="topbar-quick-actions" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t.quickActions}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {qa && (
            <div id="topbar-quick-actions" role="menu" aria-label={t.quickActions} className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl" style={{ animation: "mz-pop .15s ease-out" }}>
              {quick.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { onNavigate(a.to); setQa(false) }}
                  title={a.lockedBy ? `${a.label} — ${copy.plans.unlockToUse(a.label, copy.plans.names[a.lockedBy])}` : undefined}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium transition-colors hover:bg-ink/[0.04] ${a.lockedBy ? "text-muted" : ""}`}
                >
                  <a.icon className="h-4 w-4 text-brand" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  {a.lockedBy && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={pmRef}>
          <button type="button" onClick={() => setPm((o) => !o)} aria-label={t.accountMenu} aria-haspopup="menu" aria-expanded={pm} aria-controls="topbar-account-menu" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pe-2 ps-1 transition-colors hover:border-muted">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-bold text-white" aria-hidden="true">{initials}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          </button>
          {pm && (
            <div id="topbar-account-menu" role="menu" aria-label={t.accountMenu} className="absolute end-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-xl" style={{ animation: "mz-pop .15s ease-out" }}>
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-[13.5px] font-semibold text-ink">{auth?.name}</p>
                <p className="truncate text-[12px] text-muted">{auth?.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  <ShieldCheck className="h-3 w-3" /> {auth ? roles[auth.role] : ""}
                </span>
                {/* Never let a development-only local workspace pass for a real account. */}
                {import.meta.env.DEV && auth?.id === LOCAL_DEV_USER.id && (
                  <span className="mt-1.5 ms-1.5 inline-flex items-center gap-1 rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn">
                    {t.localDev}
                  </span>
                )}
              </div>
              <button type="button" role="menuitem" onClick={() => { onNavigate("settings"); setPm(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium hover:bg-ink/[0.04]">
                <ShieldCheck className="h-4 w-4 text-muted" /> {t.profileCompany}
              </button>
              <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-start text-[13px] font-medium text-serious hover:bg-serious-50">
                <LogOut className="h-4 w-4" /> {t.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
