import { useEffect, useRef, useState } from "react"
import { Menu, Plus, ChevronDown, LogOut, ShieldCheck, FolderPlus, ReceiptText, FileSignature } from "lucide-react"
import type { ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { roleLabels } from "../lib/mizan"

export default function Topbar({
  title, onMenu, onNavigate, onLogout,
}: {
  title: string
  onMenu: () => void
  onNavigate: (m: ModuleKey) => void
  onLogout: () => void
}) {
  const auth = useMizan((s) => s.auth)
  const [qa, setQa] = useState(false)
  const [pm, setPm] = useState(false)
  const qaRef = useRef<HTMLDivElement>(null)
  const pmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (qaRef.current && !qaRef.current.contains(e.target as Node)) setQa(false)
      if (pmRef.current && !pmRef.current.contains(e.target as Node)) setPm(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const quick = [
    { icon: FolderPlus, label: "Nouveau projet", to: "projects" as ModuleKey },
    { icon: ReceiptText, label: "Nouvelle dépense", to: "procurement" as ModuleKey },
    { icon: FileSignature, label: "Générer un contrat", to: "legal" as ModuleKey },
  ]

  const initials = auth?.name.split(" ").slice(0, 2).map((w) => w[0]).join("") ?? "U"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 no-print">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-ink/5 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-[16px] font-bold tracking-tight text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Quick actions */}
        <div className="relative" ref={qaRef}>
          <button onClick={() => setQa((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Actions rapides</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {qa && (
            <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl" style={{ animation: "mz-pop .15s ease-out" }}>
              {quick.map((a) => (
                <button key={a.label} onClick={() => { onNavigate(a.to); setQa(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium transition-colors hover:bg-ink/[0.04]">
                  <a.icon className="h-4 w-4 text-brand" /> {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={pmRef}>
          <button onClick={() => setPm((o) => !o)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pe-2 ps-1 transition-colors hover:border-muted">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{initials}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>
          {pm && (
            <div className="absolute end-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-xl" style={{ animation: "mz-pop .15s ease-out" }}>
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-[13.5px] font-semibold text-ink">{auth?.name}</p>
                <p className="truncate text-[12px] text-muted">{auth?.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  <ShieldCheck className="h-3 w-3" /> {auth ? roleLabels[auth.role] : ""}
                </span>
              </div>
              <button onClick={() => { onNavigate("settings"); setPm(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium hover:bg-ink/[0.04]">
                <ShieldCheck className="h-4 w-4 text-muted" /> Profil & entreprise
              </button>
              <button onClick={onLogout} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-start text-[13px] font-medium text-serious hover:bg-serious-50">
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
