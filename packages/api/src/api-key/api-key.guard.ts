import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';

/**
 * Guard for API key authentication (X-API-Key header).
 * Used for external AI system integration endpoints.
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
    return true;
  }
}
