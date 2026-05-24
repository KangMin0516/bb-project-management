import type { SpecProgressSummary } from '@/features/specification/lib/itemStatus'

interface SpecProgressBarProps {
  summary: SpecProgressSummary
  /** "compact" hides the legend (used in Rollup row); "detailed" shows DONE / IN_PROG / BACKLOG counts. */
  variant?: 'compact' | 'detailed'
}

/**
 * Stacked status bar — width segments are proportional to count, colours
 * mirror `ITEM_STATUS_DOT_CLASS`. Renders nothing when total is 0 so we
 * don't show a misleading "0/0" with a flat empty bar.
 */
export default function SpecProgressBar({ summary, variant = 'detailed' }: SpecProgressBarProps) {
  const { total, done, inProgress, backlog, unplanned } = summary
  if (total === 0) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {variant === 'detailed' ? 'No tracked items yet' : '—'}
      </span>
    )
  }
  const pct = (n: number) => (n / total) * 100
  return (
    <div className={variant === 'detailed' ? 'flex flex-col gap-1' : 'flex items-center gap-2'}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        {done > 0 && (
          <div className="h-full bg-emerald-500" style={{ width: `${pct(done)}%` }} />
        )}
        {inProgress > 0 && (
          <div className="h-full bg-amber-500" style={{ width: `${pct(inProgress)}%` }} />
        )}
        {backlog > 0 && (
          <div className="h-full bg-gray-400 dark:bg-gray-500" style={{ width: `${pct(backlog)}%` }} />
        )}
        {unplanned > 0 && (
          <div
            className="h-full bg-gray-300 dark:bg-gray-600"
            style={{ width: `${pct(unplanned)}%` }}
          />
        )}
      </div>
      {variant === 'detailed' ? (
        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {done} / {total} done
          </span>
          {inProgress > 0 && <span>{inProgress} in progress</span>}
          {backlog > 0 && <span>{backlog} backlog</span>}
          {unplanned > 0 && <span>{unplanned} unplanned</span>}
        </div>
      ) : (
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-gray-600 dark:text-gray-400">
          {done}/{total}
        </span>
      )}
    </div>
  )
}
