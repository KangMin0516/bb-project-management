import { useRef } from 'react'
import type { Issue } from '@/features/issue/api'
import { STATUS_BAR_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { computeBarStyle, formatDate, type TimelineRow } from '@/features/timeline/lib'
import type { TimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'
import type { DragMode } from '@/features/timeline/hooks/useTimelineDateDrag'

interface DragApi {
  hoverIssueId: string | null
  setHoverIssueId: (id: string | null) => void
  session: {
    issue: Issue
    mode: DragMode
    cursor: Date
    passedThreshold: boolean
  } | null
  previewDates: { startDate: Date | null; dueDate: Date | null } | null
  startDrag: (
    e: React.MouseEvent,
    issue: Issue,
    mode: DragMode,
    chartEl: HTMLElement,
  ) => void
  disabled?: boolean
}

interface TimelineChartProps {
  rows: TimelineRow[]
  dateRange: TimelineDateRange
  todayOffset: number
  rowHeight: number
  onSelectIssue: (issue: Issue) => void
  onHover: (issueId: string | null, e?: React.MouseEvent) => void
  drag?: DragApi
}

/**
 * Right column: week-aligned gridlines + a colored bar per issue. The
 * sticky week header tracks the chart's vertical scroll. `minWidth` on
 * the inner wrapper triggers the outer container's horizontal scroll when
 * the timeline is wider than the viewport.
 *
 * When a `drag` API is supplied, every row participates in three free-form
 * gestures handled by `useTimelineDateDrag`:
 *  - empty issue row → mousedown anywhere draws a new `[start, due]` range
 *  - bar body (both dates) → mousedown shifts both dates together
 *  - bar edge handles → mousedown resizes that side only
 * The drag overlay uses the chart's `innerRef` `getBoundingClientRect()`
 * for pixel-to-day math.
 */
export default function TimelineChart({
  rows,
  dateRange,
  todayOffset,
  rowHeight,
  onSelectIssue,
  onHover,
  drag,
}: TimelineChartProps) {
  const { weeks, totalDays, startDate, endDate } = dateRange
  const todayVisible = todayOffset >= 0 && todayOffset <= 100
  const innerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={innerRef}
        className="relative"
        style={{ minWidth: Math.max(800, totalDays * 12) }}
      >
        <ChartHeader weeks={weeks} todayOffset={todayOffset} todayVisible={todayVisible} />
        {rows.map((row, idx) => (
          <ChartRow
            key={rowKey(row, idx)}
            row={row}
            weeks={weeks}
            startDate={startDate}
            endDate={endDate}
            rowHeight={rowHeight}
            todayOffset={todayOffset}
            todayVisible={todayVisible}
            onSelectIssue={onSelectIssue}
            onHover={onHover}
            drag={drag}
            innerRef={innerRef}
          />
        ))}
        {todayVisible && (
          <div
            className="absolute top-10 bottom-0 w-px bg-red-400/50 z-[1] pointer-events-none"
            style={{ left: `${todayOffset}%` }}
          />
        )}
      </div>
    </div>
  )
}

function ChartHeader({ weeks, todayOffset, todayVisible }: { weeks: { date: Date; offset: number }[]; todayOffset: number; todayVisible: boolean }) {
  return (
    <div className="sticky top-0 z-10 h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {weeks.map((week, i) => (
        <div key={i} className="absolute top-0 flex h-full items-center" style={{ left: `${week.offset}%` }}>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap pl-1">
            {formatDate(week.date)}
          </span>
        </div>
      ))}
      {todayVisible && (
        <div className="absolute top-0 flex h-full items-end pb-0.5" style={{ left: `${todayOffset}%` }}>
          <span className="text-[10px] font-bold text-red-500 whitespace-nowrap -translate-x-1/2">Today</span>
        </div>
      )}
    </div>
  )
}

function rowKey(row: TimelineRow, idx: number): string {
  switch (row.kind) {
    case 'epic': return `chart-epic-${row.epic.id}`
    case 'no-epic': return `chart-no-epic-${idx}`
    case 'group': return `chart-group-${row.label}-${idx}`
    case 'issue': return `chart-issue-${row.issue.id}`
  }
}

