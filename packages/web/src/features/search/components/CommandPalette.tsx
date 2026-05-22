import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type GlobalSearchResult } from '@/features/search/api'
import { DEBOUNCE_DELAY } from '@/shared/config/constants'
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

  // PM-80: global cross-project search — issues + comments + specs.
  const { data: globalResults = [] } = useQuery({
    queryKey: ['search-all', debouncedQuery],
    queryFn: () => searchApi.all(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
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

  const handleGlobalSelect = useCallback((r: GlobalSearchResult) => {
    close()
    switch (r.kind) {
      case 'issue':
        navigate(`/projects/${r.projectKey}/board?open=${r.id}`)
        break
      case 'comment':
        // Open the parent issue's detail panel; comment scroll is Phase 2.
        navigate(`/projects/${r.projectKey}/board?open=${r.id}`)
        break
      case 'spec':
        navigate(`/projects/${r.projectKey}/specs`, { state: { selectedSpecId: r.id } })
        break
    }
  }, [navigate, close])

  // Bucket global results by kind so each gets its own CommandGroup.
  const issueHits = globalResults.filter((r) => r.kind === 'issue').slice(0, 5)
  const commentHits = globalResults.filter((r) => r.kind === 'comment').slice(0, 5)
  const specHits = globalResults.filter((r) => r.kind === 'spec').slice(0, 5)

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

        {debouncedQuery && issueHits.length > 0 && (
          <CommandGroup heading="Issues">
            {issueHits.map((r) => (
              <CommandItem
                key={`issue-${r.id}`}
                value={`${r.projectKey}-${r.issueNumber} ${r.title} ${query}`}
                onSelect={() => handleGlobalSelect(r)}
              >
                <span className="text-xs">📋</span>
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                  {r.projectKey}-{r.issueNumber}
                </span>
                <span className="flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
                  {r.title}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {debouncedQuery && commentHits.length > 0 && (
          <CommandGroup heading="Comments">
            {commentHits.map((r) => (
              <CommandItem
                key={`comment-${r.id}`}
                value={`${r.projectKey}-${r.issueNumber} ${r.snippet} ${query}`}
                onSelect={() => handleGlobalSelect(r)}
              >
                <span className="text-xs">💬</span>
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                  {r.projectKey}-{r.issueNumber}
                </span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                  {r.snippet}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {debouncedQuery && specHits.length > 0 && (
          <CommandGroup heading="Specs">
            {specHits.map((r) => (
              <CommandItem
                key={`spec-${r.id}`}
                value={`${r.title} ${r.snippet} ${query}`}
                onSelect={() => handleGlobalSelect(r)}
              >
                <span className="text-xs">📄</span>
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                  {r.projectKey}
                </span>
                <span className="flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
                  {r.title}
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
