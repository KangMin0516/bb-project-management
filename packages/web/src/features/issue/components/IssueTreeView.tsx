import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge } from '@/shared/lib/time'

interface TreeNode {
  issue: Issue
  children: TreeNode[]
}

interface FlatNode {
  issue: Issue
  /** Indent depth relative to the group root (0 = first row inside the group). */
  depth: number
}

interface TreeGroup {
  id: string
  label: string
  icon: string
  count: number
  nodes: TreeNode[]
}

function flattenNodes(nodes: TreeNode[], depth = 0): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({ issue: node.issue, depth })
    result.push(...flattenNodes(node.children, depth + 1))
  }
  return result
}

function buildTree(issues: Issue[]): TreeGroup[] {
  const issueMap = new Map<string, Issue>()
  for (const issue of issues) {
    issueMap.set(issue.id, issue)
  }

  // Build parent-child relationships
  const childrenMap = new Map<string, Issue[]>()
  const rootIssues: Issue[] = []

  for (const issue of issues) {
    if (issue.parentId && issueMap.has(issue.parentId)) {
      const siblings = childrenMap.get(issue.parentId) || []
      siblings.push(issue)
      childrenMap.set(issue.parentId, siblings)
    } else {
      rootIssues.push(issue)
    }
  }

  function buildNode(issue: Issue): TreeNode {
    const children = (childrenMap.get(issue.id) || []).map(buildNode)
    return { issue, children }
  }

  // Count visible rows under a node (all descendants, recursively).
  // Excludes the node itself — the group header already represents it.
  function countDescendants(node: TreeNode): number {
    let count = node.children.length
    for (const child of node.children) {
      count += countDescendants(child)
    }
    return count
  }

  // Three buckets aligned with the 4-level hierarchy:
  //   1. Module groups (DOMAIN as group header, Epics inside, Tasks deeper)
  //   2. Standalone Epic groups (Epic without Module parent)
  //   3. Standalone Tasks (Tasks / Bugs without Epic parent)
  const moduleGroups: TreeGroup[] = []
  const epicGroups: TreeGroup[] = []
  const standaloneNodes: TreeNode[] = []

  for (const issue of rootIssues) {
    const node = buildNode(issue)
    if (issue.type === 'DOMAIN') {
      moduleGroups.push({
        id: issue.id,
        label: issue.title,
        icon: TYPE_ICONS.DOMAIN || '📁',
        count: countDescendants(node),
        // Module's children (Epics) become the visible rows; the Module
        // itself lives in the group header so we don't double-render it.
        nodes: node.children,
      })
    } else if (issue.type === 'EPIC') {
      epicGroups.push({
        id: issue.id,
        label: issue.title,
        icon: TYPE_ICONS.EPIC || '⚡',
        count: countDescendants(node),
        nodes: node.children.length > 0 ? node.children : [node],
      })
    } else {
      standaloneNodes.push(node)
    }
  }

  // Empty Epic groups still render the Epic itself so the user can
  // open / drag it. Empty Module groups stay header-only.
  for (const group of epicGroups) {
    if (group.count === 0) {
      const epicIssue = issues.find((i) => i.id === group.id)!
      group.nodes = [{ issue: epicIssue, children: [] }]
      group.count = 1
    }
  }

  const groups: TreeGroup[] = [...moduleGroups, ...epicGroups]

  if (standaloneNodes.length > 0) {
    // Recursive count so the badge reflects every visible row (sub-tasks
    // included), not just the root standalones.
    const totalStandalone = standaloneNodes.reduce(
      (sum, n) => sum + 1 + countDescendants(n),
      0,
    )
    groups.push({
      id: '__standalone__',
      label: 'Standalone Tasks',
      icon: '📝',
      count: totalStandalone,
      nodes: standaloneNodes,
    })
  }

  return groups
}

