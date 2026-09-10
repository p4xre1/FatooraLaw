import { Navigate, Outlet, useLocation } from "react-router"
import { Loader2 } from "lucide-react"
import { useAdminAuth } from "./lib/adminAuth"

/**
 * Layout-route guard for the entire `/admin/*` subtree (mounted in
 * AdminApp.tsx as the parent of every protected CMS route). Renders
 * `<Outlet/>` — the matched child route — only once the current browser
 * has been verified to hold a session for a user with `profiles.is_admin
 * = true`; otherwise it redirects to `/admin/login` before any admin UI,
 * data fetch, or nested route even mounts.
 *
 * -----------------------------------------------------------------------
 * READ THIS BEFORE trusting this component with anything:
 * -----------------------------------------------------------------------
 * This check runs in the browser and can be bypassed by anyone with
 * devtools — disabling JavaScript, editing React state, or simply calling
 * the Supabase REST/JS API directly without ever loading this app. It
 * exists so a browser *without* a valid admin session never renders CMS
 * UI or fires a request the server would reject anyway — that's a UX and
 * defense-in-depth property, not an access-control one.
 *
 * The actual security boundary is Postgres Row Level Security on
 * `public.posts`, enforced through `public.is_admin()` on every read and
 * write (see supabase/schema.sql). If this component were deleted
 * entirely, `posts` would still be exactly as protected as it is today —
 * a non-admin (or unauthenticated) request is rejected by the database
 * itself. Never build a feature that assumes this component is what's
 * keeping data safe; it isn't.
 */
export default function ProtectedRoute() {
  const { status } = useAdminAuth()
  const location = useLocation()

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (status === "forbidden") {
    // Authenticated, but profiles.is_admin is false (or missing) for this
    // user — a distinct case from "not logged in" so LoginView can show a
    // clear, honest message instead of just bouncing them back silently.
    return <Navigate to="/admin/login" replace state={{ from: location, forbidden: true }} />
  }

  return <Outlet />
}
