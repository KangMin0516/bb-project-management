import { useParams, Outlet, Link } from 'react-router-dom'
import { FolderX, ArrowLeft } from 'lucide-react'
import { useProjectAccess } from '@/features/project/hooks/useProjectAccess'
import NotMemberPlaceholder from '@/features/project/components/NotMemberPlaceholder'

/**
 * Layout route mounted above every `/projects/:projectId/*` page. Reads
 * the shared `projects-all` cache to decide whether the current user
 * should see the page or the "request to join" placeholder.
 *
 * - Membership / superuser → `<Outlet />`
 * - Not a member          → `<NotMemberPlaceholder />` with Slack-notified
 *                           Request-to-Join CTA
 * - Project missing        → "Project not found" card
 *
 * Mirrors the backend `ProjectMemberGuard` behaviour so deep links from
 * Slack/MCP/email don't surface as silent "No issues found" empty states.
 */
export default function ProjectRouteGate() {
  const { projectId } = useParams<{ projectId: string }>()
  const { isLoading, project, isMember } = useProjectAccess(projectId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <FolderX className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Project not found
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            This project no longer exists or has been deleted.
          </p>
          <Link
            to="/projects"
            className="mt-5 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  if (!isMember) return <NotMemberPlaceholder project={project} />

  return <Outlet />
}