export default function IssueTreeView({
  issues,
  projectKey,
  onIssueClick,
  onEpicChange,
}: {
  issues: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onEpicChange?: (issueId: string, newParentId: string | null) => void
}) {
  const groups = useMemo(() => buildTree(issues), [issues])
  const issueMap = useMemo(() => {
    const map = new Map<string, Issue>()
    for (const issue of issues) map.set(issue.id, issue)
    return map
  }, [issues])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !onEpicChange) return

    const issueId = result.draggableId
    const destGroupId = result.destination.droppableId
    const sourceGroupId = result.source.droppableId

    // Same group — no change
    if (destGroupId === sourceGroupId) return

    // Don't allow dragging epics / modules themselves — re-parenting an
    // Epic to a different Module uses the bulk-assign UI / detail panel.
    const draggedIssue = issues.find((i) => i.id === issueId)
    if (!draggedIssue || draggedIssue.type === 'EPIC' || draggedIssue.type === 'DOMAIN') return

    // Cross-Module drops don't change Task parent (Task's parent is an
    // Epic, not a Module); skip when the destination is a Module group.
    const destGroup = groups.find((g) => g.id === destGroupId)
    if (destGroup && issueMap.get(destGroupId)?.type === 'DOMAIN') return

    const newParentId = destGroupId === '__standalone__' ? null : destGroupId
    onEpicChange(issueId, newParentId)
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-400 dark:text-gray-500">
        No issues found
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.id)
          const flatIssues = flattenNodes(group.nodes)
          return (
            <div key={group.id}>
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-gray-100 dark:bg-gray-700/80 px-6 py-2.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                )}
                <span>{group.icon}</span>
                <span className="truncate">{group.label}</span>
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({group.count})</span>
              </button>

              {/* Group content — droppable zone */}
              <Droppable droppableId={group.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'transition-colors',
                      isCollapsed && 'min-h-[4px]',
                      snapshot.isDraggingOver && 'bg-primary-50/60',
                    )}
                  >
                    {!isCollapsed &&
                      flatIssues.map(({ issue, depth }, index) => {
                        const isEpicSelf = issue.type === 'EPIC' && issue.id === group.id
                        return (
                          <Draggable
                            key={issue.id}
                            draggableId={issue.id}
                            index={index}
                            isDragDisabled={isEpicSelf}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => onIssueClick(issue)}
                                className={cn(
                                  'grid cursor-pointer items-center gap-x-2 py-2.5 pr-6 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                                  dragSnapshot.isDragging && 'bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50 rounded ring-1 ring-primary-300 border-transparent',
                                  isEpicSelf && 'opacity-50',
                                )}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  paddingLeft: 24 + depth * 24,
                                  gridTemplateColumns: 'auto 56px 1fr 88px 64px 56px 48px',
                                }}
                              >
                                {depth > 0 && (
                                  <span className="text-gray-300 text-xs">└</span>
                                )}
                                <span className={`font-mono text-xs text-gray-400 dark:text-gray-500 ${depth > 0 ? '' : 'col-start-2'}`}>
                                  {projectKey}-{issue.number}
                                </span>
                                <span className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
                                  <span className="mr-1 text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
                                  {issue.title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{issue.status.replace(/_/g, ' ')}</span>
                                </div>
                                <span className={cn('justify-self-center rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                                  {issue.priority}
                                </span>
                                <div className="flex items-center justify-end gap-1.5">
                                  {issue.assignee ? (
                                    <>
                                      <div
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-[9px] font-medium text-primary-700 dark:text-primary-300 overflow-hidden"
                                        title={issue.assignee.name}
                                      >
                                        {issue.assignee.avatar ? (
                                          <img src={issue.assignee.avatar} alt={issue.assignee.name} className="h-full w-full object-cover" />
                                        ) : (
                                          issue.assignee.name.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                      <span className="truncate text-xs text-gray-600 dark:text-gray-500">{issue.assignee.name}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </div>
                                <span className="text-right">
                                  {getDueBadge(issue.dueDate) && (
                                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', getDueBadge(issue.dueDate)!.className)}>
                                      {getDueBadge(issue.dueDate)!.text}
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
