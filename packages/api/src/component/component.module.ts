import { Module } from '@nestjs/common';
import { ComponentController } from './component.controller.js';
import { ComponentService } from './component.service.js';

@Module({
  controllers: [ComponentController],
  providers: [ComponentService],
  exports: [ComponentService],
})
export class ComponentModule {}
