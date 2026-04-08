import { Module } from '@nestjs/common';
import { SpecificationController } from './specification.controller.js';
import { SpecificationService } from './specification.service.js';

@Module({
  controllers: [SpecificationController],
  providers: [SpecificationService],
  exports: [SpecificationService],
})
export class SpecificationModule {}
