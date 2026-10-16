import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router"
import {
  Activity, BarChart3, Bell, BookOpenText, CreditCard, DatabaseBackup, FileText, Globe2, Headset, KeyRound,
  LayoutDashboard, Lock, LogOut, Mail, Menu, MessageSquareWarning, Moon, ShieldCheck, SlidersHorizontal, Sun, X,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { IconBtn } from "../components/kit"
import { applyThemeClass, useResolvedTheme, useThemeStore } from "../lib/theme"
import type { AdminAccess } from "./lib/adminAuth"

/**
 * The CMS console shell.
 *
 * Structure (and why):
 *   - A single left sidebar holds the brand, every destination grouped by
 *     purpose, and the account actions. One place to scan, one place to
 *     return to — a console is a tool you navigate, not a page you read, so
 *     the navigation earns the permanent column and the content area gets
 *     the full width. The console is RTL Arabic, so the column is laid out
 *     with `flex-row-reverse`: first child (the sidebar) lands physically on
 *     the left while the reading direction stays right-to-left.
 *   - Groups follow the operator's mental model, not the database schema:
 *     «عام» (overview), «المحتوى» (what visitors read), «المبيعات والنمو»
 *     (what pays for the product), «البريد والدعم» (what visitors send), and
 *     «النظام والسلامة» (what keeps it running). A group only renders when
 *     the signed-in role can open at least one of its links.
 *   - Under 1024px the sidebar becomes an off-canvas drawer that slides in
 *     from the left over a backdrop; a slim top bar carries the hamburger.
 *     The aside is one DOM instance in both modes (CSS moves it), so focus
 *     order and the accessibility tree never duplicate.
 *   - Theme: the console shares the device preference with the dashboard
 *     (the same `fatorati.theme.v1` store) and applies it itself — `<App/>`,
 *     which owns the private-screen repaint, is not mounted on /admin paths.
 *     Dark re-bases the semantic tokens onto the #0D1117 canvas; on the way
 *     out the cleanup hands the decision back.
 */

type AdminLink = { to: string; label: string; icon: typeof LayoutDashboard; kind: "platform" | "content" }

const SECTIONS: { label: string; links: AdminLink[] }[] = [
  {
    label: "عام",
    links: [{ to: "/admin/dashboard", label: "نظرة عامة", icon: LayoutDashboard, kind: "platform" }],
  },
  {
    label: "المحتوى",
    links: [
      { to: "/admin/website", label: "محتوى الموقع", icon: Globe2, kind: "content" },
      { to: "/admin/site/pages", label: "الصفحات", icon: FileText, kind: "content" },
      { to: "/admin/blogs", label: "المدونة", icon: BookOpenText, kind: "content" },
      { to: "/admin/content-improvement", label: "تحسين المحتوى", icon: MessageSquareWarning, kind: "content" },
    ],
  },
  {
    label: "المبيعات والنمو",
    links: [
      { to: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard, kind: "platform" },
      { to: "/admin/subscription-editor", label: "رموز التفعيل", icon: KeyRound, kind: "platform" },
      { to: "/admin/traffic", label: "الزيارات", icon: Activity, kind: "platform" },
    ],
  },
  {
    label: "البريد والدعم",
    links: [
      { to: "/admin/contact-inbox", label: "البريد الوارد", icon: Mail, kind: "content" },
      { to: "/admin/support", label: "طلبات الدعم", icon: Headset, kind: "platform" },
    ],
  },
  {
    label: "النظام والسلامة",
    links: [
      { to: "/admin/monitor", label: "المراقبة", icon: BarChart3, kind: "content" },
      { to: "/admin/security", label: "الأمان", icon: ShieldCheck, kind: "platform" },
      { to: "/admin/backups", label: "النسخ والمراجعات", icon: DatabaseBackup, kind: "platform" },
      { to: "/admin/notifications", label: "الإشعارات", icon: Bell, kind: "platform" },
      { to: "/admin/algorithms", label: "قواعد النظام", icon: SlidersHorizontal, kind: "platform" },
    ],
  },
]

const BRAND_TILE = "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm"
const GROUP_LABEL = "px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-faint"
const FOOT_NOTE = "block truncate text-[11px] text-muted"

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const access = useOutletContext<AdminAccess>()
  const resolved = useResolvedTheme()
  const setMode = useThemeStore((state) => state.setMode)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])

  useEffect(() => {
    applyThemeClass(resolved === "dark")
    return () => applyThemeClass(false)
  }, [resolved])

  // Any navigation closes the drawer; Escape does the same (mobile pattern).
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen])

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" })
    navigate("/admin/login", { replace: true })
  }

  const canEditContent = access.isContentAdmin || access.isPlatformAdmin
  // Platform destinations stay in the sidebar even for a content-only editor.
  //
  // They used to be filtered out, which produced the exact complaint this
  // comment exists to prevent: an owner looking for the activation-code
  // generator found no «رموز التفعيل» entry anywhere and concluded the CMS had
  // no such page. A hidden link and a missing page are indistinguishable from
  // the outside. The destination already explains the requirement and names
  // the row to add (`PlatformAdminRoute`), so the honest fix is to keep the
  // link, mark it locked, and let the page do the explaining.
  const visibleSections = SECTIONS
    .map((section) => ({
      ...section,
      links: section.links
        .filter((link) => (link.kind === "content" ? canEditContent : true))
        .map((link) => ({ ...link, locked: link.kind === "platform" && !access.isPlatformAdmin })),
    }))
    .filter((section) => section.links.length > 0)
  const showsLockedLinks = visibleSections.some((section) => section.links.some((link) => link.locked))

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-canvas font-arabic text-ink">
      <div className="flex min-h-screen flex-row-reverse">
        <aside
          aria-label="أقسام لوحة التحكم"
          className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[264px] shrink-0 flex-col border-s border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 ${drawerOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <span className={BRAND_TILE}><Globe2 className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-extrabold">Fatorati CMS</span>
              <span className={FOOT_NOTE}>إدارة المحتوى والمنصة</span>
            </span>
            <IconBtn className="lg:hidden" onClick={() => setDrawerOpen(false)} aria-label="إغلاق القائمة" title="إغلاق القائمة"><X className="h-4 w-4" /></IconBtn>
          </div>

          {/* Grouped navigation */}
          <nav aria-label="التنقل الرئيسي" className="flex-1 overflow-y-auto px-3 pb-4">
            {showsLockedLinks && (
              <p className="mt-3 rounded-lg border border-line bg-canvas/70 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
                الصفحات المعلَّمة بـ
                <Lock className="mx-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
                تتطلب دور «مشغّل المنصة» (صف في{" "}
                <span dir="ltr" className="font-mono text-[10px]">platform_admins</span>
                ) — بما فيها <span className="font-semibold text-ink">رموز التفعيل</span>. افتح الصفحة لترى الخطوات.
              </p>
            )}
            {visibleSections.map((section) => (
              <div key={section.label}>
                <p className={GROUP_LABEL}>{section.label}</p>
                <div className="flex flex-col gap-0.5">
                  {section.links.map((link) => (
                    <NavLink key={link.to} to={link.to} end={link.to === "/admin/dashboard"} className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${isActive ? "bg-brand-50 text-brand-700" : link.locked ? "text-faint hover:bg-canvas hover:text-muted" : "text-muted hover:bg-canvas hover:text-ink"}`}>
                      <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{link.label}</span>
                      {link.locked && <Lock className="h-3.5 w-3.5 shrink-0" aria-label="يتطلب دور مشغّل المنصة" />}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Account row: site, theme, sign-out */}
          <div className="flex items-center justify-between gap-1 border-t border-line px-3 py-3">
            <a href="/" className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink">
              <Globe2 className="h-4 w-4" aria-hidden="true" /> عرض الموقع
            </a>
            <div className="flex items-center gap-1">
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
        </aside>

        {/* Mobile backdrop */}
        {drawerOpen && <button type="button" aria-label="إغلاق القائمة" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden" />}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Slim mobile bar: hamburger + brand (desktop nav lives in the sidebar) */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
            <IconBtn onClick={() => setDrawerOpen(true)} aria-label="فتح القائمة" title="فتح القائمة"><Menu className="h-5 w-5" /></IconBtn>
            <span className={BRAND_TILE}><Globe2 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-extrabold">Fatorati CMS</span>
            </span>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet context={access} />
          </main>
        </div>
      </div>
    </div>
  )
}