function ChartRow({
  row,
  weeks,
  startDate,
  endDate,
  rowHeight,
  todayOffset,
  todayVisible,
  onSelectIssue,
  onHover,
  drag,
  innerRef,
}: {
  row: TimelineRow
  weeks: { date: Date; offset: number }[]
  startDate: Date
  endDate: Date
  rowHeight: number
  todayOffset: number
  todayVisible: boolean
  onSelectIssue: (issue: Issue) => void
  onHover: (issueId: string | null, e?: React.MouseEvent) => void
  drag?: DragApi
  innerRef: React.RefObject<HTMLDivElement | null>
}) {
  if (row.kind === 'group' || row.kind === 'no-epic') {
    return (
      <div
        className="relative border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80"
        style={{ height: rowHeight }}
      >
        <WeekGridlines weeks={weeks} />
      </div>
    )
  }

  const issue = row.kind === 'epic' ? row.epic : row.issue
  const isEpic = row.kind === 'epic'

  const isDraggingThis =
    drag?.session?.issue.id === issue.id && drag.session.passedThreshold
  const displayIssue: Issue =
    isDraggingThis && drag?.previewDates
      ? {
          ...issue,
          startDate: drag.previewDates.startDate
            ? drag.previewDates.startDate.toISOString()
            : null,
          dueDate: drag.previewDates.dueDate
            ? drag.previewDates.dueDate.toISOString()
            : null,
        }
      : issue
  const barStyle = computeBarStyle(displayIssue, startDate, endDate)
  const isDot = !displayIssue.dueDate
  const hasNoDates = !issue.startDate && !issue.dueDate
  const canMoveBar = !!issue.startDate && !!issue.dueDate
  const dragEnabled = !!drag && !drag.disabled && !drag.session

  const handleRowMouseDown = (e: React.MouseEvent) => {
    if (!dragEnabled || !hasNoDates) return
    // Let buttons (edge handles) and the bar itself receive mousedown first.
    if ((e.target as HTMLElement).closest('button')) return
    if (innerRef.current) drag!.startDrag(e, issue, 'create-free', innerRef.current)
  }

  const handleBarMouseDown = (e: React.MouseEvent) => {
    if (!dragEnabled || !canMoveBar) return
    if ((e.target as HTMLElement).closest('button')) return
    if (innerRef.current) drag!.startDrag(e, issue, 'move-bar', innerRef.current)
  }

  return (
    <div
      className={cn(
        'group relative border-b',
        isEpic
          ? 'border-gray-200 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20'
          : 'border-gray-100 dark:border-gray-700',
        hasNoDates && dragEnabled && 'cursor-crosshair hover:bg-gray-50/60 dark:hover:bg-gray-800/40',
      )}
      style={{ height: rowHeight }}
      onMouseDown={handleRowMouseDown}
    >
      <WeekGridlines weeks={weeks} muted={!isEpic} />
      {todayVisible && (
        <div className="absolute top-0 h-full w-px bg-red-400 z-[1]" style={{ left: `${todayOffset}%` }} />
      )}

      {/* Real bar — dims during drag of this row. Title renders inside,
          truncating to an ellipsis when the bar is too narrow to fit it. */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 transition-all z-[2] flex items-center overflow-hidden',
          isEpic && 'ring-1 ring-primary-300 dark:ring-primary-600',
          isDot ? (isEpic ? 'rounded-full h-3.5' : 'rounded-full h-3') : 'rounded-md h-5',
          STATUS_BAR_COLORS[issue.status] || 'bg-gray-400/80',
          canMoveBar && dragEnabled
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-pointer',
          isDraggingThis
            ? 'opacity-30 pointer-events-none'
            : 'hover:brightness-110 hover:shadow-md',
        )}
        style={{ left: barStyle.left, width: barStyle.width, minWidth: barStyle.minWidth }}
        onMouseDown={handleBarMouseDown}
        onClick={() => !isDraggingThis && onSelectIssue(issue)}
        onMouseEnter={(e) => onHover(issue.id, e)}
        onMouseMove={(e) => onHover(issue.id, e)}
        onMouseLeave={() => onHover(null)}
      >
        <span className="truncate px-1.5 text-xs font-medium leading-none text-white">
          {issue.title}
        </span>
      </div>

      {/* Edge handles on visible bars — only for issues with at least one date.
          Empty issues drag from the row itself (handleRowMouseDown). */}
      {dragEnabled && (issue.startDate || issue.dueDate) && (
        <BarEdgeHandles
          isEpic={isEpic}
          barStyle={barStyle}
          startLabel={issue.startDate ? 'Drag to change start date' : 'Drag to set start date'}
          dueLabel={issue.dueDate ? 'Drag to change due date' : 'Drag to set due date'}
          onStart={(mode, e) => {
            if (innerRef.current) drag!.startDrag(e, issue, mode, innerRef.current)
          }}
        />
      )}

      {/* Live cursor label during drag */}
      {isDraggingThis && drag?.previewDates && drag.session && (
        <PreviewLabel
          startDate={drag.previewDates.startDate}
          dueDate={drag.previewDates.dueDate}
          cursor={drag.session.cursor}
          rangeStart={startDate}
          rangeEnd={endDate}
        />
      )}

    </div>
  )
}

