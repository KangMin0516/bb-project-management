import { useCallback } from 'react'
import { issueApi, type UpdateIssuePayload } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { ASSIGNMENT_UNDO_DURATION } from '@/shared/config/constants'

type AssignmentField = 'assigneeId' | 'reviewerAssigneeId'

interface MemberLike {
  user: { id: string; name: string }
}

interface UseAssignmentWithUndoOptions {
  projectId: string
  issueId: string
  members: MemberLike[] | undefined
  onSuccess?: () => void
}

interface ChangeOptions {
  field: AssignmentField
  /** Display label for the toast message. */
  label: 'Assignee' | 'Reviewer'
  newId: string
  currentId: string | null | undefined
}

/**
 * Returns a stable `change()` function implementing the Gmail-style undo
 * pattern for assignment fields: optimistic commit + 10-second toast that
 * can revert via a backend `silent: true` flag (no extra Slack DM on undo).
 *
 * Skips the toast entirely when clearing the field — there's no recipient
 * to notify, so nothing to undo.
 */
export function useAssignmentWithUndo({ projectId, issueId, members, onSuccess }: UseAssignmentWithUndoOptions) {
  return useCallback(
    (opts: ChangeOptions) => {
      const prevId = opts.currentId ?? null
      const nextId = opts.newId || null
      if (nextId === prevId) return

      const payload = { [opts.field]: nextId } as UpdateIssuePayload
      issueRepository.update(projectId, issueId, payload).then(onSuccess).catch((err: unknown) => {
        useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update issue'))
      })

      if (!nextId) return

      const member = (members ?? []).find((m) => m.user.id === nextId)
      const name = member?.user.name ?? 'this user'
      const role = opts.label === 'Reviewer' ? 'reviewer' : 'assignee'

      useToastStore.getState().showActionToast({
        key: `${opts.field}:${issueId}`,
        type: 'info',
        message: `Set ${name} as ${role}. Notifying Slack soon.`,
        durationMs: ASSIGNMENT_UNDO_DURATION,
        action: {
          label: 'Undo',
          onAction: () => {
            issueApi
              .update(projectId, issueId, { [opts.field]: prevId, silent: true } as UpdateIssuePayload)
              .then(onSuccess)
              .catch((err) =>
                useToastStore.getState().addToast(getErrorMessage(err, `Failed to undo ${role} change`)),
              )
          },
        },
      })
    },
    [projectId, issueId, members, onSuccess],
  )
}
