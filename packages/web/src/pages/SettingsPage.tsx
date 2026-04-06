import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/projects'
import { userApi } from '@/api/users'
import { Trash2, UserPlus } from 'lucide-react'
import { useToastStore } from '@/stores/toast'

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId!),
    enabled: !!projectId,
  })

  const { data: labels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId!),
    enabled: !!projectId,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.list(),
  })

  // Project update
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
  }, [project])

  const updateProject = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectApi.update(projectId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to update project')
    },
  })

  const deleteProject = useMutation({
    mutationFn: () => projectApi.delete(projectId!),
    onSuccess: () => navigate('/'),
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to delete project')
    },
  })

  // Members
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState('DEVELOPER')

  const addMember = useMutation({
    mutationFn: () => projectApi.addMember(projectId!, { userId: addUserId, role: addRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      setAddUserId('')
    },
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to add member')
    },
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => projectApi.removeMember(projectId!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to remove member')
    },
  })

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      projectApi.updateMember(projectId!, memberId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to update role')
    },
  })

  // Labels
  const [newLabel, setNewLabel] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6366f1')

  const createLabel = useMutation({
    mutationFn: () => projectApi.createLabel(projectId!, { name: newLabel, color: newLabelColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
      setNewLabel('')
    },
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to create label')
    },
  })

  const seedLabels = useMutation({
    mutationFn: () => projectApi.seedLabels(projectId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['labels', projectId] }),
    onError: (err: any) => {
      useToastStore.getState().addToast(err.response?.data?.message || 'Failed to seed labels')
    },
  })

  if (!projectId) return null

  const memberUserIds = new Set(members?.map((m) => m.userId) || [])
  const availableUsers = users?.filter((u) => !memberUserIds.has(u.id)) || []

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900">Project Settings</h1>

      {/* General */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">General</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Project Key</label>
            <input
              value={project?.key || ''}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              rows={2}
            />
          </div>
          <button
            onClick={() => updateProject.mutate({ name, description: description || undefined })}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Save
          </button>
        </div>
      </section>

      {/* Members */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Members</h2>
        <div className="space-y-2">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                {m.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{m.user.name}</div>
                <div className="text-xs text-gray-500">{m.user.email}</div>
              </div>
              <select
                value={m.role}
                onChange={(e) => updateRole.mutate({ memberId: m.id, role: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none"
              >
                <option value="ADMIN">Admin</option>
                <option value="PM">PM</option>
                <option value="DEVELOPER">Developer</option>
              </select>
              <button
                onClick={() => removeMember.mutate(m.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {availableUsers.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="">Select user...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            >
              <option value="ADMIN">Admin</option>
              <option value="PM">PM</option>
              <option value="DEVELOPER">Developer</option>
            </select>
            <button
              onClick={() => addUserId && addMember.mutate()}
              disabled={!addUserId}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Add
            </button>
          </div>
        )}
      </section>

      {/* Labels */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Labels</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {labels?.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: l.color + '20', color: l.color }}
            >
              {l.name}
            </span>
          ))}
          {!labels?.length && (
            <span className="text-sm text-gray-400">No labels yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newLabelColor}
            onChange={(e) => setNewLabelColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-0"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
          />
          <button
            onClick={() => newLabel && createLabel.mutate()}
            disabled={!newLabel}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => seedLabels.mutate()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Seed Defaults
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-red-600">Danger Zone</h2>
        <p className="mb-3 text-xs text-gray-500">Deleting a project is irreversible.</p>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
              deleteProject.mutate()
            }
          }}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Delete Project
        </button>
      </section>
    </div>
  )
}
