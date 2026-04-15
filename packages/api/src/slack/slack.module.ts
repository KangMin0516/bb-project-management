import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller.js';
import { SlackService } from './slack.service.js';

@Module({
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
