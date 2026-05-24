import { Module } from '@nestjs/common';
import { SpecificationController } from './specification.controller.js';
import { SpecificationService } from './specification.service.js';
import { SpecItemService } from './spec-item.service.js';
import { SpecItemIssueLinkService } from './spec-item-issue-link.service.js';
import { SpecSuggestService } from './spec-suggest.service.js';
import { QuickIssueModule } from '../quick-issue/quick-issue.module.js';

@Module({
  imports: [QuickIssueModule],
  controllers: [SpecificationController],
  providers: [
    SpecificationService,
    SpecItemService,
    SpecItemIssueLinkService,
    SpecSuggestService,
  ],
  exports: [
    SpecificationService,
    SpecItemService,
    SpecItemIssueLinkService,
  ],
})
export class SpecificationModule {}
