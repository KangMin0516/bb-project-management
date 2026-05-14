import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { StandupConfig, StandupQuestion } from '@/features/standup/api'
import type { SlackChannel, SlackUser } from '@/features/integrations/slack/api'
import type { StandupConfigFormData } from '@/features/standup/lib'
import ConfigForm from './ConfigForm'
import ConfigRow from './ConfigRow'

interface ConfigsSectionProps {
  configs: StandupConfig[]
  questions: StandupQuestion[]
  channels: SlackChannel[]
  slackUsers: SlackUser[]
  integrationId: string
  isCreating: boolean
  isUpdating: boolean
  onCreate: (data: StandupConfigFormData) => void
  onUpdate: (id: string, data: StandupConfigFormData) => void
  onDelete: (id: string) => void
  onTrigger: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  isTriggering: boolean
}

/**
 * Configs management section: list of existing configs + a "+ New Config"
 * toggle that reveals the create form. `expandedId` tracks which row is
 * showing its inline edit form.
 */
export default function ConfigsSection(props: ConfigsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const handleCreate = (data: StandupConfigFormData) => {
    props.onCreate(data)
    setShowNew(false)
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Standup Configs</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Config
        </button>
      </div>

      {showNew && (
        <ConfigForm
          mode="create"
          questions={props.questions}
          channels={props.channels}
          slackUsers={props.slackUsers}
          isPending={props.isCreating}
          onSubmit={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="space-y-2">
        {props.configs.map((config) => (
          <ConfigRow
            key={config.id}
            config={config}
            questions={props.questions}
            channels={props.channels}
            slackUsers={props.slackUsers}
            expanded={expandedId === config.id}
            isUpdating={props.isUpdating}
            isTriggering={props.isTriggering}
            onToggleExpand={() => setExpandedId(expandedId === config.id ? null : config.id)}
            onToggleEnabled={() => props.onToggleEnabled(config.id, !config.enabled)}
            onTrigger={() => props.onTrigger(config.id)}
            onDelete={() => props.onDelete(config.id)}
            onSave={(data) => props.onUpdate(config.id, data)}
          />
        ))}
        {props.configs.length === 0 && !showNew && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No standup configs yet.</p>
        )}
      </div>

      {/* integrationId carried for API payload — referenced via closures inside the parent's create */}
      <span className="hidden" data-integration-id={props.integrationId} />
    </section>
  )
}
