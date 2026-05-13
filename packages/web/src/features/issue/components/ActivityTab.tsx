import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, type Activity, type Comment } from '@/features/issue/api'
import { type ProjectMember } from '@/features/project/api'
import { useToastStore } from '@/shared/lib/toast'
import { useAuthStore } from '@/features/auth/store'
import { getErrorMessage } from '@/shared/lib/error'
import CommentInput from '@/features/issue/components/comment/CommentInput'
import CommentItem from '@/features/issue/components/comment/CommentItem'
import ActivityTimeline from '@/features/issue/components/activity/ActivityTimeline'

type TimelineItem =
  | { type: 'comment'; data: Comment; createdAt: string }
  | { type: 'activity'; data: Activity; createdAt: string }

export default function ActivityTab({
  projectId,
  issueId,
  activities,
  members,
}: {
  projectId: string
  issueId: string
  activities: Activity[]
  members: ProjectMember[]
}) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const { data: commentsData } = useQuery({
    queryKey: ['comments', projectId, issueId],
    queryFn: () => issueRepository.findComments(projectId, issueId),
  })

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => issueRepository.createComment(projectId, issueId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to post comment'))
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      issueRepository.updateComment(projectId, issueId, commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update comment'))
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => issueRepository.deleteComment(projectId, issueId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete comment'))
    },
  })

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    for (const a of activities) {
      items.push({ type: 'activity', data: a, createdAt: a.createdAt })
    }

    if (commentsData?.items) {
      for (const c of commentsData.items) {
        items.push({ type: 'comment', data: c, createdAt: c.createdAt })
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items
  }, [activities, commentsData])

  return (
    <div className="p-6 space-y-6">
      <CommentInput
        members={members}
        onSubmit={(content) => createCommentMutation.mutate(content)}
        isSubmitting={createCommentMutation.isPending}
      />

      {timeline.length > 0 ? (
        <div className="space-y-4">
          {timeline.map((item) =>
            item.type === 'comment' ? (
              <CommentItem
                key={`c-${item.data.id}`}
                comment={item.data}
                currentUserId={currentUser?.id || ''}
                onUpdate={(commentId, content) => updateCommentMutation.mutate({ commentId, content })}
                onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                isUpdating={updateCommentMutation.isPending}
              />
            ) : (
              <ActivityTimeline
                key={`a-${item.data.id}`}
                activities={[item.data]}
                members={members}
              />
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No activity yet</p>
      )}
    </div>
  )
}
