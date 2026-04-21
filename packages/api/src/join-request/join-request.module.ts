import { Module } from '@nestjs/common';
import { JoinRequestController } from './join-request.controller.js';
import { JoinRequestService } from './join-request.service.js';
import { SlackModule } from '../slack/slack.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [SlackModule, NotificationModule],
  controllers: [JoinRequestController],
  providers: [JoinRequestService],
})
export class JoinRequestModule {}
