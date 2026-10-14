import { Navigate, useOutletContext } from "react-router"
import type { AdminAccess } from "./lib/adminAuth"

export default function AdminIndex() {
  const access = useOutletContext<AdminAccess>()
  if (access.isPlatformAdmin && access.isContentAdmin) return <Navigate to="/admin/dashboard" replace />
  if (access.isPlatformAdmin) return <Navigate to="/admin/subscriptions" replace />
  return <Navigate to="/admin/blogs" replace />
}
