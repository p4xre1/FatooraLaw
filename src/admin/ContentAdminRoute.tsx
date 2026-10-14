import { Navigate, Outlet, useOutletContext } from "react-router"
import type { AdminAccess } from "./lib/adminAuth"

export default function ContentAdminRoute() {
  const access = useOutletContext<AdminAccess>()
  return access.isContentAdmin || access.isPlatformAdmin
    ? <Outlet context={access} />
    : <Navigate to="/admin/login" replace />
}
