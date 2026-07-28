import api from '@/shared/api/client'

/**
 * Admin-side share-link API. Goes through the main JWT-authenticated
 * axios client. Public unlock + timeline live in `publicApi.ts` and use
 * a separate instance with the share JWT.
 */

/**
 * Mirrors the `ShareScope` enum in `schema.prisma`. `COMMENT` is the only
 * one that grants a *write* (posting doc comments), so it is never
 * implied by another scope and has to be ticked deliberately.
 */
export type ShareScope =
  | 'TIMELINE'
  | 'BOARD'
  | 'CALENDAR'
  | 'LISTS'
  | 'COMMENT'

export interface ShareLinkAdminView {
  id: string
  token: string
  url: string
  scopes: ShareScope[]
  expiresAt: string | null
  revokedAt: string | null
  lockedUntil: string | null
  accessCount: number
  lastAccessedAt: string | null
  createdAt: string
  /** Only present on `list` responses; omitted from `create` / mutation responses. */
  createdBy?: { id: string; name: string; avatar: string | null }
}

export interface CreateShareLinkInput {
  passcode: string
  scopes: ShareScope[]
  /** ISO date string, or null for "no expiry". */
  expiresAt: string | null
}

export const shareLinkApi = {
  create: (projectId: string, input: CreateShareLinkInput) =>
    api
      .post<{ data: ShareLinkAdminView }>(
        `/projects/${projectId}/share-links`,
        input,
      )
      .then((r) => r.data.data),

  list: (projectId: string) =>
    api
      .get<{ data: ShareLinkAdminView[] }>(`/projects/${projectId}/share-links`)
      .then((r) => r.data.data),

  revoke: (projectId: string, id: string) =>
    api
      .patch<{ data: ShareLinkAdminView }>(
        `/projects/${projectId}/share-links/${id}/revoke`,
      )
      .then((r) => r.data.data),

  rotatePasscode: (projectId: string, id: string, newPasscode: string) =>
    api
      .patch<{ data: ShareLinkAdminView }>(
        `/projects/${projectId}/share-links/${id}/rotate-passcode`,
        { newPasscode },
      )
      .then((r) => r.data.data),

  hardDelete: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/share-links/${id}`),
}
