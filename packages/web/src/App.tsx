import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProjectsPage from '@/pages/ProjectsPage'
import NewProjectPage from '@/pages/NewProjectPage'
import BoardPage from '@/pages/BoardPage'
import IssuesPage from '@/pages/IssuesPage'
import DashboardPage from '@/pages/DashboardPage'
import GlobalDashboardPage from '@/pages/GlobalDashboardPage'
import SettingsPage from '@/pages/SettingsPage'
import CredentialsPage from '@/pages/CredentialsPage'
import SpecificationsPage from '@/pages/SpecificationsPage'
import TimelinePage from '@/pages/TimelinePage'
import StandupSettingsPage from '@/pages/StandupSettingsPage'
import AdminPage from '@/pages/AdminPage'
import TeamDashboardPage from '@/pages/TeamDashboardPage'
import ProfilePage from '@/pages/ProfilePage'
import ErrorBoundary from '@/components/ErrorBoundary'
import ToastContainer from '@/components/ToastContainer'
import ImagePreviewModal from '@/components/ui/ImagePreviewModal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<GlobalDashboardPage />} />
                <Route path="/standup" element={<StandupSettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/dashboard" element={<TeamDashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
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
        </BrowserRouter>
      </ErrorBoundary>
      <ToastContainer />
      <ImagePreviewModal />
    </QueryClientProvider>
  )
}
