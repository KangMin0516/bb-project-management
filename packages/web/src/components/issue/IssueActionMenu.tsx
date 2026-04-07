import { useState } from 'react'
import { MoreHorizontal, Link2, Trash2 } from 'lucide-react'
import { useToastStore } from '@/stores/toast'

interface Props {
  projectKey: string
  issueNumber: number
  onDelete?: () => void
}

export function copyIssueLink(projectKey: string, issueNumber: number) {
  const url = `${window.location.origin}/share/${projectKey}-${issueNumber}`
  navigator.clipboard.writeText(url).then(
    () => useToastStore.getState().addToast('Link copied!', 'success'),
    () => useToastStore.getState().addToast('Failed to copy link', 'error'),
  )
}

export default function IssueActionMenu({ projectKey, issueNumber, onDelete }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyIssueLink(projectKey, issueNumber)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
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
