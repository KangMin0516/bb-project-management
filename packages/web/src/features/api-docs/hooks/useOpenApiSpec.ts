import { useEffect, useMemo, useState } from 'react'
import type { OpenApiSpec, GroupedEndpoints, Operation } from '@/features/api-docs/types'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

interface UseOpenApiSpecResult {
  spec: OpenApiSpec | null
  loading: boolean
  error: string | null
  grouped: GroupedEndpoints[]
  totalEndpoints: number
}

/**
 * Fetches the API spec from `/api/docs-json` and pre-groups operations by
 * the first tag on each path. The grouping is memoised so search-time
 * filtering stays cheap.
 */
export function useOpenApiSpec(): UseOpenApiSpecResult & { firstTag: string | null } {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firstTag, setFirstTag] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/docs-json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: OpenApiSpec) => {
        setSpec(data)
        const tags = data.tags?.map((t) => t.name) ?? []
        if (tags.length > 0) setFirstTag(tags[0])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo<GroupedEndpoints[]>(() => {
    if (!spec?.paths) return []
    const groups = new Map<string, GroupedEndpoints>()
    const tagDescriptions = new Map(spec.tags?.map((t) => [t.name, t.description]) ?? [])

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as Operation | undefined
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

  const totalEndpoints = grouped.reduce((sum, g) => sum + g.endpoints.length, 0)

  return { spec, loading, error, grouped, totalEndpoints, firstTag }
}

/** Filters groups + endpoints by free-text search; drops empty groups. */
export function filterGroupsBySearch(groups: GroupedEndpoints[], search: string): GroupedEndpoints[] {
  if (!search.trim()) return groups
  const q = search.toLowerCase()
  return groups
    .map((g) => ({
      ...g,
      endpoints: g.endpoints.filter((e) =>
        e.path.toLowerCase().includes(q) ||
        e.operation.summary?.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.operation.operationId?.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.endpoints.length > 0)
}
