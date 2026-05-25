import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../decorators/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Ensures the authenticated user is a member of the project
 * specified by :projectId param. Attaches membership to request.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    let projectId = request.params.projectId;

    if (!projectId) {
      throw new ForbiddenException('Project context required');
    }

    // Resolve project key to UUID if needed
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        projectId,
      );
    let archivedAt: Date | null = null;
    if (!isUuid) {
      const project = await this.prisma.project.findUnique({
        where: { key: projectId },
        select: { id: true, archivedAt: true },
      });
      if (!project) {
        throw new ForbiddenException('Project not found');
      }
      projectId = project.id;
      archivedAt = project.archivedAt;
      // Replace param so downstream services use the UUID
      request.params.projectId = projectId;
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { archivedAt: true },
      });
      archivedAt = project?.archivedAt ?? null;
    }

    // Superuser bypasses membership check (and archive check).
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperuser: true },
    });

    if (dbUser?.isSuperuser) {
      request.isSuperuser = true;
      return true;
    }

    // Archived projects are invisible to non-superusers — return 404
    // even if the caller is a member, so members cannot bookmark a
    // board/timeline URL and keep clicking into a project that has
    // been retired.
    if (archivedAt !== null) {
      throw new NotFoundException('Project not found');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.sub,
          projectId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    request.projectMember = member;
    return true;
  }
}
