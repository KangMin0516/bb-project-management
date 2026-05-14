import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import { issueRepository } from '@/features/issue/repository'
import CommentItem from '@/features/issue/components/comment/CommentItem'

interface IssueCommentsReadOnlyProps {
  projectId: string
  issueId: string
}

/**
 * Read-only comment preview shown at the bottom of the Details tab.
 * Shares the comments query cache with `ActivityTab` so switching tabs
 * does not refetch. Posting / replying happens in the Activity tab.
 */
export default function IssueCommentsReadOnly({ projectId, issueId }: IssueCommentsReadOnlyProps) {
  const currentUser = useAuthStore((s) => s.user)
  const { data } = useQuery({
    queryKey: ['comments', projectId, issueId],
    queryFn: () => issueRepository.findComments(projectId, issueId),
  })

  const comments = data?.items ?? []
  const sorted = [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No comments yet — open the Activity tab to post one.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUser?.id || ''}
              onUpdate={() => {}}
              onDelete={() => {}}
              readOnly
            />
          ))}
        </div>
      )}
    </section>
  )
}
