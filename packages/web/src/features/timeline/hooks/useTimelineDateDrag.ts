import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { DAY_MS, pixelToDate, startOfDay } from '@/features/timeline/lib'
import type { TimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'

/**
 * Three gestures the chart can dispatch into the hook:
 *
 *  - `create-from-today`: empty issue. Mousedown on the today icon, then
 *    drag in either direction; `resolveDates` picks orientation based on
 *    cursor vs anchor at commit time.
 *  - `set-due`: drag the **right** edge of any visible bar → updates `dueDate`.
 *    Existing `startDate` (if any) is preserved and clamps the floor.
 *  - `set-start`: drag the **left** edge of any visible bar → updates
 *    `startDate`. Existing `dueDate` (if any) is preserved and clamps the
 *    ceiling. Setting startDate on a dueDate-only issue fills the missing
 *    date; same edge on a both-dates issue resizes it.
 *
 * The mode is determined by which affordance the user clicked, not by the
 * issue's current date state — so PMs can always grab the visible edge of
 * any bar to adjust its end-points.
 */
export type DragMode = 'create-from-today' | 'set-due' | 'set-start'

interface PreviewDates {
  startDate: Date | null
  dueDate: Date | null
}

interface DragSession {
  issue: Issue
  mode: DragMode
  anchor: Date
  cursor: Date
  /** Pixel X of mouse-down — used to enforce the click-vs-drag threshold. */
  startMouseX: number
  /** Element whose `getBoundingClientRect` defines pixel-to-day math (the chart inner wrapper). */
  chartEl: HTMLElement
  /** True once the user has moved past the 3px threshold (`MOVE_THRESHOLD_PX`). */
  passedThreshold: boolean
}

const MOVE_THRESHOLD_PX = 3

interface UseTimelineDateDragArgs {
  projectId: string
  dateRange: TimelineDateRange
}

export function useTimelineDateDrag({ projectId, dateRange }: UseTimelineDateDragArgs) {
  const queryClient = useQueryClient()
  const [hoverIssueId, setHoverIssueId] = useState<string | null>(null)
  const [session, setSession] = useState<DragSession | null>(null)
  const sessionRef = useRef<DragSession | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const mutation = useMutation({
    mutationFn: ({ issueId, dates }: { issueId: string; dates: PreviewDates }) =>
      issueRepository.update(projectId, issueId, {
        startDate: dates.startDate ? dates.startDate.toISOString() : null,
        dueDate: dates.dueDate ? dates.dueDate.toISOString() : null,
      }),
    onMutate: async ({ issueId, dates }) => {
      await queryClient.cancelQueries({
        queryKey: ['issues', projectId, 'timeline'],
      })
      const previous = queryClient.getQueryData<{ items: Issue[] }>([
        'issues',
        projectId,
        'timeline',
      ])
      if (previous) {
        queryClient.setQueryData<{ items: Issue[] }>(
          ['issues', projectId, 'timeline'],
          {
            ...previous,
            items: previous.items.map((i) =>
              i.id === issueId
                ? {
                    ...i,
                    startDate: dates.startDate ? dates.startDate.toISOString() : null,
                    dueDate: dates.dueDate ? dates.dueDate.toISOString() : null,
                  }
                : i,
            ),
          },
        )
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['issues', projectId, 'timeline'],
          context.previous,
        )
      }
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to update dates'), 'error')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['issues', projectId, 'timeline'],
      })
    },
  })

  /** Resolve the (startDate, dueDate) pair from the current session. */
  const resolveDates = useCallback((s: DragSession): PreviewDates => {
    const { issue, mode, anchor, cursor } = s
    const existingStart = issue.startDate
      ? startOfDay(new Date(issue.startDate))
      : null
    const existingDue = issue.dueDate
      ? startOfDay(new Date(issue.dueDate))
      : null

    switch (mode) {
      case 'create-from-today': {
        // anchor = today; direction picked from cursor vs anchor
        if (cursor >= anchor) {
          return { startDate: anchor, dueDate: maxDate(cursor, addDays(anchor, 1)) }
        }
        return { startDate: minDate(cursor, addDays(anchor, -1)), dueDate: anchor }
      }
      case 'set-due': {
        // Only dueDate moves. startDate (if any) stays put and clamps lower.
        const minDue = existingStart ? addDays(existingStart, 1) : cursor
        return {
          startDate: existingStart,
          dueDate: maxDate(cursor, minDue),
        }
      }
      case 'set-start': {
        // Only startDate moves. dueDate (if any) stays put and clamps upper.
        const maxStart = existingDue ? addDays(existingDue, -1) : cursor
        return {
          startDate: minDate(cursor, maxStart),
          dueDate: existingDue,
        }
      }
    }
  }, [])

  const previewDates = session ? resolveDates(session) : null

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      issue: Issue,
      mode: DragMode,
      chartEl: HTMLElement,
    ) => {
      e.preventDefault()
      e.stopPropagation()
      const anchor = anchorForMode(mode, issue)
      const next: DragSession = {
        issue,
        mode,
        anchor,
        cursor: anchor,
        startMouseX: e.clientX,
        chartEl,
        passedThreshold: false,
      }
      sessionRef.current = next
      setSession(next)
    },
    [],
  )

  // Attach document-level listeners only while dragging. Capture the cursor's
  // chart-relative X on each mousemove → snap to a Date → store in session.
  useEffect(() => {
    if (!session) return

    const onMove = (e: MouseEvent) => {
      const s = sessionRef.current
      if (!s) return
      const rect = s.chartEl.getBoundingClientRect()
      const offset = e.clientX - rect.left
      const day = pixelToDate(
        offset,
        dateRange.startDate,
        dateRange.endDate,
        rect.width,
      )
      const passed =
        s.passedThreshold ||
        Math.abs(e.clientX - s.startMouseX) >= MOVE_THRESHOLD_PX
      const updated = { ...s, cursor: day, passedThreshold: passed }
      sessionRef.current = updated
      setSession(updated)
    }

    const onUp = () => {
      const s = sessionRef.current
      if (!s) return
      if (s.passedThreshold) {
        const dates = resolveDates(s)
        mutation.mutate({ issueId: s.issue.id, dates })
      }
      sessionRef.current = null
      setSession(null)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sessionRef.current = null
        setSession(null)
      }
    }

    const onBlur = () => {
      sessionRef.current = null
      setSession(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [session, dateRange.startDate, dateRange.endDate, mutation, resolveDates])

  return {
    hoverIssueId,
    setHoverIssueId,
    session,
    previewDates,
    isDraggingPast: session?.passedThreshold === true,
    startDrag,
  }
}

function anchorForMode(mode: DragMode, issue: Issue): Date {
  switch (mode) {
    case 'create-from-today':
      return startOfDay(new Date())
    case 'set-due':
      return issue.startDate
        ? startOfDay(new Date(issue.startDate))
        : startOfDay(new Date(issue.dueDate ?? issue.createdAt))
    case 'set-start':
      return issue.dueDate
        ? startOfDay(new Date(issue.dueDate))
        : startOfDay(new Date(issue.startDate ?? issue.createdAt))
  }
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b
}
