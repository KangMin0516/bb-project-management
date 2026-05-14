import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  credentialApi,
  type Credential,
  type CredentialEntry,
  type CreateCredentialPayload,
} from '@/features/credentials/api'
import {
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  Pencil,
  Shield,
  Key,
  Database,
  Cloud,
  MessageSquare,
  Settings,
  ArrowLeft,
} from 'lucide-react'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { confirmDialog } from '@/shared/ui/confirm-dialog'

const SERVICE_TYPES = ['AWS', 'GCP', 'DB', 'SLACK', 'CUSTOM'] as const

function getServiceIcon(type: string) {
  switch (type) {
    case 'AWS':
    case 'GCP':
      return Cloud
    case 'DB':
      return Database
    case 'SLACK':
      return MessageSquare
    default:
      return Settings
  }
}

function getServiceColor(type: string) {
  switch (type) {
    case 'AWS':
      return 'bg-orange-100 text-orange-700'
    case 'GCP':
      return 'bg-blue-100 text-blue-700'
    case 'DB':
      return 'bg-green-100 text-green-700'
    case 'SLACK':
      return 'bg-purple-100 text-purple-700'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }
}

export default function CredentialManager() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)

  const { data: credentials } = useQuery({
    queryKey: ['credentials', projectId],
    queryFn: () => credentialApi.list(projectId!),
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialApi.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', projectId] })
      setSelectedCredential(null)
      useToastStore.getState().addToast('Credential deleted', 'success')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete credential'), 'error')
    },
  })

  // Rendered next to both Detail and List views because the modal is
  // reachable from Edit (Detail view) and Add (List view).
  const modal = showModal && (
    <CredentialModal
      projectId={projectId!}
      credential={editingCredential}
      onClose={() => {
        setShowModal(false)
        setEditingCredential(null)
      }}
      onSaved={(cred) => {
        setShowModal(false)
        setEditingCredential(null)
        setSelectedCredential(cred)
      }}
    />
  )

  if (selectedCredential) {
    return (
      <>
        <CredentialDetail
          credential={selectedCredential}
          projectId={projectId!}
          onBack={() => setSelectedCredential(null)}
          onEdit={(cred) => {
            setEditingCredential(cred)
            setShowModal(true)
          }}
          onDelete={async (id) => {
            if (await confirmDialog({
              title: 'Are you sure you want to delete this credential?',
              confirmLabel: 'Delete',
              destructive: true,
            })) {
              deleteMutation.mutate(id)
            }
          }}
        />
        {modal}
      </>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Credentials</h2>
        </div>
        <button
          onClick={() => {
            setEditingCredential(null)
            setShowModal(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {credentials && credentials.length > 0 ? (
        <div className="grid gap-3">
          {credentials.map((cred) => {
            const Icon = getServiceIcon(cred.serviceType)
            const colorClass = getServiceColor(cred.serviceType)
            return (
              <button
                key={cred.id}
                onClick={() => setSelectedCredential(cred)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left transition hover:border-primary-200 hover:shadow-sm"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cred.name}</div>
                  {cred.description && (
                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">{cred.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <Key className="mr-1 inline h-3 w-3" />
                    {cred.entries.length} {cred.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{cred.serviceType}</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-10 text-center">
          <Shield className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">No credentials yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Add credentials to store service access keys securely</p>
        </div>
      )}

      {modal}
    </div>
  )
}

function CredentialDetail({
  credential,
  projectId,
  onBack,
  onEdit,
  onDelete,
}: {
  credential: Credential
  projectId: string
  onBack: () => void
  onEdit: (cred: Credential) => void
  onDelete: (id: string) => void
}) {
  const [revealedEntries, setRevealedEntries] = useState<CredentialEntry[] | null>(null)
  const [revealing, setRevealing] = useState(false)

  const handleReveal = async () => {
    if (revealedEntries) {
      setRevealedEntries(null)
      return
    }
    setRevealing(true)
    try {
      const revealed = await credentialApi.reveal(projectId, credential.id)
      setRevealedEntries(revealed.entries)
    } catch {
      useToastStore.getState().addToast('Failed to reveal credentials. You may not have permission.', 'error')
    } finally {
      setRevealing(false)
    }
  }

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value)
    useToastStore.getState().addToast('Copied to clipboard', 'success')
  }

  const entries = revealedEntries || credential.entries
  const Icon = getServiceIcon(credential.serviceType)
  const colorClass = getServiceColor(credential.serviceType)

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </button>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{credential.name}</h3>
              {credential.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{credential.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(credential)}
              className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary-600"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(credential.id)}
              className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {credential.url && (
          <div className="mb-4">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">URL: </span>
            <a
              href={credential.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:underline"
            >
              {credential.url}
            </a>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Entries</span>
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {revealedEntries ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Hide values
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Reveal values
              </>
            )}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Key</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map((entry, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{entry.key}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-500">
                    {entry.sensitive && !revealedEntries ? '••••••••' : entry.value}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => {
                        if (entry.sensitive && !revealedEntries) {
                          useToastStore.getState().addToast('Reveal values first to copy', 'info')
                          return
                        }
                        handleCopy(entry.value)
                      }}
                      className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span>Created by {credential.createdBy.name}</span>
          <span>·</span>
          <span>{new Date(credential.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}

function CredentialModal({
  projectId,
  credential,
  onClose,
  onSaved,
}: {
  projectId: string
  credential: Credential | null
  onClose: () => void
  onSaved: (cred: Credential) => void
}) {
  const queryClient = useQueryClient()
  const { open, requestClose } = useDeferredClose(onClose)
  const [name, setName] = useState(credential?.name || '')
  const [serviceType, setServiceType] = useState(credential?.serviceType || 'CUSTOM')
  const [description, setDescription] = useState(credential?.description || '')
  const [url, setUrl] = useState(credential?.url || '')
  const [entries, setEntries] = useState<CredentialEntry[]>(
    credential?.entries.length
      ? credential.entries.map((e) => ({ ...e, value: e.sensitive ? '' : e.value }))
      : [{ key: '', value: '', sensitive: true }],
  )

  const createMutation = useMutation({
    mutationFn: (data: CreateCredentialPayload) => credentialApi.create(projectId, data),
    onSuccess: (cred) => {
      queryClient.invalidateQueries({ queryKey: ['credentials', projectId] })
      onSaved(cred)
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create credential'), 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateCredentialPayload>) =>
      credentialApi.update(projectId, credential!.id, data),
    onSuccess: (cred) => {
      queryClient.invalidateQueries({ queryKey: ['credentials', projectId] })
      onSaved(cred)
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update credential'), 'error')
    },
  })

  const addEntry = () => {
    setEntries([...entries, { key: '', value: '', sensitive: true }])
  }

  const removeEntry = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx))
  }

  const updateEntry = (idx: number, field: keyof CredentialEntry, value: string | boolean) => {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validEntries = entries.filter((en) => en.key.trim())
    const payload: CreateCredentialPayload = {
      name,
      serviceType,
      description: description || undefined,
      url: url || undefined,
      entries: validEntries,
    }

    if (credential) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose() }}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <DialogTitle className="text-base">
            {credential ? 'Edit Credential' : 'Add Credential'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {credential ? 'Edit credential details and entries' : 'Add a new credential with entries'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Service Type</label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AWS Production"
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Entries</label>
                <button
                  type="button"
                  onClick={addEntry}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  <Plus className="h-3 w-3" />
                  Add entry
                </button>
              </div>
              <div className="space-y-2">
                {entries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={entry.key}
                      onChange={(e) => updateEntry(idx, 'key', e.target.value)}
                      placeholder="Key"
                      className="w-1/3 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    <input
                      value={entry.value}
                      onChange={(e) => updateEntry(idx, 'value', e.target.value)}
                      placeholder="Value"
                      type={entry.sensitive ? 'password' : 'text'}
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateEntry(idx, 'sensitive', !entry.sensitive)}
                      className={`rounded p-1.5 ${entry.sensitive ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500'}`}
                      title={entry.sensitive ? 'Sensitive (masked)' : 'Not sensitive'}
                    >
                      {entry.sensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEntry(idx)}
                        className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || isSubmitting}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {credential ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
