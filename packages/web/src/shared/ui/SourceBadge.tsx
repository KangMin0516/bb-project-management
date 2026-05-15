import { Sparkles, MessageSquare, Globe2, Webhook, Cog, KeyRound } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { IssueSource } from '@/features/issue/api'

interface SourceBadgeProps {
  source: IssueSource | null | undefined
  /**
   * `WEB` is the implicit common case — most rows are created in the
   * web UI, so we hide the badge by default and only render the
   * non-WEB origins (the actually-interesting metadata).
   */
  hideWhenWeb?: boolean
  className?: string
}

interface BadgeStyle {
  label: string
  className: string
  Icon: React.ComponentType<{ className?: string }>
}

const STYLES: Record<IssueSource, BadgeStyle> = {
  WEB: {
    label: 'Web',
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-400',
    Icon: Globe2,
  },
  MCP: {
    label: 'MCP',
    className:
      'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    Icon: Sparkles,
  },
  SLACK: {
    label: 'Slack',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    Icon: MessageSquare,
  },
  WEBHOOK: {
    label: 'Webhook',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Icon: Webhook,
  },
  API: {
    label: 'API',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Icon: KeyRound,
  },
  SYSTEM: {
    label: 'System',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Icon: Cog,
  },
}

/**
 * Small pill showing which client (Web / MCP / Slack / Webhook / API /
 * System) produced a row. Co-locates icon + colour per source so call
 * sites only need `<SourceBadge source={...} />`.
 */
export default function SourceBadge({
  source,
  hideWhenWeb = true,
  className,
}: SourceBadgeProps) {
  if (!source) return null
  if (hideWhenWeb && source === 'WEB') return null
  const style = STYLES[source] ?? STYLES.API
  const { Icon, label } = style
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        style.className,
        className,
      )}
      title={`Created via ${label}`}
    >
      <Icon className="h-3 w-3" />
      via {label}
    </span>
  )
}
