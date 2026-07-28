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
  /**
   * Present only on a *member* session, minted by
   * `UnlockShareLinkAsMemberUseCase` after a BB PM credential proved
   * both who the caller is and that they belong to the project. A
   * passcode guest has neither field, and the difference is what
   * decides whether a comment is signed with a real account or a typed
   * display name.
   */
  userId?: string;
  /** Snapshot display name, used to stamp `resolvedBy`. */
  userName?: string;
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

/**
 * Read the claims this strategy parked on the request. Returns
 * `undefined` when the route was wired without `ShareAuthGuard`;
 * `VerifyShareAccessUseCase` is what turns that into a 403, so callers
 * never have to decide.
 */
export function claimsOf(req: { user?: unknown }): SharePayload | undefined {
  return req.user as SharePayload | undefined;
}
