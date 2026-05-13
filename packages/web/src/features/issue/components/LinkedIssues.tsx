import type { IssueLink, IssueSpecLink } from '@/features/issue/api'
import LinkedIssuesSection from '@/features/issue/components/links/LinkedIssuesSection'
import SpecRefsSection from '@/features/issue/components/links/SpecRefsSection'

interface LinkedIssuesProps {
  projectId: string
  issueId: string
  sourceLinks?: IssueLink[]
  targetLinks?: IssueLink[]
  specLinks?: IssueSpecLink[]
}

/**
 * Composition root for the issue panel's "links" area. Just stacks the
 * two sections — issue-to-issue links above, spec references below.
 */
export default function LinkedIssues({ projectId, issueId, sourceLinks, targetLinks, specLinks }: LinkedIssuesProps) {
  return (
    <div>
      <LinkedIssuesSection
        projectId={projectId}
        issueId={issueId}
        sourceLinks={sourceLinks}
        targetLinks={targetLinks}
      />
      <SpecRefsSection projectId={projectId} issueId={issueId} specLinks={specLinks} />
    </div>
  )
}
