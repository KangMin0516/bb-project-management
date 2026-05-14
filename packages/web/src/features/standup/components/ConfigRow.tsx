import { ChevronDown, ChevronRight, Play, Trash2 } from 'lucide-react'
import type { StandupConfig, StandupQuestion } from '@/features/standup/api'
import type { SlackChannel, SlackUser } from '@/features/integrations/slack/api'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { Checkbox } from '@/shared/ui/checkbox'
import ConfigForm from './ConfigForm'

interface ConfigRowProps {
  config: StandupConfig
  questions: StandupQuestion[]
  channels: SlackChannel[]
  slackUsers: SlackUser[]
  expanded: boolean
  isUpdating: boolean
  isTriggering: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onTrigger: () => void
  onDelete: () => void
  onSave: (data: Parameters<typeof ConfigForm>[0]['onSubmit'] extends (d: infer T) => unknown ? T : never) => void
}

/**
 * Collapsible row in the configs list. When expanded, renders ConfigForm
 * in 'edit' mode pre-populated from the config's current values.
 */
export default function ConfigRow({
  config,
  questions,
  channels,
  slackUsers,
  expanded,
  isUpdating,
  isTriggering,
  onToggleExpand,
  onToggleEnabled,
  onTrigger,
  onDelete,
  onSave,
}: ConfigRowProps) {
  const channelName = config.channelName ?? channels.find((c) => c.id === config.channelId)?.name ?? config.channelId

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={onToggleExpand}>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            #{channelName} · {config.cronHour}:{config.cronMinute.padStart(2, '0')} · {config.members.length} members · {config._count.reports} reports
          </div>
        </div>
        <label className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={config.enabled} onCheckedChange={onToggleEnabled} />
          <span className="text-xs text-gray-500 dark:text-gray-400">On</span>
        </label>
        <button
          onClick={(e) => { e.stopPropagation(); onTrigger() }}
          disabled={isTriggering}
          className="rounded border border-gray-300 dark:border-gray-600 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Trigger now"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (await confirmDialog({
              title: `Delete "${config.name}"?`,
              confirmLabel: 'Delete',
              destructive: true,
            })) onDelete()
          }}
          className="text-gray-400 dark:text-gray-500 hover:text-red-500"
          aria-label={`Delete ${config.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-3">
          <ConfigForm
            mode="edit"
            initial={{
              name: config.name,
              channelId: config.channelId,
              cronHour: config.cronHour,
              cronMinute: config.cronMinute,
              cronDayOfWeek: config.cronDayOfWeek,
              timezone: config.timezone,
              greeting: config.greeting,
              goodbye: config.goodbye,
              selectedQuestionIds: config.questions.map((q) => q.questionId),
              selectedMemberIds: config.members.map((m) => m.slackUserId),
            }}
            questions={questions}
            channels={channels}
            slackUsers={slackUsers}
            isPending={isUpdating}
            onSubmit={onSave}
          />
        </div>
      )}
    </div>
  )
}
