import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import type { ModuleKey } from "./store/types"
import { useMizan } from "./store/useMizan"
import { NAV } from "./components/nav"
import { useAppLanguage } from "./lib/language/store"
import Auth from "./components/Auth"
import NotFound from "./components/NotFound"
import OnboardingModal from "./components/OnboardingModal"
import { useSupabaseAuth } from "./hooks/useSupabaseAuth"
import { useOnboarding } from "./hooks/useOnboarding"
import { allowedModules } from "./lib/permissions"
import { useIdleLogout } from "./lib/useIdleLogout"
import { forgetLocalDevSession, localDevModeEnabled, localDevSessionRequested, signInLocally } from "./lib/localDevMode"
import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import LocalSaveNotice from "./components/LocalSaveNotice"
import { Btn } from "./components/kit"
import Landing, { BlogArticlePage } from "./marketing/Landing"
import { readPrerenderedBlogPost, readPrerenderedBlogPosts } from "./lib/blogPrerender"
import { readPrerenderedSiteCmsData } from "./lib/siteCmsPrerender"
import { applyNoIndexHead, privateTitleFor } from "./lib/seo"
import {
  AUTH_PATHS,
  DEFAULT_APP_PATH,
  authScreenFromPath,
  blogArticleFromPath,
  landingPageFromPath,
  localeRoute,
  moduleFromPath,
  modulePath,
  type AuthScreen,
} from "./lib/routes"
import { currentHistoryState, navigate, useRoutePath } from "./lib/router"

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

/** The URL of an auth screen maps 1:1 to the screen the <Auth/> component shows. */
const AUTH_SCREEN_TO_VIEW: Record<AuthScreen, "login" | "signup" | "forgot" | "reset"> = {
  login: "login",
  signup: "signup",
  forgot: "forgot",
  reset: "reset",
}

const VIEW_TO_AUTH_SCREEN = {
  login: "login",
  signup: "signup",
  forgot: "forgot",
  reset: "reset",
} as const satisfies Record<string, AuthScreen>

/**
 * The application shell. Every screen it can show now has its own URL:
 *
 *   - public pages: `/`, `/features`, `/assistant`, `/pricing`, … (prerendered) —
 *     each also published per language (`/ar/pricing`, `/en/pricing`); the
 *     locale lives in the URL, so `<Landing/>` and the head tags follow it
 *   - auth screens: `/login`, `/signup`, `/forgot-password`, `/reset-password`
 *   - signed-in modules: `/dashboard`, `/projects`, … `/settings`
 *   - anything else: the not-found page
 *
 * The URL is the source of truth (see src/lib/router.ts); the redirects below
 * keep it honest — a signed-out visitor who opens `/dashboard` lands on
 * `/login` (and back on `/dashboard` after signing in), and a signed-in
 * visitor who opens `/` or `/login` lands on the dashboard instead of seeing
 * a marketing page or an empty login form.
 */
