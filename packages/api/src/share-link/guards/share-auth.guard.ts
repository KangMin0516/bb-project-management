import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates routes that exclusively serve public share traffic.
 * Place this guard on every `/api/public/share/:token/...` route that
 * needs more than the bare `unlock` endpoint — it verifies the share
 * JWT issued by `UnlockShareLinkUseCase` and rejects everything else,
 * including regular user JWTs.
 *
 * The public controller is also decorated with `@Public()` so the
 * global `JwtAuthGuard` doesn't try to validate the share JWT against
 * the wrong secret first.
 */
@Injectable()
export class ShareAuthGuard extends AuthGuard('share-jwt') {}
