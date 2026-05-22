import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { DAY_MS, pixelToDate, startOfDay } from '@/features/timeline/lib'
import type { TimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'

/**
 * The four ways the user can grab a row to set or change dates. The hook
 * doesn't care which affordance triggered the drag — `TimelineChart`
 * picks the right `DragMode` per row state and passes it through.
 *
 *  - `create-right`  : empty issue, drag right from today. anchor = today (becomes startDate).
 *  - `create-left`   : empty issue, drag left from today.  anchor = today (becomes dueDate).
 *  - `set-due`       : one-sided issue with startDate only. anchor = startDate. Drag sets dueDate.
 *  - `set-start`     : one-sided issue with dueDate only.   anchor = dueDate.   Drag sets startDate.
 *  - `resize-right`  : both dates set. anchor = startDate. Drag right edge → updates dueDate.
 *  - `resize-left`   : both dates set. anchor = dueDate.   Drag left edge → updates startDate.
 */
export type DragMode =
  | 'create-right'
  | 'create-left'
  | 'set-due'
  | 'set-start'
  | 'resize-right'
  | 'resize-left'

interface PreviewDates {
  startDate: Date
  dueDate: Date
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
        startDate: dates.startDate.toISOString(),
        dueDate: dates.dueDate.toISOString(),
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
                    startDate: dates.startDate.toISOString(),
                    dueDate: dates.dueDate.toISOString(),
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
    const { mode, anchor, cursor } = s
    switch (mode) {
      case 'create-right':
        // anchor = today (start), cursor = future (due)
        return { startDate: anchor, dueDate: maxDate(cursor, addDays(anchor, 1)) }
      case 'create-left':
        // anchor = today (due), cursor = past (start)
        return { startDate: minDate(cursor, addDays(anchor, -1)), dueDate: anchor }
      case 'set-due':
        // anchor = startDate (fixed), cursor = new dueDate
        return { startDate: anchor, dueDate: maxDate(cursor, addDays(anchor, 1)) }
      case 'set-start':
        // anchor = dueDate (fixed), cursor = new startDate
        return { startDate: minDate(cursor, addDays(anchor, -1)), dueDate: anchor }
      case 'resize-right':
        return { startDate: anchor, dueDate: maxDate(cursor, addDays(anchor, 1)) }
      case 'resize-left':
        return { startDate: minDate(cursor, addDays(anchor, -1)), dueDate: anchor }
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
      if (!anchor) return
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

function anchorForMode(mode: DragMode, issue: Issue): Date | null {
  switch (mode) {
    case 'create-right':
    case 'create-left':
      return startOfDay(new Date())
    case 'set-due':
      return issue.startDate ? startOfDay(new Date(issue.startDate)) : null
    case 'set-start':
      return issue.dueDate ? startOfDay(new Date(issue.dueDate)) : null
    case 'resize-right':
      return issue.startDate ? startOfDay(new Date(issue.startDate)) : null
    case 'resize-left':
      return issue.dueDate ? startOfDay(new Date(issue.dueDate)) : null
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
