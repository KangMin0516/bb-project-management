import { TYPE_ICONS } from '@/shared/config/constants'

interface IssueTypeIconProps {
  type: string
  /** Fallback character when the type is unknown. Default ⚡. */
  fallback?: string
}

export default function IssueTypeIcon({ type, fallback = '' }: IssueTypeIconProps) {
  return <span aria-label={`Type: ${type}`}>{TYPE_ICONS[type] || fallback}</span>
}
