import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtPayload } from '../decorators/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SuperuserGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isSuperuser: true },
    });

    if (!dbUser?.isSuperuser) {
      throw new ForbiddenException('Superuser access required');
    }

    return true;
  }
}
