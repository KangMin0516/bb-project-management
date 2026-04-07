import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult } from '@/api/search'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { Search, X } from 'lucide-react'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

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

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
  }, [results])

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false)
    navigate(`/projects/${result.project.id}/issues`, { state: { selectedIssueId: result.id } })
  }, [navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
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
            placeholder="Search issues across all projects..."
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
          {debouncedQuery && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No results found</div>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
                index === activeIndex ? 'bg-primary-50' : 'hover:bg-gray-50',
              )}
            >
              <span className="text-xs">{TYPE_ICONS[result.type] || '📋'}</span>
              <span className="font-mono text-xs text-gray-400">
                {result.project.key}-{result.number}
              </span>
              <span className={cn('flex-1 truncate font-medium', index === activeIndex ? 'text-primary-700' : 'text-gray-900')}>
                {result.title}
              </span>
              <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[result.status])} />
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[result.priority])}>
                {result.priority}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2 text-[11px] text-gray-400">
            <span className="mr-3">↑↓ Navigate</span>
            <span className="mr-3">↵ Open</span>
            <span>ESC Close</span>
          </div>
        )}
      </div>
    </div>
  )
}
