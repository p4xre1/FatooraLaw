import { Navigate, Outlet, useOutletContext } from "react-router"
import type { AdminAccess } from "./lib/adminAuth"

export default function PlatformAdminRoute() {
  const access = useOutletContext<AdminAccess>()
  return access.isPlatformAdmin
    ? <Outlet context={access} />
    : <Navigate to={access.isContentAdmin ? "/admin/blogs" : "/admin/login"} replace />
}
