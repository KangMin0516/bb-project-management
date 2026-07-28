import { describe, expect, it, jest } from '@jest/globals';
import {
  ListAllDocCommentsUseCase,
  MAX_PROJECT_COMMENTS,
} from './list-doc-comments.use-case.js';
import type {
  DocCommentRecord,
  DocCommentRepository,
} from './ports/doc-comment.repository.js';

function record(over: Partial<DocCommentRecord> = {}): DocCommentRecord {
  return {
    id: 'c-1',
    docKey: '/f/js-auth',
    containerId: null,
    quote: null,
    prefix: null,
    suffix: null,
    textOffset: null,
    body: 'body',
    parentId: null,
    authorKey: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    author: { user: null, guestName: 'Guest' },
    ...over,
  };
}

function useCaseOver(rows: DocCommentRecord[]) {
  const repo = {
    findByDoc: jest.fn(),
    findByProject: jest.fn(() => Promise.resolve(rows)),
    countByProject: jest.fn(),
    create: jest.fn(),
    findAuthRow: jest.fn(),
    findReplies: jest.fn(),
    setResolved: jest.fn(),
    delete: jest.fn(),
  } as unknown as DocCommentRepository;
  return {
    useCase: new ListAllDocCommentsUseCase(repo),
    findByProject: repo.findByProject as jest.Mock,
  };
}

const GUEST = { authorKey: 'k-1', userId: null, role: null };
const DEV = { authorKey: null, userId: 'u-1', role: 'DEVELOPER' as const };
const PM = { authorKey: null, userId: 'u-9', role: 'PM' as const };

describe('ListAllDocCommentsUseCase', () => {
  it('returns threads from every document, each keeping its docKey', async () => {
    const { useCase } = useCaseOver([
      record({ id: 'a', docKey: '/f/js-auth' }),
      record({ id: 'b', docKey: '/m/crm/3' }),
    ]);
    const result = await useCase.execute({ projectId: 'p-1', caller: PM });
    expect(result.threads.map((t) => [t.id, t.docKey])).toEqual([
      ['a', '/f/js-auth'],
      ['b', '/m/crm/3'],
    ]);
    expect(result.truncated).toBe(false);
  });

  it('folds replies into their head across documents', async () => {
    const { useCase } = useCaseOver([
      record({ id: 'head', docKey: '/m/crm/3' }),
      record({ id: 'reply', docKey: '/m/crm/3', parentId: 'head' }),
    ]);
    const result = await useCase.execute({ projectId: 'p-1', caller: PM });
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].replies.map((r) => r.id)).toEqual(['reply']);
  });

  it('hides internal threads from a guest and the client’s from a DEVELOPER', async () => {
    const rows = [
      record({ id: 'external', author: { user: null, guestName: 'Client' } }),
      record({
        id: 'internal',
        author: {
          user: { id: 'u-7', name: 'Thu', avatar: null },
          guestName: null,
        },
      }),
    ];

    const asGuest = await useCaseOver(rows).useCase.execute({
      projectId: 'p-1',
      caller: GUEST,
    });
    expect(asGuest.threads.map((t) => t.id)).toEqual(['external']);

    const asDev = await useCaseOver(rows).useCase.execute({
      projectId: 'p-1',
      caller: DEV,
    });
    expect(asDev.threads.map((t) => t.id)).toEqual(['internal']);

    const asPm = await useCaseOver(rows).useCase.execute({
      projectId: 'p-1',
      caller: PM,
    });
    expect(asPm.threads.map((t) => t.id)).toEqual(['external', 'internal']);
  });

  it('drops a whole thread, not just its head, when it is not visible', async () => {
    // A dangling reply would leak both that the question exists and what
    // the answer to it was.
    const rows = [
      record({ id: 'head', author: { user: null, guestName: 'Client' } }),
      record({
        id: 'reply',
        parentId: 'head',
        author: {
          user: { id: 'u-7', name: 'Thu', avatar: null },
          guestName: null,
        },
      }),
    ];
    const result = await useCaseOver(rows).useCase.execute({
      projectId: 'p-1',
      caller: DEV,
    });
    expect(result.threads).toEqual([]);
  });

  it('keeps a thread the member posted in, whoever started it', async () => {
    const rows = [
      record({ id: 'head', author: { user: null, guestName: 'Client' } }),
      record({
        id: 'reply',
        parentId: 'head',
        author: {
          user: { id: 'u-1', name: 'Dev', avatar: null },
          guestName: null,
        },
      }),
    ];
    const result = await useCaseOver(rows).useCase.execute({
      projectId: 'p-1',
      caller: DEV,
    });
    expect(result.threads.map((t) => t.id)).toEqual(['head']);
    expect(result.threads[0].replies.map((r) => r.id)).toEqual(['reply']);
  });

  it('reports truncation instead of passing off a partial set as whole', async () => {
    // The repo returns limit + 1 as the "there is more" probe.
    const rows = Array.from({ length: MAX_PROJECT_COMMENTS + 1 }, (_, i) =>
      record({ id: `c-${i}` }),
    );
    const { useCase, findByProject } = useCaseOver(rows);
    const result = await useCase.execute({ projectId: 'p-1', caller: PM });

    expect(findByProject).toHaveBeenCalledWith('p-1', MAX_PROJECT_COMMENTS);
    expect(result.truncated).toBe(true);
    expect(result.threads).toHaveLength(MAX_PROJECT_COMMENTS);
  });
});
