import { useState } from 'react'
import type { Comment } from '@/features/issue/api'
import MarkdownViewer from '@/shared/ui/markdown/MarkdownViewer'
import MarkdownEditor from '@/shared/ui/markdown/MarkdownEditor'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { timeAgo } from '@/shared/lib/time'
import SourceBadge from '@/shared/ui/SourceBadge'

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  onUpdate: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
  isUpdating?: boolean
  /** Hide Edit/Delete affordances (used by the Details-tab preview). */
  readOnly?: boolean
}

function renderMentions(content: string): string {
  // Match @Name (word chars, spaces between words, Korean chars) but not emails
  return content.replace(/(?<!\S)@([a-zA-Z가-힣\d][a-zA-Z가-힣\d\s]*?[a-zA-Z가-힣\d])(?=\s|[.,!?)]|$)/g, '**@$1**')
}

export default function CommentItem({ comment, currentUserId, onUpdate, onDelete, isUpdating, readOnly }: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const isOwner = comment.user.id === currentUserId

  const handleSave = () => {
    const trimmed = editContent.trim()
    if (!trimmed || trimmed === comment.content) {
      setEditing(false)
      return
    }
    onUpdate(comment.id, trimmed)
    setEditing(false)
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
        {comment.user.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{comment.user.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt)}
          </span>
          {comment.createdAt !== comment.updatedAt && (
            <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
          )}
          <SourceBadge source={comment.source} />
          {isOwner && !editing && !readOnly && (
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditContent(comment.content)
                  setEditing(true)
                }}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await confirmDialog({
                    title: 'Delete this comment?',
                    confirmLabel: 'Delete',
                    destructive: true,
                  })) onDelete(comment.id)
                }}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-2">
            <MarkdownEditor
              value={editContent}
              onChange={setEditContent}
              minRows={3}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isUpdating}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <MarkdownViewer content={renderMentions(comment.content)} className="text-sm" />
          </div>
        )}
      </div>
    </div>
  )
}
