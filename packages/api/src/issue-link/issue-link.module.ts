import { Module } from '@nestjs/common';
import { IssueLinkController } from './issue-link.controller.js';
import { IssueLinkService } from './issue-link.service.js';

@Module({
  controllers: [IssueLinkController],
  providers: [IssueLinkService],
  exports: [IssueLinkService],
})
export class IssueLinkModule {}
