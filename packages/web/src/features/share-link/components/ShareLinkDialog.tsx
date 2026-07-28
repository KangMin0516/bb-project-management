import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Copy, RefreshCw, Check, KeyRound, Ban, Loader2 } from 'lucide-react'
import {
  shareLinkApi,
  type ShareLinkAdminView,
  type ShareScope,
} from '../api/shareLinkApi'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { cn } from '@/shared/lib/utils'

interface ShareLinkDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = 'create' | 'manage'

/**
 * Scopes offerable in the UI. `BOARD` / `CALENDAR` / `LISTS` exist in the
 * enum but have no public read surface behind them yet, so listing them
 * would create links that 403 on use.
 *
 * `COMMENT` is called out as a write because it is the one scope that
 * lets a link holder change something on our side — worth a beat of
 * hesitation before ticking it.
 */
const SCOPE_OPTIONS: {
  value: ShareScope
  label: string
  hint: string
  write?: boolean
}[] = [
  {
    value: 'TIMELINE',
    label: 'Timeline',
    hint: 'Read-only Gantt view of the project',
  },
  {
    value: 'COMMENT',
    label: 'Comments',
    hint: 'Read and post inline comments on linked documents',
    write: true,
  },
]

/**
 * "Share" dialog from the Timeline toolbar. Two tabs:
 *  - **Create new**: passcode + expiry (default +90d, "No expiry") +
 *    scope tickbox. After submit, switches to a one-shot reveal of the
 *    URL + passcode (the only time the human sees the passcode — like
 *    an AWS access key).
 *  - **Manage**: list every existing share link for the project; copy
 *    the URL, rotate the passcode (inline form), or revoke (destructive
 *    confirmDialog). Hard-delete is ADMIN-only and not exposed here.
 *
 * Passcode generator uses `crypto.getRandomValues` for genuine entropy;
 * 10 chars of `a-z0-9` gives ~52 bits which is plenty given the 5/min/IP
 * unlock throttle and 20-fail per-link lockout enforced server-side.
 */
