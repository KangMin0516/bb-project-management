import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'

export function useBoardData(projectId: string, showArchived: boolean, sort?: string, search?: string) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId),
    enabled: !!projectId,
  })

  const boardQuery = useQuery({
    queryKey: ['board', projectId, showArchived, sort ?? '', search ?? ''],
    queryFn: () => issueRepository.findBoardLayout(projectId, { includeArchived: showArchived, sort, search }),
    enabled: !!projectId,
  })

  return {
    project: projectQuery.data,
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
  }
}
