import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'
import type { BoardQueryParams } from '@/features/issue/api'

export function useBoardData(projectId: string, params: BoardQueryParams = {}) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  const boardQuery = useQuery({
    queryKey: ['board', projectId, params],
    queryFn: () => issueRepository.findBoardLayout(projectId, params),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
  }
}
