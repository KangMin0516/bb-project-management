import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  PRIORITY_COLORS,
  STATUS_BADGE_COLORS,
  STATUS_LABELS,
  TYPE_ICONS,
  TYPE_LABELS,
} from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import type { Issue } from '@/features/issue/api'

/**
 * Read-only ticket popup for the public Timeline. Distinct from
 * `IssueDetailPanel` because that panel queries comments / activity /
 * linked-issues — all of which would defeat the public whitelist. This
 * modal shows the same fields the timeline already exposed; clicking a
 * row just brings them to the foreground in a less-cramped layout.
 */
export default function PublicIssueModal({
  issue,
  projectKey,
  onClose,
}: {
  issue: Issue
  projectKey: string
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{TYPE_ICONS[issue.type] ?? '📋'}</span>
            <span className="font-mono">{projectKey}-{issue.number}</span>
            <span>·</span>
            <span>{TYPE_LABELS[issue.type] ?? issue.type}</span>
          </div>
          <DialogTitle className="mt-1 text-base">{issue.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1 text-sm">
          <Row label="Status">
            <span
              className={cn(
                'inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium',
                STATUS_BADGE_COLORS[issue.status] ?? 'bg-gray-100 text-gray-700',
              )}
            >
              {STATUS_LABELS[issue.status] ?? issue.status}
            </span>
          </Row>
          <Row label="Priority">
            <span
              className={cn(
                'inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium',
                PRIORITY_COLORS[issue.priority] ?? 'bg-gray-100 text-gray-700',
              )}
            >
              {issue.priority}
            </span>
          </Row>
          {(issue.startDate || issue.dueDate) && (
            <Row label="Dates">
              <span className="text-gray-700">
                {formatDate(issue.startDate)} → {formatDate(issue.dueDate)}
              </span>
            </Row>
          )}
          {issue.assignee && (
            <Row label="Assignee">
              <span className="inline-flex items-center gap-1.5">
                {issue.assignee.avatar ? (
                  <img
                    src={issue.assignee.avatar}
                    alt={issue.assignee.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
                    {issue.assignee.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-gray-800">{issue.assignee.name}</span>
              </span>
            </Row>
          )}
          {issue.labels.length > 0 && (
            <Row label="Labels">
              <div className="flex flex-wrap gap-1">
                {issue.labels.map((l) => (
                  <span
                    key={l.label.id}
                    className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: l.label.color + '33',
                      color: l.label.color,
                      borderColor: l.label.color + '66',
                    }}
                  >
                    {l.label.name}
                  </span>
                ))}
              </div>
            </Row>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
