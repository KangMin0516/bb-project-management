import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { LogOut, Calendar, Loader2 } from 'lucide-react'
import { useTimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'
import { useTimelineGroups } from '@/features/timeline/hooks/useTimelineGroups'
import { useTimelineRows } from '@/features/timeline/hooks/useTimelineRows'
import TimelineLabelColumn from '@/features/timeline/components/TimelineLabelColumn'
import TimelineChart from '@/features/timeline/components/TimelineChart'
import TimelineTooltip from '@/features/timeline/components/TimelineTooltip'
import { startOfDay } from '@/features/timeline/lib'
import type { Issue } from '@/features/issue/api'
import {
  clearShareJwt,
  readShareJwt,
  setCurrentShareToken,
  sharePublicApi,
} from '../api/publicApi'
import { toIssueShape } from '../api/toIssueShape'
import PublicIssueModal from '../components/PublicIssueModal'

const LABEL_WIDTH = 280
const ROW_HEIGHT = 36

/**
 * Read-only Timeline rendered from the public API. Reuses the same leaf
 * components and hooks as the internal `TimelinePage`, going through a
 * `toIssueShape` adapter so the hooks see a familiar `Issue` shape even
 * though the wire payload is whitelisted (no email, no description,
 * no _count, etc.).
 *
 * Differences vs internal:
 *  - No URL filter / sort state — public consumers shouldn't write back
 *    to the URL bar (and we don't want filter codecs to leak into
 *    sessionStorage either).
 *  - Click → `PublicIssueModal` instead of `IssueDetailPanel`. The panel
 *    pulls comments/activity which would defeat the whitelist.
 *  - No drag, no toolbar — only a slim header with the project name,
 *    "Shared by …", and Logout (clear session, back to passcode form).
 */
export default function SharedTimelinePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [hoveredIssue, setHoveredIssue] = useState<
    { id: string; x: number; y: number } | null
  >(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Bind the publicApi token reference once per mount so the interceptor
  // can find the JWT. Done as soon as we have the path param, before any
  // query runs.
  useEffect(() => {
    if (token) setCurrentShareToken(token)
  }, [token])

  useEffect(() => {
    if (!token) return
    if (!readShareJwt(token)) navigate(`/share/${token}`, { replace: true })
  }, [token, navigate])

  const projectQuery = useQuery({
    queryKey: ['share', token, 'project'],
    queryFn: () => sharePublicApi.project(token!),
    enabled: !!token && !!readShareJwt(token),
    retry: false,
  })

  const timelineQuery = useQuery({
    queryKey: ['share', token, 'timeline'],
    queryFn: () => sharePublicApi.timeline(token!),
    enabled: !!token && !!readShareJwt(token),
    retry: false,
  })

  const allIssues: Issue[] = useMemo(
    () => (timelineQuery.data?.issues ?? []).map(toIssueShape),
    [timelineQuery.data],
  )
  const dateRange = useTimelineDateRange(allIssues)
  // No filter UI on public — pass the same list as both args.
  const { epicGroups, groups } = useTimelineGroups(allIssues, allIssues, 'epic')
  const rows = useTimelineRows('epic', epicGroups, groups, collapsedEpics)

  const todayOffset = useMemo(() => {
    const now = startOfDay(new Date())
    const range = dateRange.endDate.getTime() - dateRange.startDate.getTime()
    if (range === 0) return 0
    return ((now.getTime() - dateRange.startDate.getTime()) / range) * 100
  }, [dateRange])

  const hoveredIssueData = useMemo(
    () =>
      hoveredIssue ? allIssues.find((i) => i.id === hoveredIssue.id) ?? null : null,
    [hoveredIssue, allIssues],
  )

  function toggleEpicCollapse(key: string) {
    setCollapsedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function logout() {
    if (token) clearShareJwt(token)
    navigate(`/share/${token}`, { replace: true })
  }

  // If either query 401'd / 410'd, bounce back to passcode form — the
  // interceptor already cleared the JWT in those cases. Pass a reason
  // via location.state so the passcode page can show *why* the user
  // landed there instead of an unexplained empty form.
  useEffect(() => {
    const err = projectQuery.error ?? timelineQuery.error
    if (!err || !token) return
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    if (status === 401) {
      navigate(`/share/${token}`, {
        replace: true,
        state: { reason: 'session-expired' },
      })
    } else if (status === 410) {
      navigate(`/share/${token}`, {
        replace: true,
        state: { reason: 'gone' },
      })
    }
  }, [projectQuery.error, timelineQuery.error, token, navigate])

  if (!token) return null

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
      <header className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5">
        <div className="rounded-md bg-indigo-100 dark:bg-indigo-900/40 p-1.5 text-indigo-600 dark:text-indigo-300">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {projectQuery.data?.projectName ?? '—'}
            {projectQuery.data?.projectKey && (
              <span className="ml-2 font-mono text-xs font-normal text-gray-400 dark:text-gray-500">
                {projectQuery.data.projectKey}
              </span>
            )}
          </div>
          {projectQuery.data?.sharedByName && (
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">
              Shared by {projectQuery.data.sharedByName}
              {projectQuery.data.expiresAt && (
                <ExpiryHint expiresAt={projectQuery.data.expiresAt} />
              )}
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          title="Forget passcode on this device"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </header>

      <div className="flex-1 overflow-hidden">
        {timelineQuery.isLoading || projectQuery.isLoading ? (
          <LoadingState />
        ) : timelineQuery.isError ? (
          <ErrorState />
        ) : allIssues.length === 0 ? (
          <EmptyState />
        ) : (
          <div ref={scrollRef} className="h-full overflow-auto">
            <div className="flex">
              <TimelineLabelColumn
                rows={rows}
                groupBy="epic"
                projectKey={projectQuery.data?.projectKey}
                rowHeight={ROW_HEIGHT}
                width={LABEL_WIDTH}
                onSelectIssue={setSelectedIssue}
                onToggleEpic={toggleEpicCollapse}
              />
              <TimelineChart
                rows={rows}
                dateRange={dateRange}
                todayOffset={todayOffset}
                rowHeight={ROW_HEIGHT}
                onSelectIssue={setSelectedIssue}
                onHover={(id, e) => {
                  if (!id || !e) setHoveredIssue(null)
                  else setHoveredIssue({ id, x: e.clientX, y: e.clientY })
                }}
              />
            </div>
          </div>
        )}
      </div>

      {hoveredIssueData && hoveredIssue && (
        <TimelineTooltip
          issue={hoveredIssueData}
          projectKey={projectQuery.data?.projectKey}
          position={{ x: hoveredIssue.x, y: hoveredIssue.y }}
        />
      )}

      {selectedIssue && (
        <PublicIssueModal
          issue={selectedIssue}
          projectKey={projectQuery.data?.projectKey ?? ''}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  )
}

function ExpiryHint({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt)
  const now = new Date()
  const days = Math.ceil(
    (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  )
  if (days <= 0) return null
  return (
    <span className="ml-2 text-gray-400 dark:text-gray-500">
      · Expires in {days} day{days !== 1 ? 's' : ''}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
      <p className="text-lg font-medium">No issues to display</p>
      <p className="text-sm">This project doesn't have any scheduled work yet.</p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <p className="text-lg font-medium">Couldn't load timeline</p>
      <p className="text-sm">Try logging out and re-entering the passcode.</p>
    </div>
  )
}
