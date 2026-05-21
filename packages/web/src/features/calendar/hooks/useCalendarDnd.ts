import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { DropResult } from '@hello-pangea/dnd'
import type { PaginatedIssues } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { DAY_DROPPABLE_PREFIX } from '@/features/calendar/lib'

/**
 * Drop handler for the Calendar's drag-scheduling flow (PM-58).
 *
 * Drag source: the Unscheduled panel (`droppableId === "unscheduled"`).
 * Drop target: any DayCell (`droppableId === "day:YYYY-MM-DD"`).
 *
 * On drop we patch the issue's `dueDate` to that local-day's 00:00 ICT
 * (mirrors how the existing DatePopover writes — start of the picked
 * day in the user's timezone). React-Query invalidation on success
 * refreshes both the month grid query and the unscheduled list.
 */
export function useCalendarDnd(projectId: string) {
  const queryClient = useQueryClient()

  const unscheduledKey = ['issues', projectId, 'unscheduled'] as const

  const mutation = useMutation({
    mutationFn: ({ issueId, dueDate }: { issueId: string; dueDate: string }) =>
      issueRepository.update(projectId, issueId, { dueDate }),
    // Optimistic: pull the row out of the Unscheduled cache immediately
    // so it disappears from the panel before the server round-trip. The
    // calendar month grid query gets its real refresh on settle.
    onMutate: async ({ issueId }) => {
      await queryClient.cancelQueries({ queryKey: unscheduledKey })
      const prev = queryClient.getQueryData<PaginatedIssues>(unscheduledKey)
      if (prev) {
        queryClient.setQueryData<PaginatedIssues>(unscheduledKey, {
          ...prev,
          items: prev.items.filter((i) => i.id !== issueId),
          total: Math.max(0, (prev.total ?? prev.items.length) - 1),
        })
      }
      return { prev }
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(unscheduledKey, ctx.prev)
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to set due date'), 'error')
    },
    onSettled: () => {
      // Calendar month query + unscheduled query both live under this prefix.
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    },
  })

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, draggableId } = result
      if (!destination) return
      if (!destination.droppableId.startsWith(DAY_DROPPABLE_PREFIX)) return

      // `YYYY-MM-DD` → ISO at local midnight. `new Date('YYYY-MM-DD')`
      // parses as UTC midnight; we want the user's local midnight so
      // the calendar grid puts the chip in the same cell the user
      // dropped on. Building from local components avoids the off-by-
      // one when the user is east of UTC (ICT = UTC+7).
      const dayKey = destination.droppableId.slice(DAY_DROPPABLE_PREFIX.length)
      const [y, m, d] = dayKey.split('-').map((s) => parseInt(s, 10))
      if (!y || !m || !d) return
      const localMidnight = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()

      mutation.mutate({ issueId: draggableId, dueDate: localMidnight })

      useToastStore.getState().addToast(
        `Scheduled for ${new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}`,
        'success',
      )
    },
    [mutation],
  )

  return { onDragEnd, isPending: mutation.isPending }
}
