import { useState } from 'react'
import type { Issue, IssueDetail, CreateIssuePayload } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import UserAvatar from '@/entities/user/UserAvatar'
import StatusBadge from '@/features/issue/components/badges/StatusBadge'

interface IssueSubtasksProps {
  projectId: string
  parentId: string
  /** Status to inherit for new sub-tasks (mirrors current parent status). */
  parentStatus: string
  children: IssueDetail['children'] | undefined
  isCreating: boolean
  onCreate: (data: CreateIssuePayload) => void
  onNavigate: (issue: Issue) => void
}

/**
 * Sub-task list with an inline create-row. New sub-tasks inherit the
 * parent's status so they don't have to be re-statused right away.
 */
export default function IssueSubtasks({ projectId, parentId, parentStatus, children, isCreating, onCreate, onNavigate }: IssueSubtasksProps) {
  const [showInput, setShowInput] = useState(false)
  const [title, setTitle] = useState('')

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
            <button
              key={child.id}
              onClick={() => openChild(child.id)}
              className="flex w-full items-center gap-2 rounded bg-gray-50 dark:bg-gray-700 px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
            >
              <span className="font-mono text-xs text-gray-400">#{child.number}</span>
              <span className="flex-1 truncate">{child.title}</span>
              {child.assignee && <UserAvatar user={child.assignee} />}
              <StatusBadge status={child.status} />
            </button>
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
