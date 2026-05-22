import { useState, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, MoveRight, Loader2, Trash2, Unlink } from 'lucide-react'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { STATUS_BADGE_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import type { TableOfContent, TableOfContentEpic } from '@/features/issue/api'

/**
 * Table of Content — project outline as a 2-level tree:
 *
 *   Module (DOMAIN)
 *     └── Epic    (with task / done counts)
 *
 * The page is the canonical "what does this project cover" view.
 * Orphan Epics (no Module) land in their own section so PMs can
 * triage and re-parent them inline.
 *
 * Plan: docs/plans/table-of-content-domain-level.md
 */
export default function TableOfContentPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaults, setCreateDefaults] = useState<{ type: 'DOMAIN' | 'EPIC'; parentId?: string } | null>(null)
  const [busyEpicId, setBusyEpicId] = useState<string | null>(null)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId!),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery<TableOfContent>({
    queryKey: ['toc', projectId],
    queryFn: () => issueRepository.findTableOfContent(projectId!),
    enabled: !!projectId,
  })

  const domains = useMemo(() => data?.domains ?? [], [data])
  const orphanEpics = useMemo(() => data?.orphanEpics ?? [], [data])
  const domainOptions = useMemo(
    () => domains.map((d) => ({ id: d.id, title: d.title })),
    [domains],
  )

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['toc', projectId] })
  }, [queryClient, projectId])

  const handleMoveToModule = useCallback(
    async (epicId: string, domainId: string | null) => {
      if (!projectId) return
      setBusyEpicId(epicId)
      try {
        await issueRepository.bulkSetParent(projectId, [epicId], domainId)
        useToastStore.getState().addToast(
          domainId ? 'Epic moved to module' : 'Epic removed from module',
          'success',
        )
        reload()
      } catch (err) {
        useToastStore.getState().addToast(getErrorMessage(err, 'Failed to move epic'), 'error')
      } finally {
        setBusyEpicId(null)
      }
    },
    [projectId, reload],
  )

  const handleRemoveEpicFromModule = useCallback(
    async (epic: TableOfContentEpic) => {
      const ok = await confirmDialog({
        title: 'Remove epic from module?',
        description: `"${epic.title}" will appear under Unassigned Epics. The epic itself is kept — you can re-assign it later from there.`,
        confirmLabel: 'Remove',
      })
      if (!ok) return
      void handleMoveToModule(epic.id, null)
    },
    [handleMoveToModule],
  )

  const handleDeleteModule = useCallback(
    async (domain: { id: string; title: string; epics: TableOfContentEpic[] }) => {
      if (!projectId) return
      const n = domain.epics.length
      const ok = await confirmDialog({
        title: `Delete module "${domain.title}"?`,
        description:
          n > 0
            ? `This module contains ${n} epic${n === 1 ? '' : 's'}. They will be kept and moved to Unassigned Epics so you can re-assign them later — but the module itself is deleted permanently.`
            : 'The module will be deleted permanently. No epics will be affected.',
        confirmLabel: 'Delete module',
        destructive: true,
      })
      if (!ok) return
      try {
        await issueRepository.remove(projectId, domain.id)
        useToastStore
          .getState()
          .addToast(
            n > 0
              ? `Module deleted · ${n} epic${n === 1 ? '' : 's'} moved to Unassigned`
              : 'Module deleted',
            'success',
          )
        reload()
      } catch (err) {
        useToastStore
          .getState()
          .addToast(getErrorMessage(err, 'Failed to delete module'), 'error')
      }
    },
    [projectId, reload],
  )

  const openCreate = (next: { type: 'DOMAIN' | 'EPIC'; parentId?: string }) => {
    setCreateDefaults(next)
    setCreateOpen(true)
  }

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Table of Content
          </h1>
          {project ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {project.name} · scope outline
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => openCreate({ type: 'DOMAIN' })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Module
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : domains.length === 0 && orphanEpics.length === 0 ? (
          <EmptyState onCreateModule={() => openCreate({ type: 'DOMAIN' })} />
        ) : (
          <div className="space-y-6">
            {domains.map((d) => (
              <ModuleCard
                key={d.id}
                projectId={projectId}
                domain={d}
                onAddEpic={() => openCreate({ type: 'EPIC', parentId: d.id })}
                onDeleteModule={() => handleDeleteModule(d)}
                onRemoveEpic={handleRemoveEpicFromModule}
              />
            ))}

            {orphanEpics.length > 0 && (
              <OrphanSection
                projectId={projectId}
                epics={orphanEpics}
                domainOptions={domainOptions}
                busyEpicId={busyEpicId}
                onMove={handleMoveToModule}
              />
            )}
          </div>
        )}
      </div>

      {createOpen && createDefaults ? (
        <CreateIssueModal
          projectId={projectId}
          defaultType={createDefaults.type}
          defaultParentId={createDefaults.parentId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

interface ModuleCardProps {
  projectId: string
  domain: { id: string; title: string; epics: TableOfContentEpic[] }
  onAddEpic: () => void
  onDeleteModule: () => void
  onRemoveEpic: (epic: TableOfContentEpic) => void
}

function ModuleCard({ projectId, domain, onAddEpic, onDeleteModule, onRemoveEpic }: ModuleCardProps) {
  const totals = domain.epics.reduce(
    (acc, e) => ({ tasks: acc.tasks + e.taskCount, done: acc.done + e.doneCount }),
    { tasks: 0, done: 0 },
  )
  const pct = totals.tasks > 0 ? Math.round((totals.done / totals.tasks) * 100) : 0

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {domain.title}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            · {domain.epics.length} epic{domain.epics.length === 1 ? '' : 's'} · {totals.done}/{totals.tasks} done ({pct}%)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddEpic}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Plus className="h-3 w-3" />
            Add Epic
          </button>
          <button
            type="button"
            onClick={onDeleteModule}
            title="Delete module"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {domain.epics.length === 0 ? (
        <p className="px-4 py-4 text-xs italic text-gray-400">No epics yet.</p>
      ) : (
        <ul>
          {domain.epics.map((e) => (
            <EpicRow
              key={e.id}
              projectId={projectId}
              epic={e}
              onRemove={() => onRemoveEpic(e)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function EpicRow({
  projectId,
  epic,
  onRemove,
}: {
  projectId: string
  epic: TableOfContentEpic
  onRemove: () => void
}) {
  const pct = epic.taskCount > 0 ? (epic.doneCount / epic.taskCount) * 100 : 0
  return (
    <li className="group flex items-center gap-3 border-t border-gray-100 px-4 py-2 first:border-t-0 dark:border-gray-700">
      <span className="w-5 text-center text-base">{TYPE_ICONS.EPIC}</span>
      <Link
        to={`/projects/${projectId}/lists?focus=${epic.id}`}
        className="flex-1 truncate text-sm text-gray-900 hover:text-primary-600 hover:underline dark:text-gray-100"
        title={epic.title}
      >
        {epic.title}
      </Link>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium',
          STATUS_BADGE_COLORS[epic.status] ?? 'bg-gray-100 text-gray-600',
        )}
      >
        {epic.status.replace('_', ' ')}
      </span>
      <span className="w-20 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {epic.doneCount}/{epic.taskCount}
      </span>
      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:block">
        <span
          className="block h-full rounded-full bg-green-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <button
        type="button"
        onClick={onRemove}
        title="Remove from module"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-600 dark:text-gray-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
      >
        <Unlink className="h-3 w-3" />
      </button>
    </li>
  )
}

interface OrphanSectionProps {
  projectId: string
  epics: TableOfContentEpic[]
  domainOptions: Array<{ id: string; title: string }>
  busyEpicId: string | null
  onMove: (epicId: string, domainId: string | null) => void
}

function OrphanSection({ projectId, epics, domainOptions, busyEpicId, onMove }: OrphanSectionProps) {
  return (
    <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 shadow-sm dark:border-amber-700 dark:bg-amber-900/10">
      <header className="border-b border-amber-200 px-4 py-3 dark:border-amber-800">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Unassigned Epics ({epics.length})
        </h2>
        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
          Epics not yet attached to a Module — assign them so this project's scope is fully accounted for.
        </p>
      </header>
      <ul>
        {epics.map((e) => {
          const busy = busyEpicId === e.id
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 border-t border-amber-200/60 px-4 py-2 first:border-t-0 dark:border-amber-800/60"
            >
              <span className="w-5 text-center text-base">{TYPE_ICONS.EPIC}</span>
              <Link
                to={`/projects/${projectId}/lists?focus=${e.id}`}
                className="flex-1 truncate text-sm text-gray-900 hover:text-primary-600 hover:underline dark:text-gray-100"
                title={e.title}
              >
                {e.title}
              </Link>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  STATUS_BADGE_COLORS[e.status] ?? 'bg-gray-100 text-gray-600',
                )}
              >
                {e.status.replace('_', ' ')}
              </span>
              <div className="flex w-44 items-center gap-1">
                <MoveRight className="h-3 w-3 text-amber-600" />
                <Select
                  value=""
                  onValueChange={(v) => onMove(e.id, v)}
                  disabled={busy || domainOptions.length === 0}
                >
                  <SelectTrigger className="h-7 w-full text-xs">
                    <SelectValue placeholder={busy ? 'Moving…' : 'Move to module…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {domainOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function EmptyState({ onCreateModule }: { onCreateModule: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-gray-700">
      <FolderOpen className="h-8 w-8 text-indigo-400" />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        No modules yet
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Modules (DOMAIN) group related Epics so you can read this project like a table of contents.
        Start by adding one module per feature area (Authentication, User Management, …).
      </p>
      <button
        type="button"
        onClick={onCreateModule}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        Add your first Module
      </button>
    </div>
  )
}
