import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ShareScopeLiteral } from '../application/ports/share-link.repository.js';

export interface SharePayload {
  kind: 'share';
  shareLinkId: string;
  projectId: string;
  scopes: ShareScopeLiteral[];
}

/**
 * `share-jwt` is a parallel passport strategy that only accepts JWTs
 * signed by `JWT_SHARE_SECRET` and carrying `kind: "share"`. The main
 * `JwtStrategy` is patched to reject this kind explicitly — together
 * the two enforce that share tokens cannot escalate into a user
 * session, and user tokens cannot pose as share tokens.
 */
@Injectable()
export class ShareJwtStrategy extends PassportStrategy(Strategy, 'share-jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SHARE_SECRET');
    if (!secret)
      throw new Error('JWT_SHARE_SECRET environment variable is required');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: SharePayload): SharePayload {
    if (payload.kind !== 'share')
      throw new UnauthorizedException('Not a share token');
    return payload;
  }
}
