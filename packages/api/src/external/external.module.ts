import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller.js';
import { ExternalService } from './external.service.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { IssueModule } from '../issue/issue.module.js';
import { SpecificationModule } from '../specification/specification.module.js';
import { IssueSpecLinkModule } from '../issue-spec-link/issue-spec-link.module.js';
import { CommentModule } from '../comment/comment.module.js';

@Module({
  imports: [
    ApiKeyModule,
    IssueModule,
    SpecificationModule,
    IssueSpecLinkModule,
    CommentModule,
  ],
  controllers: [ExternalController],
  providers: [ExternalService],
})
export class ExternalModule {}
