import { Navigate, Route, Routes } from "react-router"
import ProtectedRoute from "./ProtectedRoute"
import AdminLayout from "./AdminLayout"
import LoginView from "./LoginView"
import { BlogEditorView, BlogListView } from "./blogs"

/**
 * Router subtree for everything under `/admin`. Mounted once from
 * main.tsx, alongside the existing (untouched) marketing/dashboard app —
 * see the comment in main.tsx for why the two live side by side instead
 * of one router owning the whole site.
 *
 * This is "all administrative views organized as subfolders under a
 * protected layout" in route-tree form: every path below the
 * `<ProtectedRoute/>` element requires a verified admin session, and each
 * CMS feature is its own subfolder under src/admin/ (currently just
 * `blogs/`) with its own `client.ts` data layer and view components.
 * Adding a second module (e.g. `pages/` or `media/`) later means a new
 * subfolder plus one more nested <Route> here — ProtectedRoute and
 * AdminLayout don't change.
 */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginView />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="blogs" replace />} />
          <Route path="blogs" element={<BlogListView />} />
          <Route path="blogs/new" element={<BlogEditorView />} />
          <Route path="blogs/:id" element={<BlogEditorView />} />
        </Route>
      </Route>

      {/* Unknown /admin/* path: don't leak whether it "exists" — send
          straight to the login gate like everything else unauthenticated. */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  )
}