export default function App() {
  const { auth, team } = useMizan()
  const path = useRoutePath()
  const { ready, recovery, clearRecovery, logout } = useSupabaseAuth()
  // The page title and <title> follow the app language. This is the side-effect
  // free hook on purpose: App also renders the marketing routes, where
  // Landing.tsx owns lang/dir on <html> from the URL, and a preference-driven
  // write here would fight it.
  const { t: copy } = useAppLanguage()
  const { needsOnboarding, submitting: onboardingSubmitting, error: onboardingError, submit: submitOnboarding } = useOnboarding(auth?.id ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [idleSignedOut, setIdleSignedOut] = useState(false)

  // Marketing pages exist once per language (`/pricing`, `/ar/pricing`,
  // `/en/pricing`), so the *screen* comes from the path with its locale prefix
  // stripped. `<Landing/>` then reads the locale back off the URL itself, and
  // a prefix in front of a private screen stays an unknown path.
  const landingPage = landingPageFromPath(localeRoute(path).path)
  const articleRoute = blogArticleFromPath(path)
  const authScreen = authScreenFromPath(path)
  const routeModule = moduleFromPath(path)
  const initialBlogPosts = useMemo(() => landingPage === "home" || landingPage === "blog"
    ? readPrerenderedBlogPosts(path, localeRoute(path).locale)
    : undefined, [path, landingPage])
  const initialArticlePost = useMemo(() => articleRoute
    ? readPrerenderedBlogPost(path, articleRoute.locale, articleRoute.slug)
    : undefined, [path, articleRoute?.locale, articleRoute?.slug])
  const initialSiteCmsData = useMemo(() => readPrerenderedSiteCmsData(path, localeRoute(path).locale), [path])
  /** A path that belongs to no screen: `/404`, a typo, an old link. */
  const unknownPath = !landingPage && !articleRoute && !authScreen && !routeModule && path !== "/"

  // Leaving a local development session must also clear its opt-in marker,
  // otherwise the next reload would sign the same tab straight back in.
  function signOut() {
    forgetLocalDevSession()
    return logout()
  }

  /**
   * The single sign-out path for every "se déconnecter" control in the shell —
   * the top bar, the sidebar's account menu and the no-access screen. Clearing
   * the dev-session marker first matters: without it the next reload would sign
   * the same tab straight back in (see lib/localDevMode).
   */
  function signOutAndGoHome() {
    void signOut()
    navigate("/")
  }

  // Development-only: restore the opt-in local session in this tab (no-op in
  // production builds and whenever Supabase is configured — see lib/localDevMode).
  // When Supabase is not configured and no user is signed in, automatically enter
  // local dev mode so the app is usable immediately without manual setup.
  useEffect(() => {
    if (localDevSessionRequested()) signInLocally()
    else if (localDevModeEnabled() && !useMizan.getState().auth) signInLocally()
  }, [])

  useIdleLogout(!!auth, IDLE_TIMEOUT_MS, () => {
    void signOut()
    setIdleSignedOut(true)
    navigate(AUTH_PATHS.login)
  })

  const allowed = useMemo(() => allowedModules(auth, team), [auth, team])

  // Redirects, never a silent swap of screen for URL: the address bar always
  // shows the page actually being rendered.
  useEffect(() => {
    if (!ready) return
    if (recovery) {
      if (path !== AUTH_PATHS.reset) navigate(AUTH_PATHS.reset, { replace: true })
      return
    }
    if (!auth) {
      // A private screen without a session: ask for one, and remember where
      // the visitor was headed so sign-in can return them there.
      if (routeModule) navigate(AUTH_PATHS.login, { replace: true, state: { from: path } })
      return
    }
    // Signed in: the home pages (`/`, `/ar`, `/en`) and the auth screens belong
    // to the dashboard now. Public marketing pages stay reachable (a signed-in
    // visitor may want /pricing).
    // If the visitor was sent here from a module URL (see the branch above, which
    // stores it as `state.from`), sign-in returns them to *that* screen.
    // An account with no module at all stays put and sees the "no access" screen.
    if (landingPage === "home" || authScreen) {
      const requested = typeof currentHistoryState()?.from === "string" ? moduleFromPath(String(currentHistoryState()?.from)) : null
      const home = requested && allowed[requested] ? requested : firstAllowedModule(auth, team)
      if (home) navigate(modulePath(home), { replace: true })
    }
  }, [ready, recovery, auth, authScreen, landingPage, routeModule, path, team, allowed])

  if (!ready) {
    return <Fallback />
  }

  if (recovery) {
    return (
      <Auth
        view="reset"
        onViewChange={() => clearRecovery()}
        onBack={() => { clearRecovery(); void signOut(); navigate("/") }}
        onRecoveryDone={clearRecovery}
      />
    )
  }

  if (!auth) {
    if (unknownPath) {
      return <NotFound onHome={() => navigate("/")} />
    }
    if (articleRoute) return <BlogArticlePage locale={articleRoute.locale} slug={articleRoute.slug} initialPost={initialArticlePost} onEnter={() => navigate(AUTH_PATHS.login)} />
    if (authScreen) {
      return (
        <>
          <NoIndexTitle title={privateTitleFor(AUTH_PATHS[authScreen])} />
          <Auth
            view={AUTH_SCREEN_TO_VIEW[authScreen]}
            onViewChange={(view) => navigate(AUTH_PATHS[VIEW_TO_AUTH_SCREEN[view]])}
            idleSignedOut={idleSignedOut}
            onBack={() => { setIdleSignedOut(false); navigate("/") }}
          />
        </>
      )
    }
    // Public page: `<Landing/>` reads the page from the same URL, so links,
    // reloads and shares all work.
    return <Landing onEnter={() => navigate(AUTH_PATHS.login)} initialBlogPosts={initialBlogPosts} initialSiteCmsData={initialSiteCmsData} />
  }

  // A signed-in visitor on a public marketing page: show it (the redirect
  // effect above only takes over `/` and the auth screens).
  if (landingPage && landingPage !== "home") {
    return <Landing onEnter={() => navigate(DEFAULT_APP_PATH)} initialBlogPosts={initialBlogPosts} initialSiteCmsData={initialSiteCmsData} />
  }
  if (articleRoute) {
    return <BlogArticlePage locale={articleRoute.locale} slug={articleRoute.slug} initialPost={initialArticlePost} onEnter={() => navigate(DEFAULT_APP_PATH)} />
  }

  if (unknownPath) {
    return <NotFound onHome={() => navigate(DEFAULT_APP_PATH)} />
  }

  const current = routeModule && allowed[routeModule] ? routeModule : firstAllowedModule(auth, team)
  if (!current) {
    return <NoAccess onSignOut={signOutAndGoHome} />
  }
  const title = copy.shared.modules[current]

  function go(m: ModuleKey) {
    navigate(modulePath(m))
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
        onLogout={signOutAndGoHome}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setMobileOpen(true)} onNavigate={go} onLogout={signOutAndGoHome} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <NoIndexTitle title={`${title} | Fatorati`} />
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

/** The first module the account is allowed to open (dashboard for a full account). */
function firstAllowedModule(auth: Parameters<typeof allowedModules>[0], team: Parameters<typeof allowedModules>[1]): ModuleKey | null {
  const allowed = allowedModules(auth, team)
  return NAV.find((entry) => allowed[entry.key])?.key ?? null
}

/** Private screens must never be indexed, whichever document the host served. */
function NoIndexTitle({ title }: { title: string }) {
  useEffect(() => {
    applyNoIndexHead(title)
  }, [title])
  return null
}

function NoAccess({ onSignOut }: { onSignOut: () => void }) {
  useEffect(() => {
    applyNoIndexHead("Aucun accès | Fatorati")
  }, [])
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warn" />
        <h1 className="text-xl font-bold">Aucun accès disponible</h1>
        <p className="text-sm text-muted">Ce compte est désactivé ou aucun module ne lui est attribué. Contactez le propriétaire de votre espace.</p>
        <Btn onClick={onSignOut}>Se déconnecter</Btn>
      </div>
    </div>
  )
}
