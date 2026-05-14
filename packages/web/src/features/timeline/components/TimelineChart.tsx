import type { Issue } from '@/features/issue/api'
import { STATUS_BAR_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { computeBarStyle, formatDate, type TimelineRow } from '@/features/timeline/lib'
import type { TimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'

interface TimelineChartProps {
  rows: TimelineRow[]
  dateRange: TimelineDateRange
  todayOffset: number
  rowHeight: number
  onSelectIssue: (issue: Issue) => void
  onHover: (issueId: string | null, e?: React.MouseEvent) => void
}

/**
 * Right column: week-aligned gridlines + a colored bar per issue. The
 * sticky week header tracks the chart's vertical scroll. `minWidth` on
 * the inner wrapper triggers the outer container's horizontal scroll when
 * the timeline is wider than the viewport.
 */
export default function TimelineChart({ rows, dateRange, todayOffset, rowHeight, onSelectIssue, onHover }: TimelineChartProps) {
  const { weeks, totalDays, startDate, endDate } = dateRange
  const todayVisible = todayOffset >= 0 && todayOffset <= 100

  return (
    <div className="flex-1 min-w-0">
      <div className="relative" style={{ minWidth: Math.max(800, totalDays * 12) }}>
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
  const barStyle = computeBarStyle(issue, startDate, endDate)
  const isDot = !issue.dueDate

  return (
    <div
      className={cn(
        'relative border-b',
        isEpic
          ? 'border-gray-200 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20'
          : 'border-gray-100 dark:border-gray-700',
      )}
      style={{ height: rowHeight }}
    >
      <WeekGridlines weeks={weeks} muted={!isEpic} />
      {todayVisible && (
        <div className="absolute top-0 h-full w-px bg-red-400 z-[1]" style={{ left: `${todayOffset}%` }} />
      )}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all hover:brightness-110 hover:shadow-md z-[2]',
          isEpic && 'ring-1 ring-primary-300 dark:ring-primary-600',
          isDot ? (isEpic ? 'rounded-full h-3.5' : 'rounded-full h-3') : 'rounded-md h-5',
          STATUS_BAR_COLORS[issue.status] || 'bg-gray-400/80',
        )}
        style={{ left: barStyle.left, width: barStyle.width, minWidth: barStyle.minWidth }}
        onClick={() => onSelectIssue(issue)}
        onMouseEnter={(e) => onHover(issue.id, e)}
        onMouseMove={(e) => onHover(issue.id, e)}
        onMouseLeave={() => onHover(null)}
      />
    </div>
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
