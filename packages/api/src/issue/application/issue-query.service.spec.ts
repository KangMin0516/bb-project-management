import { describe, expect, it, jest } from '@jest/globals';
import { IssueQueryService } from './issue-query.service.js';
import { ISSUE_MAX_PER_COLUMN } from '../../common/constants.js';

const mkService = () => {
  const prisma = {
    issue: {
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
    },
  };
  return { service: new IssueQueryService(prisma as never), prisma };
};

describe('IssueQueryService.findByStatus', () => {
  it('does not cap active-workflow columns (TODO, IN_PROGRESS, ...)', async () => {
    const { service, prisma } = mkService();
    await service.findByStatus('p1');

    const activeCalls = prisma.issue.findMany.mock.calls.filter(
      ([args]: [{ where: { status: string } }]) =>
        !['DONE', 'CANCELED'].includes(args.where.status),
    );
    expect(activeCalls.length).toBeGreaterThan(0);
    for (const [args] of activeCalls) {
      expect(args.take).toBeUndefined();
    }
  });

  it('caps only the terminal columns (DONE, CANCELED)', async () => {
    const { service, prisma } = mkService();
    await service.findByStatus('p1');

    const terminalCalls = prisma.issue.findMany.mock.calls.filter(
      ([args]: [{ where: { status: string } }]) =>
        ['DONE', 'CANCELED'].includes(args.where.status),
    );
    expect(terminalCalls).toHaveLength(2);
    for (const [args] of terminalCalls) {
      expect(args.take).toBe(ISSUE_MAX_PER_COLUMN);
    }
  });

  it('drops the cap on every column when a search term is active', async () => {
    const { service, prisma } = mkService();
    await service.findByStatus('p1', false, undefined, 'admin account');

    for (const [args] of prisma.issue.findMany.mock.calls) {
      expect(args.take).toBeUndefined();
      expect(args.where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { title: { contains: 'admin account', mode: 'insensitive' } },
              { description: { contains: 'admin account', mode: 'insensitive' } },
            ],
          },
        ]),
      );
    }
  });

  it('matches a bare issue number in the search term', async () => {
    const { service, prisma } = mkService();
    await service.findByStatus('p1', false, undefined, '1817');

    const [args] = prisma.issue.findMany.mock.calls[0] as [
      { where: { AND: Array<{ OR?: Array<Record<string, unknown>> }> } },
    ];
    const searchClause = args.where.AND.find((c) => c.OR?.some((cond) => 'title' in cond));
    expect(searchClause?.OR).toEqual(
      expect.arrayContaining([{ number: 1817 }]),
    );
  });
});
