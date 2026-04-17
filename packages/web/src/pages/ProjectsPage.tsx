import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { projectApi } from '@/api/projects'
import { FolderKanban, Users, TicketCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import TemplateManager from '@/components/template/TemplateManager'

type Tab = 'projects' | 'templates'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('projects')
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
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
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.key}/board`)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-left shadow-sm transition hover:shadow-md"
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
          ))}
        </div>
      )}
    </div>
  )
}
