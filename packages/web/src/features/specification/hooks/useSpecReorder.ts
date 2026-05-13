import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { DropResult } from '@hello-pangea/dnd'
import { specApi, type SpecListItem } from '@/features/specification/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

/**
 * Reorders specs within a category via drag-drop. Performs an optimistic
 * cache update first, then PATCHes only the items whose order actually
 * changed. A failed PATCH still triggers a final invalidate so the UI
 * snaps back to server truth.
 */
export function useSpecReorder(projectId: string, specs: SpecListItem[] | undefined) {
  const queryClient = useQueryClient()

  return useCallback((result: DropResult) => {
    if (!projectId) return
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    const category = source.droppableId
    const current = specs ?? []
    const sameCat = current.filter((s) => (s.category || 'Uncategorized') === category)
    const reordered = [...sameCat]
    const [moved] = reordered.splice(source.index, 1)
    reordered.splice(destination.index, 0, moved)

    queryClient.setQueryData<SpecListItem[]>(['specifications', projectId], (old) => {
      if (!old) return old
      const newByOrder = reordered.map((s, i) => ({ ...s, order: i }))
      const newIds = new Set(newByOrder.map((s) => s.id))
      const result: SpecListItem[] = []
      let inserted = false
      for (const s of old) {
        const cat = s.category || 'Uncategorized'
        if (cat === category) {
          if (!inserted) {
            result.push(...newByOrder)
            inserted = true
          }
          continue
        }
        if (!newIds.has(s.id)) result.push(s)
      }
      if (!inserted) result.push(...newByOrder)
      return result
    })

    Promise.all(
      reordered.map((spec, idx) => (spec.order === idx ? null : specApi.update(projectId, spec.id, { order: idx }))),
    )
      .catch((err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder')))
      .finally(() => queryClient.invalidateQueries({ queryKey: ['specifications', projectId] }))
  }, [projectId, specs, queryClient])
}
