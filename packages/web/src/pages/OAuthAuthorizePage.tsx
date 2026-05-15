import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store'
import api from '@/shared/api/client'
import { getErrorMessage } from '@/shared/lib/error'

interface ClientInfo {
  client_id: string
  client_name: string
  redirect_uris: string[]
  scopes: string[]
}

const SCOPE_LABELS: Record<string, string> = {
  mcp: 'Read and write to your projects, issues, comments, and labels',
  openid: 'Verify your BBPM identity',
  profile: 'Read your name and avatar',
  email: 'Read your email address',
}

export default function OAuthAuthorizePage() {
  const { user, token, isLoading } = useAuthStore()
  const [params] = useSearchParams()

  const required = useMemo(
    () => ({
      response_type: params.get('response_type') ?? '',
      client_id: params.get('client_id') ?? '',
      redirect_uri: params.get('redirect_uri') ?? '',
      scope: params.get('scope') ?? 'mcp',
      state: params.get('state') ?? '',
      code_challenge: params.get('code_challenge') ?? '',
      code_challenge_method: params.get('code_challenge_method') ?? '',
      resource: params.get('resource') ?? undefined,
    }),
    [params],
  )

  const validation = validateAuthorizeParams(required)

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (validation || !token) return
    let cancelled = false
    api
      .get<ClientInfo>('/oauth/authorize/client', {
        params: { client_id: required.client_id },
      })
      .then((res) => {
        if (cancelled) return
        setClient(res.data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(getErrorMessage(err, 'Failed to load OAuth client'))
      })
    return () => {
      cancelled = true
    }
  }, [validation, token, required.client_id])

  // Auth gate. We render our own gate here (not <AuthGuard>) so the
  // OAuth params survive the round-trip to /login and back.
  if (isLoading) {
    return <CenteredSpinner />
  }
  if (!token) {
    const nextUrl = `/oauth/authorize?${params.toString()}`
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(nextUrl)}`}
        replace
      />
    )
  }

  if (validation) {
    return <ErrorCard title="Invalid OAuth request" message={validation} />
  }

  if (loadError) {
    return <ErrorCard title="Could not start authorization" message={loadError} />
  }

  if (!client) {
    return <CenteredSpinner />
  }

  if (!client.redirect_uris.includes(required.redirect_uri)) {
    return (
      <ErrorCard
        title="redirect_uri not allowed"
        message={`The redirect URI "${required.redirect_uri}" is not registered for this client.`}
      />
    )
  }

  const requestedScopes = required.scope
    .split(/\s+/)
    .filter(Boolean)
    .filter((s) => client.scopes.includes(s))

  async function approve() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.post<{ code: string; state?: string }>(
        '/oauth/authorize/consent',
        {
          client_id: required.client_id,
          redirect_uri: required.redirect_uri,
          scope: requestedScopes.join(' '),
          state: required.state,
          code_challenge: required.code_challenge,
          code_challenge_method: required.code_challenge_method,
          resource: required.resource,
        },
      )
      const url = new URL(required.redirect_uri)
      url.searchParams.set('code', res.data.code)
      if (required.state) url.searchParams.set('state', required.state)
      window.location.assign(url.toString())
    } catch (err: unknown) {
      setSubmitError(getErrorMessage(err, 'Could not issue authorization code'))
      setSubmitting(false)
    }
  }

  function deny() {
    const url = new URL(required.redirect_uri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set(
      'error_description',
      'User denied the authorization request',
    )
    if (required.state) url.searchParams.set('state', required.state)
    window.location.assign(url.toString())
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800 dark:shadow-gray-900/50">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary-100 p-2 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Authorize {client.client_name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as {user?.email}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{client.client_name}</span> is requesting
          access to your Burningbros Project Management account. It will be able
          to:
        </p>

        <ul className="mb-6 space-y-2 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-700/50">
          {requestedScopes.map((s) => (
            <li key={s} className="flex gap-2 text-gray-700 dark:text-gray-200">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>{SCOPE_LABELS[s] ?? s}</span>
            </li>
          ))}
        </ul>

        <details className="mb-6 text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer select-none">
            Technical details
          </summary>
          <dl className="mt-2 space-y-1">
            <DetailRow label="Client ID" value={client.client_id} />
            <DetailRow label="Redirect URI" value={required.redirect_uri} />
            {required.resource && (
              <DetailRow label="Resource" value={required.resource} />
            )}
          </dl>
        </details>

        {submitError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={deny}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={submitting || requestedScopes.length === 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Authorizing…' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  )
}

function validateAuthorizeParams(p: {
  response_type: string
  client_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
}): string | null {
  if (p.response_type !== 'code')
    return 'response_type must be "code" (only authorization code flow is supported).'
  if (!p.client_id) return 'client_id is required.'
  if (!p.redirect_uri) return 'redirect_uri is required.'
  if (!p.code_challenge) return 'PKCE code_challenge is required.'
  if (p.code_challenge_method !== 'S256')
    return 'code_challenge_method must be "S256".'
  try {
    new URL(p.redirect_uri)
  } catch {
    return 'redirect_uri is not a valid URL.'
  }
  return null
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
          <X className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  )
}

function CenteredSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-medium">{label}</dt>
      <dd className="break-all font-mono">{value}</dd>
    </div>
  )
}
