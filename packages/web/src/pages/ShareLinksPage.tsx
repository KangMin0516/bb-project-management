import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import {
  shareLinkApi,
  type ShareLinkAdminView,
  type ShareScope,
} from '@/features/share-link/api/shareLinkApi'
import ShareLinkDialog from '@/features/share-link/components/ShareLinkDialog'
import { useProjectRole, isPmOrAdmin } from '@/features/share-link/hooks/useProjectRole'
import { useAuthStore } from '@/features/auth/store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { cn } from '@/shared/lib/utils'

type LinkStatus = 'Active' | 'Expired' | 'Revoked' | 'Locked'

export default function ShareLinksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const role = useProjectRole(projectId)
  const isSuperuser = useAuthStore((s) => !!s.user?.isSuperuser)
  const allowed = isPmOrAdmin(role) || isSuperuser
  const [createOpen, setCreateOpen] = useState(false)

  const listQuery = useQuery({
    queryKey: ['share-links', projectId],
    queryFn: () => shareLinkApi.list(projectId!),
    enabled: !!projectId && allowed,
  })

  if (!projectId) return null

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <div className="font-semibold">PM↑ only</div>
            <p className="mt-1">
              Public share links are managed by project managers. Ask a PM or
              admin on this project to share Timeline with external clients.
            </p>
            <Link
              to={`/projects/${projectId}`}
              className="mt-3 inline-block text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              ← Back to project
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const links = listQuery.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Public share links
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Passcode-gated read-only links to this project&apos;s Timeline.
            Each link has its own passcode so you can revoke one client
            without disturbing others.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New share link
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-5 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t load share links. Refresh the page or try again later.
        </div>
      ) : links.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <ShareLinksTable links={links} projectId={projectId} />
      )}

      <ShareLinkDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        <KeyRound className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </div>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        No share links yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
        Create a passcode-protected link so external clients can view this
        project&apos;s Timeline without a BB PM account.
      </p>
      <Button className="mt-4" size="sm" onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" />
        Create your first link
      </Button>
    </div>
  )
}

