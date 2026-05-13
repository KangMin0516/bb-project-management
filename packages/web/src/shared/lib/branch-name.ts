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
  if (issueType === 'BUG') return 'bug'
  return DEFAULT_PREFIX
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, '')
  )
}
