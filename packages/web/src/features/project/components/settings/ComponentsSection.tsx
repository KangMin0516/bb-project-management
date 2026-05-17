import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Component, CreateComponentPayload, UpdateComponentPayload } from '@/features/project/component-api'
import type { ProjectMember } from '@/features/project/api'
import UserAvatar from '@/entities/user/UserAvatar'
import SettingsSection from './SettingsSection'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

/** Sentinel — Radix Select rejects empty string item values. */
const NO_MEMBER = '__none__'

interface ComponentsSectionProps {
  components: Component[] | undefined
  members: ProjectMember[] | undefined
  onCreate: (data: CreateComponentPayload) => void
  onUpdate: (id: string, data: UpdateComponentPayload) => void
  onDelete: (id: string) => void
}

/** Each component row swaps between read-mode and edit-mode (compound-like API). */
export default function ComponentsSection({ components, members, onCreate, onUpdate, onDelete }: ComponentsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <SettingsSection title="Components">
      {components && components.length > 0 ? (
        <div className="mb-3 space-y-2">
          {components.map((comp) =>
            editingId === comp.id ? (
              <ComponentEditForm
                key={comp.id}
                component={comp}
                members={members}
                onCancel={() => setEditingId(null)}
                onSave={(data) => {
                  onUpdate(comp.id, data)
                  setEditingId(null)
                }}
              />
            ) : (
              <ComponentRow
                key={comp.id}
                component={comp}
                onEdit={() => setEditingId(comp.id)}
                onDelete={async () => {
                  if (await confirmDialog({
                    title: `Delete component "${comp.name}"?`,
                    confirmLabel: 'Delete',
                    destructive: true,
                  })) onDelete(comp.id)
                }}
              />
            ),
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-gray-400 dark:text-gray-500">No components yet</p>
      )}
      <AddComponentForm members={members} onSubmit={onCreate} />
    </SettingsSection>
  )
}

function ComponentRow({ component, onEdit, onDelete }: { component: Component; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{component.name}</div>
        {component.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{component.description}</div>
        )}
        <div className="mt-0.5 flex gap-3 text-xs text-gray-400 dark:text-gray-500">
          {component.lead && <span>Lead: {component.lead.name}</span>}
          {component.defaultAssignee && <span>Default: {component.defaultAssignee.name}</span>}
          <span>{component._count.issues} issue{component._count.issues !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button onClick={onEdit} className="text-gray-400 dark:text-gray-500 hover:text-primary-500" aria-label={`Edit ${component.name}`}>
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onDelete} className="text-gray-400 dark:text-gray-500 hover:text-red-500" aria-label={`Delete ${component.name}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

interface ComponentFormFields {
  name: string
  description: string
  leadId: string
  defaultAssigneeId: string
}

function useComponentFormState(initial: Partial<ComponentFormFields> = {}) {
  return useState<ComponentFormFields>({
    name: initial.name ?? '',
    description: initial.description ?? '',
    leadId: initial.leadId ?? '',
    defaultAssigneeId: initial.defaultAssigneeId ?? '',
  })
}

function MemberSelect({ value, onChange, members, placeholder }: { value: string; onChange: (v: string) => void; members: ProjectMember[] | undefined; placeholder: string }) {
  return (
    <Select
      value={value || NO_MEMBER}
      onValueChange={(v) => onChange(v === NO_MEMBER ? '' : v)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_MEMBER}>{placeholder}</SelectItem>
        {members?.map((m) => (
          <SelectItem key={m.user.id} value={m.user.id}>
            <span className="flex items-center gap-2">
              <UserAvatar user={m.user} size="md" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{m.user.name}</span>
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">{m.user.email}</span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ComponentEditForm({
  component,
  members,
  onCancel,
  onSave,
}: {
  component: Component
  members: ProjectMember[] | undefined
  onCancel: () => void
  onSave: (data: UpdateComponentPayload) => void
}) {
  const [state, setState] = useComponentFormState({
    name: component.name,
    description: component.description ?? '',
    leadId: component.leadId ?? '',
    defaultAssigneeId: component.defaultAssigneeId ?? '',
  })

  return (
    <div className="space-y-2 rounded-lg border border-primary-200 bg-primary-50/30 p-3">
      <input
        value={state.name}
        onChange={(e) => setState({ ...state, name: e.target.value })}
        placeholder="Component name"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
      />
      <input
        value={state.description}
        onChange={(e) => setState({ ...state, description: e.target.value })}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <MemberSelect value={state.leadId} onChange={(v) => setState({ ...state, leadId: v })} members={members} placeholder="No lead" />
        <MemberSelect value={state.defaultAssigneeId} onChange={(v) => setState({ ...state, defaultAssigneeId: v })} members={members} placeholder="No default assignee" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => state.name && onSave({
            name: state.name,
            description: state.description || undefined,
            leadId: state.leadId || null,
            defaultAssigneeId: state.defaultAssigneeId || null,
          })}
          disabled={!state.name}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function AddComponentForm({
  members,
  onSubmit,
}: {
  members: ProjectMember[] | undefined
  onSubmit: (data: CreateComponentPayload) => void
}) {
  const [state, setState] = useComponentFormState()

  const submit = () => {
    if (!state.name) return
    onSubmit({
      name: state.name,
      description: state.description || undefined,
      leadId: state.leadId || undefined,
      defaultAssigneeId: state.defaultAssigneeId || undefined,
    })
    setState({ name: '', description: '', leadId: '', defaultAssigneeId: '' })
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Add Component</div>
      <input
        value={state.name}
        onChange={(e) => setState({ ...state, name: e.target.value })}
        placeholder="Component name"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
      />
      <input
        value={state.description}
        onChange={(e) => setState({ ...state, description: e.target.value })}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <MemberSelect value={state.leadId} onChange={(v) => setState({ ...state, leadId: v })} members={members} placeholder="No lead" />
        <MemberSelect value={state.defaultAssigneeId} onChange={(v) => setState({ ...state, defaultAssigneeId: v })} members={members} placeholder="No default assignee" />
      </div>
      <button
        onClick={submit}
        disabled={!state.name}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  )
}
