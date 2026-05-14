import { specApi, type SpecListItem, type SpecDetail } from '@/features/specification/api'

/**
 * Repository layer for Specifications. Hides URL params and naming for
 * download/comment side-roads behind business-named methods.
 */
export const specRepository = {
  /** List specs in a project, optionally filtered. */
  findInProject(
    projectId: string,
    filters?: { category?: string; status?: string },
  ): Promise<SpecListItem[]> {
    return specApi.list(projectId, filters)
  },

  /** Full spec with sections + comments + issue links. */
  findOne(projectId: string, specId: string): Promise<SpecDetail> {
    return specApi.get(projectId, specId)
  },

  create: specApi.create,
  update: specApi.update,
  remove: specApi.delete,

  /** Comments. */
  listComments: specApi.listComments,
  createComment: specApi.createComment,
  updateComment: specApi.updateComment,
  deleteComment: specApi.deleteComment,

  /** Export to Markdown. */
  downloadOne: specApi.downloadOne,
  downloadAll: specApi.downloadAll,
}

export type SpecRepository = typeof specRepository
