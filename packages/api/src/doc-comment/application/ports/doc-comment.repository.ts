/**
 * Repository port for DocComment. Domain decisions live in
 * `domain/doc-comment.entity.ts`, persistence in the Prisma impl; tests
 * inject a fake. Mirrors the ShareLink split (refactor-plan §6.3).
 */

export const DOC_COMMENT_REPOSITORY = Symbol('DOC_COMMENT_REPOSITORY');

/** Author identity as stored. Exactly one of the two is set in practice. */
export interface DocCommentAuthor {
  user: { id: string; name: string; avatar: string | null } | null;
  guestName: string | null;
}

export interface DocCommentRecord {
  id: string;
  docKey: string;
  containerId: string | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  textOffset: number | null;
  body: string;
  parentId: string | null;
  /** Never serialised to a client — see the schema comment. */
  authorKey: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: DocCommentAuthor;
}

export interface CreateDocCommentInput {
  projectId: string;
  docKey: string;
  containerId: string | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  textOffset: number | null;
  body: string;
  parentId: string | null;
  /** Set for a member session; mutually exclusive with `guestName`. */
  userId: string | null;
  guestName: string | null;
  authorKey: string | null;
  shareLinkId: string | null;
}

/** Open-thread tally per document, for nav badges. */
export interface DocCommentCount {
  docKey: string;
  open: number;
  resolved: number;
}

/** The subset the domain needs to authorise a mutation. */
export interface DocCommentAuthRow {
  id: string;
  projectId: string;
  docKey: string;
  parentId: string | null;
  authorKey: string | null;
  userId: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface DocCommentRepository {
  /**
   * Every comment on one document, heads and replies together, oldest
   * first; `ListDocCommentsUseCase` assembles the threads. Unpaginated
   * on purpose — a spec page carries tens of comments, and the client
   * polls the whole document anyway to detect other people's edits.
   */
  findByDoc(projectId: string, docKey: string): Promise<DocCommentRecord[]>;

  /**
   * Every comment in the project, oldest first, across all documents —
   * what the publishing site's rail needs to list open questions without
   * the reader opening each page to discover them. `limit` is a ceiling,
   * not a page: there is no cursor, and the caller reports truncation
   * rather than silently showing a partial set.
   */
  findByProject(projectId: string, limit: number): Promise<DocCommentRecord[]>;

  /** Open/resolved head counts for every document in the project. */
  countByProject(projectId: string): Promise<DocCommentCount[]>;

  create(input: CreateDocCommentInput): Promise<DocCommentRecord>;

  /** Project-scoped so a share link can never touch another project's row. */
  findAuthRow(id: string, projectId: string): Promise<DocCommentAuthRow | null>;

  findReplies(parentId: string): Promise<DocCommentAuthRow[]>;

  setResolved(
    id: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
  ): Promise<DocCommentRecord>;

  /** Cascades to replies via the FK — callers check that first. */
  delete(id: string): Promise<void>;
}
