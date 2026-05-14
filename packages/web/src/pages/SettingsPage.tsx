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
import SlackIntegration from '@/features/integrations/slack/components/SlackIntegration'
import GitHubIntegration from '@/features/integrations/github/components/GitHubIntegration'
import DailyReportSettings from '@/features/report/components/DailyReportSettings'

/**
 * Project settings composition root. Each section owns its own state + UI;
 * page only wires data hooks to sections and resolves admin permission.
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Project Settings</h1>

      <GeneralSection project={project} onSave={(data) => projectMutations.update.mutate(data)} />

      <MembersSection
        members={members.members}
        allUsers={allUsers}
        onAdd={(data) => members.add.mutate(data)}
        onRemove={(memberId) => members.remove.mutate(memberId)}
        onUpdateRole={(memberId, role) => members.updateRole.mutate({ memberId, role })}
      />

      <JoinRequestsSection
        requests={joinRequests.requests}
        forceShow={showRequests}
        onApprove={(id) => joinRequests.approve.mutate(id)}
        onReject={(requestId, reason) => joinRequests.reject.mutate({ requestId, reason })}
        isApproving={joinRequests.approve.isPending}
      />

      <LabelsSection
        labels={labels.labels}
        onCreate={(data) => labels.create.mutate(data)}
        onSeed={() => labels.seed.mutate()}
      />

      <ComponentsSection
        components={components.components}
        members={members.members}
        onCreate={(data) => components.create.mutate(data)}
        onUpdate={(id, data) => components.update.mutate({ id, data })}
        onDelete={(id) => components.remove.mutate(id)}
      />

      <SlackIntegration />
      <GitHubIntegration projectId={projectId} />

      <DailyReportSettings
        projectId={projectId}
        integrationId={slackStatus?.integrationId}
        slackConnected={slackStatus?.connected ?? false}
      />

      <DangerZoneSection onDelete={() => projectMutations.remove.mutate()} />
    </div>
  )
}
