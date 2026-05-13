import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type UpdateIssuePayload, type CreateIssuePayload } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Bundles every mutation IssueDetailPanel needs (update / delete / file /
 * subtask) and centralises cache-invalidation so call sites stay tiny.
 *
 * `onDeleted` lets the panel close itself once a delete succeeds — we
 * can't invalidate the open-issue query because the issue no longer exists.
 */
export function useIssueMutations(projectId: string, issueId: string, onDeleted?: () => void) {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
  }

  const update = useMutation({
    mutationFn: (data: UpdateIssuePayload) => issueRepository.update(projectId, issueId, data),
    onSuccess: invalidateAll,
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update issue'))
    },
  })

  const deleteIssue = useMutation({
    mutationFn: () => issueRepository.remove(projectId, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      onDeleted?.()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue'))
    },
  })

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => issueRepository.uploadFile(file, { issueId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload file'))
    },
  })

  const deleteAttachment = useMutation({
    mutationFn: (id: string) => issueRepository.removeFile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete file'))
    },
  })

  const createSubtask = useMutation({
    mutationFn: (data: CreateIssuePayload) => issueRepository.create(projectId, data),
    onSuccess: invalidateAll,
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create sub-task'))
    },
  })

  return { update, deleteIssue, uploadAttachment, deleteAttachment, createSubtask, invalidateAll }
}
