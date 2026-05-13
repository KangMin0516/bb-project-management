import { useEffect, useMemo, useState } from 'react'
import { Search, BookOpen, ExternalLink, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { useOpenApiSpec, filterGroupsBySearch } from '@/features/api-docs/hooks/useOpenApiSpec'
import EndpointCard from '@/features/api-docs/components/EndpointCard'
import TagSidebar from '@/features/api-docs/components/TagSidebar'

/**
 * OpenAPI 3 viewer. Spec fetching + grouping live in the api-docs feature
 * hook; the page just owns expand/collapse + search UI and stitches the
 * sidebar + endpoint sections together.
 */
export default function ApiDocsPage() {
  const { spec, loading, error, grouped, totalEndpoints, firstTag } = useOpenApiSpec()
  const [search, setSearch] = useState('')
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    if (firstTag && expandedTags.size === 0) {
      setExpandedTags(new Set([firstTag]))
      setActiveTag(firstTag)
    }
  }, [firstTag, expandedTags.size])

  const filtered = useMemo(() => filterGroupsBySearch(grouped, search), [grouped, search])

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
    setActiveTag(tag)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error) return <ErrorState error={error} />

  return (
    <div className="flex h-full">
      <TagSidebar groups={filtered} activeTag={activeTag} onSelect={toggleTag} />

      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {spec?.info?.title || 'API Documentation'}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    v{spec?.info?.version || '1.0'} &middot; {totalEndpoints} endpoints &middot; {grouped.length} modules
                  </p>
                </div>
              </div>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Swagger UI <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search endpoints... (path, method, or description)"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setExpandedTags(new Set(filtered.map((g) => g.tag)))}
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Expand All
              </button>
              <button
                onClick={() => setExpandedTags(new Set())}
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Authentication</span>
            </div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Most endpoints require a Bearer token. Login via{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 font-mono">POST /api/auth/login</code>
              {' '}to get an access token, then include it in the{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 font-mono">Authorization: Bearer {'<token>'}</code> header.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-6 py-4 space-y-6">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No endpoints match "{search}"
            </div>
          )}

          {filtered.map((group) => (
            <section key={group.tag} id={`tag-${group.tag}`} className="scroll-mt-36">
              <button onClick={() => toggleTag(group.tag)} className="flex w-full items-center gap-2 mb-3 text-left group">
                {expandedTags.has(group.tag)
                  ? <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {group.tag}
                </h2>
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {group.endpoints.length}
                </span>
                {group.description && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">&mdash; {group.description}</span>
                )}
              </button>
              {expandedTags.has(group.tag) && spec && (
                <div className="space-y-2">
                  {group.endpoints.map((ep) => (
                    <EndpointCard
                      key={`${ep.method}-${ep.path}`}
                      method={ep.method}
                      path={ep.path}
                      operation={ep.operation}
                      spec={spec}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center max-w-md">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">API Spec Load Failed</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Make sure the API server is running. The Swagger spec is served at{' '}
          <code className="rounded bg-gray-100 dark:bg-gray-800 px-1">/api/docs-json</code>
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
