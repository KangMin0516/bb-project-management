import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'

export function useBoardData(projectId: string, showArchived: boolean, sort?: string) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  const boardQuery = useQuery({
    queryKey: ['board', projectId, showArchived, sort ?? ''],
    queryFn: () => issueRepository.findBoardLayout(projectId, { includeArchived: showArchived, sort }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
  }
}
