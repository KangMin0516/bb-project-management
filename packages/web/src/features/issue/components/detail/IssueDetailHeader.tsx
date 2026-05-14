import { useState } from 'react'
import { Trash2, Link2, ChevronsLeft, ChevronsRight, GitBranch } from 'lucide-react'
import type { IssueDetail, Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { TYPE_ICONS } from '@/shared/config/constants'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { deriveBranchName } from '@/shared/lib/branch-name'
import { copyToClipboard } from '@/shared/lib/copyToClipboard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { copyIssueLink } from '@/features/issue/lib/copyIssueLink'
import type { ShareContext } from '@/shared/types'

interface IssueDetailHeaderProps {
  projectId: string
  projectKey: string
  issue: IssueDetail | Issue
  detail: IssueDetail | undefined
  context?: ShareContext
  expanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  onDelete: () => void
  onNavigate: (issue: Issue) => void
  onTitleChange: (title: string) => void
}

/**
 * Top bar of the issue panel: action buttons, breadcrumb to ancestors,
 * and the click-to-edit title (#number + text).
 */
export default function IssueDetailHeader({
  projectId,
  projectKey,
  issue: d,
  detail,
  context,
  expanded,
  onToggleExpand,
  onClose,
  onDelete,
  onNavigate,
  onTitleChange,
}: IssueDetailHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const labels = d.labels ?? []

  const handleCopyBranch = () => {
    const branch = deriveBranchName({
      projectKey,
      issueNumber: d.number,
      title: d.title,
      labels: labels.map((l) => l.label),
      issueType: d.type as 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK',
    })
    copyToClipboard(branch)
  }

  const handleConfirmDelete = () => setConfirmDeleteOpen(true)

  const commitTitle = () => {
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== d.title) onTitleChange(trimmed)
    setEditingTitle(false)
  }

  return (
    <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <IconButton onClick={handleCopyBranch} title="Copy branch name (derived from labels)" ariaLabel="Copy branch name">
            <GitBranch className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={() => copyIssueLink(projectKey, d.number, context)} title="Copy link" ariaLabel="Copy link">
            <Link2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'} ariaLabel={expanded ? 'Collapse panel' : 'Expand panel'}>
            {expanded ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </IconButton>
          <IconButton onClick={handleConfirmDelete} title="Delete issue" ariaLabel="Delete issue" danger>
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={onClose} title="Close" ariaLabel="Close">✕</IconButton>
        </div>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Comments, attachments, and activity history
              will be removed along with the issue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {detail?.parent && (
        <Breadcrumb parent={detail.parent} current={d} projectId={projectId} onNavigate={onNavigate} />
      )}

      {editingTitle ? (
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { e.stopPropagation(); setEditingTitle(false) }
          }}
          className="mt-1 w-full rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-gray-700 px-1 text-xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          autoFocus
        />
      ) : (
        <h2
          className="mt-1 cursor-pointer rounded px-1 -mx-1 text-xl font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          onClick={() => { setDraftTitle(d.title); setEditingTitle(true) }}
        >
          <span className="font-mono text-base text-gray-400 mr-2 align-middle">#{d.number}</span>
          {d.title}
        </h2>
      )}
    </div>
  )
}

function IconButton({
  onClick,
  title,
  ariaLabel,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  ariaLabel: string
  danger?: boolean
  children: React.ReactNode
}) {
  const hoverClass = danger ? 'hover:text-red-500' : 'hover:text-gray-600 dark:hover:text-gray-300'
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={`rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 ${hoverClass}`}
    >
      {children}
    </button>
  )
}

function Breadcrumb({
  parent,
  current,
  projectId,
  onNavigate,
}: {
  parent: NonNullable<IssueDetail['parent']>
  current: { title: string; number: number; type: string }
  projectId: string
  onNavigate: (issue: Issue) => void
}) {
  const ancestors = [parent.parent, parent].filter(Boolean) as Array<{ id: string; number: number; title: string; type: string }>

  const navigate = (id: string) => {
    issueRepository.findOne(projectId, id).then(
      (fullIssue) => onNavigate(fullIssue),
      (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to load issue'), 'error'),
    )
  }

  return (
    <p className="mt-1 text-xs text-gray-400 flex items-center gap-x-1 min-w-0">
      {ancestors.map((ancestor, idx) => (
        <span key={ancestor.id} className="flex items-center gap-x-1 min-w-0">
          <button
            onClick={() => navigate(ancestor.id)}
            title={ancestor.title}
            className="flex items-center gap-x-1 min-w-0 max-w-[200px] hover:text-primary-600 hover:underline"
          >
            <span className="shrink-0">{TYPE_ICONS[ancestor.type] || ''} #{ancestor.number}</span>
            <span className="truncate">{ancestor.title}</span>
          </button>
          {idx < ancestors.length - 1 && <span className="text-gray-300 shrink-0">/</span>}
        </span>
      ))}
      <span className="text-gray-300 shrink-0">/</span>
      <span title={current.title} className="flex items-center gap-x-1 min-w-0 max-w-[200px]">
        <span className="shrink-0">{TYPE_ICONS[current.type] || ''} #{current.number}</span>
        <span className="truncate">{current.title}</span>
      </span>
    </p>
  )
}
