import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectSourceFromHeaders, setRequestSource } from '../common/source.js';

/**
 * Guard for non-interactive auth on external/MCP endpoints.
 *
 * Accepts EITHER:
 *  - `X-API-Key: bbpm_<hex>` — long-lived personal key (used by Cursor,
 *    Claude Code, Claude Desktop, scripts).
 *  - `Authorization: Bearer bbpm_at_<…>` — short-lived OAuth 2.1 access
 *    token issued by the BBPM Authorization Server. Used by claude.ai
 *    web custom connectors, ChatGPT connectors, etc.
 *
 * Both paths populate `request.user` with the same shape, so downstream
 * controllers don't care which credential type was used.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers as Record<string, string | undefined>;

    const apiKey = headers['x-api-key'];
    if (apiKey) {
      const user = await this.apiKeyService.validateKey(apiKey);
      if (!user) {
        throw new UnauthorizedException('Invalid API key');
      }
      request.user = { sub: user.id, email: user.email };
      setRequestSource(request, detectSourceFromHeaders(request.headers));
      return true;
    }

    const bearer = extractBearer(headers['authorization']);
    if (bearer) {
      const resolved = await this.resolveBearer(bearer);
      if (!resolved) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      request.user = { sub: resolved.userId, email: resolved.email };
      // OAuth Bearer flow always originates from an external MCP-style
      // client. Honour an explicit X-Client-Source if the client sent
      // one (so ChatGPT / claude.ai can differentiate themselves), else
      // tag the row with the registered OAuth client name.
      const source = detectSourceFromHeaders(request.headers);
      setRequestSource(request, source);
      return true;
    }

    throw new UnauthorizedException(
      'Authentication required: send X-API-Key or Authorization: Bearer.',
    );
  }

  private async resolveBearer(token: string) {
    const row = await this.prisma.oAuthAccessToken.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true, status: true } },
      },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    if (row.user.status !== 'ACTIVE') return null;
    return { userId: row.user.id, email: row.user.email };
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ', 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}
