import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type StandupReportEntry } from '@/features/dashboard/api'

const REFETCH_INTERVAL = 60_000

export function useTeamDashboard(enabled: boolean) {
  const query = useQuery({
    queryKey: ['team-dashboard'],
    queryFn: dashboardApi.getTeamDashboard,
    refetchInterval: REFETCH_INTERVAL,
    enabled,
  })

  /**
   * Group standup reports by the systemUser they map to so the row
   * components can look up their entry in O(1).
   */
  const standupByUserId = useMemo(() => {
    const map = new Map<string, StandupReportEntry[]>()
    for (const r of query.data?.standup?.reports ?? []) {
      if (!r.systemUser) continue
      const uid = r.systemUser.id
      if (!map.has(uid)) map.set(uid, [])
      map.get(uid)!.push(r)
    }
    return map
  }, [query.data])

  return { data: query.data, isLoading: query.isLoading, standupByUserId }
}
