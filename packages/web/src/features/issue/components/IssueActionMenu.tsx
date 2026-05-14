import { useState } from 'react'
import { MoreHorizontal, Link2, Trash2 } from 'lucide-react'
import type { ShareContext } from '@/shared/types'
import { copyIssueLink } from '@/features/issue/lib/copyIssueLink'

interface IssueActionMenuProps {
  projectKey: string
  issueNumber: number
  context?: ShareContext
  onDelete?: () => void
}

export default function IssueActionMenu({ projectKey, issueNumber, context, onDelete }: IssueActionMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 py-1 shadow-lg">
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyIssueLink(projectKey, issueNumber, context)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Link2 className="h-3 w-3" /> Copy Link
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onDelete()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
