import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
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
    const projectId = request.params.projectId;

    if (!projectId) {
      throw new ForbiddenException('Project context required');
    }

    // Superuser bypasses membership check
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperuser: true },
    });

    if (dbUser?.isSuperuser) {
      request.isSuperuser = true;
      return true;
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
