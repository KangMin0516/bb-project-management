import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service.js';
import { RawResponse } from '../common/interceptors/index.js';
import { Public } from '../common/decorators/index.js';

/**
 * Standard discovery endpoint for the OAuth 2.1 Authorization Server.
 *
 * RFC 8414 §3 says the well-known suffix is inserted **between the
 * host and the path component** of the issuer identifier. Our issuer
 * is `https://pm.burningbros.kr/api`, so an RFC-conformant client
 * probes `https://pm.burningbros.kr/.well-known/oauth-authorization-server/api`.
 * Claude.ai's MCP connector follows this strictly. We also keep the
 * non-path variant `/.well-known/oauth-authorization-server` (works
 * for host-rooted issuers) for completeness, plus the legacy
 * `/api/.well-known/...` path that ChatGPT and earlier callers cached.
 *
 * `main.ts` excludes `/.well-known/(.*)` from the global API prefix,
 * so these handlers reach Nest without the `/api` rewrite.
 */
@ApiExcludeController()
@RawResponse()
@Controller()
export class WellKnownController {
  constructor(
    private oauth: OAuthService,
    private config: ConfigService,
  ) {}

  /** RFC 8414 path for our issuer `https://<host>/api`. */
  @Public()
  @Get('.well-known/oauth-authorization-server/api')
  metadataForApi() {
    return this.buildMetadata();
  }

  /** Host-rooted variant, returned for legacy/lenient clients. */
  @Public()
  @Get('.well-known/oauth-authorization-server')
  metadataAtRoot() {
    return this.buildMetadata();
  }

  /** Path-after-prefix variant (was the only working path before the
   *  `exclude` change). Kept so cached ChatGPT clients don't break. */
  @Public()
  @Get('api/.well-known/oauth-authorization-server')
  metadataLegacy() {
    return this.buildMetadata();
  }

  private buildMetadata() {
    const webBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return this.oauth.metadata({ apiBase: `${webBase}/api`, webBase });
  }
}
