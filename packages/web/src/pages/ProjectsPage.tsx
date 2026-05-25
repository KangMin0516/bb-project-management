import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Archive, FolderKanban } from 'lucide-react'
import { projectRepository } from '@/features/project/repository'
import { useCreateJoinRequest } from '@/features/project/hooks/useCreateJoinRequest'
import { useAuthStore } from '@/features/auth/store'
import ArchivedProjectCard from '@/features/project/components/ArchivedProjectCard'
import ProjectCard from '@/features/project/components/ProjectCard'
import TemplateManager from '@/features/template/components/TemplateManager'
import TabSwitcher from '@/shared/ui/atoms/TabSwitcher'

type Tab = 'projects' | 'templates' | 'archived'

/**
 * Landing page: project cards + a templates tab. The page is just the
 * tab switcher + grid layout — card UI and join-request state live in
 * their own components. Superusers see an extra "Archived" tab that
 * surfaces soft-archived projects with an Unarchive action.
 */
export default function ProjectsPage() {
  const [tab, setTab] = useState<Tab>('projects')
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const isSuperuser = useAuthStore((s) => !!s.user?.isSuperuser)

  const tabs = useMemo(() => {
    const base: Array<{ value: Tab; label: string }> = [
      { value: 'projects', label: 'Projects' },
      { value: 'templates', label: 'Templates' },
    ]
    if (isSuperuser) base.push({ value: 'archived', label: 'Archived' })
    return base
  }, [isSuperuser])

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects-all'],
    queryFn: projectRepository.findAllWithMembership,
  })

  const archived = useQuery({
    queryKey: ['projects-archived'],
    queryFn: projectRepository.listArchived,
    enabled: isSuperuser && tab === 'archived',
  })

  const join = useCreateJoinRequest(() => setActiveRequestId(null))

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
        <TabSwitcher options={tabs} value={tab} onChange={setTab} />
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
      ) : tab === 'archived' ? (
        archived.isLoading ? (
          <div className="text-gray-400 dark:text-gray-500">Loading…</div>
        ) : !archived.data?.length ? (
          <ArchivedEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archived.data.map((p) => (
              <ArchivedProjectCard key={p.id} project={p} />
            ))}
          </div>
        )
      ) : !projects?.length ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSendingJoin={join.isPending && activeRequestId === project.id}
              onRequestJoin={(message) => {
                setActiveRequestId(project.id)
                join.mutate({ projectId: project.id, message })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
      <FolderKanban className="mx-auto mb-3 h-12 w-12 text-gray-300" />
      <p className="text-gray-500 dark:text-gray-400">No projects yet. Create your first project.</p>
    </div>
  )
}

function ArchivedEmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
      <Archive className="mx-auto mb-3 h-12 w-12 text-gray-300" />
      <p className="text-gray-500 dark:text-gray-400">No archived projects.</p>
    </div>
  )
}
