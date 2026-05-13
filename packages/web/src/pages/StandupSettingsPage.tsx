import { useAuthStore } from '@/features/auth/store'
import { slackApi } from '@/features/integrations/slack/api'
import { useStandupQuestions } from '@/features/standup/hooks/useStandupQuestions'
import { useStandupConfigs } from '@/features/standup/hooks/useStandupConfigs'
import { useSlackData } from '@/features/standup/hooks/useSlackData'
import QuestionsSection from '@/features/standup/components/QuestionsSection'
import ConfigsSection from '@/features/standup/components/ConfigsSection'
import type { StandupConfigFormData } from '@/features/standup/lib'

/**
 * Composition root for the standup-bot admin page. Gates on superuser +
 * Slack connection, then delegates UI to QuestionsSection / ConfigsSection.
 */
export default function StandupSettingsPage() {
  const currentUser = useAuthStore((s) => s.user)
  const questions = useStandupQuestions()
  const configs = useStandupConfigs()
  const slack = useSlackData()

  if (!currentUser?.isSuperuser) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Only superusers can manage standup settings.</p>
      </div>
    )
  }

  if (!slack.isConnected || !slack.integrationId) return <SlackConnectGate />

  const integrationId = slack.integrationId

  const buildPayload = (data: StandupConfigFormData) => ({
    name: data.name,
    channelId: data.channelId,
    channelName: slack.channels.find((c) => c.id === data.channelId)?.name,
    cronHour: data.cronHour,
    cronMinute: data.cronMinute,
    cronDayOfWeek: data.cronDayOfWeek,
    timezone: data.timezone,
    greeting: data.greeting,
    goodbye: data.goodbye,
    slackIntegrationId: integrationId,
    questions: data.selectedQuestionIds.map((qId, i) => ({ questionId: qId, order: i })),
    members: data.selectedMemberIds.map((id) => ({
      slackUserId: id,
      username: slack.users.find((u) => u.id === id)?.realName,
    })),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Standup Bot</h1>

      <QuestionsSection
        questions={questions.questions}
        onCreate={(text, order) => questions.create.mutate({ text, order })}
        onRemove={(id) => questions.remove.mutate(id)}
      />

      <ConfigsSection
        configs={configs.configs}
        questions={questions.questions}
        channels={slack.channels}
        slackUsers={slack.users}
        integrationId={integrationId}
        isCreating={configs.create.isPending}
        isUpdating={configs.update.isPending}
        isTriggering={configs.trigger.isPending}
        onCreate={(data) => configs.create.mutate(buildPayload(data))}
        onUpdate={(id, data) => configs.update.mutate({ id, data: buildPayload(data) })}
        onDelete={(id) => configs.remove.mutate(id)}
        onTrigger={(id) => configs.trigger.mutate(id)}
        onToggleEnabled={(id, enabled) => configs.toggleEnabled.mutate({ id, enabled })}
      />
    </div>
  )
}

function SlackConnectGate() {
  const handleConnect = async () => {
    try {
      const { url } = await slackApi.getInstallUrl()
      window.location.href = url
    } catch {
      // user can retry; surfacing this error inline would race the redirect
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Standup Bot</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Connect Slack to use the Standup Bot.</p>
      <button
        onClick={handleConnect}
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
      >
        Connect Slack
      </button>
    </div>
  )
}
