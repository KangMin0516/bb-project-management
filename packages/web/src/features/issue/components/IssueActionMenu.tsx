import { MoreHorizontal, Link2, Trash2 } from 'lucide-react'
import type { ShareContext } from '@/shared/types'
import { copyIssueLink } from '@/features/issue/lib/copyIssueLink'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface IssueActionMenuProps {
  projectKey: string
  issueNumber: number
  context?: ShareContext
  onDelete?: () => void
}

export default function IssueActionMenu({ projectKey, issueNumber, context, onDelete }: IssueActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            copyIssueLink(projectKey, issueNumber, context)
          }}
          className="text-xs text-gray-700 dark:text-gray-300"
        >
          <Link2 className="h-3 w-3" /> Copy Link
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-xs text-red-600 dark:text-red-400 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-900/30 dark:focus:text-red-300"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
