import { useState } from 'react'
import MarkdownEditor from '@/shared/ui/markdown/MarkdownEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'

interface CreateSpecModalProps {
  isPending: boolean
  onCreate: (data: { title: string; content: string; category?: string }) => void
  onClose: () => void
}

export default function CreateSpecModal({ isPending, onCreate, onClose }: CreateSpecModalProps) {
  const { open, requestClose } = useDeferredClose(onClose)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')

  const canSubmit = !!title.trim() && !!content.trim() && !isPending

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent className="max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
            New Specification
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new specification</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional)"
              className="w-40 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <MarkdownEditor value={content} onChange={setContent} placeholder="Write your specification in Markdown..." minRows={12} />
          <div className="flex justify-end gap-2">
            <button
              onClick={requestClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => onCreate({ title, content, category: category || undefined })}
              disabled={!canSubmit}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
