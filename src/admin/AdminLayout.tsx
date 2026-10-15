import { useEffect } from "react"
import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router"
import {
  Activity, BarChart3, Bell, BookOpenText, CreditCard, DatabaseBackup, FileText, Globe2, Headset, LayoutDashboard,
  KeyRound, LogOut, Mail, MessageSquareWarning, Moon, ShieldCheck, SlidersHorizontal, Sun,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { IconBtn } from "../components/kit"
import { applyThemeClass, useResolvedTheme, useThemeStore } from "../lib/theme"
import type { AdminAccess } from "./lib/adminAuth"

type AdminLink = { to: string; label: string; icon: typeof BookOpenText }

export default function AdminLayout() {
  const navigate = useNavigate()
  const access = useOutletContext<AdminAccess>()
  const resolved = useResolvedTheme()
  const setMode = useThemeStore((state) => state.setMode)

  useEffect(() => {
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])

  /**
   * The CMS shares the device theme preference with the dashboard (the same
   * `fatorati.theme.v1` store), but applies it itself: `<App/>` — which owns
   * the private-screen repaint for the modules — is not mounted on /admin
   * paths (separate route trees in main.tsx). Dark re-bases the semantic
   * tokens (canvas #0D1117); on the way out the cleanup hands the decision
   * back, and <App/>'s own effect re-applies whatever the next screen needs.
   */
  useEffect(() => {
    applyThemeClass(resolved === "dark")
    return () => applyThemeClass(false)
  }, [resolved])

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" })
    navigate("/admin/login", { replace: true })
  }

  const canEditContent = access.isContentAdmin || access.isPlatformAdmin
  const links: AdminLink[] = [
    ...(access.isPlatformAdmin ? [
      { to: "/admin/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
      { to: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard },
      { to: "/admin/subscription-editor", label: "الرموز والأسعار", icon: KeyRound },
      { to: "/admin/traffic", label: "الزيارات", icon: Activity },
    ] : []),
    ...(canEditContent ? [
      { to: "/admin/website", label: "محتوى الموقع", icon: Globe2 },
      { to: "/admin/site/pages", label: "الصفحات", icon: FileText },
      { to: "/admin/blogs", label: "المدونة", icon: BookOpenText },
      { to: "/admin/monitor", label: "المراقبة", icon: BarChart3 },
      { to: "/admin/content-improvement", label: "تحسين المحتوى", icon: MessageSquareWarning },
      { to: "/admin/contact-inbox", label: "البريد الوارد", icon: Mail },
    ] : []),
    ...(access.isPlatformAdmin ? [
      { to: "/admin/support", label: "طلبات الدعم", icon: Headset },
      { to: "/admin/backups", label: "النسخ والمراجعات", icon: DatabaseBackup },
      { to: "/admin/security", label: "الأمان", icon: ShieldCheck },
      { to: "/admin/notifications", label: "الإشعارات", icon: Bell },
      { to: "/admin/algorithms", label: "قواعد النظام", icon: SlidersHorizontal },
    ] : []),
  ]

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-canvas font-arabic text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
              <Globe2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-extrabold">Fatorati CMS</span>
              <span className="block truncate text-[11px] text-muted">إدارة المحتوى والمنصة</span>
            </span>
          </div>
          <nav aria-label="أقسام لوحة التحكم" className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2 lg:flex">
            {links.map((link) => <AdminNavLink key={link.to} link={link} />)}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <a href="/" className="hidden rounded-lg px-3 py-2 text-[12px] font-semibold text-muted hover:bg-canvas hover:text-ink sm:inline-flex">عرض الموقع</a>
            <IconBtn
              onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
              aria-label={resolved === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
              title={resolved === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
            >
              {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconBtn>
            <IconBtn onClick={handleLogout} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut className="h-4 w-4" /></IconBtn>
          </div>
        </div>
        <nav aria-label="أقسام لوحة التحكم المحمولة" className="flex gap-1.5 overflow-x-auto px-4 pb-3 lg:hidden">
          {links.map((link) => <AdminNavLink key={link.to} link={link} compact />)}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <Outlet context={access} />
      </main>
    </div>
  )
}

function AdminNavLink({ link, compact = false }: { link: AdminLink; compact?: boolean }) {
  const Icon = link.icon
  return (
    <NavLink
      to={link.to}
      className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"} ${compact ? "border border-line bg-surface" : ""}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {link.label}
    </NavLink>
  )
}
