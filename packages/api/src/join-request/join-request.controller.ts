import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import type { JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';
import { ApproveJoinRequestUseCase } from './application/approve-join-request.use-case.js';
import { CancelJoinRequestUseCase } from './application/cancel-join-request.use-case.js';
import { CreateJoinRequestUseCase } from './application/create-join-request.use-case.js';
import { RejectJoinRequestUseCase } from './application/reject-join-request.use-case.js';
import {
  JOIN_REQUEST_REPOSITORY,
  type JoinRequestRepository,
} from './application/ports/join-request.repository.js';
import type { JoinRequest } from './domain/join-request.entity.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { RejectJoinRequestDto } from './dto/reject-join-request.dto.js';

/**
 * Read paths (findByProject / findByUser) go straight to the repository
 * — they're DTO-shaped queries with no business logic. Write paths run
 * through use cases. Controller stays as a thin HTTP-↔-application
 * adapter; response shapes match legacy verbatim (see behavior
 * preservation checklist §4).
 */
@ApiTags('Join Requests')
@ApiBearerAuth()
@Controller()
export class JoinRequestController {
  constructor(
    private readonly createUC: CreateJoinRequestUseCase,
    private readonly approveUC: ApproveJoinRequestUseCase,
    private readonly rejectUC: RejectJoinRequestUseCase,
    private readonly cancelUC: CancelJoinRequestUseCase,
    @Inject(JOIN_REQUEST_REPOSITORY)
    private readonly repo: JoinRequestRepository,
  ) {}

  // ─── Public (no ProjectMemberGuard) ──────────────────

  @Post('projects/:projectId/join-requests')
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJoinRequestDto,
  ) {
    const { request, requester, project } = await this.createUC.execute({
      projectIdOrKey: projectId,
      requesterId: user.sub,
      message: dto.message,
    });
    return serializeWithRequesterAndProject(request, requester, project);
  }

  @Get('me/join-requests')
  async myRequests(@CurrentUser() user: JwtPayload) {
    const items = await this.repo.listForRequester(user.sub);
    return items.map(({ request, project }) => ({
      ...serializeBase(request),
      project,
    }));
  }

  @Delete('me/join-requests/:id')
  cancelRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.cancelUC.execute({ requestId: id, userId: user.sub });
  }

  // ─── Project-scoped (ADMIN/PM only) ──────────────────

  @Get('projects/:projectId/join-requests')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async findByProject(@Param('projectId') projectId: string) {
    const items = await this.repo.listPendingForProject(projectId);
    return items.map(({ request, requester }) => ({
      ...serializeBase(request),
      requester,
    }));
  }

  @Post('projects/:projectId/join-requests/:id/approve')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async approve(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { request, requester, project } = await this.approveUC.execute({
      projectId,
      requestId: id,
      resolvedById: user.sub,
    });
    return serializeWithRequesterAndProject(request, requester, project);
  }

  @Post('projects/:projectId/join-requests/:id/reject')
  @UseGuards(ProjectMemberGuard, RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  async reject(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectJoinRequestDto,
  ) {
    const { request, requester, project } = await this.rejectUC.execute({
      projectId,
      requestId: id,
      resolvedById: user.sub,
      reason: dto.reason,
    });
    return serializeWithRequesterAndProject(request, requester, project);
  }
}

// ─── Serializers (controller-local; legacy shape parity) ────

function serializeBase(request: JoinRequest) {
  return {
    id: request.id,
    projectId: request.projectId,
    requesterId: request.requesterId,
    status: request.status,
    message: request.message,
    rejectionReason: request.rejectionReason,
    resolvedById: request.resolvedById,
    resolvedAt: request.resolvedAt,
    createdAt: request.createdAt,
  };
}

function serializeWithRequesterAndProject(
  request: JoinRequest,
  requester: { id: string; name: string; email: string; avatar: string | null },
  project: { id: string; name: string; key: string },
) {
  return {
    ...serializeBase(request),
    requester,
    project,
  };
}
