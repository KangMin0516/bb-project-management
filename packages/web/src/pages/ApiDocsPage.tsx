import { useState, useEffect, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Search,
  Lock,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface Parameter {
  name: string
  in: string
  required?: boolean
  schema?: SchemaObject
  description?: string
}

interface SchemaObject {
  type?: string
  properties?: Record<string, SchemaObject>
  items?: SchemaObject
  required?: string[]
  enum?: string[]
  $ref?: string
  description?: string
  example?: unknown
  format?: string
  default?: unknown
  allOf?: SchemaObject[]
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  nullable?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

interface RequestBody {
  required?: boolean
  content?: Record<string, { schema?: SchemaObject }>
}

interface ResponseObject {
  description?: string
  content?: Record<string, { schema?: SchemaObject }>
}

interface Operation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses?: Record<string, ResponseObject>
  security?: Array<Record<string, string[]>>
}

interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  patch?: Operation
  delete?: Operation
  parameters?: Parameter[]
}

interface OpenApiSpec {
  info?: { title?: string; version?: string; description?: string }
  paths?: Record<string, PathItem>
  components?: { schemas?: Record<string, SchemaObject> }
  tags?: Array<{ name: string; description?: string }>
}

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  POST: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  PATCH: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  PUT: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  DELETE: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
}

function MethodBadge({ method }: { method: string }) {
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET
  return (
    <span className={cn('inline-flex w-16 items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold uppercase', colors.bg, colors.text)}>
      {method}
    </span>
  )
}

function resolveRef(ref: string, spec: OpenApiSpec): SchemaObject | undefined {
  const parts = ref.replace('#/', '').split('/')
  let current: unknown = spec
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current as SchemaObject | undefined
}

function resolveSchema(schema: SchemaObject | undefined, spec: OpenApiSpec, depth = 0): SchemaObject | undefined {
  if (!schema || depth > 5) return schema
  if (schema.$ref) return resolveRef(schema.$ref, spec)
  if (schema.allOf) {
    const merged: SchemaObject = { type: 'object', properties: {}, required: [] }
    for (const sub of schema.allOf) {
      const resolved = resolveSchema(sub, spec, depth + 1)
      if (resolved?.properties) {
        merged.properties = { ...merged.properties, ...resolved.properties }
      }
      if (resolved?.required) {
        merged.required = [...(merged.required || []), ...resolved.required]
      }
    }
    return merged
  }
  return schema
}

function getSchemaName(ref?: string): string {
  if (!ref) return ''
  const parts = ref.split('/')
  return parts[parts.length - 1]
}

