import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { projectApi } from '@/api/projects'
import { userApi } from '@/api/users'
import { componentApi, type Component } from '@/api/components'
import { Trash2, UserPlus, Check, X, Pencil } from 'lucide-react'
import { slackApi } from '@/api/slack'
import SlackIntegration from '@/components/settings/SlackIntegration'
import DailyReportSettings from '@/components/settings/DailyReportSettings'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/lib/error'

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: slackStatus } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
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
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update project'))
    },
  })

  const deleteProject = useMutation({
    mutationFn: () => projectApi.delete(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete project'))
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
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to add member'))
    },
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => projectApi.removeMember(projectId!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to remove member'))
    },
  })

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      projectApi.updateMember(projectId!, memberId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update role'))
    },
  })

  // Components
  const { data: components } = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId!),
    enabled: !!projectId,
  })

  const [newComponentName, setNewComponentName] = useState('')
  const [newComponentDesc, setNewComponentDesc] = useState('')
  const [newComponentLead, setNewComponentLead] = useState('')
  const [newComponentDefaultAssignee, setNewComponentDefaultAssignee] = useState('')
  const [editingComponent, setEditingComponent] = useState<Component | null>(null)
  const [editComponentName, setEditComponentName] = useState('')
  const [editComponentDesc, setEditComponentDesc] = useState('')
  const [editComponentLead, setEditComponentLead] = useState('')
  const [editComponentDefaultAssignee, setEditComponentDefaultAssignee] = useState('')

  const createComponent = useMutation({
    mutationFn: () =>
      componentApi.create(projectId!, {
        name: newComponentName,
        description: newComponentDesc || undefined,
        leadId: newComponentLead || undefined,
        defaultAssigneeId: newComponentDefaultAssignee || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', projectId] })
      setNewComponentName('')
      setNewComponentDesc('')
      setNewComponentLead('')
      setNewComponentDefaultAssignee('')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create component'))
    },
  })

  const updateComponent = useMutation({
    mutationFn: () =>
      componentApi.update(projectId!, editingComponent!.id, {
        name: editComponentName,
        description: editComponentDesc || undefined,
        leadId: editComponentLead || null,
        defaultAssigneeId: editComponentDefaultAssignee || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', projectId] })
      setEditingComponent(null)
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update component'))
    },
  })

  const deleteComponent = useMutation({
    mutationFn: (componentId: string) => componentApi.delete(projectId!, componentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['components', projectId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete component'))
    },
  })

  const startEditComponent = (comp: Component) => {
    setEditingComponent(comp)
    setEditComponentName(comp.name)
    setEditComponentDesc(comp.description || '')
    setEditComponentLead(comp.leadId || '')
    setEditComponentDefaultAssignee(comp.defaultAssigneeId || '')
  }

  // Labels
  const [newLabel, setNewLabel] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6366f1')

  const createLabel = useMutation({
    mutationFn: () => projectApi.createLabel(projectId!, { name: newLabel, color: newLabelColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
      setNewLabel('')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create label'))
    },
  })

  const seedLabels = useMutation({
    mutationFn: () => projectApi.seedLabels(projectId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['labels', projectId] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to seed labels'))
    },
  })

  const currentUser = useAuthStore((s) => s.user)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      useToastStore.getState().addToast('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change password'))
    },
  })

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    setPasswordError('')
    changePassword.mutate()
  }

  const { data: pendingUsers } = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => userApi.listPending(),
    enabled: !!currentUser?.isSuperuser,
  })

  const approveUser = useMutation({
    mutationFn: (userId: string) => userApi.approve(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'pending'] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to approve user'))
    },
  })

  const rejectUser = useMutation({
    mutationFn: (userId: string) => userApi.reject(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'pending'] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reject user'))
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
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700 overflow-hidden">
                {m.user.avatar ? (
                  <img src={m.user.avatar} alt={m.user.name} className="h-full w-full object-cover" />
                ) : (
                  m.user.name.charAt(0).toUpperCase()
                )}
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

      {/* Components */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Components</h2>
        {components && components.length > 0 ? (
          <div className="mb-3 space-y-2">
            {components.map((comp) =>
              editingComponent?.id === comp.id ? (
                <div key={comp.id} className="space-y-2 rounded-lg border border-primary-200 bg-primary-50/30 p-3">
                  <input
                    value={editComponentName}
                    onChange={(e) => setEditComponentName(e.target.value)}
                    placeholder="Component name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <input
                    value={editComponentDesc}
                    onChange={(e) => setEditComponentDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editComponentLead}
                      onChange={(e) => setEditComponentLead(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                    >
                      <option value="">No lead</option>
                      {members?.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                    </select>
                    <select
                      value={editComponentDefaultAssignee}
                      onChange={(e) => setEditComponentDefaultAssignee(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
                    >
                      <option value="">No default assignee</option>
                      {members?.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editComponentName && updateComponent.mutate()}
                      disabled={!editComponentName}
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingComponent(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={comp.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{comp.name}</div>
                    {comp.description && (
                      <div className="text-xs text-gray-500">{comp.description}</div>
                    )}
                    <div className="mt-0.5 flex gap-3 text-xs text-gray-400">
                      {comp.lead && <span>Lead: {comp.lead.name}</span>}
                      {comp.defaultAssignee && <span>Default: {comp.defaultAssignee.name}</span>}
                      <span>{comp._count.issues} issue{comp._count.issues !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => startEditComponent(comp)}
                    className="text-gray-400 hover:text-primary-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete component "${comp.name}"?`)) {
                        deleteComponent.mutate(comp.id)
                      }
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mb-3 text-sm text-gray-400">No components yet</p>
        )}
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="text-xs font-medium text-gray-500">Add Component</div>
          <input
            value={newComponentName}
            onChange={(e) => setNewComponentName(e.target.value)}
            placeholder="Component name"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
          />
          <input
            value={newComponentDesc}
            onChange={(e) => setNewComponentDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newComponentLead}
              onChange={(e) => setNewComponentLead(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            >
              <option value="">No lead</option>
              {members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
            <select
              value={newComponentDefaultAssignee}
              onChange={(e) => setNewComponentDefaultAssignee(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            >
              <option value="">No default assignee</option>
              {members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => newComponentName && createComponent.mutate()}
            disabled={!newComponentName}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* User Approval (superuser only) */}
      {currentUser?.isSuperuser && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">User Approval</h2>
          {pendingUsers && pendingUsers.length > 0 ? (
            <div className="space-y-2">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => approveUser.mutate(u.id)}
                    className="rounded-md bg-green-50 p-1.5 text-green-600 hover:bg-green-100"
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => rejectUser.mutate(u.id)}
                    className="rounded-md bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No pending approval requests</p>
          )}
        </section>
      )}

      {/* Change Password */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          {passwordError && (
            <p className="text-xs text-red-500">{passwordError}</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* Slack Integration */}
      <SlackIntegration />

      {/* Daily Reports */}
      <DailyReportSettings
        projectId={projectId!}
        integrationId={slackStatus?.integrationId}
        slackConnected={slackStatus?.connected ?? false}
      />

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
