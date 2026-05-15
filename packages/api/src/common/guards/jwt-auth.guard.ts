import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/index.js';
import { setRequestSource } from '../source.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Every JWT-authenticated request is by definition a web session.
    // Tags the request so downstream services persist `source: 'WEB'`
    // on the rows they create — see `common/source.ts`.
    setRequestSource(context.switchToHttp().getRequest(), 'WEB');
    return super.canActivate(context);
  }
}
