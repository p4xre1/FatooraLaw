import { Navigate, Route, Routes } from "react-router"
import ProtectedRoute from "./ProtectedRoute"
import AdminLayout from "./AdminLayout"
import PlatformAdminRoute from "./PlatformAdminRoute"
import ContentAdminRoute from "./ContentAdminRoute"
import AdminIndex from "./AdminIndex"
import LoginView from "./LoginView"
import { BlogEditorView, BlogListView } from "./blogs"
import AdminDashboardView from "./platform/DashboardView"
import SubscriptionsView from "./platform/SubscriptionsView"
import AnalyticsView from "./platform/AnalyticsView"
import SecurityView from "./security/CmsSecurityControl"
import NotificationsView from "./platform/NotificationsView"
import AlgorithmsView from "./platform/AlgorithmsView"
import PagesPanel from "./site/PagesPanel"
import MonitorPanel from "./monitor/MonitorPanel"
import ContentImprovement from "./content/ContentImprovement"
import WebsiteView from "./site/WebsiteView"
import SupportRequestsView from "./site/SupportRequestsView"
import BackupsView from "./site/BackupsView"

/**
 * Every route first verifies an authenticated CMS role, then the nested role
 * gate narrows access to content editing or platform operations. Database
 * RLS and protected RPCs remain authoritative; this route tree is UX only.
 */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginView />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route element={<PlatformAdminRoute />}>
            <Route path="dashboard" element={<AdminDashboardView />} />
            <Route path="subscriptions" element={<SubscriptionsView />} />
            <Route path="traffic" element={<AnalyticsView />} />
            <Route path="security" element={<SecurityView />} />
            <Route path="notifications" element={<NotificationsView />} />
            <Route path="algorithms" element={<AlgorithmsView />} />
            <Route path="support" element={<SupportRequestsView />} />
            <Route path="backups" element={<BackupsView />} />
          </Route>
          <Route element={<ContentAdminRoute />}>
            <Route path="website" element={<WebsiteView />} />
            <Route path="site/pages" element={<PagesPanel />} />
          <Route path="monitor" element={<MonitorPanel />} />
            <Route path="content-improvement" element={<ContentImprovement />} />
            <Route path="blogs" element={<BlogListView />} />
            <Route path="blogs/new" element={<BlogEditorView />} />
            <Route path="blogs/:id" element={<BlogEditorView />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  )
}
