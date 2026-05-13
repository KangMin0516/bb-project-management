import { useQuery } from '@tanstack/react-query'
import { issueApi } from '@/features/issue/api'
import { projectApi } from '@/features/project/api'

export function useBoardData(projectId: string, showArchived: boolean) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId),
    enabled: !!projectId,
  })

  const boardQuery = useQuery({
    queryKey: ['board', projectId, showArchived],
    queryFn: () => issueApi.board(projectId, showArchived ? { includeArchived: true } : undefined),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
  }
}
