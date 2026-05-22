import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { Issue, IssueDetail, CreateIssuePayload } from '@/features/issue/api'
import type { ProjectMember } from '@/features/project/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { cn } from '@/shared/lib/utils'
import { STATUSES, STATUS_LABELS } from '@/shared/config/constants'
import UserAvatar from '@/entities/user/UserAvatar'
import StatusBadge from '@/features/issue/components/badges/StatusBadge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'

interface IssueSubtasksProps {
  projectId: string
  parentId: string
  /** Status to inherit for new children (mirrors current parent status). */
  parentStatus: string
  /** Parent issue type — drives whether children are Tasks, Sub-tasks,
   *  or Epics. Without this we used to label every children list
   *  "Sub-tasks" and always create SUB_TASK regardless of the parent's
   *  position in the hierarchy. */
  parentType: string
  children: IssueDetail['children'] | undefined
  isCreating: boolean
  onCreate: (data: CreateIssuePayload) => void
  onNavigate: (issue: Issue) => void
  /** Project members for the inline assignee picker on each row. */
  members: ProjectMember[]
}

/**
 * The 4-level hierarchy is `DOMAIN → EPIC → TASK/BUG → SUB_TASK`, so
 * the children section's wording + the inline create button has to
 * match the parent's level.
 */
function deriveChildSpec(parentType: string): { type: CreateIssuePayload['type']; label: string; singular: string } {
  switch (parentType) {
    case 'DOMAIN':
      return { type: 'EPIC', label: 'Epics', singular: 'epic' }
    case 'EPIC':
      return { type: 'TASK', label: 'Tasks', singular: 'task' }
    default:
      return { type: 'SUB_TASK', label: 'Sub-tasks', singular: 'sub-task' }
  }
}

/**
 * Sub-task list with an inline create-row. New sub-tasks inherit the
 * parent's status so they don't have to be re-statused right away.
 */
export default function IssueSubtasks({ projectId, parentId, parentStatus, parentType, children, isCreating, onCreate, onNavigate, members }: IssueSubtasksProps) {
  const [showInput, setShowInput] = useState(false)
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()
  const childSpec = deriveChildSpec(parentType)

  const assignMutation = useMutation({
    mutationFn: ({ subtaskId, assigneeId }: { subtaskId: string; assigneeId: string | null }) =>
      issueRepository.update(projectId, subtaskId, { assigneeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, parentId] })
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, `Failed to assign ${childSpec.singular}`), 'error')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ subtaskId, status }: { subtaskId: string; status: string }) =>
      issueRepository.update(projectId, subtaskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, parentId] })
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change status'), 'error')
    },
  })

  const submit = () => {
    if (!title.trim()) return
    onCreate({ title, type: childSpec.type, parentId, status: parentStatus })
    setTitle('')
    setShowInput(false)
  }

  const openChild = (id: string) => {
    issueRepository.findOne(projectId, id).then(
      (fullIssue) => onNavigate(fullIssue),
      (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to load issue'), 'error'),
    )
  }

  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 mb-1">
        {childSpec.label} {children && children.length > 0 ? `(${children.length})` : ''}
      </span>
      {children && children.length > 0 && (
        <div className="space-y-1 mb-2">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex w-full items-center gap-2 rounded bg-gray-50 dark:bg-gray-700 px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <button
                type="button"
                onClick={() => openChild(child.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="font-mono text-xs text-gray-400">#{child.number}</span>
                <span className="flex-1 truncate">{child.title}</span>
              </button>
              <SubtaskAssigneePicker
                child={child}
                members={members}
                onChange={(assigneeId) => assignMutation.mutate({ subtaskId: child.id, assigneeId })}
              />
              <SubtaskStatusPicker
                status={child.status}
                onChange={(status) => statusMutation.mutate({ subtaskId: child.id, status })}
              />
            </div>
          ))}
        </div>
      )}
      {showInput ? (
        <div className="flex gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${childSpec.singular[0].toUpperCase()}${childSpec.singular.slice(1)} title`}
            className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') { setShowInput(false); setTitle('') }
            }}
          />
          <button
            onClick={submit}
            disabled={!title.trim() || isCreating}
            className="rounded bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isCreating ? '...' : 'Add'}
          </button>
          <button
            onClick={() => { setShowInput(false); setTitle('') }}
            className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)} className="text-xs text-gray-400 hover:text-primary-600">
          + Add {childSpec.singular}
        </button>
      )}
    </div>
  )
}

const NO_ASSIGNEE = '__none__'

/**
 * Avatar that opens a Combobox to (re)assign the sub-task inline, so
 * users don't have to dive into each sub-task's detail panel just to
 * change ownership.
 */
function SubtaskAssigneePicker({
  child,
  members,
  onChange,
}: {
  child: IssueDetail['children'][number]
  members: ProjectMember[]
  onChange: (assigneeId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const currentId = child.assignee?.id ?? NO_ASSIGNEE

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          className="rounded-full ring-1 ring-transparent transition hover:ring-primary-300"
          title={child.assignee ? `Assignee: ${child.assignee.name}` : 'Unassigned — click to assign'}
        >
          <UserAvatar user={child.assignee} size="sm" />
        </button>
      </PopoverTrigger>
      {/* Explicit max-h on PopoverContent so the inner CommandList scroll
          viewport has a bounded height to anchor against, even when the
          Popover renders without an inherited container height. */}
      <PopoverContent className="w-56 max-h-80 overflow-hidden p-0" align="end">
        <Command>
          <CommandInput placeholder="Search member..." />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Unassigned"
                onSelect={() => { onChange(null); setOpen(false) }}
              >
                <Check className={cn('h-4 w-4', currentId === NO_ASSIGNEE ? 'opacity-100' : 'opacity-0')} />
                <span className="flex items-center gap-2">
                  <UserAvatar user={null} size="sm" />
                  Unassigned
                </span>
              </CommandItem>
              {members.map((m) => (
                <CommandItem
                  key={m.user.id}
                  value={m.user.name}
                  onSelect={() => { onChange(m.user.id); setOpen(false) }}
                >
                  <Check className={cn('h-4 w-4', currentId === m.user.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex items-center gap-2">
                    <UserAvatar user={m.user} size="sm" />
                    {m.user.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Status pill that opens a Combobox so admins can change a sub-task's
 * status without diving into the sub-task detail panel. Mirrors
 * SubtaskAssigneePicker so the two pickers feel identical.
 */
function SubtaskStatusPicker({
  status,
  onChange,
}: {
  status: string
  onChange: (status: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          className="rounded ring-1 ring-transparent transition hover:ring-primary-300"
          title={`Status: ${STATUS_LABELS[status] ?? status} — click to change`}
        >
          <StatusBadge status={status} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <Command>
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandGroup>
              {STATUSES.map((s) => (
                <CommandItem
                  key={s}
                  value={STATUS_LABELS[s] ?? s}
                  onSelect={() => { onChange(s); setOpen(false) }}
                >
                  <Check className={cn('h-4 w-4', status === s ? 'opacity-100' : 'opacity-0')} />
                  <StatusBadge status={s} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