function BarEdgeHandles({
  isEpic,
  barStyle,
  startLabel,
  dueLabel,
  onStart,
}: {
  isEpic: boolean
  barStyle: { left: string; width: string; minWidth: string }
  startLabel: string
  dueLabel: string
  onStart: (mode: DragMode, e: React.MouseEvent) => void
}) {
  const heightClass = isEpic ? 'h-3.5' : 'h-5'
  return (
    <>
      <EdgeHandle
        side="left"
        left={barStyle.left}
        width={barStyle.width}
        heightClass={heightClass}
        label={startLabel}
        onMouseDown={(e) => onStart('set-start', e)}
      />
      <EdgeHandle
        side="right"
        left={barStyle.left}
        width={barStyle.width}
        heightClass={heightClass}
        label={dueLabel}
        onMouseDown={(e) => onStart('set-due', e)}
      />
    </>
  )
}

function EdgeHandle({
  side,
  left,
  width,
  heightClass,
  label,
  onMouseDown,
}: {
  side: 'left' | 'right'
  left: string
  width: string
  heightClass: string
  label: string
  onMouseDown: (e: React.MouseEvent) => void
}) {
  // Place a 6px-wide draggable strip on the bar edge. Visible only on hover.
  const style: React.CSSProperties =
    side === 'left'
      ? { left: `calc(${left} - 3px)` }
      : { left: `calc(${left} + ${width} - 3px)` }
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      title={label}
      className={cn(
        'absolute top-1/2 z-[4] w-1.5 -translate-y-1/2 cursor-ew-resize rounded-sm bg-white dark:bg-gray-200 opacity-0 shadow-sm ring-1 ring-gray-400 transition-opacity group-hover:opacity-90',
        heightClass,
      )}
      style={style}
    />
  )
}

function PreviewLabel({
  startDate,
  dueDate,
  cursor,
  rangeStart,
  rangeEnd,
}: {
  startDate: Date | null
  dueDate: Date | null
  cursor: Date
  rangeStart: Date
  rangeEnd: Date
}) {
  const range = rangeEnd.getTime() - rangeStart.getTime()
  if (range === 0) return null
  const clamped = Math.max(
    rangeStart.getTime(),
    Math.min(cursor.getTime(), rangeEnd.getTime()),
  )
  const offset = ((clamped - rangeStart.getTime()) / range) * 100
  return (
    <span
      className="absolute top-1 z-[5] -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow whitespace-nowrap"
      style={{ left: `${offset}%` }}
    >
      {startDate ? formatDate(startDate) : '—'} → {dueDate ? formatDate(dueDate) : '—'}
    </span>
  )
}

function WeekGridlines({ weeks, muted }: { weeks: { date: Date; offset: number }[]; muted?: boolean }) {
  return (
    <>
      {weeks.map((week, i) => (
        <div
          key={i}
          className={cn('absolute top-0 h-full w-px', muted ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-600/60')}
          style={{ left: `${week.offset}%` }}
        />
      ))}
    </>
  )
}
