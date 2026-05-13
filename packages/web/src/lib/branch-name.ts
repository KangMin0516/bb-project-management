// Derive a git-friendly branch name from an issue.
//
// Convention: `<type>/<projectKey>-<issueNumber>-<title-slug>`
//   e.g.  feat/BBPM-1-test-abc
//         bug/BBPM-42-fix-login-redirect
//
// The type prefix is chosen from the issue's labels, falling back to "feat"
// when no label matches. Matching is case-insensitive and uses the first
// label whose normalized name appears in PREFIX_MAP — labels are iterated
// in attachment order, so users can hint by reordering them in the UI.

const PREFIX_MAP: Array<{ match: RegExp; prefix: string }> = [
  { match: /^urgent$|^hotfix$/i, prefix: 'hotfix' },
  { match: /^bug$/i, prefix: 'bug' },
  { match: /^fix$/i, prefix: 'fix' },
  { match: /^documentation$|^docs?$/i, prefix: 'docs' },
  { match: /^improvement$|^refactor$/i, prefix: 'refactor' },
  { match: /^design$/i, prefix: 'design' },
  { match: /^test$|^qa$/i, prefix: 'test' },
  { match: /^chore$|^infra$|^build$/i, prefix: 'chore' },
  { match: /^feature$|^feat$|^enhancement$/i, prefix: 'feat' },
]

const DEFAULT_PREFIX = 'feat'
const MAX_SLUG_LENGTH = 50

export interface BranchNameInput {
  projectKey: string
  issueNumber: number
  title: string
  labels: ReadonlyArray<{ name: string }>
  /** Allows the issue type to inform the prefix when no label matches. */
  issueType?: 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK'
}

export function deriveBranchName({
  projectKey,
  issueNumber,
  title,
  labels,
  issueType,
}: BranchNameInput): string {
  const prefix = pickPrefix(labels, issueType)
  const slug = slugify(title)
  const key = `${projectKey}-${issueNumber}`
  return slug ? `${prefix}/${key}-${slug}` : `${prefix}/${key}`
}

function pickPrefix(
  labels: ReadonlyArray<{ name: string }>,
  issueType: BranchNameInput['issueType'],
): string {
  for (const { name } of labels) {
    for (const { match, prefix } of PREFIX_MAP) {
      if (match.test(name)) return prefix
    }
  }
  // Fall back on issue type when no label hints at intent.
  if (issueType === 'BUG') return 'bug'
  return DEFAULT_PREFIX
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      // Strip combining diacritic marks (cà phê -> ca phe). Hangul / other scripts pass through.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      // Anything that isn't a letter, digit, or whitespace becomes a separator.
      .replace(/[^\p{L}\p{N}\s]+/gu, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      // Truncation can leave a trailing dash mid-word — clean it up.
      .replace(/-+$/g, '')
  )
}