function SchemaProperties({ schema, spec, depth = 0 }: { schema: SchemaObject; spec: OpenApiSpec; depth?: number }) {
  const resolved = resolveSchema(schema, spec, depth)
  if (!resolved?.properties) return null

  return (
    <div className={cn('space-y-1', depth > 0 && 'ml-4 border-l-2 border-gray-100 dark:border-gray-700 pl-3')}>
      {Object.entries(resolved.properties).map(([name, prop]) => {
        const propResolved = resolveSchema(prop, spec, depth + 1)
        const isRequired = resolved.required?.includes(name)
        const typeStr = getTypeString(prop, spec)

        return (
          <div key={name} className="py-1">
            <div className="flex items-center gap-2">
              <code className="text-xs font-medium text-gray-900 dark:text-gray-100">{name}</code>
              {isRequired && <span className="text-[10px] font-medium text-red-500">required</span>}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{typeStr}</span>
            </div>
            {prop.description && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{prop.description}</p>
            )}
            {prop.enum && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {prop.enum.map((v) => (
                  <span key={v} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:text-gray-300">{String(v)}</span>
                ))}
              </div>
            )}
            {propResolved?.properties && depth < 3 && (
              <SchemaProperties schema={propResolved} spec={spec} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function getTypeString(schema: SchemaObject | undefined, spec: OpenApiSpec): string {
  if (!schema) return 'any'
  if (schema.$ref) return getSchemaName(schema.$ref)
  if (schema.allOf) return 'object'
  if (schema.oneOf) return schema.oneOf.map(s => getTypeString(s, spec)).join(' | ')
  if (schema.type === 'array') {
    const itemType = schema.items ? getTypeString(schema.items, spec) : 'any'
    return `${itemType}[]`
  }
  if (schema.enum) return schema.enum.map(v => `"${v}"`).join(' | ')
  if (schema.format) return `${schema.type} (${schema.format})`
  return schema.type || 'any'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button onClick={handleCopy} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Copy">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function EndpointCard({ method, path, operation, spec }: { method: string; path: string; operation: Operation; spec: OpenApiSpec }) {
  const [expanded, setExpanded] = useState(false)
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET
  const hasAuth = !operation.security || operation.security.length > 0
  const bodySchema = operation.requestBody?.content?.['application/json']?.schema
    || operation.requestBody?.content?.['multipart/form-data']?.schema
  const resolvedBody = bodySchema ? resolveSchema(bodySchema, spec) : undefined
  const pathParams = operation.parameters?.filter(p => p.in === 'path') || []
  const queryParams = operation.parameters?.filter(p => p.in === 'query') || []

  return (
    <div className={cn('rounded-lg border transition-colors', expanded ? colors.border : 'border-gray-200 dark:border-gray-700')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', expanded && cn(colors.bg))}
      >
        <MethodBadge method={method} />
        <code className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{path}</code>
        {hasAuth && <Lock className="h-3 w-3 text-gray-400 dark:text-gray-500" />}
        <span className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
          {operation.summary}
        </span>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* Summary & Description */}
          {(operation.summary || operation.description) && (
            <div>
              {operation.summary && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{operation.summary}</h4>}
              {operation.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{operation.description}</p>}
            </div>
          )}

          {/* cURL Example */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Request</span>
              <CopyButton text={`curl -X ${method} '/api${path}'${hasAuth ? " \\\n  -H 'Authorization: Bearer <token>'" : ''}${resolvedBody ? " \\\n  -H 'Content-Type: application/json' \\\n  -d '{}'" : ''}`} />
            </div>
            <div className="rounded-md bg-gray-900 dark:bg-gray-950 p-3 font-mono text-xs text-gray-200 overflow-x-auto">
              <span className="text-emerald-400">curl</span>{' '}
              <span className="text-amber-300">-X {method}</span>{' '}
              <span className="text-gray-300">'/api{path}'</span>
              {hasAuth && (
                <>{' \\\n  '}<span className="text-amber-300">-H</span> <span className="text-gray-300">'Authorization: Bearer {'<token>'}'</span></>
              )}
              {resolvedBody && (
                <>{' \\\n  '}<span className="text-amber-300">-H</span> <span className="text-gray-300">'Content-Type: application/json'</span>
                {' \\\n  '}<span className="text-amber-300">-d</span> <span className="text-gray-300">'{'{...}'}'</span></>
              )}
            </div>
          </div>

          {/* Path Parameters */}
          {pathParams.length > 0 && (
            <div>
              <h5 className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Path Parameters</h5>
              <div className="rounded-md border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {pathParams.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 px-3 py-2">
                    <code className="text-xs font-medium text-gray-900 dark:text-gray-100">{p.name}</code>
                    <span className="text-[10px] font-medium text-red-500">required</span>
                    <span className="text-[10px] text-gray-400">{p.schema?.type || 'string'}</span>
                    {p.description && <span className="text-[11px] text-gray-500 dark:text-gray-400">{p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Query Parameters */}
          {queryParams.length > 0 && (
            <div>
              <h5 className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Query Parameters</h5>
              <div className="rounded-md border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {queryParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 px-3 py-2">
                    <code className="text-xs font-medium text-gray-900 dark:text-gray-100">{p.name}</code>
                    {p.required && <span className="text-[10px] font-medium text-red-500">required</span>}
                    <span className="text-[10px] text-gray-400">{p.schema?.type || 'string'}</span>
                    {p.schema?.enum && (
                      <div className="flex flex-wrap gap-1">
                        {p.schema.enum.map((v) => (
                          <span key={v} className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-[10px] font-mono text-gray-600 dark:text-gray-300">{String(v)}</span>
                        ))}
                      </div>
                    )}
                    {p.description && <span className="text-[11px] text-gray-500 dark:text-gray-400">{p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {resolvedBody?.properties && (
            <div>
              <h5 className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Request Body</h5>
              <div className="rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <SchemaProperties schema={resolvedBody} spec={spec} />
              </div>
            </div>
          )}

          {/* Responses */}
          {operation.responses && (
            <div>
              <h5 className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Responses</h5>
              <div className="space-y-1">
                {Object.entries(operation.responses).map(([code, resp]) => (
                  <div key={code} className="flex items-start gap-2 px-1">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-mono font-bold',
                      code.startsWith('2') ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                      code.startsWith('4') ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}>
                      {code}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{resp.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface GroupedEndpoints {
  tag: string
  description?: string
  endpoints: Array<{ method: string; path: string; operation: Operation }>
}

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/docs-json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setSpec(data)
        // Expand first tag by default
        const tags = data.tags?.map((t: { name: string }) => t.name) || []
        if (tags.length > 0) {
          setExpandedTags(new Set([tags[0]]))
          setActiveTag(tags[0])
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo((): GroupedEndpoints[] => {
    if (!spec?.paths) return []

    const groups = new Map<string, GroupedEndpoints>()
    const tagDescriptions = new Map(spec.tags?.map((t) => [t.name, t.description]) || [])

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const operation = pathItem[method]
        if (!operation) continue

        const tag = operation.tags?.[0] || 'default'
        if (!groups.has(tag)) {
          groups.set(tag, { tag, description: tagDescriptions.get(tag), endpoints: [] })
        }
        groups.get(tag)!.endpoints.push({ method: method.toUpperCase(), path, operation })
      }
    }

    return Array.from(groups.values())
  }, [spec])

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.toLowerCase()
    return grouped
      .map((g) => ({
        ...g,
        endpoints: g.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(q) ||
            e.operation.summary?.toLowerCase().includes(q) ||
            e.method.toLowerCase().includes(q) ||
            e.operation.operationId?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.endpoints.length > 0)
  }, [grouped, search])

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
    setActiveTag(tag)
  }

  const expandAll = () => setExpandedTags(new Set(filtered.map((g) => g.tag)))
  const collapseAll = () => setExpandedTags(new Set())

  const totalEndpoints = grouped.reduce((sum, g) => sum + g.endpoints.length, 0)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center max-w-md">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">API Spec Load Failed</h2>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Make sure the API server is running. The Swagger spec is served at <code className="rounded bg-gray-100 dark:bg-gray-800 px-1">/api/docs-json</code>
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

  return (
    <div className="flex h-full">
      {/* Sidebar - Tag Navigation */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Modules</h3>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {filtered.map((g) => (
            <button
              key={g.tag}
              onClick={() => {
                toggleTag(g.tag)
                document.getElementById(`tag-${g.tag}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm',
                activeTag === g.tag
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              <span className="truncate">{g.tag}</span>
              <span className="shrink-0 ml-2 rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                {g.endpoints.length}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
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
              <div className="flex items-center gap-2">
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Swagger UI <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search endpoints... (path, method, or description)"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <button onClick={expandAll} className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                Expand All
              </button>
              <button onClick={collapseAll} className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* Auth Info */}
        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Authentication</span>
            </div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Most endpoints require a Bearer token. Login via <code className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 font-mono">POST /api/auth/login</code> to get an access token, then include it in the <code className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 font-mono">Authorization: Bearer {'<token>'}</code> header.
            </p>
          </div>
        </div>

        {/* Endpoint Groups */}
        <div className="mx-auto max-w-4xl px-6 py-4 space-y-6">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No endpoints match "{search}"
            </div>
          )}

          {filtered.map((group) => (
            <section key={group.tag} id={`tag-${group.tag}`} className="scroll-mt-36">
              <button
                onClick={() => toggleTag(group.tag)}
                className="flex w-full items-center gap-2 mb-3 text-left group"
              >
                {expandedTags.has(group.tag) ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                )}
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

              {expandedTags.has(group.tag) && (
                <div className="space-y-2">
                  {group.endpoints.map((ep) => (
                    <EndpointCard
                      key={`${ep.method}-${ep.path}`}
                      method={ep.method}
                      path={ep.path}
                      operation={ep.operation}
                      spec={spec!}
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
