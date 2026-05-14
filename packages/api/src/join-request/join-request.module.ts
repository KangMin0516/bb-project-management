import { Module, type OnModuleInit } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { OutboxHandlerRegistry } from '../outbox/outbox-handler.registry.js';
import { SlackModule } from '../slack/slack.module.js';
import { ApproveJoinRequestUseCase } from './application/approve-join-request.use-case.js';
import { CancelJoinRequestUseCase } from './application/cancel-join-request.use-case.js';
import { CreateJoinRequestUseCase } from './application/create-join-request.use-case.js';
import {
  JOIN_REQUEST_ADMIN_DM_DELIVERY,
  JoinRequestAdminDmHandler,
} from './application/handlers/join-request-admin-dm.handler.js';
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
    JoinRequestAdminDmHandler,
  ],
})
export class JoinRequestModule implements OnModuleInit {
  constructor(
    private readonly registry: OutboxHandlerRegistry,
    private readonly adminDmHandler: JoinRequestAdminDmHandler,
  ) {}

  /**
   * Register outbox handlers on init. Matches the NotificationModule
   * pattern — wiring lives at the composition root so the use case +
   * handler stay decoupled from the routing key string.
   */
  onModuleInit(): void {
    this.registry.register(JOIN_REQUEST_ADMIN_DM_DELIVERY, (row) =>
      this.adminDmHandler.handle(row),
    );
  }
}
