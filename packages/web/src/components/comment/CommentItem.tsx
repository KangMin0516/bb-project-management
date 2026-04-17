import { useState } from 'react'
import type { Comment } from '@/api/issues'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'
import MarkdownEditor from '@/components/markdown/MarkdownEditor'
import { timeAgo } from '@/lib/time'

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  onUpdate: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
  isUpdating?: boolean
}

function renderMentions(content: string): string {
  // Match @Name (word chars, spaces between words, Korean chars) but not emails
  return content.replace(/(?<!\S)@([a-zA-Z가-힣\d][a-zA-Z가-힣\d\s]*?[a-zA-Z가-힣\d])(?=\s|[.,!?)]|$)/g, '**@$1**')
}

export default function CommentItem({ comment, currentUserId, onUpdate, onDelete, isUpdating }: CommentItemProps) {
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
          <span className="text-sm font-medium text-gray-900">{comment.user.name}</span>
          <span className="text-xs text-gray-400" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt)}
          </span>
          {comment.createdAt !== comment.updatedAt && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
          {isOwner && !editing && (
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditContent(comment.content)
                  setEditing(true)
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => { if (window.confirm('Delete this comment?')) onDelete(comment.id) }}
                className="text-xs text-gray-400 hover:text-red-500"
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
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
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
