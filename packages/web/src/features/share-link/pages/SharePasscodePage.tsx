import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Lock, ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  clearShareJwt,
  readShareJwt,
  setCurrentShareToken,
  sharePublicApi,
  writeShareJwt,
} from '../api/publicApi'

type ErrorState =
  | { kind: 'wrong' | 'gone' | 'network' | 'session-expired' }
  | { kind: 'locked'; retryAfter?: number }

/**
 * Public, unauthenticated landing for `/share/:token`. Outside the
 * AuthGuard so external clients never see a login screen.
 *
 * Self-redirects to `/share/:token/timeline` if a valid JWT already
 * exists in sessionStorage — keeps the form from re-appearing on a
 * page reload during the JWT lifetime.
 */
export default function SharePasscodePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // `reason` arrives via `navigate(..., { state })` from SharedTimelinePage
  // when it was forced to redirect here on 401/410. Seeds the inline
  // banner so the user understands why they landed back at the form
  // instead of seeing it blank.
  const reasonFromNav = (location.state as { reason?: string } | null)?.reason
  const seededError: ErrorState | null =
    reasonFromNav === 'gone'
      ? { kind: 'gone' }
      : reasonFromNav === 'session-expired'
        ? { kind: 'session-expired' }
        : null

  const [passcode, setPasscode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<ErrorState | null>(seededError)

  function handlePasscodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasscode(e.target.value)
    // Clear the seeded "gone"/"session-expired" banner the moment the
    // user starts typing — they've acknowledged it.
    if (error && error.kind !== 'locked') setError(null)
  }

  useEffect(() => {
    if (!token) return
    setCurrentShareToken(token)
    // Auto-redirect to /timeline only when we have a fresh JWT AND the
    // current navigation isn't a kick-out from there (avoid bouncing
    // back into the broken state).
    if (!reasonFromNav && readShareJwt(token))
      navigate(`/share/${token}/timeline`, { replace: true })
  }, [token, navigate, reasonFromNav])

  if (!token) {
    return (
      <CenteredCard>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Invalid share link
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          The URL is missing the share token.
        </p>
      </CenteredCard>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passcode || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await sharePublicApi.unlock(token!, passcode)
      writeShareJwt(token!, result.shareJwt)
      navigate(`/share/${token!}/timeline`, { replace: true })
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const body = axios.isAxiosError(err)
        ? (err.response?.data as { retryAfterSeconds?: number } | undefined)
        : undefined
      if (status === 410) setError({ kind: 'gone' })
      else if (status === 423)
        setError({ kind: 'locked', retryAfter: body?.retryAfterSeconds })
      else if (status === 401 || status === 400 || status === 429)
        setError({ kind: 'wrong' })
      else setError({ kind: 'network' })
      // On 401 the publicApi interceptor already cleared any stale JWT
      // for this token; nothing else to do here.
      clearShareJwt(token!)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CenteredCard>
      <div className="mb-4 flex items-center justify-center">
        <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 p-3 text-indigo-600 dark:text-indigo-300">
          <Lock className="h-6 w-6" />
        </div>
      </div>
      <h1 className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
        Enter passcode
      </h1>
      <p className="mt-1 text-center text-sm text-gray-600 dark:text-gray-400">
        This link is shared with a passcode. Enter it below to view the timeline.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="password"
          autoFocus
          autoComplete="off"
          value={passcode}
          onChange={handlePasscodeChange}
          placeholder="Passcode"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-label="Passcode"
        />
        <Button type="submit" className="w-full" disabled={!passcode || isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>

      {error && <ErrorBanner state={error} />}

      <p className="mt-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
        Powered by Burningbros
      </p>
    </CenteredCard>
  )
}

function ErrorBanner({ state }: { state: ErrorState }) {
  const { msg, tone } = bannerCopy(state)
  const palette =
    tone === 'warn'
      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs ${palette}`}
    >
      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{msg}</span>
    </div>
  )
}

function bannerCopy(state: ErrorState): { msg: string; tone: 'warn' | 'error' } {
  switch (state.kind) {
    case 'wrong':
      return { msg: 'Wrong passcode. Try again.', tone: 'error' }
    case 'gone':
      return {
        msg: 'This share link is no longer available. Ask the project owner for a new one.',
        tone: 'error',
      }
    case 'session-expired':
      return {
        msg: 'Your session expired. Enter the passcode again to keep viewing.',
        tone: 'warn',
      }
    case 'locked': {
      const mins = state.retryAfter ? Math.ceil(state.retryAfter / 60) : null
      return {
        msg: mins
          ? `Too many failed attempts. Try again in about ${mins} minute${mins > 1 ? 's' : ''}.`
          : 'Too many failed attempts. Try again later.',
        tone: 'warn',
      }
    }
    case 'network':
      return { msg: 'Something went wrong reaching the server.', tone: 'error' }
  }
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        {children}
      </div>
    </div>
  )
}
