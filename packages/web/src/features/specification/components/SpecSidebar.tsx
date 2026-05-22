import { useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { ChevronRight, FileText, Plus, PanelLeftClose, Download } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { SpecListItem } from '@/features/specification/api'

interface SpecSidebarProps {
  projectKey: string
  specs: SpecListItem[] | undefined
  selectedId: string | null
  isLoading: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDownloadAll: () => void
  onClose: () => void
  onReorder: (result: DropResult) => void
}

/**
 * Left rail in the specs editor. Groups specs by category with collapsible
 * sections and drag-drop reordering inside a single category.
 */
export default function SpecSidebar({
  projectKey,
  specs,
  selectedId,
  isLoading,
  onSelect,
  onCreate,
  onDownloadAll,
  onClose,
  onReorder,
}: SpecSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const map = new Map<string, SpecListItem[]>()
    for (const spec of specs ?? []) {
      const cat = spec.category || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(spec)
    }
    return map
  }, [specs])

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  return (
    // Width is controlled by the outer wrapper in SpecificationsPage so the
    // collapse/expand transition animates; the inner content keeps its
    // intrinsic w-64 layout via the parent's overflow clip.
    <div className="flex h-full w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">{projectKey} Specs</h1>
        <div className="flex items-center gap-0.5">
          <IconButton onClick={onCreate} title="New specification"><Plus className="h-4 w-4" /></IconButton>
          <IconButton onClick={onDownloadAll} title="Download all as Markdown"><Download className="h-4 w-4" /></IconButton>
          <IconButton onClick={onClose} title="Close sidebar"><PanelLeftClose className="h-4 w-4" /></IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onReorder}>
            {[...grouped.entries()].map(([category, items]) => {
              const isCollapsed = collapsed.has(category)
              return (
                <div key={category} className="mb-1">
                  <CategoryHeader category={category} count={items.length} collapsed={isCollapsed} onToggle={() => toggleCollapse(category)} />
                  {!isCollapsed && (
                    <Droppable droppableId={category}>
                      {(dropProvided, dropSnapshot) => (
                        <div
                          ref={dropProvided.innerRef}
                          {...dropProvided.droppableProps}
                          className={cn('rounded transition-colors', dropSnapshot.isDraggingOver && 'bg-primary-50/40 dark:bg-primary-900/20')}
                        >
                          {items.map((spec, idx) => (
                            <Draggable key={spec.id} draggableId={spec.id} index={idx}>
                              {(dragProvided, dragSnapshot) => (
                                <SpecRow
                                  dragProvided={dragProvided}
                                  isDragging={dragSnapshot.isDragging}
                                  spec={spec}
                                  isSelected={selectedId === spec.id}
                                  onClick={() => onSelect(spec.id)}
                                />
                              )}
                            </Draggable>
                          ))}
                          {dropProvided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              )
            })}
          </DragDropContext>
        )}
        {!isLoading && (!specs || specs.length === 0) && (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No specifications yet</p>
        )}
      </div>
    </div>
  )
}

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
      title={title}
    >
      {children}
    </button>
  )
}

function CategoryHeader({ category, count, collapsed, onToggle }: { category: string; count: number; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
    >
      <ChevronRight className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-90')} />
      <span className="flex-1 text-left">{category}</span>
      <span className="text-[9px] font-normal normal-case tracking-normal">{count}</span>
    </button>
  )
}

interface DragProvided {
  innerRef: (el: HTMLDivElement | null) => void
  draggableProps: React.HTMLAttributes<HTMLDivElement>
  dragHandleProps: React.HTMLAttributes<HTMLDivElement> | null
}

function SpecRow({
  dragProvided,
  isDragging,
  spec,
  isSelected,
  onClick,
}: {
  dragProvided: DragProvided
  isDragging: boolean
  spec: SpecListItem
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      // @hello-pangea/dnd requires spreading these provided refs/props onto the
      // draggable element; the new react-hooks lint mistakes them for stale refs.
      // eslint-disable-next-line react-hooks/refs
      ref={dragProvided.innerRef}
      // eslint-disable-next-line react-hooks/refs
      {...dragProvided.draggableProps}
      // eslint-disable-next-line react-hooks/refs
      {...dragProvided.dragHandleProps}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition cursor-pointer',
        isSelected
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
        isDragging && 'shadow-lg ring-1 ring-primary-300 bg-white dark:bg-gray-800',
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
      <span className="flex-1 truncate">{spec.title}</span>
      {spec._count.comments > 0 && (
        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[9px] font-medium text-amber-600">
          {spec._count.comments}
        </span>
      )}
    </div>
  )
}
