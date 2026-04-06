import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '../../../generated/prisma/enums.js';
import { ROLES_KEY } from '../decorators/index.js';
import type { JwtPayload } from '../decorators/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const projectId =
      request.params.projectId || request.body?.projectId;

    if (!projectId) {
      throw new ForbiddenException('Project context required');
    }

    // Reuse data from ProjectMemberGuard if it already ran
    if (request.isSuperuser) {
      return true;
    }

    if (request.projectMember) {
      const member = request.projectMember;
      if (!requiredRoles.includes(member.role)) {
        throw new ForbiddenException('Insufficient role');
      }
      return true;
    }

    // Fallback: query DB if ProjectMemberGuard didn't run before this guard
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperuser: true },
    });

    if (dbUser?.isSuperuser) {
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

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    // Attach membership to request for downstream use
    request.projectMember = member;
    return true;
  }
}
