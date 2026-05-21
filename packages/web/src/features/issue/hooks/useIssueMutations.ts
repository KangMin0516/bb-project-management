import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type UpdateIssuePayload, type CreateIssuePayload } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { prepareForUpload } from '@/shared/lib/prepareUpload'
import { issueRepository } from '@/features/issue/repository'

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
    // TOC depends on Module ↔ Epic parent links + per-Epic task counts;
    // any issue update (parent, status, archive, …) can shift those.
    queryClient.invalidateQueries({ queryKey: ['toc', projectId] })
    // Calendar's Unscheduled panel reflects `dueDate IS NULL` issues —
    // setting / clearing dueDate from the detail panel flips visibility
    // there. The prefix invalidate above would normally cover this but
    // we refetchQueries explicitly so an inactive observer still picks
    // up the change once the user re-opens the Calendar (PM-58).
    queryClient.refetchQueries({ queryKey: ['issues', projectId, 'unscheduled'] })
  }

  const update = useMutation({
    mutationFn: (data: UpdateIssuePayload) => issueRepository.update(projectId, issueId, data),
    onSuccess: invalidateAll,
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update issue'), 'error')
    },
  })

  const deleteIssue = useMutation({
    mutationFn: () => issueRepository.remove(projectId, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      queryClient.invalidateQueries({ queryKey: ['toc', projectId] })
      onDeleted?.()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue'), 'error')
    },
  })

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      const prepared = await prepareForUpload(file)
      return issueRepository.uploadFile(prepared, { issueId })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload file'), 'error')
    },
  })

  const deleteAttachment = useMutation({
    mutationFn: (id: string) => issueRepository.removeFile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete file'), 'error')
    },
  })

  const createSubtask = useMutation({
    mutationFn: (data: CreateIssuePayload) => issueRepository.create(projectId, data),
    onSuccess: invalidateAll,
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create sub-task'), 'error')
    },
  })

  return { update, deleteIssue, uploadAttachment, deleteAttachment, createSubtask, invalidateAll }
}
