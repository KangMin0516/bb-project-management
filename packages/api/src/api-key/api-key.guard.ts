import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import {
  detectSourceFromHeaders,
  setRequestSource,
} from '../common/source.js';

/**
 * Guard for API key authentication (X-API-Key header).
 * Used for external AI system integration endpoints.
 *
 * Also tags the request with the inferred client (MCP / SLACK /
 * WEBHOOK / API) based on the User-Agent so downstream controllers
 * can persist `source` on the rows they create — that's what gives
 * the UI its "via MCP" badge.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const user = await this.apiKeyService.validateKey(apiKey);
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Set user on request for downstream use (same shape as JWT payload)
    request.user = { sub: user.id, email: user.email };
    setRequestSource(request, detectSourceFromHeaders(request.headers));
    return true;
  }
}
