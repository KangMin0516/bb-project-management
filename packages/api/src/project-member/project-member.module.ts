import { Module } from '@nestjs/common';
import { ProjectMemberController } from './project-member.controller.js';
import { ProjectMemberService } from './project-member.service.js';

@Module({
  controllers: [ProjectMemberController],
  providers: [ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
