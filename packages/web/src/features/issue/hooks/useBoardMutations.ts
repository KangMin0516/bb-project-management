import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

type BoardCache = Record<string, Issue[]>

/** Board-specific mutations: drag-drop reorder + status/parent updates from sub-task toggles. */
export function useBoardMutations(projectId: string) {
  const queryClient = useQueryClient()
  // Prefix only — the full key in useBoardData is ['board', projectId, showArchived]
  // so we use setQueriesData / queryFilter so both archived/unarchived caches stay
  // in sync regardless of which one is currently mounted.
  const boardKeyPrefix = ['board', projectId] as const
  const invalidate = () => queryClient.invalidateQueries({ queryKey: boardKeyPrefix })

  /**
   * Apply (issueId, status, order) and optionally parentId to the board
   * cache so the dropped card stays put while the request is in flight.
   * Without this, hello-pangea/dnd resets the drag overlay before our
   * cache catches up and the card visibly snaps back to its source
   * column before jumping again on refetch — that's the "jitter".
   */
  const buildOptimistic = (
    issueId: string,
    nextStatus: string,
    nextOrder: number,
    nextParentId?: string | null,
  ) => (prev: BoardCache | undefined): BoardCache | undefined => {
    if (!prev) return prev
    let moved: Issue | undefined
    const next: BoardCache = {}
    for (const [status, issues] of Object.entries(prev)) {
      const filtered: Issue[] = []
      for (const issue of issues) {
        if (issue.id === issueId) moved = issue
        else filtered.push(issue)
      }
      next[status] = filtered
    }
    if (!moved) return prev
    const updated: Issue = {
      ...moved,
      status: nextStatus,
      order: nextOrder,
      ...(nextParentId !== undefined ? { parentId: nextParentId } : null),
    }
    const bucket = next[nextStatus] ? [...next[nextStatus]] : []
    bucket.push(updated)
    bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    next[nextStatus] = bucket
    return next
  }

  /** Snapshot every cache entry matching the board prefix so we can roll back if the mutation fails. */
  const snapshotBoards = () =>
    queryClient.getQueriesData<BoardCache>({ queryKey: boardKeyPrefix })

  const restoreBoards = (snapshot: ReturnType<typeof snapshotBoards>) => {
    for (const [key, data] of snapshot) {
      queryClient.setQueryData(key, data)
    }
  }

  const reorder = useMutation({
    mutationFn: (args: { issueId: string; status: string; order: number }) =>
      issueRepository.reorder(projectId, args.issueId, { status: args.status, order: args.order }),
    onMutate: async ({ issueId, status, order }) => {
      await queryClient.cancelQueries({ queryKey: boardKeyPrefix })
      const prev = snapshotBoards()
      queryClient.setQueriesData<BoardCache>(
        { queryKey: boardKeyPrefix },
        buildOptimistic(issueId, status, order),
      )
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) restoreBoards(ctx.prev)
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder issue'), 'error')
    },
    onSettled: invalidate,
  })

  const updateIssue = useMutation({
    mutationFn: (args: { issueId: string; data: { status?: string; parentId?: string | null } }) =>
      issueRepository.update(projectId, args.issueId, args.data),
    onMutate: async ({ issueId, data }) => {
      if (data.status === undefined && data.parentId === undefined) return { prev: undefined }
      await queryClient.cancelQueries({ queryKey: boardKeyPrefix })
      const prev = snapshotBoards()
      // Find the issue's current status/order in any board cache so we can
      // build the optimistic update — companion reorder mutation owns the
      // exact order; here we just preserve it.
      let current: Issue | undefined
      for (const [, cache] of prev) {
        if (!cache) continue
        for (const issues of Object.values(cache)) {
          const hit = issues.find((i) => i.id === issueId)
          if (hit) { current = hit; break }
        }
        if (current) break
      }
      if (!current) return { prev }
      queryClient.setQueriesData<BoardCache>(
        { queryKey: boardKeyPrefix },
        buildOptimistic(
          issueId,
          data.status ?? current.status,
          current.order ?? 0,
          data.parentId,
        ),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) restoreBoards(ctx.prev)
    },
    onSettled: invalidate,
  })

  return { reorder, updateIssue }
}
