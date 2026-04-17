import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { specApi, type SpecComment } from '@/api/specifications'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { MessageSquare, Check, Reply, Trash2, X } from 'lucide-react'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'

interface SpecCommentPanelProps {
  projectId: string
  specId: string
  comments: SpecComment[]
  filterSection?: string | null
  filterSectionTitle?: string | null
  onSectionClick?: (sectionId: string) => void
  onClearFilter?: () => void
  onScrollToSection?: (sectionId: string) => void
}

export default function SpecCommentPanel({ projectId, specId, comments, filterSection, filterSectionTitle, onSectionClick, onClearFilter, onScrollToSection }: SpecCommentPanelProps) {
  const currentUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [newContent, setNewContent] = useState('')

  const filtered = filterSection
    ? comments.filter((c) => c.section?.sectionId === filterSection)
    : comments

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['specification', projectId, specId] })

  const createMutation = useMutation({
    mutationFn: (data: { content: string; sectionId?: string; parentId?: string }) =>
      specApi.createComment(projectId, specId, data),
    onSuccess: () => { invalidate(); setNewContent(''); setReplyContent(''); setReplyTo(null) },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to post comment')),
  })

  const toggleResolveMutation = useMutation({
    mutationFn: ({ commentId, resolved }: { commentId: string; resolved: boolean }) =>
      specApi.updateComment(projectId, specId, commentId, { resolved }),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update comment')),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => specApi.deleteComment(projectId, specId, commentId),
    onSuccess: invalidate,
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete comment')),
  })

  const unresolvedCount = filtered.filter((c) => !c.resolved).length

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Comments</span>
            {unresolvedCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                {unresolvedCount} open
              </span>
            )}
          </div>
        </div>
        {filterSection && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Section:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
              {filterSectionTitle || filterSection}
              <button onClick={() => onClearFilter?.()} className="ml-0.5 rounded-full hover:bg-primary-100 p-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* New comment form */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="w-full resize-none text-sm focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => createMutation.mutate({ content: newContent, sectionId: filterSection ?? undefined })}
              disabled={!newContent.trim() || createMutation.isPending}
              className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </div>

        {/* Comment list */}
        {filtered.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            currentUserId={currentUser?.id || ''}
            replyTo={replyTo}
            replyContent={replyContent}
            onSetReplyTo={setReplyTo}
            onSetReplyContent={setReplyContent}
            onReply={(parentId) => createMutation.mutate({ content: replyContent, parentId })}
            onToggleResolve={(id, resolved) => toggleResolveMutation.mutate({ commentId: id, resolved })}
            onDelete={(id) => { if (confirm('Delete this comment?')) deleteMutation.mutate(id) }}
            isReplying={createMutation.isPending}
            onSectionClick={onSectionClick}
            onScrollToSection={onScrollToSection}
          />
        ))}

        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500 italic">No comments yet</p>
        )}
      </div>
    </div>
  )
}

function CommentThread({
  comment, currentUserId, replyTo, replyContent, onSetReplyTo, onSetReplyContent,
  onReply, onToggleResolve, onDelete, isReplying, onSectionClick, onScrollToSection,
}: {
  comment: SpecComment
  currentUserId: string
  replyTo: string | null
  replyContent: string
  onSetReplyTo: (id: string | null) => void
  onSetReplyContent: (v: string) => void
  onReply: (parentId: string) => void
  onToggleResolve: (id: string, resolved: boolean) => void
  onDelete: (id: string) => void
  isReplying: boolean
  onSectionClick?: (sectionId: string) => void
  onScrollToSection?: (sectionId: string) => void
}) {
  return (
    <div className={`rounded-lg border p-3 ${comment.resolved ? 'border-green-200 bg-green-50/50' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {comment.section && (
            <button
              onClick={() => {
                onSectionClick?.(comment.section!.sectionId)
                onScrollToSection?.(comment.section!.sectionId)
              }}
              className="mb-1 inline-block rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-500 hover:bg-gray-200"
              title="Filter & scroll to section"
            >
              {comment.section.title}
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">{comment.user.name}</span>
            <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="mt-1 text-sm text-gray-800">
            <MarkdownViewer content={comment.content} className="text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleResolve(comment.id, !comment.resolved)}
            className={`rounded p-1 ${comment.resolved ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title={comment.resolved ? 'Reopen' : 'Resolve'}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          {comment.userId === currentUserId && (
            <button onClick={() => onDelete(comment.id)} className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2 ml-3 space-y-2 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{reply.user.name}</span>
                <span>{new Date(reply.createdAt).toLocaleDateString()}</span>
              </div>
              <MarkdownViewer content={reply.content} className="mt-0.5 text-sm text-gray-700 dark:text-gray-300" />
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="mt-2">
        {replyTo === comment.id ? (
          <div className="flex gap-2">
            <input
              value={replyContent}
              onChange={(e) => onSetReplyContent(e.target.value)}
              placeholder="Reply..."
              className="flex-1 rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
              onKeyDown={(e) => { if (e.key === 'Enter' && replyContent.trim()) onReply(comment.id) }}
            />
            <button
              onClick={() => onReply(comment.id)}
              disabled={!replyContent.trim() || isReplying}
              className="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Send
            </button>
            <button onClick={() => onSetReplyTo(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { onSetReplyTo(comment.id); onSetReplyContent('') }}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>
        )}
      </div>
    </div>
  )
}
