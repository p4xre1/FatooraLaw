import { useMemo, useState } from "react"
import { Search, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { ModuleKey } from "../store/types"
import { NAV, Logo } from "./nav"

export default function Sidebar({
  active, onNavigate, collapsed, setCollapsed, allowed, mobileOpen, setMobileOpen,
}: {
  active: ModuleKey
  onNavigate: (m: ModuleKey) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  allowed: Record<ModuleKey, boolean>
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}) {
  const [q, setQ] = useState("")

  const items = useMemo(
    () => NAV.filter((n) => allowed[n.key] && n.label.toLowerCase().includes(q.toLowerCase())),
    [q, allowed],
  )
  const groups = useMemo(() => {
    const g: Record<string, typeof items> = {}
    for (const it of items) (g[it.group] ??= []).push(it)
    return g
  }, [items])

  const width = collapsed ? "lg:w-[68px]" : "lg:w-64"

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-navy/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`dark-scroll fixed inset-y-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-ink transition-all duration-200 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 ${width} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          {collapsed ? (
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-[16px] font-extrabold leading-none text-white">F</span>
          ) : (
            <Logo light />
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-1.5 text-sidebar-faint transition-colors hover:bg-sidebar-hover hover:text-white lg:block">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un module…"
                className="w-full rounded-lg bg-sidebar-hover py-2 pl-9 pr-3 text-[12.5px] text-white outline-none placeholder:text-sidebar-faint focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {Object.entries(groups).map(([group, list]) => (
            <div key={group} className="mt-4 first:mt-1">
              {!collapsed && (
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-faint">{group}</p>
              )}
              <div className="space-y-0.5">
                {list.map((n) => {
                  const on = active === n.key
                  return (
                    <button
                      key={n.key}
                      onClick={() => { onNavigate(n.key); setMobileOpen(false) }}
                      title={collapsed ? n.label : undefined}
                      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${on ? "bg-sidebar-active text-white shadow-sm" : "text-sidebar-ink hover:bg-sidebar-hover hover:text-white"} ${collapsed ? "justify-center" : ""}`}
                    >
                      <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={on ? 2.4 : 2} />
                      {!collapsed && <span className="truncate">{n.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="border-t border-sidebar-hover px-4 py-3 text-[10.5px] text-sidebar-faint">
            Mizan ERP · v1.0 · chiffré (loi 09-08)
          </div>
        )}
      </aside>
    </>
  )
}
