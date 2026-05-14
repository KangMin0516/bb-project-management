import type { TeamMember } from '@/features/dashboard/api'

export type StatusIndicator = 'active' | 'light' | 'idle' | 'overloaded'

/**
 * Strategy table for the member-status indicator. `order` controls the
 * "sort by status" key — overloaded first so the most attention-grabbing
 * cases bubble up.
 */
export const STATUS_CONFIG: Record<StatusIndicator, { dot: string; label: string; order: number; tooltip: string }> = {
  overloaded: { dot: 'bg-orange-500', label: 'Overloaded', order: 0, tooltip: '활성 이슈 15개 초과 — 업무 과부하 상태' },
  active:     { dot: 'bg-green-500',  label: 'Active',     order: 1, tooltip: '진행 중 이슈가 있고 24시간 내 활동 있음' },
  light:      { dot: 'bg-yellow-500', label: 'Light',      order: 2, tooltip: '활성 이슈 2개 이하이거나 진행 중 이슈 없음' },
  idle:       { dot: 'bg-red-500',    label: 'Idle',       order: 3, tooltip: '24시간 내 활동 없음' },
}

/** Decision tree for an individual member's status pill. */
export function getMemberStatus(m: TeamMember): StatusIndicator {
  if (m.overall.totalActive > 15) return 'overloaded'
  if (m.recentActivityCount === 0) return 'idle'
  if (m.overall.totalActive <= 2 || m.today.inProgressCount === 0) return 'light'
  return 'active'
}
