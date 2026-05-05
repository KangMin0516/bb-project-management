import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller.js';
import { ExternalService } from './external.service.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { IssueModule } from '../issue/issue.module.js';
import { SpecificationModule } from '../specification/specification.module.js';

@Module({
  imports: [ApiKeyModule, IssueModule, SpecificationModule],
  controllers: [ExternalController],
  providers: [ExternalService],
})
export class ExternalModule {}
