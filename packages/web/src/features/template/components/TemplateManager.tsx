import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templateApi, type CreateTemplatePayload } from '@/features/template/api'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { TYPE_ICONS } from '@/shared/config/constants'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/shared/lib/error'
import TipTapEditor from '@/shared/ui/editor/TipTapEditor'

const TYPES = ['TASK', 'BUG', 'EPIC', 'SUB_TASK'] as const

export default function TemplateManager() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('TASK')
  const [description, setDescription] = useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTemplatePayload) => templateApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      resetForm()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create template'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateTemplatePayload }) =>
      templateApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      resetForm()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update template'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete template'))
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditId(null)
    setName('')
    setType('TASK')
    setDescription('')
  }

  const startEdit = (t: { id: string; name: string; type: string; description: string | null }) => {
    setEditId(t.id)
    setName(t.name)
    setType(t.type)
    setDescription(t.description || '')
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateTemplatePayload = { name, type, description: description || undefined }
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400 dark:text-gray-500">Loading...</div>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Issue Templates</h2>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> New Template
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {editId ? 'Edit Template' : 'New Template'}
            </h3>
            <button type="button" onClick={resetForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bug Report"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description Template</label>
            <TipTapEditor
              content={description}
              onChange={setDescription}
              placeholder="Template description (supports rich text)"
              minHeight="120px"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {editId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {!templates?.length && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No templates yet. Create one to auto-fill issue descriptions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates?.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <span className="mt-0.5 text-lg">{TYPE_ICONS[t.type] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                  <span className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    {t.type.replace('_', ' ')}
                  </span>
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{t.description}</p>
                )}
                <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  by {t.creator.name}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this template?')) deleteMutation.mutate(t.id)
                  }}
                  className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
