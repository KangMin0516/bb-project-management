import { Module } from '@nestjs/common';
import { IssueSpecLinkController } from './issue-spec-link.controller.js';
import { IssueSpecLinkService } from './issue-spec-link.service.js';

@Module({
  controllers: [IssueSpecLinkController],
  providers: [IssueSpecLinkService],
  exports: [IssueSpecLinkService],
})
export class IssueSpecLinkModule {}
