import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult } from '@/api/search'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import {
  Search, X, Plus, LayoutDashboard, List, BarChart3,
  Settings, FileText, Keyboard, FolderKanban,
} from 'lucide-react'
import { useShortcutsStore } from '@/stores/shortcuts'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  section: 'actions' | 'pages'
  handler: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { projectId } = useParams()

  // Debounced query
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [] } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi.issues(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setDebouncedQuery('')
      setActiveIndex(0)
    }
  }, [open])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [results, query])

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  const handleSelect = useCallback((result: SearchResult) => {
    close()
    navigate(`/projects/${result.project.key}/lists`, { state: { selectedIssueId: result.id } })
  }, [navigate, close])

  // Build quick actions
  const quickActions: QuickAction[] = []

  if (projectId) {
    quickActions.push(
      { id: 'create-issue', label: 'Create Issue', icon: <Plus className="h-4 w-4" />, section: 'actions', handler: () => { close(); /* CreateIssueModal is handled per-page */ } },
    )
  }

  // Pages section
  if (projectId) {
    quickActions.push(
      { id: 'go-board', label: 'Go to Board', icon: <FolderKanban className="h-4 w-4" />, section: 'pages', handler: () => { close(); navigate(`/projects/${projectId}/board`) } },
      { id: 'go-issues', label: 'Go to Issues', icon: <List className="h-4 w-4" />, section: 'pages', handler: () => { close(); navigate(`/projects/${projectId}/lists`) } },
      { id: 'go-dashboard', label: 'Go to Dashboard', icon: <BarChart3 className="h-4 w-4" />, section: 'pages', handler: () => { close(); navigate(`/projects/${projectId}`) } },
      { id: 'go-settings', label: 'Go to Settings', icon: <Settings className="h-4 w-4" />, section: 'pages', handler: () => { close(); navigate(`/projects/${projectId}/settings`) } },
      { id: 'go-specs', label: 'Go to Specifications', icon: <FileText className="h-4 w-4" />, section: 'pages', handler: () => { close(); navigate(`/projects/${projectId}/specs`) } },
    )
  }

  quickActions.push(
    { id: 'show-shortcuts', label: 'Show Keyboard Shortcuts', icon: <Keyboard className="h-4 w-4" />, section: 'actions', handler: () => { close(); useShortcutsStore.getState().setHelpModalOpen(true) } },
  )

  // Filter quick actions by query
  const filteredActions = query.trim()
    ? quickActions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : quickActions

  const actionItems = filteredActions.filter((a) => a.section === 'actions')
  const pageItems = filteredActions.filter((a) => a.section === 'pages')

  const showQuickActions = !debouncedQuery || filteredActions.length > 0
  const totalQuickItems = filteredActions.length
  const totalItems = (debouncedQuery ? results.length : 0) + totalQuickItems

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Determine which item is selected
      if (activeIndex < totalQuickItems) {
        filteredActions[activeIndex]?.handler()
      } else {
        const resultIdx = activeIndex - totalQuickItems
        if (results[resultIdx]) handleSelect(results[resultIdx])
      }
    } else if (e.key === 'Escape') {
      close()
    }
  }

  if (!open) return null

  let runningIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={close}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search issues..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {/* Quick Actions */}
          {showQuickActions && actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Quick Actions</span>
              </div>
              {actionItems.map((action) => {
                const idx = runningIndex++
                return (
                  <button
                    key={action.id}
                    onClick={action.handler}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                      idx === activeIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <span className={cn('text-gray-400', idx === activeIndex && 'text-primary-500')}>{action.icon}</span>
                    {action.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Pages */}
          {showQuickActions && pageItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Pages</span>
              </div>
              {pageItems.map((action) => {
                const idx = runningIndex++
                return (
                  <button
                    key={action.id}
                    onClick={action.handler}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                      idx === activeIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <span className={cn('text-gray-400', idx === activeIndex && 'text-primary-500')}>{action.icon}</span>
                    {action.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Issue search results */}
          {debouncedQuery && (
            <div>
              {results.length > 0 && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Issues</span>
                </div>
              )}
              {results.length === 0 && totalQuickItems === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No results found</div>
              )}
              {results.map((result) => {
                const idx = runningIndex++
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
                      idx === activeIndex ? 'bg-primary-50' : 'hover:bg-gray-50',
                    )}
                  >
                    <span className="text-xs">{TYPE_ICONS[result.type] || '\uD83D\uDCCB'}</span>
                    <span className="font-mono text-xs text-gray-400">
                      {result.project.key}-{result.number}
                    </span>
                    <span className={cn('flex-1 truncate font-medium', idx === activeIndex ? 'text-primary-700' : 'text-gray-900')}>
                      {result.title}
                    </span>
                    <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[result.status])} />
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[result.priority])}>
                      {result.priority}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2 text-[11px] text-gray-400">
          <span className="mr-3">\u2191\u2193 Navigate</span>
          <span className="mr-3">\u21B5 Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
