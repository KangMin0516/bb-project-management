import { describe, expect, it, jest } from '@jest/globals';
import { OutboxHandlerRegistry } from './outbox-handler.registry.js';
import { OutboxPublisher } from './outbox.publisher.js';
import type {
  ClaimedOutboxRow,
  OutboxRepository,
} from './outbox.repository.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const ROW: ClaimedOutboxRow = {
  id: 'r-1',
  eventType: 'Foo',
  aggregateType: 'X',
  aggregateId: 'a-1',
  payload: {},
  attempts: 0,
  occurredAt: new Date(),
};

/** Prisma double — runs the transactional callback inline so the
 *  publisher's `claimBatch + dispatch` orchestration is exercised
 *  end-to-end without a real DB. */
function makePrisma(): PrismaService {
  return {
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({}),
    ),
  } as unknown as PrismaService;
}

function makeRepo(
  rows: ClaimedOutboxRow[],
  overrides: Partial<OutboxRepository> = {},
): OutboxRepository {
  return {
    claimBatch: jest.fn(async () => rows),
    markDelivered: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    append: jest.fn(),
    deleteUndelivered: jest.fn(),
    ...overrides,
  } as unknown as OutboxRepository;
}

describe('OutboxPublisher.pump — happy path', () => {
  it('claims, dispatches each row, marks delivered', async () => {
    const registry = new OutboxHandlerRegistry();
    const handler = jest.fn(async () => undefined);
    registry.register('Foo', handler);

    const repo = makeRepo([ROW]);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(repo.markDelivered).toHaveBeenCalledWith('r-1', {});
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('returns immediately when batch is empty', async () => {
    const registry = new OutboxHandlerRegistry();
    const repo = makeRepo([]);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(repo.markDelivered).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
  });
});

describe('OutboxPublisher.pump — failure handling', () => {
  it('marks failed when handler throws — backoff via repository', async () => {
    const registry = new OutboxHandlerRegistry();
    registry.register('Foo', async () => {
      throw new Error('Slack down');
    });

    const repo = makeRepo([ROW]);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(repo.markFailed).toHaveBeenCalledWith(
      'r-1',
      'Slack down',
      0,
      expect.anything(),
    );
    expect(repo.markDelivered).not.toHaveBeenCalled();
  });

  it('marks failed when no handler is registered (loud, not silent dead-letter)', async () => {
    const registry = new OutboxHandlerRegistry(); // empty
    const repo = makeRepo([ROW]);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(repo.markFailed).toHaveBeenCalledTimes(1);
    const [, error] = (repo.markFailed as jest.Mock).mock.calls[0];
    expect(error).toMatch(/no handler/i);
  });

  it('parks a row that has already hit MAX_ATTEMPTS — does not invoke handler', async () => {
    const registry = new OutboxHandlerRegistry();
    const handler = jest.fn(async () => undefined);
    registry.register('Foo', handler);

    const parkedRow = { ...ROW, attempts: 8 };
    const repo = makeRepo([parkedRow]);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(handler).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith(
      'r-1',
      expect.stringMatching(/max attempts/i),
      8,
      expect.anything(),
    );
  });
});

describe('OutboxPublisher.pump — concurrency mutex', () => {
  it('skips overlapping ticks while one is in progress', async () => {
    const registry = new OutboxHandlerRegistry();
    const claim = jest.fn(
      async () =>
        // First tick yields a row but takes time; second tick should
        // see `running=true` and bail before reaching claim.
        new Promise<ClaimedOutboxRow[]>((resolve) =>
          setTimeout(() => resolve([]), 30),
        ),
    );
    const repo = makeRepo([], { claimBatch: claim });
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    const first = publisher.pump();
    const second = publisher.pump();
    await Promise.all([first, second]);

    // claim should only run once because the second tick was gated by
    // the `running` flag.
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('continues running after a tick crashes (mutex released in finally)', async () => {
    const registry = new OutboxHandlerRegistry();
    let firstCall = true;
    const claim = jest.fn(async () => {
      if (firstCall) {
        firstCall = false;
        throw new Error('connection lost');
      }
      return [];
    });
    const repo = makeRepo([], { claimBatch: claim });
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump(); // tick 1 throws; finally releases the mutex
    await publisher.pump(); // tick 2 must proceed

    expect(claim).toHaveBeenCalledTimes(2);
  });
});

describe('OutboxPublisher.pump — multi-row dispatch', () => {
  it('processes each row independently (one failure does not block others)', async () => {
    const registry = new OutboxHandlerRegistry();
    registry.register('Foo', async (row) => {
      if (row.id === 'r-bad') throw new Error('boom');
    });

    const rows: ClaimedOutboxRow[] = [
      { ...ROW, id: 'r-ok1' },
      { ...ROW, id: 'r-bad' },
      { ...ROW, id: 'r-ok2' },
    ];
    const repo = makeRepo(rows);
    const publisher = new OutboxPublisher(makePrisma(), repo, registry);

    await publisher.pump();

    expect(repo.markDelivered).toHaveBeenCalledTimes(2);
    expect(repo.markFailed).toHaveBeenCalledTimes(1);
    const [failedId] = (repo.markFailed as jest.Mock).mock.calls[0];
    expect(failedId).toBe('r-bad');
  });
});
