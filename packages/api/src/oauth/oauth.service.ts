import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

interface RegisterClientInput {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
}

interface AuthorizeMintInput {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
}

interface TokenExchangeCodeInput {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  client_secret?: string;
  code_verifier: string;
  resource?: string;
}

interface TokenRefreshInput {
  grant_type: 'refresh_token';
  refresh_token: string;
  client_id: string;
  client_secret?: string;
  scope?: string;
  resource?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly authCodeTtlSeconds = 5 * 60;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.accessTokenTtlSeconds = this.config.get<number>(
      'OAUTH_ACCESS_TOKEN_TTL',
      60 * 60,
    );
    this.refreshTokenTtlSeconds = this.config.get<number>(
      'OAUTH_REFRESH_TOKEN_TTL',
      30 * 24 * 60 * 60,
    );
  }

  /** Build the AS metadata document (RFC 8414). */
  metadata(issuer: string) {
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
      scopes_supported: ['mcp', 'openid', 'profile', 'email'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      revocation_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      service_documentation: `${issuer}/api/docs`,
    };
  }

  // ─── Dynamic Client Registration (RFC 7591) ─────────────

  async registerClient(input: RegisterClientInput) {
    if (!input.client_name?.trim()) {
      throw new BadRequestException('client_name is required');
    }
    if (
      !Array.isArray(input.redirect_uris) ||
      input.redirect_uris.length === 0
    ) {
      throw new BadRequestException('redirect_uris must be a non-empty array');
    }
    for (const uri of input.redirect_uris) {
      if (typeof uri !== 'string' || !this.isValidRedirectUri(uri)) {
        throw new BadRequestException(
          `Invalid redirect_uri: ${uri}. Must be https:// or http://localhost/127.0.0.1.`,
        );
      }
    }

    const authMethod =
      input.token_endpoint_auth_method ?? 'client_secret_basic';
    const isPublic = authMethod === 'none';

    const clientId = `bbpm_client_${randomBytes(16).toString('hex')}`;
    const clientSecret = isPublic
      ? null
      : `bbpm_secret_${randomBytes(32).toString('hex')}`;

    const scopes = (input.scope ?? 'mcp').split(/\s+/).filter(Boolean);

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        clientName: input.client_name.slice(0, 200),
        redirectUris: input.redirect_uris,
        scopes,
        grantTypes: input.grant_types ?? [
          'authorization_code',
          'refresh_token',
        ],
        responseTypes: input.response_types ?? ['code'],
        tokenEndpointAuthMethod: authMethod,
      },
    });

    return {
      client_id: client.clientId,
      ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: client.responseTypes,
      scope: client.scopes.join(' '),
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    };
  }

  // ─── Authorization (consent) ─────────────────────────────

  async getClient(clientId: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      scopes: client.scopes,
    };
  }

  async mintAuthorizationCode(input: AuthorizeMintInput) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: input.clientId },
    });
    if (!client) {
      throw new BadRequestException('Unknown client_id');
    }
    if (!client.redirectUris.includes(input.redirectUri)) {
      throw new BadRequestException(
        'redirect_uri not registered for this client',
      );
    }
    if (input.codeChallengeMethod !== 'S256') {
      throw new BadRequestException(
        'Only PKCE code_challenge_method=S256 is supported',
      );
    }
    if (!input.codeChallenge || input.codeChallenge.length < 43) {
      throw new BadRequestException('code_challenge is required (PKCE)');
    }

    const requestedScopes = input.scope.split(/\s+/).filter(Boolean);
    const grantedScopes = requestedScopes.filter((s) =>
      client.scopes.includes(s),
    );
    if (grantedScopes.length === 0) {
      throw new BadRequestException(
        `No requested scope is supported by this client. Supported: ${client.scopes.join(', ')}`,
      );
    }

    const code = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.authCodeTtlSeconds * 1000);

    await this.prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: client.clientId,
        userId: input.userId,
        redirectUri: input.redirectUri,
        scopes: grantedScopes,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        resource: input.resource,
        expiresAt,
      },
    });

    return code;
  }

  // ─── Token endpoint ──────────────────────────────────────

  async exchangeCode(input: TokenExchangeCodeInput) {
    const client = await this.requireClient(
      input.client_id,
      input.client_secret,
    );

    const authCode = await this.prisma.oAuthAuthCode.findUnique({
      where: { code: input.code },
    });
    if (!authCode) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Single-use: delete eagerly to defeat replay regardless of outcome.
    await this.prisma.oAuthAuthCode.delete({ where: { code: input.code } });

    if (authCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Authorization code expired');
    }
    if (authCode.clientId !== client.clientId) {
      throw new BadRequestException('Code was issued to a different client');
    }
    if (authCode.redirectUri !== input.redirect_uri) {
      throw new BadRequestException(
        'redirect_uri does not match the one used at authorize time',
      );
    }

    // PKCE check: SHA256(verifier) base64url-encoded must equal challenge.
    const computedChallenge = createHash('sha256')
      .update(input.code_verifier)
      .digest('base64url');
    if (!this.constantTimeEqual(computedChallenge, authCode.codeChallenge)) {
      throw new BadRequestException('PKCE verifier mismatch');
    }

    return this.issueTokenPair(
      authCode.userId,
      client.clientId,
      authCode.scopes,
      authCode.resource ?? input.resource,
    );
  }

  async refreshTokens(input: TokenRefreshInput) {
    const client = await this.requireClient(
      input.client_id,
      input.client_secret,
    );

    const existing = await this.prisma.oAuthRefreshToken.findUnique({
      where: { token: input.refresh_token },
    });
    if (!existing) {
      throw new BadRequestException('Invalid refresh_token');
    }

    // Rotate: delete old refresh token regardless (consume-once semantics).
    await this.prisma.oAuthRefreshToken.delete({
      where: { token: input.refresh_token },
    });

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Refresh token expired');
    }
    if (existing.clientId !== client.clientId) {
      throw new BadRequestException('Refresh token belongs to another client');
    }

    // Allow scope down-scoping but not up-scoping.
    let scopes = existing.scopes;
    if (input.scope) {
      const requested = input.scope.split(/\s+/).filter(Boolean);
      const invalid = requested.filter((s) => !existing.scopes.includes(s));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Cannot request additional scopes on refresh: ${invalid.join(' ')}`,
        );
      }
      scopes = requested;
    }

    return this.issueTokenPair(
      existing.userId,
      client.clientId,
      scopes,
      existing.resource ?? input.resource,
    );
  }

  // ─── Bearer-token resolution (called by guards) ─────────

  async resolveAccessToken(token: string) {
    const row = await this.prisma.oAuthAccessToken.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true, status: true } },
        client: { select: { clientId: true, clientName: true } },
      },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    if (row.user.status !== 'ACTIVE') return null;
    return {
      userId: row.user.id,
      email: row.user.email,
      clientId: row.client.clientId,
      clientName: row.client.clientName,
      scopes: row.scopes,
    };
  }

  // ─── Revocation (RFC 7009) ──────────────────────────────

  async revokeToken(token: string, clientId: string, clientSecret?: string) {
    const client = await this.requireClient(clientId, clientSecret);
    await this.prisma.oAuthAccessToken
      .deleteMany({ where: { token, clientId: client.clientId } })
      .catch(() => undefined);
    await this.prisma.oAuthRefreshToken
      .deleteMany({ where: { token, clientId: client.clientId } })
      .catch(() => undefined);
  }

  // ─── Helpers ────────────────────────────────────────────

  private async issueTokenPair(
    userId: string,
    clientId: string,
    scopes: string[],
    resource: string | undefined,
  ) {
    const accessToken = `bbpm_at_${randomBytes(32).toString('base64url')}`;
    const refreshToken = `bbpm_rt_${randomBytes(32).toString('base64url')}`;
    const accessExpiresAt = new Date(
      Date.now() + this.accessTokenTtlSeconds * 1000,
    );
    const refreshExpiresAt = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );

    await this.prisma.$transaction([
      this.prisma.oAuthAccessToken.create({
        data: {
          token: accessToken,
          clientId,
          userId,
          scopes,
          resource,
          expiresAt: accessExpiresAt,
        },
      }),
      this.prisma.oAuthRefreshToken.create({
        data: {
          token: refreshToken,
          clientId,
          userId,
          scopes,
          resource,
          expiresAt: refreshExpiresAt,
        },
      }),
    ]);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  private async requireClient(clientId: string, clientSecret?: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });
    if (!client) {
      throw new UnauthorizedException('Unknown client');
    }
    if (client.tokenEndpointAuthMethod === 'none') {
      // Public client (PKCE) — secret must NOT be sent.
      if (clientSecret) {
        throw new UnauthorizedException(
          'Public client must not present a client_secret',
        );
      }
      return client;
    }
    if (!clientSecret || !client.clientSecret) {
      throw new UnauthorizedException('client_secret required');
    }
    if (!this.constantTimeEqual(clientSecret, client.clientSecret)) {
      throw new UnauthorizedException('Invalid client_secret');
    }
    return client;
  }

  private isValidRedirectUri(uri: string): boolean {
    try {
      const u = new URL(uri);
      if (u.protocol === 'https:') return true;
      // OAuth 2.1 still allows http on loopback for native apps.
      if (
        u.protocol === 'http:' &&
        (u.hostname === 'localhost' ||
          u.hostname === '127.0.0.1' ||
          u.hostname === '[::1]')
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
