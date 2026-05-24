import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { DAY_MS, pixelToDate, startOfDay } from '@/features/timeline/lib'
import type { TimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'

/**
 * Four gestures the chart can dispatch into the hook:
 *
 *  - `create-free`: empty issue. Mousedown anywhere on the row. Anchor and
 *    cursor are both free pixel-derived dates; at commit time they're
 *    normalised to `[min, max]` for `startDate`/`dueDate`. A same-day drop
 *    expands to a 1-day bar so the user always gets a visible range.
 *  - `set-due`: drag the **right** edge of any visible bar → updates `dueDate`.
 *    Existing `startDate` (if any) is preserved and clamps the floor.
 *  - `set-start`: drag the **left** edge of any visible bar → updates
 *    `startDate`. Existing `dueDate` (if any) is preserved and clamps the
 *    ceiling. Setting startDate on a dueDate-only issue fills the missing
 *    date; same edge on a both-dates issue resizes it.
 *  - `move-bar`: drag the **body** of a bar with both dates → shifts both
 *    by the same number of days. Anchor is the mousedown date, delta =
 *    `cursor - anchor` in days, new dates = `originals + delta`.
 */
export type DragMode = 'create-free' | 'set-due' | 'set-start' | 'move-bar'

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
  /** Captured at mousedown; `move-bar` shifts these by (cursor - anchor) days. */
  originalStart: Date | null
  originalDue: Date | null
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
    const { issue, mode, anchor, cursor, originalStart, originalDue } = s
    const existingStart = issue.startDate
      ? startOfDay(new Date(issue.startDate))
      : null
    const existingDue = issue.dueDate
      ? startOfDay(new Date(issue.dueDate))
      : null

    switch (mode) {
      case 'create-free': {
        const lo = minDate(anchor, cursor)
        const hi = maxDate(anchor, cursor)
        const due = hi.getTime() === lo.getTime() ? addDays(lo, 1) : hi
        return { startDate: lo, dueDate: due }
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
      case 'move-bar': {
        const deltaDays = Math.round(
          (cursor.getTime() - anchor.getTime()) / DAY_MS,
        )
        return {
          startDate: originalStart ? addDays(originalStart, deltaDays) : null,
          dueDate: originalDue ? addDays(originalDue, deltaDays) : null,
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
      const rect = chartEl.getBoundingClientRect()
      const offset = e.clientX - rect.left
      const mouseDate = pixelToDate(
        offset,
        dateRange.startDate,
        dateRange.endDate,
        rect.width,
      )
      const originalStart = issue.startDate
        ? startOfDay(new Date(issue.startDate))
        : null
      const originalDue = issue.dueDate
        ? startOfDay(new Date(issue.dueDate))
        : null
      const anchor = computeAnchor(mode, originalStart, originalDue, mouseDate)
      const next: DragSession = {
        issue,
        mode,
        anchor,
        cursor: mouseDate,
        startMouseX: e.clientX,
        chartEl,
        passedThreshold: false,
        originalStart,
        originalDue,
      }
      sessionRef.current = next
      setSession(next)
    },
    [dateRange.startDate, dateRange.endDate],
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

function computeAnchor(
  mode: DragMode,
  originalStart: Date | null,
  originalDue: Date | null,
  mouseDate: Date,
): Date {
  switch (mode) {
    case 'create-free':
    case 'move-bar':
      return mouseDate
    case 'set-due':
      return originalStart ?? originalDue ?? mouseDate
    case 'set-start':
      return originalDue ?? originalStart ?? mouseDate
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
