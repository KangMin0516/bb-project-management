import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { Issue, IssueDetail, CreateIssuePayload } from '@/features/issue/api'
import type { ProjectMember } from '@/features/project/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { cn } from '@/shared/lib/utils'
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
  /** Status to inherit for new sub-tasks (mirrors current parent status). */
  parentStatus: string
  children: IssueDetail['children'] | undefined
  isCreating: boolean
  onCreate: (data: CreateIssuePayload) => void
  onNavigate: (issue: Issue) => void
  /** Project members for the inline assignee picker on each row. */
  members: ProjectMember[]
}

/**
 * Sub-task list with an inline create-row. New sub-tasks inherit the
 * parent's status so they don't have to be re-statused right away.
 */
export default function IssueSubtasks({ projectId, parentId, parentStatus, children, isCreating, onCreate, onNavigate, members }: IssueSubtasksProps) {
  const [showInput, setShowInput] = useState(false)
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()

  const assignMutation = useMutation({
    mutationFn: ({ subtaskId, assigneeId }: { subtaskId: string; assigneeId: string | null }) =>
      issueRepository.update(projectId, subtaskId, { assigneeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, parentId] })
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to assign sub-task'), 'error')
    },
  })

  const submit = () => {
    if (!title.trim()) return
    onCreate({ title, type: 'SUB_TASK', parentId, status: parentStatus })
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
        Sub-tasks {children && children.length > 0 ? `(${children.length})` : ''}
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
              <StatusBadge status={child.status} />
            </div>
          ))}
        </div>
      )}
      {showInput ? (
        <div className="flex gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sub-task title"
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
          + Add sub-task
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
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search member..." />
          <CommandList>
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
