import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';

@Module({
  imports: [ApiKeyModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
