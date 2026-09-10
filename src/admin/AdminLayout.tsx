import { useEffect } from "react"
import { NavLink, Outlet, useNavigate } from "react-router"
import { LogOut, Newspaper, ShieldCheck } from "lucide-react"
import { supabase } from "../lib/supabase"
import { IconBtn } from "../components/kit"

/**
 * The protected layout every admin CMS view renders inside of. Mounted as
 * the child of `<ProtectedRoute/>` in AdminApp.tsx, so by the time this
 * component ever renders, the visitor has already been verified as a
 * signed-in admin — this file only owns chrome (top bar, nav, sign-out),
 * never auth logic.
 *
 * New CMS sections (e.g. a future "pages" or "media" module) become a new
 * sibling subfolder under src/admin/ plus one more <NavLink> here and one
 * more <Route> in AdminApp.tsx — this layout and ProtectedRoute don't
 * change.
 *
 * The whole subtree renders `dir="rtl" lang="ar"` — matching this app's
 * actual default language (see src/modules/auth/language/useLanguage.ts,
 * DEFAULT_LANGUAGE = "ar") — and that alone is enough to get the Arabic
 * Tajawal typeface: `[dir='rtl'] { font-family: var(--font-arabic) }` is
 * already global CSS in src/index.css, loaded from the same Google Fonts
 * `@import` the rest of the app already uses. No new font setup needed
 * anywhere in this module.
 */
export default function AdminLayout() {
  const navigate = useNavigate()

  // Keep the CMS out of search results — it's an authenticated tool, not
  // public content, regardless of what robots.txt says (crawlers that
  // ignore robots.txt still respect a rendered noindex meta tag).
  useEffect(() => {
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  async function handleLogout() {
    // Signing out here doesn't need useAdminAuth()'s verification cycle —
    // that hook is already running once, in ProtectedRoute, for this
    // entire subtree. Calling supabase.auth.signOut() fires its
    // onAuthStateChange listener, which re-verifies and redirects to
    // /admin/login on its own; the explicit navigate() below is just a
    // faster, more deliberate transition than waiting on that listener.
    await supabase.auth.signOut()
    navigate("/admin/login", { replace: true })
  }

  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen bg-canvas font-arabic">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3.5">
          <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            لوحة تحكم المحتوى
          </div>
          <nav className="flex items-center gap-1.5">
            <NavLink
              to="/admin/blogs"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-ink/[0.05] hover:text-ink"
                }`
              }
            >
              <Newspaper className="h-4 w-4" aria-hidden="true" />
              المقالات
            </NavLink>
            <IconBtn onClick={handleLogout} aria-label="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </IconBtn>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
