import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareLinkRow,
  type ShareScopeLiteral,
} from './ports/share-link.repository.js';

export interface CreateShareLinkCommand {
  projectId: string;
  creatorId: string;
  passcode: string;
  scopes: ShareScopeLiteral[];
  expiresAt: Date | null;
}

const BCRYPT_COST = 10;
const TOKEN_BYTES = 16; // → 32 hex chars

@Injectable()
export class CreateShareLinkUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CreateShareLinkCommand): Promise<ShareLinkRow> {
    if (cmd.passcode.length < 6 || cmd.passcode.length > 64) {
      throw new BadRequestException(
        'Passcode must be between 6 and 64 characters',
      );
    }
    if (cmd.scopes.length === 0) {
      throw new BadRequestException('At least one scope is required');
    }

    // Confirm the project exists — Prisma FK would catch this too, but a
    // 404 reads better than a generic 500 for "wrong projectKey in URL".
    const project = await this.prisma.project.findUnique({
      where: { id: cmd.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const passcodeHash = await hash(cmd.passcode, BCRYPT_COST);

    return this.repo.create({
      token,
      passcodeHash,
      scopes: cmd.scopes,
      expiresAt: cmd.expiresAt,
      projectId: cmd.projectId,
      createdById: cmd.creatorId,
    });
  }
}
