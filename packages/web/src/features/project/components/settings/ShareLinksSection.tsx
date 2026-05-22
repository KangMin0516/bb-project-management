import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, KeyRound } from 'lucide-react'
import {
  shareLinkApi,
  type ShareLinkAdminView,
} from '@/features/share-link/api/shareLinkApi'
import SettingsSection from './SettingsSection'

interface ShareLinksSectionProps {
  projectId: string
}

/**
 * Entry-point card in project Settings linking to the dedicated
 * `/projects/:projectId/share-links` manage page. The full table lives
 * on the manage page; this section only shows a 1-line summary
 * (active link count) so PMs see at a glance whether the project has
 * any external share surface. Rendered only for PM↑ by SettingsPage.
 */
export default function ShareLinksSection({ projectId }: ShareLinksSectionProps) {
  const { data } = useQuery({
    queryKey: ['share-links', projectId],
    queryFn: () => shareLinkApi.list(projectId),
    enabled: !!projectId,
  })

  const activeCount = countActive(data)

  return (
    <SettingsSection title="Public share links">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30">
            <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">
            <div className="font-medium text-gray-800 dark:text-gray-100">
              {activeCount === 0
                ? 'No active links'
                : `${activeCount} active link${activeCount === 1 ? '' : 's'}`}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              Passcode-gated read-only Timeline links for external clients.
              Manage, rotate passcodes, or revoke from the dedicated page.
            </p>
          </div>
        </div>
        <Link
          to={`/projects/${projectId}/share-links`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Manage
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </SettingsSection>
  )
}

function countActive(links: ShareLinkAdminView[] | undefined): number {
  if (!links) return 0
  const now = Date.now()
  return links.filter(
    (l) =>
      !l.revokedAt &&
      (!l.expiresAt || new Date(l.expiresAt).getTime() > now),
  ).length
}
