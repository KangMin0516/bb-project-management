import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { FileText, Loader2 } from 'lucide-react'
import { specRepository } from '@/features/specification/repository'
import { projectRepository } from '@/features/project/repository'
import { summariseProgress } from '@/features/specification/lib/itemStatus'
import SpecProgressBar from '@/features/specification/components/SpecProgressBar'
import type { SpecDetail } from '@/features/specification/api'

type SortField = 'progress' | 'recent' | 'title'

/**
 * Project-level rollup of every spec's progress. Pulls each spec's
 * detail (which includes its `items[]` after the BE Phase-1 change) to
 * compute the live "done / total" summary; rendering is a single column
 * list with a stacked progress bar per row.
 *
 * Note: we deliberately call `specRepository.findOne` per spec instead
 * of inventing a new list-with-items endpoint. The list page only
 * renders ≈10–50 specs per project; the round-trip cost is acceptable
 * for now and we avoid duplicating include shapes on the BE.
 */
export default function SpecRollupPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as SortField) ?? 'progress'

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId!),
    enabled: !!projectId,
  })

  const listQuery = useQuery({
    queryKey: ['specifications', projectId],
    queryFn: () => specRepository.findInProject(projectId!),
    enabled: !!projectId,
  })

  // Fan-out: one detail query per spec. React-Query handles caching so
  // navigating into SpecificationsPage right after will hit the same key.
  const detailQueries = useQueries({
    queries: (listQuery.data ?? []).map((spec) => ({
      queryKey: ['specification', projectId, spec.id],
      queryFn: () => specRepository.findOne(projectId!, spec.id),
      enabled: !!projectId,
    })),
  })

  const rows = useMemo(() => {
    const list = listQuery.data ?? []
    return list.map((spec, idx) => {
      const detail = detailQueries[idx]?.data as SpecDetail | undefined
      const summary = summariseProgress(detail?.items ?? [])
      const donePct = summary.total === 0 ? -1 : summary.done / summary.total
      return {
        id: spec.id,
        title: spec.title,
        status: spec.status,
        category: spec.category,
        updatedAt: spec.updatedAt,
        creator: spec.creator,
        summary,
        donePct,
        isLoading: detailQueries[idx]?.isLoading,
      }
    })
  }, [listQuery.data, detailQueries])

  const sortedRows = useMemo(() => {
    const arr = [...rows]
    if (sort === 'title') return arr.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'recent')
      return arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    // progress desc — empty specs (donePct = -1) sink to the bottom
    return arr.sort((a, b) => b.donePct - a.donePct)
  }, [rows, sort])

  if (!projectId) return null

  const isInitialLoading = listQuery.isLoading

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Spec Rollup
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {projectQuery.data?.name ?? ''} — 기획별 진척 한눈에 보기
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            Sort by
            <select
              value={sort}
              onChange={(e) =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('sort', e.target.value)
                  return next
                })
              }
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1 text-xs"
            >
              <option value="progress">Progress</option>
              <option value="recent">Recently updated</option>
              <option value="title">Title (A–Z)</option>
            </select>
          </label>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading specs…
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-2">이 프로젝트에는 아직 기획서가 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedRows.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/projects/${projectId}/specs?specId=${row.id}`}
                  className="flex items-start gap-4 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 transition hover:border-gray-300 dark:hover:border-gray-500"
                >
                  <FileText className="mt-1 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {row.title}
                      </h2>
                      <span className="shrink-0 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:text-gray-400">
                        {row.status}
                      </span>
                      {row.category && (
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                          {row.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {row.isLoading ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Loading items…</span>
                      ) : (
                        <SpecProgressBar summary={row.summary} variant="detailed" />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-gray-400 dark:text-gray-500">
                    <p>{row.creator.name}</p>
                    <p>{relativeTime(row.updatedAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}
