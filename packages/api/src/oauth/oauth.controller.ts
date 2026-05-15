import {
  All,
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OAuthService } from './oauth.service.js';
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import { RawResponse } from '../common/interceptors/index.js';
import {
  CurrentUser,
  Public,
  type JwtPayload,
} from '../common/decorators/index.js';

/**
 * Full OAuth 2.1 Authorization Server for MCP + third-party clients.
 *
 * Layout note: the *consent UI* lives in the React app at
 * `/oauth/authorize` — claude.ai opens that URL in a browser tab and the
 * front-end calls `POST /api/oauth/authorize/consent` once the user
 * clicks Approve. This split keeps the actual login + cookie session
 * with the web app rather than reimplementing it server-side.
 */
@ApiExcludeController()
@RawResponse()
@Controller('oauth')
export class OAuthController {
  constructor(
    private oauth: OAuthService,
    private config: ConfigService,
  ) {}

  private bases(): { apiBase: string; webBase: string } {
    const webBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return { webBase, apiBase: `${webBase}/api` };
  }

  // ─── Discovery (legacy path, kept for back-compat) ──────

  @Public()
  @Get('.well-known/oauth-authorization-server')
  metadata() {
    return this.oauth.metadata(this.bases());
  }

  // ─── Dynamic Client Registration (RFC 7591) ─────────────

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(@Body() body: Record<string, unknown>) {
    const rawName = body.client_name;
    return this.oauth.registerClient({
      client_name: typeof rawName === 'string' ? rawName : '',
      redirect_uris: Array.isArray(body.redirect_uris)
        ? (body.redirect_uris as string[])
        : [],
      grant_types: Array.isArray(body.grant_types)
        ? (body.grant_types as string[])
        : undefined,
      response_types: Array.isArray(body.response_types)
        ? (body.response_types as string[])
        : undefined,
      scope: typeof body.scope === 'string' ? body.scope : undefined,
      token_endpoint_auth_method:
        typeof body.token_endpoint_auth_method === 'string'
          ? body.token_endpoint_auth_method
          : undefined,
    });
  }

  // ─── Authorization (consent screen helpers) ─────────────

  // The web UI calls this to display the client name + requested
  // scopes on the consent screen. JWT-protected so we know who is
  // about to authorize.
  @Get('authorize/client')
  async getAuthorizeClient(@Req() req: Request) {
    const clientId = (req.query.client_id as string) ?? '';
    if (!clientId) throw new BadRequestException('client_id required');
    return this.oauth.getClient(clientId);
  }

  // User clicked "Approve" — mint a code and return it for the web UI
  // to redirect the browser back to the client's redirect_uri.
  @Post('authorize/consent')
  async consent(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      client_id: string;
      redirect_uri: string;
      scope?: string;
      code_challenge: string;
      code_challenge_method: string;
      state?: string;
      resource?: string;
    },
  ) {
    const code = await this.oauth.mintAuthorizationCode({
      userId: user.sub,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      scope: body.scope ?? 'mcp',
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method,
      resource: body.resource,
    });
    return { code, state: body.state };
  }

  // ─── Token endpoint ──────────────────────────────────────

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('token')
  async token(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: Record<string, string>,
  ) {
    const { clientId, clientSecret } = parseClientAuth(authHeader, body);

    if (body.grant_type === 'authorization_code') {
      const required = ['code', 'redirect_uri', 'code_verifier'];
      for (const f of required) {
        if (!body[f]) throw new BadRequestException(`${f} is required`);
      }
      return this.oauth.exchangeCode({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: body.redirect_uri,
        code_verifier: body.code_verifier,
        client_id: clientId,
        client_secret: clientSecret,
        resource: body.resource,
      });
    }

    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) {
        throw new BadRequestException('refresh_token is required');
      }
      return this.oauth.refreshTokens({
        grant_type: 'refresh_token',
        refresh_token: body.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        scope: body.scope,
        resource: body.resource,
      });
    }

    throw new BadRequestException(`Unsupported grant_type: ${body.grant_type}`);
  }

  // ─── Revocation (RFC 7009) ──────────────────────────────

  @Public()
  @Post('revoke')
  async revoke(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: Record<string, string>,
  ) {
    const { clientId, clientSecret } = parseClientAuth(authHeader, body);
    if (!body.token) throw new BadRequestException('token is required');
    await this.oauth.revokeToken(body.token, clientId, clientSecret);
    return {};
  }

  // ─── UserInfo (Bearer) ──────────────────────────────────

  // Tiny convenience endpoint so MCP server can resolve a bearer
  // token → user without joining the DB. Auth happens via the
  // ApiKeyGuard now that it understands Bearer tokens too.
  @Public()
  @UseGuards(ApiKeyGuard)
  @All('userinfo')
  userinfo(@CurrentUser() user: JwtPayload) {
    return { sub: user.sub, email: user.email };
  }
}

function parseClientAuth(
  authHeader: string | undefined,
  body: Record<string, string>,
): { clientId: string; clientSecret?: string } {
  if (authHeader?.toLowerCase().startsWith('basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) {
      throw new UnauthorizedException('Malformed Basic credentials');
    }
    return {
      clientId: decodeURIComponent(decoded.slice(0, idx)),
      clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
    };
  }
  if (!body.client_id) {
    throw new UnauthorizedException('client_id required');
  }
  return {
    clientId: body.client_id,
    clientSecret: body.client_secret,
  };
}
