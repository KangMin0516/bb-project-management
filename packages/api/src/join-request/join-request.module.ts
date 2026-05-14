import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { ApproveJoinRequestUseCase } from './application/approve-join-request.use-case.js';
import { CancelJoinRequestUseCase } from './application/cancel-join-request.use-case.js';
import { CreateJoinRequestUseCase } from './application/create-join-request.use-case.js';
import { JOIN_REQUEST_REPOSITORY } from './application/ports/join-request.repository.js';
import { RejectJoinRequestUseCase } from './application/reject-join-request.use-case.js';
import { JoinRequestPrismaRepository } from './infrastructure/join-request.prisma.repository.js';
import { JoinRequestController } from './join-request.controller.js';

@Module({
  imports: [SlackModule, NotificationModule],
  controllers: [JoinRequestController],
  providers: [
    JoinRequestPrismaRepository,
    {
      provide: JOIN_REQUEST_REPOSITORY,
      useExisting: JoinRequestPrismaRepository,
    },
    CreateJoinRequestUseCase,
    ApproveJoinRequestUseCase,
    RejectJoinRequestUseCase,
    CancelJoinRequestUseCase,
  ],
})
export class JoinRequestModule {}
