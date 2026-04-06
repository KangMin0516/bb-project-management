import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller.js';
import { ExternalService } from './external.service.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';

@Module({
  imports: [ApiKeyModule],
  controllers: [ExternalController],
  providers: [ExternalService],
})
export class ExternalModule {}