function ShareLinksTable({
  links,
  projectId,
}: {
  links: ShareLinkAdminView[]
  projectId: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5">Created by</th>
              <th className="px-4 py-2.5">Scopes</th>
              <th className="px-4 py-2.5">Expires</th>
              <th className="px-4 py-2.5">Last accessed</th>
              <th className="px-4 py-2.5 text-right">Views</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {links.map((link) => (
              <ShareLinkTableRow
                key={link.id}
                link={link}
                projectId={projectId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShareLinkTableRow({
  link,
  projectId,
}: {
  link: ShareLinkAdminView
  projectId: string
}) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)

  const status = computeStatus(link)
  const isTerminal = status === 'Revoked'

  const revokeMutation = useMutation({
    mutationFn: () => shareLinkApi.revoke(projectId, link.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['share-links', projectId],
      })
      useToastStore.getState().addToast('Share link revoked', 'success')
    },
    onError: (err) =>
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to revoke'), 'error'),
  })

  async function handleRevoke() {
    const ok = await confirmDialog({
      title: 'Revoke this share link?',
      description:
        'Anyone holding the URL + passcode will be locked out immediately. The public URL will start returning 410 Gone. This cannot be undone — create a new link if you need to re-share.',
      confirmLabel: 'Revoke',
      destructive: true,
    })
    if (ok) revokeMutation.mutate()
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <tr className="text-gray-700 dark:text-gray-200">
        <td className="px-4 py-3 align-top">
          <div className="text-xs text-gray-700 dark:text-gray-200">
            {new Date(link.createdAt).toLocaleDateString()}
          </div>
          <code className="text-[10px] text-gray-400 dark:text-gray-500">
            …{link.token.slice(-8)}
          </code>
        </td>
        <td className="px-4 py-3 align-top text-xs">
          {link.createdBy?.name ?? '—'}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex flex-wrap gap-1">
            {link.scopes.map((s) => (
              <ScopePill key={s} scope={s} />
            ))}
          </div>
        </td>
        <td className="px-4 py-3 align-top text-xs">
          {link.expiresAt ? (
            <span>{new Date(link.expiresAt).toLocaleDateString()}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">Never</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-xs">
          {link.lastAccessedAt ? (
            new Date(link.lastAccessedAt).toLocaleString()
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-right text-xs tabular-nums">
          {link.accessCount}
        </td>
        <td className="px-4 py-3 align-top">
          <StatusPill kind={status} />
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex justify-end gap-1">
            <IconButton
              title="Copy URL"
              onClick={handleCopyUrl}
              disabled={isTerminal}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </IconButton>
            <IconButton
              title="Rotate passcode"
              onClick={() => setRotateOpen(true)}
              disabled={isTerminal}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              title="Revoke"
              onClick={handleRevoke}
              disabled={isTerminal || revokeMutation.isPending}
              destructive
            >
              <Ban className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </td>
      </tr>

      {rotateOpen && (
        <RotatePasscodeDialog
          projectId={projectId}
          link={link}
          open={rotateOpen}
          onOpenChange={setRotateOpen}
        />
      )}
    </>
  )
}

function RotatePasscodeDialog({
  projectId,
  link,
  open,
  onOpenChange,
}: {
  projectId: string
  link: ShareLinkAdminView
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const rotateMutation = useMutation({
    mutationFn: () =>
      shareLinkApi.rotatePasscode(projectId, link.id, passcode),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['share-links', projectId],
      })
      useToastStore.getState().addToast('Passcode rotated', 'success')
      setRevealed(passcode)
      setPasscode('')
    },
    onError: (err) =>
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to rotate passcode'), 'error'),
  })

  function generate() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
    const arr = new Uint32Array(10)
    crypto.getRandomValues(arr)
    setPasscode(
      Array.from(arr, (n) => alphabet[n % alphabet.length]).join(''),
    )
  }

  async function copyBoth() {
    if (!revealed) return
    await navigator.clipboard.writeText(
      `URL: ${link.url}\nPasscode: ${revealed}`,
    )
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  function close() {
    onOpenChange(false)
    setTimeout(() => {
      setPasscode('')
      setRevealed(null)
      setCopiedAll(false)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rotate passcode</DialogTitle>
          <DialogDescription>
            The current passcode is invalidated immediately. Existing
            sessions on this link stay alive until their JWT expires (≤2h),
            but new unlocks require the new passcode.
          </DialogDescription>
        </DialogHeader>

        {revealed ? (
          <>
            <div className="space-y-3 py-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  New passcode (copy now — won&apos;t be shown again)
                </div>
                <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {revealed}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  URL (unchanged)
                </div>
                <div className="mt-1 break-all rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-100">
                  {link.url}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Done
              </Button>
              <Button onClick={copyBoth}>
                {copiedAll ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedAll ? 'Copied' : 'Copy URL + passcode'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  New passcode
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="6–64 characters"
                    minLength={6}
                    maxLength={64}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generate}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={() => rotateMutation.mutate()}
                disabled={passcode.length < 6 || rotateMutation.isPending}
              >
                {rotateMutation.isPending ? 'Rotating…' : 'Rotate'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function IconButton({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 dark:border-gray-700 transition disabled:cursor-not-allowed disabled:opacity-40',
        destructive
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
      )}
    >
      {children}
    </button>
  )
}

function ScopePill({ scope }: { scope: ShareScope }) {
  return (
    <span className="rounded bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
      {scope}
    </span>
  )
}

function computeStatus(link: ShareLinkAdminView): LinkStatus {
  const now = Date.now()
  if (link.revokedAt) return 'Revoked'
  if (link.expiresAt && new Date(link.expiresAt).getTime() < now)
    return 'Expired'
  if (link.lockedUntil && new Date(link.lockedUntil).getTime() > now)
    return 'Locked'
  return 'Active'
}

function StatusPill({ kind }: { kind: LinkStatus }) {
  const map: Record<LinkStatus, string> = {
    Active:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Expired:
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    Revoked:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Locked:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-medium',
        map[kind],
      )}
    >
      {kind}
    </span>
  )
}
