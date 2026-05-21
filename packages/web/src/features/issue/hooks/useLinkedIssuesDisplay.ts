import { useMemo } from 'react'
import type { IssueLink, IssueLinkType } from '@/features/issue/api'
import { getInverseLinkType } from '@/features/issue/lib/linkType'

export interface LinkedIssueDisplay {
  linkId: string
  type: IssueLinkType
  issueId: string
  number: number
  title: string
  status: string
  priority: string
  projectKey: string
}

/**
 * Flattens `sourceLinks` + `targetLinks` into one perspective ("links
 * emanating from this issue"). Outbound links keep their `type`; inbound
 * links are flipped via the strategy table so the UI reads naturally.
 *
 * Dedupes on `(type, issueId)` to hide the symmetric-pair backend
 * artefact: when the user creates A→B with RELATES_TO, the service
 * stores both `(A,B,RELATES_TO)` and `(B,A,RELATES_TO)` (reverse of
 * RELATES_TO is itself), so naive flatten shows two identical rows.
 * Asymmetric pairs (e.g. BLOCKS / IS_BLOCKED_BY) are unaffected because
 * `getInverseLinkType` flips the inbound type, making `(type, issueId)`
 * unique. See PM-57.
 */
export function useLinkedIssuesDisplay(
  sourceLinks: IssueLink[] | undefined,
  targetLinks: IssueLink[] | undefined,
): { all: LinkedIssueDisplay[]; grouped: Map<IssueLinkType, LinkedIssueDisplay[]> } {
  const all = useMemo<LinkedIssueDisplay[]>(() => {
    const seen = new Map<string, LinkedIssueDisplay>()

    const push = (display: LinkedIssueDisplay) => {
      const key = `${display.type}::${display.issueId}`
      if (!seen.has(key)) seen.set(key, display)
    }

    for (const link of sourceLinks ?? []) {
      if (!link.targetIssue) continue
      push({
        linkId: link.id,
        type: link.type,
        issueId: link.targetIssue.id,
        number: link.targetIssue.number,
        title: link.targetIssue.title,
        status: link.targetIssue.status,
        priority: link.targetIssue.priority,
        projectKey: link.targetIssue.project.key,
      })
    }

    for (const link of targetLinks ?? []) {
      if (!link.sourceIssue) continue
      push({
        linkId: link.id,
        type: getInverseLinkType(link.type),
        issueId: link.sourceIssue.id,
        number: link.sourceIssue.number,
        title: link.sourceIssue.title,
        status: link.sourceIssue.status,
        priority: link.sourceIssue.priority,
        projectKey: link.sourceIssue.project.key,
      })
    }

    return [...seen.values()]
  }, [sourceLinks, targetLinks])

  const grouped = useMemo(() => {
    const map = new Map<IssueLinkType, LinkedIssueDisplay[]>()
    for (const item of all) {
      const list = map.get(item.type) || []
      list.push(item)
      map.set(item.type, list)
    }
    return map
  }, [all])

  return { all, grouped }
}
