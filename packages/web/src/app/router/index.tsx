import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

const AppLayout = lazy(() => import('@/widgets/AppLayout/AppLayout'))
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
const TimelinePage = lazy(() => import('@/pages/TimelinePage'))
const StandupSettingsPage = lazy(() => import('@/pages/StandupSettingsPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const TeamDashboardPage = lazy(() => import('@/pages/TeamDashboardPage'))
const TeamIssuesPage = lazy(() => import('@/pages/TeamIssuesPage'))
const MemberTasksPage = lazy(() => import('@/pages/MemberTasksPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const ApiDocsPage = lazy(() => import('@/pages/ApiDocsPage'))
const OAuthAuthorizePage = lazy(() => import('@/pages/OAuthAuthorizePage'))

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

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GlobalDashboardPage />} />
          <Route path="/standup" element={<StandupSettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/dashboard" element={<TeamDashboardPage />} />
          <Route path="/admin/issues" element={<TeamIssuesPage />} />
          <Route path="/admin/members/:userId" element={<MemberTasksPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId" element={<DashboardPage />} />
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
          <Route path="/projects/:projectId/lists" element={<IssuesPage />} />
          <Route path="/projects/:projectId/issues" element={<IssuesPage />} />
          <Route path="/projects/:projectId/specs" element={<SpecificationsPage />} />
          <Route path="/projects/:projectId/timeline" element={<TimelinePage />} />
          <Route path="/projects/:projectId/credentials" element={<CredentialsPage />} />
          <Route path="/projects/:projectId/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
