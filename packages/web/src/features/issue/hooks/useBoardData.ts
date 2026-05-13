import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectApi } from '@/features/project/api'

export function useBoardData(projectId: string, showArchived: boolean) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId),
    enabled: !!projectId,
  })

  const boardQuery = useQuery({
    queryKey: ['board', projectId, showArchived],
    queryFn: () => issueRepository.findBoardLayout(projectId, showArchived),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
  }
}
