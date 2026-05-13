import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { projectApi } from '@/features/project/api'
import { FolderKanban, Users, TicketCheck, Clock, Send, UserPlus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import TemplateManager from '@/features/template/components/TemplateManager'

type Tab = 'projects' | 'templates'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('projects')
  const [requestMessage, setRequestMessage] = useState('')
  const [requestingProjectId, setRequestingProjectId] = useState<string | null>(null)

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects-all'],
    queryFn: projectApi.listAll,
  })

  const createJoinRequest = useMutation({
    mutationFn: ({ projectId, message }: { projectId: string; message?: string }) =>
      projectApi.createJoinRequest(projectId, message ? { message } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-all'] })
      setRequestingProjectId(null)
      setRequestMessage('')
      useToastStore.getState().addToast('Join request sent', 'success')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to send join request'))
    },
  })

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">Loading...</div>
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-600">Failed to load projects. Please try again later.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            {(['projects', 'templates'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  tab === t
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                )}
              >
                {t === 'projects' ? 'Projects' : 'Templates'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'projects' && (
          <Link
            to="/projects/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            New Project
          </Link>
        )}
      </div>

      {tab === 'templates' ? (
        <TemplateManager />
      ) : !projects?.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderKanban className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500 dark:text-gray-400">No projects yet. Create your first project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition hover:shadow-md"
            >
              <button
                onClick={() => project.isMember ? navigate(`/projects/${project.key}/board`) : undefined}
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

              {/* Join Request UI for non-members */}
              {!project.isMember && (
                <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                  {project.pendingJoinRequest ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      Pending request
                    </div>
                  ) : requestingProjectId === project.id ? (
                    <div className="space-y-2">
                      <input
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="Message (optional)"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            createJoinRequest.mutate({ projectId: project.id, message: requestMessage || undefined })
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => createJoinRequest.mutate({ projectId: project.id, message: requestMessage || undefined })}
                          disabled={createJoinRequest.isPending}
                          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          Send
                        </button>
                        <button
                          onClick={() => { setRequestingProjectId(null); setRequestMessage('') }}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRequestingProjectId(project.id); setRequestMessage('') }}
                      className="flex items-center gap-1.5 rounded-lg border border-primary-300 dark:border-primary-700 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Request to Join
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
