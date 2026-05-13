import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { standupApi } from '@/features/standup/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

export function useStandupQuestions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['standup-questions'] })

  const query = useQuery({ queryKey: ['standup-questions'], queryFn: standupApi.listQuestions })

  const create = useMutation({
    mutationFn: (data: { text: string; order: number }) => standupApi.createQuestion(data),
    onSuccess: invalidate,
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => standupApi.deleteQuestion(id),
    onSuccess: invalidate,
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  return { questions: query.data ?? [], create, remove }
}
