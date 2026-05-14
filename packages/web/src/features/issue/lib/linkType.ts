import type { IssueLinkType } from '@/features/issue/api'

/**
 * Strategy table for IssueLinkType: label, inverse, and display order all
 * live in one place instead of being switch-cased across components.
 *
 * `inverse` lets us render a "B is blocked by A" perspective from A's
 * point of view when we receive a targetLink (A's incoming links).
 */
interface LinkTypeStrategy {
  /** Human-readable label used in section headings ("blocks", "duplicates"). */
  label: string
  /** Opposite-direction type for incoming links. */
  inverse: IssueLinkType
}

export const LINK_TYPE_STRATEGY: Record<IssueLinkType, LinkTypeStrategy> = {
  BLOCKS:           { label: 'blocks',           inverse: 'IS_BLOCKED_BY' },
  IS_BLOCKED_BY:    { label: 'is blocked by',    inverse: 'BLOCKS' },
  RELATES_TO:       { label: 'relates to',       inverse: 'RELATES_TO' },
  DUPLICATES:       { label: 'duplicates',       inverse: 'IS_DUPLICATED_BY' },
  IS_DUPLICATED_BY: { label: 'is duplicated by', inverse: 'DUPLICATES' },
}

/** Display order in the form's <select>. Mirrors common JIRA conventions. */
export const LINK_TYPES: readonly IssueLinkType[] = [
  'BLOCKS',
  'IS_BLOCKED_BY',
  'RELATES_TO',
  'DUPLICATES',
  'IS_DUPLICATED_BY',
] as const

export function getLinkTypeLabel(type: IssueLinkType): string {
  return LINK_TYPE_STRATEGY[type].label
}

export function getInverseLinkType(type: IssueLinkType): IssueLinkType {
  return LINK_TYPE_STRATEGY[type].inverse
}
