import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service.js';
import { RawResponse } from '../common/interceptors/index.js';
import { Public } from '../common/decorators/index.js';

/**
 * Standard discovery endpoint for the OAuth 2.1 Authorization Server.
 *
 * Per RFC 8414, OAuth clients fetch metadata by appending
 * `/.well-known/oauth-authorization-server` to the issuer URL. Our
 * issuer is `https://pm.burningbros.kr/api` (BBPM's API root); the
 * project's React SPA owns the apex domain, so the only path that
 * reliably reaches Nest is under `/api`. claude.ai web custom
 * connectors and ChatGPT remote MCP servers both probe this URL.
 *
 * The legacy `/api/oauth/.well-known/...` path is kept inside
 * OAuthController for back-compat with anything that already cached it.
 */
@ApiExcludeController()
@RawResponse()
@Controller()
export class WellKnownController {
  constructor(
    private oauth: OAuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Get('.well-known/oauth-authorization-server')
  metadata() {
    const webBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return this.oauth.metadata({ apiBase: `${webBase}/api`, webBase });
  }
}
