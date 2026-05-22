import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { userRepository } from '@/entities/user/repository'
import { slackApi } from '@/features/integrations/slack/api'
import { useAuthStore } from '@/features/auth/store'
import { useProjectMembers } from '@/features/project/hooks/useProjectMembers'
import { useProjectLabels } from '@/features/project/hooks/useProjectLabels'
import { useProjectComponents } from '@/features/project/hooks/useProjectComponents'
import { useJoinRequests } from '@/features/project/hooks/useJoinRequests'
import { useProjectMutations } from '@/features/project/hooks/useProjectMutations'
import GeneralSection from '@/features/project/components/settings/GeneralSection'
import MembersSection from '@/features/project/components/settings/MembersSection'
import JoinRequestsSection from '@/features/project/components/settings/JoinRequestsSection'
import LabelsSection from '@/features/project/components/settings/LabelsSection'
import ComponentsSection from '@/features/project/components/settings/ComponentsSection'
import DangerZoneSection from '@/features/project/components/settings/DangerZoneSection'
import ShareLinksSection from '@/features/project/components/settings/ShareLinksSection'
import SlackIntegration from '@/features/integrations/slack/components/SlackIntegration'
import GitHubIntegration from '@/features/integrations/github/components/GitHubIntegration'
import DailyReportSettings from '@/features/report/components/DailyReportSettings'
import { cn } from '@/shared/lib/utils'

interface NavItem {
  id: string
  label: string
}

/**
 * Project settings composition root. Each section owns its own state + UI;
 * page only wires data hooks to sections and resolves admin permission.
 *
 * Layout: sticky TOC sidebar on the left + content column on the right.
 * Integration cards (Slack / GitHub) sit in a 2-up grid since their bodies
 * are short — keeps the page from feeling like a long single column.
 */
export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentUser = useAuthStore((s) => s.user)

  const showRequests = searchParams.get('tab') === 'requests'

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId!),
    enabled: !!projectId,
  })

  const { data: slackStatus } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
  })

  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: () => userRepository.search() })

  // The URL param is the project KEY (e.g. "PITB"). Mutations require the
  // UUID id (the backend's PATCH/DELETE endpoints don't accept keys), so we
  // resolve it from the loaded project and fall back to the key for queries
  // (those accept either via projectService.findOne's id-or-key resolver).
  const resolvedId = project?.id ?? projectId ?? ''

  const members = useProjectMembers(resolvedId)
  const labels = useProjectLabels(resolvedId)
  const components = useProjectComponents(resolvedId)

  const currentMember = members.members?.find((m) => m.userId === currentUser?.id)
  const isAdminOrPm = currentMember?.role === 'ADMIN' || currentMember?.role === 'PM' || !!currentUser?.isSuperuser

  const joinRequests = useJoinRequests(resolvedId, isAdminOrPm)
  const projectMutations = useProjectMutations(resolvedId, () => navigate('/'))

  // Deep-link to the requests section (?tab=requests) — scroll once visible.
  useEffect(() => {
    if (showRequests) {
      const id = setTimeout(() => document.getElementById('requests')?.scrollIntoView({ behavior: 'smooth' }), 300)
      return () => clearTimeout(id)
    }
  }, [showRequests])

  if (!projectId) return null

  const navItems: NavItem[] = [
    { id: 'general', label: 'General' },
    { id: 'members', label: 'Members' },
    ...(isAdminOrPm && joinRequests.requests && joinRequests.requests.length > 0
      ? [{ id: 'requests', label: 'Join Requests' }]
      : []),
    { id: 'labels', label: 'Labels' },
    { id: 'components', label: 'Components' },
    ...(isAdminOrPm ? [{ id: 'share-links', label: 'Share Links' }] : []),
    { id: 'integrations', label: 'Integrations' },
    { id: 'daily-reports', label: 'Daily Reports' },
    { id: 'danger', label: 'Danger Zone' },
  ]

  return (
    // No centred wrapper — the page fills the available width (the AppLayout
    // sidebar already takes the leftmost ~256px). TOC sits flush-left next
    // to the sidebar; content fills the rest of the viewport. Each section
    // component is responsible for capping its own form inputs if needed.
    <div className="flex gap-8 p-6">
      <aside className="hidden w-44 shrink-0 lg:block">
        <nav className="sticky top-6 space-y-0.5">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                'block rounded px-3 py-1.5 text-sm text-gray-600 transition',
                'hover:bg-gray-100 hover:text-gray-900',
                'dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100',
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <section id="general" className="scroll-mt-6">
            <GeneralSection project={project} onSave={(data) => projectMutations.update.mutate(data)} />
          </section>

          <section id="members" className="scroll-mt-6">
            <MembersSection
              members={members.members}
              allUsers={allUsers}
              onAdd={(data) => members.add.mutate(data)}
              onRemove={(memberId) => members.remove.mutate(memberId)}
              onUpdateRole={(memberId, role) => members.updateRole.mutate({ memberId, role })}
            />
          </section>

          <JoinRequestsSection
            requests={joinRequests.requests}
            forceShow={showRequests}
            onApprove={(id) => joinRequests.approve.mutate(id)}
            onReject={(requestId, reason) => joinRequests.reject.mutate({ requestId, reason })}
            isApproving={joinRequests.approve.isPending}
          />

          <section id="labels" className="scroll-mt-6">
            <LabelsSection
              labels={labels.labels}
              onCreate={(data) => labels.create.mutate(data)}
              onRemove={(id) => labels.remove.mutate(id)}
              onSeed={() => labels.seed.mutate()}
            />
          </section>

          <section id="components" className="scroll-mt-6">
            <ComponentsSection
              components={components.components}
              members={members.members}
              onCreate={(data) => components.create.mutate(data)}
              onUpdate={(id, data) => components.update.mutate({ id, data })}
              onDelete={(id) => components.remove.mutate(id)}
            />
          </section>

          {isAdminOrPm && (
            <section id="share-links" className="scroll-mt-6">
              <ShareLinksSection projectId={resolvedId} />
            </section>
          )}

          <section id="integrations" className="scroll-mt-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <SlackIntegration />
              <GitHubIntegration projectId={projectId} />
            </div>
          </section>

          <section id="daily-reports" className="scroll-mt-6">
            <DailyReportSettings
              projectId={projectId}
              integrationId={slackStatus?.integrationId}
              slackConnected={slackStatus?.connected ?? false}
            />
          </section>

        <section id="danger" className="scroll-mt-6">
          <DangerZoneSection onDelete={() => projectMutations.remove.mutate()} />
        </section>
      </div>
    </div>
  )
}
