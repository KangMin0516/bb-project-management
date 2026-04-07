import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Issue } from '@/api/issues'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge } from '@/lib/time'

interface TreeNode {
  issue: Issue
  children: TreeNode[]
}

interface TreeGroup {
  id: string
  label: string
  icon: string
  count: number
  nodes: TreeNode[]
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

  // Count all descendants (including nested)
  function countDescendants(node: TreeNode): number {
    let count = node.children.length
    for (const child of node.children) {
      count += countDescendants(child)
    }
    return count
  }

  // Group: Epics with their descendants
  const epicGroups: TreeGroup[] = []
  const standaloneNodes: TreeNode[] = []

  for (const issue of rootIssues) {
    const node = buildNode(issue)
    if (issue.type === 'EPIC') {
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

  // Epics with no children still show as a group with themselves as content
  for (const group of epicGroups) {
    if (group.count === 0) {
      // Epic with no children — show itself
      const epicIssue = issues.find((i) => i.id === group.id)!
      group.nodes = [{ issue: epicIssue, children: [] }]
      group.count = 1
    }
  }

  const groups: TreeGroup[] = [...epicGroups]

  if (standaloneNodes.length > 0) {
    groups.push({
      id: '__standalone__',
      label: 'Standalone Tasks',
      icon: '📝',
      count: standaloneNodes.length,
      nodes: standaloneNodes,
    })
  }

  return groups
}

export default function IssueTreeView({
  issues,
  projectKey,
  onIssueClick,
}: {
  issues: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
}) {
  const groups = useMemo(() => buildTree(issues), [issues])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-400">
        No issues found
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id)
        return (
          <div key={group.id}>
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center gap-2 bg-gray-50 px-6 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
              <span>{group.icon}</span>
              <span className="truncate">{group.label}</span>
              <span className="ml-1 text-xs text-gray-400">({group.count})</span>
            </button>

            {/* Group content */}
            {!isCollapsed && (
              <div>
                {group.nodes.map((node) => (
                  <TreeNodeRow
                    key={node.issue.id}
                    node={node}
                    depth={0}
                    projectKey={projectKey}
                    onIssueClick={onIssueClick}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  projectKey,
  onIssueClick,
}: {
  node: TreeNode
  depth: number
  projectKey: string
  onIssueClick: (issue: Issue) => void
}) {
  const { issue, children } = node
  const badge = getDueBadge(issue.dueDate)
  const paddingLeft = 24 + depth * 24 // base 24px + 24px per depth level

  return (
    <>
      <div
        onClick={() => onIssueClick(issue)}
        className="grid cursor-pointer items-center gap-x-2 py-2 pr-6 hover:bg-gray-50 transition-colors"
        style={{
          paddingLeft,
          gridTemplateColumns: 'auto 56px 1fr 88px 64px 56px 48px',
        }}
      >
        {/* Tree connector for sub-items */}
        {depth > 0 && (
          <span className="text-gray-300 text-xs">└</span>
        )}

        {/* ID */}
        <span className={`font-mono text-xs text-gray-400 ${depth > 0 ? '' : 'col-start-2'}`}>
          {projectKey}-{issue.number}
        </span>

        {/* Type icon + Title */}
        <span className="min-w-0 truncate text-sm text-gray-900">
          <span className="mr-1 text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
          {issue.title}
        </span>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
          <span className="text-xs text-gray-500 truncate">{issue.status.replace(/_/g, ' ')}</span>
        </div>

        {/* Priority */}
        <span className={cn('justify-self-center rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
          {issue.priority}
        </span>

        {/* Assignee */}
        <span className="truncate text-xs text-gray-600 text-right">
          {issue.assignee?.name || '-'}
        </span>

        {/* Due badge */}
        <span className="text-right">
          {badge && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
              {badge.text}
            </span>
          )}
        </span>
      </div>

      {/* Render children recursively */}
      {children.map((child) => (
        <TreeNodeRow
          key={child.issue.id}
          node={child}
          depth={depth + 1}
          projectKey={projectKey}
          onIssueClick={onIssueClick}
        />
      ))}
    </>
  )
}
