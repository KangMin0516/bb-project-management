import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ProjectRole } from '../../generated/prisma/enums.js';
import { Roles } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CreateShareLinkUseCase } from './application/create-share-link.use-case.js';
import { RevokeShareLinkUseCase } from './application/revoke-share-link.use-case.js';
import { RotatePasscodeUseCase } from './application/rotate-passcode.use-case.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { Inject } from '@nestjs/common';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from './application/ports/share-link.repository.js';
import { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import { RotatePasscodeDto } from './dto/rotate-passcode.dto.js';
import type {
  ShareLinkRow,
  ShareLinkWithCreator,
} from './application/ports/share-link.repository.js';

/**
 * Admin surface for share links. Mounted under the project URL so the
 * existing `ProjectMemberGuard` checks membership before any handler
 * runs, and `RolesGuard` narrows write-ish ops to PM↑. Hard-delete is
 * gated to ADMIN only — PMs revoke via PATCH instead.
 */
@ApiTags('Share Links')
@ApiBearerAuth()
@Controller('projects/:projectId/share-links')
@UseGuards(ProjectMemberGuard)
export class ShareLinkController {
  constructor(
    private readonly createUseCase: CreateShareLinkUseCase,
    private readonly revokeUseCase: RevokeShareLinkUseCase,
    private readonly rotateUseCase: RotatePasscodeUseCase,
    private readonly config: ConfigService,
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateShareLinkDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReturnType<typeof this.toAdminView> & { url: string }> {
    const link = await this.createUseCase.execute({
      projectId,
      creatorId: user.sub,
      passcode: dto.passcode,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return { ...this.toAdminView(link), url: this.buildUrl(link.token) };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async list(@Param('projectId') projectId: string) {
    const rows = await this.repo.findByProject(projectId);
    return rows.map((r) => ({
      ...this.toAdminView(r),
      url: this.buildUrl(r.token),
      createdBy: r.createdBy,
    }));
  }

  @Patch(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async revoke(@Param('projectId') projectId: string, @Param('id') id: string) {
    const row = await this.revokeUseCase.execute({ id, projectId });
    return this.toAdminView(row);
  }

  @Patch(':id/rotate-passcode')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async rotate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: RotatePasscodeDto,
  ) {
    const row = await this.rotateUseCase.execute({
      id,
      projectId,
      newPasscode: dto.newPasscode,
    });
    return this.toAdminView(row);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN)
  @HttpCode(204)
  async destroy(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    // findByIdScoped enforces the (id, projectId) pair — keep it so the
    // delete cannot reach across projects.
    const link = await this.repo.findByIdScoped(id, projectId);
    if (!link) return;
    await this.repo.hardDelete(link.id);
  }

  private toAdminView(row: ShareLinkRow | ShareLinkWithCreator) {
    // Passcode hash never leaves the server. Token IS leaked here
    // because admins need it to compose / verify the URL; the URL
    // alone is harmless without the passcode.
    return {
      id: row.id,
      token: row.token,
      scopes: row.scopes,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lockedUntil: row.lockedUntil,
      accessCount: row.accessCount,
      lastAccessedAt: row.lastAccessedAt,
      createdAt: row.createdAt,
    };
  }

  private buildUrl(token: string): string {
    const base = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    return `${base.replace(/\/$/, '')}/share/${token}`;
  }
}
