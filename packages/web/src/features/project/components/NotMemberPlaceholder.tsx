import { Link } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'
import type { ProjectWithJoinStatus } from '@/features/project/api'
import { useCreateJoinRequest } from '@/features/project/hooks/useCreateJoinRequest'
import JoinRequestPrompt from '@/features/project/components/JoinRequestPrompt'

interface NotMemberPlaceholderProps {
  project: ProjectWithJoinStatus
}

/**
 * Rendered by `ProjectRouteGate` when the current user opens a deep link
 * (`/projects/:projectId/board?open=...`) for a project they aren't a
 * member of. Replaces the silent "No issues found" empty state with an
 * explanation + a "Request to Join" CTA. Sending the request triggers a
 * Slack DM to project admins (handled server-side in
 * `CreateJoinRequestUseCase`).
 */
export default function NotMemberPlaceholder({ project }: NotMemberPlaceholderProps) {
  const createJoinRequest = useCreateJoinRequest()
  const hasPending = project.pendingJoinRequest?.status === 'PENDING'

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <Lock className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {project.name}
        </h2>
        <p className="mt-0.5 text-xs font-mono text-gray-500 dark:text-gray-400">{project.key}</p>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          You're not a member of this project yet. Send a join request — project admins
          will be notified on Slack and can approve you from project settings.
        </p>

        <div className="mt-5 flex items-center justify-center">
          <JoinRequestPrompt
            hasPending={hasPending}
            isSending={createJoinRequest.isPending}
            onSend={(message) =>
              createJoinRequest.mutate({ projectId: project.id, message })
            }
          />
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to home
        </Link>
      </div>
    </div>
  )
}
