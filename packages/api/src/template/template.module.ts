import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller.js';
import { TemplateService } from './template.service.js';

@Module({
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
