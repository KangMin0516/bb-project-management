import axios from 'axios'

/**
 * Axios instance for the public share surface. Distinct from the main
 * `client` because:
 *  - Token comes from sessionStorage (per-tab, dies on close), not
 *    localStorage. A leaked machine doesn't outlive the tab.
 *  - No refresh-token dance — share JWTs are short-lived (2h) and a
 *    re-prompt for the passcode is fine.
 *  - 401 redirects to the passcode form, not to /login.
 */

const TOKEN_KEY = (token: string) => `bbpm.share.${token}`

export interface SharedProjectMeta {
  projectKey: string
  projectName: string
  sharedByName: string
  scopes: string[]
  expiresAt: string | null
}

export interface SharedUnlockResponse extends SharedProjectMeta {
  shareJwt: string
}

export interface PublicTimelineIssue {
  id: string
  number: number
  title: string
  type: 'DOMAIN' | 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK'
  status: string
  priority: string
  startDate: string | null
  dueDate: string | null
  /** Anchor used by the timeline lib when `startDate` is null. */
  createdAt: string
  parentId: string | null
  assignee: { name: string; avatar: string | null } | null
  labels: Array<{ name: string; color: string }>
}

/** Read the current share token's JWT from sessionStorage. */
export function readShareJwt(token: string): string | null {
  return sessionStorage.getItem(TOKEN_KEY(token))
}

export function writeShareJwt(token: string, jwt: string): void {
  sessionStorage.setItem(TOKEN_KEY(token), jwt)
}

export function clearShareJwt(token: string): void {
  sessionStorage.removeItem(TOKEN_KEY(token))
}

const publicClient = axios.create({
  baseURL: '/api/public',
  headers: { 'Content-Type': 'application/json' },
})

/** A reference the interceptor can read without coupling to React state. */
let currentToken: string | null = null

export function setCurrentShareToken(token: string | null): void {
  currentToken = token
}

publicClient.interceptors.request.use((config) => {
  // Skip the auth header on the unlock request itself — the JWT
  // doesn't exist yet when the user first hits Unlock.
  const url = config.url ?? ''
  if (url.endsWith('/unlock') || url.includes('/unlock?')) return config
  if (!currentToken) return config
  const jwt = readShareJwt(currentToken)
  if (jwt) config.headers.Authorization = `Bearer ${jwt}`
  return config
})

/**
 * Drop the JWT for any response that means the cached token can't be
 * used again — `401` (token expired / invalid) and `410` (link revoked
 * or past `expiresAt`). Without clearing on 410 the passcode page sees
 * a still-valid JWT and bounces back to the timeline, which 410s again
 * → redirect loop.
 *
 * `423` (locked link) is intentionally NOT cleared: the JWT is fine,
 * the link is just temporarily inaccessible.
 *
 * Navigation is left to the page — the interceptor doesn't own the
 * router.
 */
publicClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status as number | undefined
    if ((status === 401 || status === 410) && currentToken) {
      clearShareJwt(currentToken)
    }
    return Promise.reject(error)
  },
)

/**
 * Every API response is `{ data: <payload> }` via the BE
 * `TransformInterceptor`; unwrap once here so callers see the payload
 * directly.
 */
export const sharePublicApi = {
  unlock: (token: string, passcode: string) =>
    publicClient
      .post<{ data: SharedUnlockResponse }>(`/share/${token}/unlock`, { passcode })
      .then((r) => r.data.data),

  project: (token: string) =>
    publicClient
      .get<{ data: SharedProjectMeta }>(`/share/${token}/project`)
      .then((r) => r.data.data),

  timeline: (token: string) =>
    publicClient
      .get<{ data: { issues: PublicTimelineIssue[] } }>(`/share/${token}/timeline`)
      .then((r) => r.data.data),
}
