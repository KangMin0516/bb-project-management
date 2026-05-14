import { useNavigate } from 'react-router-dom'
import { Users, TicketCheck } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ProjectWithJoinStatus } from '@/features/project/api'
import JoinRequestPrompt from './JoinRequestPrompt'

interface ProjectCardProps {
  project: ProjectWithJoinStatus
  isSendingJoin: boolean
  onRequestJoin: (message?: string) => void
}

/**
 * Card on the projects landing page. Members click through to the board;
 * non-members get the join-request prompt at the bottom of the card.
 */
export default function ProjectCard({ project, isSendingJoin, onRequestJoin }: ProjectCardProps) {
  const navigate = useNavigate()
  const goToBoard = () => {
    if (project.isMember) navigate(`/projects/${project.key}/board`)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition hover:shadow-md">
      <button
        onClick={goToBoard}
        className={cn('w-full text-left', project.isMember ? 'cursor-pointer' : 'cursor-default')}
      >
        <div className="mb-1 font-mono text-xs text-gray-400 dark:text-gray-500">{project.key}</div>
        <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{project.name}</div>
        {project.description && (
          <p className="mb-3 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
        )}
        <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <TicketCheck className="h-3.5 w-3.5" /> {project._count.issues} issues
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {project._count.members} members
          </span>
        </div>
      </button>

      {!project.isMember && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <JoinRequestPrompt
            hasPending={!!project.pendingJoinRequest}
            isSending={isSendingJoin}
            onSend={onRequestJoin}
          />
        </div>
      )}
    </div>
  )
}
