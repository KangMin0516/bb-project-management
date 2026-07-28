import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ForbiddenException, GoneException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  ShareLinkRepository,
  ShareLinkRow,
} from './ports/share-link.repository.js';
import { UnlockShareLinkAsMemberUseCase } from './unlock-share-link-as-member.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function makeLink(over: Partial<ShareLinkRow> = {}): ShareLinkRow {
  return {
    id: 'link-1',
    token: 'a'.repeat(32),
    passcodeHash: 'irrelevant-here',
    scopes: ['COMMENT'],
    expiresAt: null,
    revokedAt: null,
    lastAccessedAt: null,
    accessCount: 0,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'project-1',
    createdById: 'user-1',
    ...over,
  };
}

function makeRepo(link: ShareLinkRow | null) {
  const recordSuccess = jest.fn(() => Promise.resolve(undefined));
  const repo = {
    create: jest.fn(),
    findByToken: jest.fn(() => Promise.resolve(link)),
    findByIdScoped: jest.fn(),
    findByProject: jest.fn(),
    recordSuccess,
    recordFailure: jest.fn(),
    revoke: jest.fn(),
    rotatePasscode: jest.fn(),
    hardDelete: jest.fn(),
  } as unknown as ShareLinkRepository;
  return { repo, recordSuccess };
}

interface PrismaOpts {
  member?: boolean;
  archived?: boolean;
}

function makePrisma({ member = true, archived = false }: PrismaOpts = {}) {
  return {
    project: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          key: 'SRM',
          name: 'Saramin VN',
          archivedAt: archived ? new Date() : null,
        }),
      ),
    },
    projectMember: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          member
            ? { user: { id: 'user-9', name: 'Thương', avatar: null } }
            : null,
        ),
      ),
    },
    user: {
      findUnique: jest.fn(() => Promise.resolve({ name: 'Alice' })),
    },
  } as unknown as PrismaService;
}

function makeConfig(): ConfigService {
  return {
    get: jest.fn((key: string, def?: string) => {
      const map: Record<string, string> = {
        JWT_SHARE_SECRET: 'test-share-secret',
        SHARE_JWT_MEMBER_EXPIRES_IN: '12h',
      };
      return map[key] ?? def;
    }),
  } as unknown as ConfigService;
}

function makeUseCase(link: ShareLinkRow | null, prismaOpts?: PrismaOpts) {
  const { repo, recordSuccess } = makeRepo(link);
  const sign = jest.fn(() => 'signed.member.jwt');
  const jwt = { sign } as unknown as JwtService;
  const useCase = new UnlockShareLinkAsMemberUseCase(
    repo,
    makePrisma(prismaOpts),
    jwt,
    makeConfig(),
  );
  return { useCase, sign, recordSuccess };
}

const CMD = { token: 'a'.repeat(32), userId: 'user-9' };

describe('UnlockShareLinkAsMemberUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs the share JWT with the member identity', async () => {
    const { useCase, sign, recordSuccess } = makeUseCase(makeLink());
    const result = await useCase.execute(CMD);

    expect(result.shareJwt).toBe('signed.member.jwt');
    expect(result.member).toEqual({
      id: 'user-9',
      name: 'Thương',
      avatar: null,
    });
    expect(result.projectKey).toBe('SRM');
    expect(sign.mock.calls[0][0]).toEqual({
      kind: 'share',
      shareLinkId: 'link-1',
      projectId: 'project-1',
      scopes: ['COMMENT'],
      userId: 'user-9',
      userName: 'Thương',
    });
    expect(recordSuccess).toHaveBeenCalledWith('link-1', expect.any(Date));
  });

  it('refuses a BB PM user who is not a member of the project', async () => {
    const { useCase, sign } = makeUseCase(makeLink(), { member: false });
    await expect(useCase.execute(CMD)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sign).not.toHaveBeenCalled();
  });

  it('unlocks despite a passcode lockout — the lock is not about members', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 60_000);
    const { useCase } = makeUseCase(makeLink({ lockedUntil }));
    await expect(useCase.execute(CMD)).resolves.toHaveProperty(
      'shareJwt',
      'signed.member.jwt',
    );
  });

  it('returns 410 Gone for an unknown token', async () => {
    const { useCase } = makeUseCase(null);
    await expect(useCase.execute(CMD)).rejects.toBeInstanceOf(GoneException);
  });

  it('returns 410 Gone for a revoked link', async () => {
    const { useCase } = makeUseCase(
      makeLink({ revokedAt: new Date(Date.now() - 60_000) }),
    );
    await expect(useCase.execute(CMD)).rejects.toBeInstanceOf(GoneException);
  });

  it('returns 410 Gone for an expired link', async () => {
    const { useCase } = makeUseCase(
      makeLink({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    await expect(useCase.execute(CMD)).rejects.toBeInstanceOf(GoneException);
  });

  it('returns 410 Gone when the project has been archived', async () => {
    const { useCase } = makeUseCase(makeLink(), { archived: true });
    await expect(useCase.execute(CMD)).rejects.toBeInstanceOf(GoneException);
  });
});
