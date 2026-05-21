import type { Issue, IssueSource } from '@/features/issue/api'
import type { PublicTimelineIssue } from './publicApi'

/**
 * The public payload is intentionally narrower than `Issue` (no email,
 * no description, no source flag…). The timeline hooks (`useTimelineGroups`,
 * `useTimelineRows`, `useFilteredIssues`) all consume `Issue`, so we
 * synthesise a minimal-but-valid `Issue` from each public row. Fields the
 * hooks don't read are filled with safe defaults — they're never shown to
 * the client because the public render path uses the whitelist directly.
 *
 * Important: keep this asymmetric. New `Issue` fields default to safe
 * empty values here so a hook that reads them won't crash; new
 * `PublicTimelineIssue` fields require a matching BE whitelist update
 * before they can be surfaced.
 */
export function toIssueShape(pub: PublicTimelineIssue): Issue {
  return {
    id: pub.id,
    number: pub.number,
    title: pub.title,
    description: null,
    status: pub.status,
    priority: pub.priority,
    type: pub.type,
    order: 0,
    isRecheck: false,
    startDate: pub.startDate,
    dueDate: pub.dueDate,
    focusDate: null,
    archivedAt: null,
    source: 'WEB' as IssueSource,
    // createdAt is load-bearing for the timeline lib: when an issue
    // has no startDate, `computeBarStyle` anchors the bar at
    // `createdAt` instead. Empty string here causes `new Date('')` →
    // Invalid Date → bars collapse to 8px dots (PR2 bug).
    createdAt: pub.createdAt,
    updatedAt: pub.createdAt,
    projectId: '',
    assigneeId: null,
    reviewerAssigneeId: null,
    creatorId: '',
    parentId: pub.parentId,
    assignee: pub.assignee
      ? {
          // Use the name as a stable synthetic id so timeline groupings
          // that key by `assignee.id` (e.g. "by assignee") still bucket
          // correctly without leaking the real userId.
          id: `pub:${pub.assignee.name}`,
          email: '',
          name: pub.assignee.name,
          avatar: pub.assignee.avatar,
        }
      : null,
    reviewerAssignee: null,
    creator: null,
    labels: pub.labels.map((l) => ({
      label: { id: `pub:${l.name}`, name: l.name, color: l.color },
    })),
    components: [],
    parent: null,
    _count: { children: 0 },
  }
}
