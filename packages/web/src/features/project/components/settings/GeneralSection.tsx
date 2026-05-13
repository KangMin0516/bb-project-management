import { useEffect, useState } from 'react'
import type { ProjectDetail } from '@/features/project/api'
import SettingsSection from './SettingsSection'

interface GeneralSectionProps {
  project: ProjectDetail | undefined
  onSave: (data: { name: string; description?: string }) => void
}

/**
 * Edit project name + description. Inputs are uncontrolled mirrors of the
 * server data — we re-sync from `project` so a successful save reflects
 * back without losing the user's in-progress edit if it differs.
 */
export default function GeneralSection({ project, onSave }: GeneralSectionProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
  }, [project])

  return (
    <SettingsSection title="General">
      <div className="space-y-3">
        <Field label="Project Key">
          <input
            value={project?.key || ''}
            disabled
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-400 dark:text-gray-500"
          />
        </Field>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            rows={2}
          />
        </Field>
        <button
          onClick={() => onSave({ name, description: description || undefined })}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Save
        </button>
      </div>
    </SettingsSection>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}
