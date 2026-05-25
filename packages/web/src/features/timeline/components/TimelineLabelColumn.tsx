import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import { STATUS_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { NO_EPIC_KEY, type GroupBy, type TimelineRow } from '@/features/timeline/lib'

interface TimelineLabelColumnProps {
  rows: TimelineRow[]
  groupBy: GroupBy
  projectKey: string | undefined
  rowHeight: number
  width: number
  collapsed: boolean
  isResizing?: boolean
  onToggleCollapsed: () => void
  onSelectIssue: (issue: Issue) => void
  onToggleEpic: (key: string) => void
  /** Mousedown on the right-edge resize handle. Wired in TimelinePage. */
  onResizeStart?: (e: React.MouseEvent) => void
}

/**
 * Sticky left column listing issues / group headers. Click an issue row to
 * open the detail panel; click the chevron on an EPIC row to expand or
 * collapse its children. When `onResizeStart` is provided and the column is
 * expanded, a 4 px draggable handle sits on the right edge so PMs can dial
 * the column width to taste (persisted by the parent).
 */
export default function TimelineLabelColumn({
  rows,
  groupBy,
  projectKey,
  rowHeight,
  width,
  collapsed,
  isResizing,
  onToggleCollapsed,
  onSelectIssue,
  onToggleEpic,
  onResizeStart,
}: TimelineLabelColumnProps) {
  return (
    <div
      className={cn(
        'shrink-0 sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        // Skip the width transition while the user is actively dragging — otherwise the column lags behind the cursor.
        !isResizing && 'transition-[width] duration-200',
      )}
      style={{ width }}
    >
      <div className="sticky top-0 z-20 h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 flex items-center justify-between">
        {!collapsed && (
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-1">
            Issues
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand issues column' : 'Collapse issues column'}
          className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {rows.map((row, idx) => (
        <LabelRow
          key={rowKey(row, idx)}
          row={row}
          groupBy={groupBy}
          projectKey={projectKey}
          rowHeight={rowHeight}
          collapsed={collapsed}
          onSelectIssue={onSelectIssue}
          onToggleEpic={onToggleEpic}
        />
      ))}

      {/* Right-edge resize handle — only when expanded and parent wired the callback. */}
      {!collapsed && onResizeStart && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Issues column"
          onMouseDown={onResizeStart}
          className={cn(
            'absolute top-0 right-0 h-full w-1 cursor-col-resize z-30',
            'after:absolute after:top-0 after:right-0 after:h-full after:w-px after:transition-colors',
            isResizing
              ? 'after:bg-primary-500'
              : 'after:bg-transparent hover:after:bg-primary-500/60',
          )}
          title="Drag to resize"
        />
      )}
    </div>
  )
}

function rowKey(row: TimelineRow, idx: number): string {
  switch (row.kind) {
    case 'epic': return `epic-${row.epic.id}`
    case 'no-epic': return `no-epic-${idx}`
    case 'group': return `group-${row.label}-${idx}`
    case 'issue': return `issue-${row.issue.id}`
  }
}

function LabelRow({
  row,
  groupBy,
  projectKey,
  rowHeight,
  collapsed,
  onSelectIssue,
  onToggleEpic,
}: {
  row: TimelineRow
  groupBy: GroupBy
  projectKey: string | undefined
  rowHeight: number
  collapsed: boolean
  onSelectIssue: (issue: Issue) => void
  onToggleEpic: (key: string) => void
}) {
  if (row.kind === 'group') {
    return (
      <div
        className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-3"
        style={{ height: rowHeight }}
      >
        {!collapsed && (
          <>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {groupBy === 'type' ? `${TYPE_ICONS[row.label] || ''} ${row.label.replace(/_/g, ' ')}` : row.label}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({row.count})</span>
          </>
        )}
      </div>
    )
  }

  if (row.kind === 'no-epic') {
    const Chev = row.collapsed ? ChevronRight : ChevronDown
    return (
      <button
        onClick={() => onToggleEpic(NO_EPIC_KEY)}
        title={collapsed ? `No Epic (${row.childCount})` : undefined}
        className="flex w-full items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        style={{ height: rowHeight }}
      >
        <Chev className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
        {!collapsed && (
          <>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">No Epic</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({row.childCount})</span>
          </>
        )}
      </button>
    )
  }

  if (row.kind === 'epic') {
    const Chev = row.collapsed ? ChevronRight : ChevronDown
    const e = row.epic
    return (
      <div
        className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20 px-1.5 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
        style={{ height: rowHeight }}
        onClick={() => onSelectIssue(e)}
        title={collapsed ? `${projectKey}-${e.number} · ${e.title}` : undefined}
      >
        <button
          onClick={(ev) => { ev.stopPropagation(); onToggleEpic(e.id) }}
          className="shrink-0 rounded p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800/40"
          aria-label={row.collapsed ? 'Expand' : 'Collapse'}
        >
          <Chev className="h-3.5 w-3.5 text-primary-700 dark:text-primary-300" />
        </button>
        <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[e.status])} />
        {!collapsed && (
          <>
            <span className="text-xs font-mono text-primary-700 dark:text-primary-300 shrink-0">
              {projectKey}-{e.number}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex-1">{e.title}</span>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{row.childCount}</span>
          </>
        )}
      </div>
    )
  }

  // issue row
  const issue = row.issue
  return (
    <div
      className="flex items-center border-b border-gray-100 dark:border-gray-700 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
      style={{ height: rowHeight, paddingLeft: collapsed ? 8 : 12 + row.indent * 18 }}
      onClick={() => onSelectIssue(issue)}
      title={collapsed ? `${projectKey}-${issue.number} · ${issue.title}` : undefined}
    >
      <div className={cn('h-2 w-2 shrink-0 rounded-full mr-2', STATUS_COLORS[issue.status])} />
      {!collapsed && (
        <>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mr-1.5 shrink-0">
            {projectKey}-{issue.number}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
        </>
      )}
    </div>
  )
}
