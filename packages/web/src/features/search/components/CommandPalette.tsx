import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult } from '@/features/search/api'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS, DEBOUNCE_DELAY } from '@/shared/config/constants'
import {
  Plus, List, BarChart3,
  Settings, FileText, Keyboard, FolderKanban,
} from 'lucide-react'
import { useShortcutsStore } from '@/shared/lib/shortcuts'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'

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
  const navigate = useNavigate()
  const { projectId } = useParams()

  // Debounced query — only used to gate the backend issue search.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_DELAY)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [] } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi.issues(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  // Reset query when the palette opens — `open` is owned by the parent
  // so this is the right boundary for re-syncing local state.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

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

  const actionItems = quickActions.filter((a) => a.section === 'actions')
  const pageItems = quickActions.filter((a) => a.section === 'pages')

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-w-lg top-[20vh] translate-y-0"
      title="Command Palette"
      description="Type a command or search issues"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command or search issues..."
      />
      <CommandList>
        <CommandEmpty>No results found</CommandEmpty>

        {actionItems.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {actionItems.map((action) => (
              <CommandItem
                key={action.id}
                value={action.label}
                onSelect={action.handler}
              >
                <span className="text-gray-400 dark:text-gray-500">{action.icon}</span>
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {pageItems.length > 0 && (
          <CommandGroup heading="Pages">
            {pageItems.map((action) => (
              <CommandItem
                key={action.id}
                value={action.label}
                onSelect={action.handler}
              >
                <span className="text-gray-400 dark:text-gray-500">{action.icon}</span>
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {debouncedQuery && results.length > 0 && (
          <CommandGroup heading="Issues">
            {results.map((result) => (
              <CommandItem
                key={result.id}
                // Force-include backend hit regardless of cmdk's local filter.
                value={`${result.project.key}-${result.number} ${result.title} ${query}`}
                onSelect={() => handleSelect(result)}
              >
                <span className="text-xs">{TYPE_ICONS[result.type] || '📋'}</span>
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                  {result.project.key}-{result.number}
                </span>
                <span className="flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
                  {result.title}
                </span>
                <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[result.status])} />
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[result.priority])}>
                  {result.priority}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span className="mr-3">↑↓ Navigate</span>
        <span className="mr-3">↵ Open</span>
        <span>ESC Close</span>
      </div>
    </CommandDialog>
  )
}
