import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

const AppLayout = lazy(() => import('@/widgets/AppLayout/AppLayout'))
const ProjectRouteGate = lazy(() => import('@/app/router/ProjectRouteGate'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const NewProjectPage = lazy(() => import('@/pages/NewProjectPage'))
const BoardPage = lazy(() => import('@/pages/BoardPage'))
const IssuesPage = lazy(() => import('@/pages/IssuesPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const GlobalDashboardPage = lazy(() => import('@/pages/GlobalDashboardPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const CredentialsPage = lazy(() => import('@/pages/CredentialsPage'))
const SpecificationsPage = lazy(() => import('@/pages/SpecificationsPage'))
const SpecRollupPage = lazy(() => import('@/pages/SpecRollupPage'))
const TableOfContentPage = lazy(() => import('@/pages/TableOfContentPage'))
const TimelinePage = lazy(() => import('@/pages/TimelinePage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const StandupSettingsPage = lazy(() => import('@/pages/StandupSettingsPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const IssueRulesPage = lazy(() => import('@/pages/IssueRulesPage'))
const TeamDashboardPage = lazy(() => import('@/pages/TeamDashboardPage'))
const TeamIssuesPage = lazy(() => import('@/pages/TeamIssuesPage'))
const MemberTasksPage = lazy(() => import('@/pages/MemberTasksPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const ApiDocsPage = lazy(() => import('@/pages/ApiDocsPage'))
const OAuthAuthorizePage = lazy(() => import('@/pages/OAuthAuthorizePage'))
const SharePasscodePage = lazy(
  () => import('@/features/share-link/pages/SharePasscodePage'),
)
const SharedTimelinePage = lazy(
  () => import('@/features/share-link/pages/SharedTimelinePage'),
)
const ShareLinksPage = lazy(() => import('@/pages/ShareLinksPage'))

function AuthGuard() {
  const { token, isLoading, loadUser } = useAuthStore()

  useEffect(() => {
    if (token) loadUser()
    else useAuthStore.setState({ isLoading: false })
  }, [token, loadUser])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
      {/* Public share-link routes — outside AuthGuard. Clients without
          a BB PM account land here. Prefix is `/s/` (not `/share/`) to
          avoid the production nginx rewrite that proxies `/share/*` to
          the OG-unfurl backend controller — that path collides with
          this feature's token. */}
      <Route path="/s/:token" element={<SharePasscodePage />} />
      <Route path="/s/:token/timeline" element={<SharedTimelinePage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GlobalDashboardPage />} />
          <Route path="/standup" element={<StandupSettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/issue-rules" element={<IssueRulesPage />} />
          <Route path="/admin/dashboard" element={<TeamDashboardPage />} />
          <Route path="/admin/issues" element={<TeamIssuesPage />} />
          <Route path="/admin/members/:userId" element={<MemberTasksPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectRouteGate />}>
            <Route index element={<DashboardPage />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="lists" element={<IssuesPage />} />
            <Route path="issues" element={<IssuesPage />} />
            <Route path="specs" element={<SpecificationsPage />} />
            <Route path="spec-rollup" element={<SpecRollupPage />} />
            <Route path="table-of-content" element={<TableOfContentPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="credentials" element={<CredentialsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="share-links" element={<ShareLinksPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
