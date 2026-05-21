import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  GoneException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  ShareLinkRepository,
  ShareLinkRow,
} from './ports/share-link.repository.js';
import { UnlockShareLinkUseCase } from './unlock-share-link.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const FRESH_HASH = await hash('correct-pass', 4); // cheap rounds for tests

function makeLink(over: Partial<ShareLinkRow> = {}): ShareLinkRow {
  return {
    id: 'link-1',
    token: 'aaaa',
    passcodeHash: FRESH_HASH,
    scopes: ['TIMELINE'],
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

interface RepoSpies {
  findByToken: jest.Mock;
  recordSuccess: jest.Mock;
  recordFailure: jest.Mock;
}

function makeRepo(link: ShareLinkRow | null): {
  repo: ShareLinkRepository;
  spies: RepoSpies;
} {
  const findByToken = jest.fn(() => Promise.resolve(link));
  const recordSuccess = jest.fn(() => Promise.resolve(undefined));
  const recordFailure = jest.fn(() => Promise.resolve(undefined));
  const repo = {
    create: jest.fn(),
    findByToken,
    findByIdScoped: jest.fn(),
    findByProject: jest.fn(),
    recordSuccess,
    recordFailure,
    revoke: jest.fn(),
    rotatePasscode: jest.fn(),
    hardDelete: jest.fn(),
  } as unknown as ShareLinkRepository;
  return { repo, spies: { findByToken, recordSuccess, recordFailure } };
}

function makePrisma(): PrismaService {
  return {
    project: {
      findUnique: jest.fn(() =>
        Promise.resolve({ key: 'PITB', name: 'PITB Project' }),
      ),
    },
    user: {
      findUnique: jest.fn(() => Promise.resolve({ name: 'Alice' })),
    },
  } as unknown as PrismaService;
}

function makeJwt(): JwtService {
  return {
    sign: jest.fn(() => 'signed.jwt.value'),
  } as unknown as JwtService;
}

function makeConfig(): ConfigService {
  return {
    get: jest.fn((key: string, def?: string) => {
      const map: Record<string, string> = {
        JWT_SHARE_SECRET: 'test-share-secret',
        SHARE_JWT_EXPIRES_IN: '2h',
        SHARE_LINK_PASSCODE_FAIL_THRESHOLD: '20',
        SHARE_LINK_LOCKOUT_MINUTES: '60',
      };
      return map[key] ?? def;
    }),
  } as unknown as ConfigService;
}

function makeUseCase(link: ShareLinkRow | null) {
  const { repo, spies } = makeRepo(link);
  const useCase = new UnlockShareLinkUseCase(
    repo,
    makePrisma(),
    makeJwt(),
    makeConfig(),
  );
  return { useCase, spies };
}

describe('UnlockShareLinkUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a signed JWT when passcode matches', async () => {
    const { useCase, spies } = makeUseCase(makeLink());
    const result = await useCase.execute({
      token: 'aaaa',
      passcode: 'correct-pass',
    });
    expect(result.shareJwt).toBe('signed.jwt.value');
    expect(result.projectKey).toBe('PITB');
    expect(result.sharedByName).toBe('Alice');
    expect(spies.recordSuccess).toHaveBeenCalledWith(
      'link-1',
      expect.any(Date),
    );
    expect(spies.recordFailure).not.toHaveBeenCalled();
  });

  it('treats unknown token as 401, not 404 (no enumeration)', async () => {
    const { useCase } = makeUseCase(null);
    await expect(
      useCase.execute({ token: 'zzzz', passcode: 'anything' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records failure and throws 401 on wrong passcode', async () => {
    const { useCase, spies } = makeUseCase(makeLink({ failedAttempts: 3 }));
    await expect(
      useCase.execute({ token: 'aaaa', passcode: 'WRONG' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(spies.recordFailure).toHaveBeenCalledWith('link-1', 4, null);
    expect(spies.recordSuccess).not.toHaveBeenCalled();
  });

  it('locks the link on the threshold-th failure', async () => {
    const { useCase, spies } = makeUseCase(makeLink({ failedAttempts: 19 }));
    await expect(
      useCase.execute({ token: 'aaaa', passcode: 'WRONG' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const recordCall = spies.recordFailure.mock.calls[0];
    expect(recordCall[0]).toBe('link-1');
    expect(recordCall[1]).toBe(20);
    expect(recordCall[2]).toBeInstanceOf(Date); // lockedUntil set
  });

  it('rejects locked link without bcrypt-comparing (timing safety)', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 60_000); // +30min
    const { useCase, spies } = makeUseCase(makeLink({ lockedUntil }));
    let caught: unknown = null;
    try {
      await useCase.execute({ token: 'aaaa', passcode: 'correct-pass' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(HttpStatus.LOCKED);
    expect(spies.recordFailure).not.toHaveBeenCalled();
    expect(spies.recordSuccess).not.toHaveBeenCalled();
  });

  it('returns 410 Gone for revoked links', async () => {
    const { useCase } = makeUseCase(
      makeLink({ revokedAt: new Date(Date.now() - 60_000) }),
    );
    await expect(
      useCase.execute({ token: 'aaaa', passcode: 'correct-pass' }),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('returns 410 Gone for expired links', async () => {
    const { useCase } = makeUseCase(
      makeLink({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    await expect(
      useCase.execute({ token: 'aaaa', passcode: 'correct-pass' }),
    ).rejects.toBeInstanceOf(GoneException);
  });
});