export default function ShareLinkDialog({
  projectId,
  open,
  onOpenChange,
}: ShareLinkDialogProps) {
  const [tab, setTab] = useState<Tab>('create')

  function close() {
    onOpenChange(false)
    // Reset tab on next open so users land on Create by default.
    setTimeout(() => setTab('create'), 200)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share with external clients</DialogTitle>
          <DialogDescription>
            Passcode-gated links, scoped per link. The passcode is
            bcrypt-hashed — once this dialog closes it can only be rotated,
            not retrieved.
          </DialogDescription>
        </DialogHeader>

        <div className="-mt-1 flex border-b border-gray-200 dark:border-gray-700">
          <TabButton active={tab === 'create'} onClick={() => setTab('create')}>
            Create new
          </TabButton>
          <TabButton active={tab === 'manage'} onClick={() => setTab('manage')}>
            Manage
          </TabButton>
        </div>

        {tab === 'create' ? (
          <CreateTab projectId={projectId} onClose={close} />
        ) : (
          <ManageTab projectId={projectId} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-xs font-medium transition',
        active
          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {children}
    </button>
  )
}

// ─── Create tab ──────────────────────────────────────────────

function CreateTab({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = useState('')
  const [noExpiry, setNoExpiry] = useState(false)
  const [expiryDays, setExpiryDays] = useState(90)
  const [scopes, setScopes] = useState<ShareScope[]>(['TIMELINE'])
  const [created, setCreated] = useState<{
    url: string
    passcode: string
    link: ShareLinkAdminView
  } | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const createMutation = useMutation({
    mutationFn: () =>
      shareLinkApi.create(projectId, {
        passcode,
        scopes,
        expiresAt: noExpiry
          ? null
          : new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      }),
    onSuccess: (link) => {
      setCreated({ url: link.url, passcode, link })
      void queryClient.invalidateQueries({
        queryKey: ['share-links', projectId],
      })
    },
    onError: (err) =>
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to create share link'), 'error'),
  })

  function generatePasscode() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789' // dropped lookalikes l/o/0/1
    const arr = new Uint32Array(10)
    crypto.getRandomValues(arr)
    setPasscode(Array.from(arr, (n) => alphabet[n % alphabet.length]).join(''))
  }

  async function copyBoth() {
    if (!created) return
    await navigator.clipboard.writeText(
      `URL: ${created.url}\nPasscode: ${created.passcode}`,
    )
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  if (created) {
    return (
      <>
        <div className="space-y-3 py-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              URL
            </div>
            <div className="mt-1 break-all rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 font-mono text-xs">
              {created.url}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Passcode
            </div>
            <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono text-sm font-semibold">
              {created.passcode}
            </div>
          </div>
          {created.link.expiresAt && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Expires {new Date(created.link.expiresAt).toLocaleString()}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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
    )
  }

  return (
    <>
      <div className="space-y-4 py-2">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Passcode
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
              onClick={generatePasscode}
              title="Generate a random passcode"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Expiry
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={expiryDays}
              onChange={(e) =>
                setExpiryDays(
                  Math.max(1, Math.min(365, Number(e.target.value) || 90)),
                )
              }
              disabled={noExpiry}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-400"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">days</span>
            <label className="ml-3 inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <Checkbox
                checked={noExpiry}
                onCheckedChange={(c) => setNoExpiry(c === true)}
              />
              No expiry
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Scope
          </label>
          <div className="mt-1.5 space-y-2">
            {SCOPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2"
              >
                <Checkbox
                  checked={scopes.includes(option.value)}
                  onCheckedChange={(checked) =>
                    setScopes((prev) =>
                      checked === true
                        ? [...prev, option.value]
                        : prev.filter((s) => s !== option.value),
                    )
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                    {option.label}
                    {option.write && (
                      <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        writes
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {scopes.length === 0 && (
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              Pick at least one scope — a link with none can&apos;t read
              anything.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={
            passcode.length < 6 ||
            scopes.length === 0 ||
            createMutation.isPending
          }
        >
          {createMutation.isPending ? 'Creating…' : 'Create link'}
        </Button>
      </DialogFooter>
    </>
  )
}

// ─── Manage tab ──────────────────────────────────────────────

function ManageTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['share-links', projectId],
    queryFn: () => shareLinkApi.list(projectId),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => shareLinkApi.revoke(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['share-links', projectId] })
      useToastStore.getState().addToast('Share link revoked', 'success')
    },
    onError: (err) =>
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to revoke'), 'error'),
  })

  async function handleRevoke(link: ShareLinkAdminView) {
    const ok = await confirmDialog({
      title: 'Revoke this share link?',
      description:
        'Anyone holding the URL + passcode will be locked out immediately. This cannot be undone — create a new link if you need to re-share.',
      confirmLabel: 'Revoke',
      destructive: true,
    })
    if (ok) revokeMutation.mutate(link.id)
  }

  if (listQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (listQuery.isError) {
    return (
      <div className="py-6 text-center text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load share links.
      </div>
    )
  }

  const links = listQuery.data ?? []
  if (links.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No share links yet. Switch to <strong>Create new</strong> to make one.
      </div>
    )
  }

  return (
    <div className="-mx-2 max-h-[60vh] overflow-y-auto py-2">
      <ul className="space-y-2 px-2">
        {links.map((link) => (
          <li
            key={link.id}
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
          >
            <ShareLinkRow
              link={link}
              projectId={projectId}
              onRevoke={() => handleRevoke(link)}
              revoking={revokeMutation.isPending && revokeMutation.variables === link.id}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ShareLinkRow({
  link,
  projectId,
  onRevoke,
  revoking,
}: {
  link: ShareLinkAdminView
  projectId: string
  onRevoke: () => void
  revoking: boolean
}) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [newPasscode, setNewPasscode] = useState('')
  const [rotatedReveal, setRotatedReveal] = useState<string | null>(null)

  const status = computeStatus(link)

  const rotateMutation = useMutation({
    mutationFn: (passcode: string) =>
      shareLinkApi.rotatePasscode(projectId, link.id, passcode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['share-links', projectId] })
      useToastStore.getState().addToast('Passcode rotated', 'success')
      setRotatedReveal(newPasscode)
      setNewPasscode('')
    },
    onError: (err) =>
      useToastStore
        .getState()
        .addToast(getErrorMessage(err, 'Failed to rotate passcode'), 'error'),
  })

  async function copyUrl() {
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function generate() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
    const arr = new Uint32Array(10)
    crypto.getRandomValues(arr)
    setNewPasscode(Array.from(arr, (n) => alphabet[n % alphabet.length]).join(''))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              …{link.token.slice(-8)}
            </code>
            <StatusPill kind={status} />
            {/* Scopes, so a project with several links tells you which is
                which without opening each one. */}
            {link.scopes.map((scope) => (
              <span
                key={scope}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  scope === 'COMMENT'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                )}
              >
                {scope.toLowerCase()}
              </span>
            ))}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            Created {new Date(link.createdAt).toLocaleDateString()}
            {link.expiresAt && (
              <> · Expires {new Date(link.expiresAt).toLocaleDateString()}</>
            )}
            <> · {link.accessCount} view{link.accessCount === 1 ? '' : 's'}</>
            {link.lastAccessedAt && (
              <> · Last {new Date(link.lastAccessedAt).toLocaleString()}</>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton title="Copy URL" onClick={copyUrl} disabled={status === 'Revoked'}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton
            title="Rotate passcode"
            onClick={() => {
              setRotateOpen((v) => !v)
              setRotatedReveal(null)
            }}
            disabled={status === 'Revoked'}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            title="Revoke"
            destructive
            onClick={onRevoke}
            disabled={status === 'Revoked' || revoking}
          >
            <Ban className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {rotateOpen && status !== 'Revoked' && (
        <div className="space-y-2 rounded border border-dashed border-gray-300 dark:border-gray-600 p-2">
          {rotatedReveal ? (
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                New passcode (copy now)
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                {rotatedReveal}
              </div>
              <button
                className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => {
                  setRotatedReveal(null)
                  setRotateOpen(false)
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="New passcode (6–64 chars)"
                minLength={6}
                maxLength={64}
                className="min-w-0 flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-2 py-1 text-xs font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={generate}>
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => rotateMutation.mutate(newPasscode)}
                disabled={newPasscode.length < 6 || rotateMutation.isPending}
              >
                {rotateMutation.isPending ? 'Rotating…' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IconButton({
  title,
  onClick,
  children,
  disabled,
  destructive,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  destructive?: boolean
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

type LinkStatus = 'Active' | 'Expired' | 'Revoked' | 'Locked'

function computeStatus(link: ShareLinkAdminView): LinkStatus {
  const now = Date.now()
  if (link.revokedAt) return 'Revoked'
  if (link.expiresAt && new Date(link.expiresAt).getTime() < now) return 'Expired'
  if (link.lockedUntil && new Date(link.lockedUntil).getTime() > now)
    return 'Locked'
  return 'Active'
}

function StatusPill({ kind }: { kind: LinkStatus }) {
  const map: Record<LinkStatus, string> = {
    Active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    Revoked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', map[kind])}>
      {kind}
    </span>
  )
}
