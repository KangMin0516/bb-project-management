import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../../common/decorators/index.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: { sub: string; email: string; kind?: string }): JwtPayload {
    // Defense-in-depth: a JWT signed by `JWT_SHARE_SECRET` can't pass
    // here anyway (wrong key), but if the same secret were ever reused
    // by accident, this kind-check still keeps share tokens out of the
    // internal API. Symmetrically, `ShareJwtStrategy` only validates
    // payloads where kind === 'share'.
    if (payload.kind === 'share')
      throw new UnauthorizedException(
        'Share tokens cannot access the internal API',
      );
    return { sub: payload.sub, email: payload.email };
  }
}
