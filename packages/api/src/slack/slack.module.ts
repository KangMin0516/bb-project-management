import { Module } from '@nestjs/common';
import { MESSAGING_PORT } from '../common/ports/messaging.port.js';
import { SlackAdapter } from './infrastructure/slack.adapter.js';
import { SlackController } from './slack.controller.js';
import { SlackService } from './slack.service.js';

/**
 * SlackModule wires two surfaces:
 *
 *  1. The legacy `SlackService` — still exported for OAuth + admin
 *     features (channel/user listing, disconnect) and for consumers
 *     that haven't migrated to the port yet.
 *
 *  2. The new `MessagingPort` — bound to `SlackAdapter` via a token
 *     so any module importing SlackModule can inject the port symbol
 *     without knowing the concrete vendor.
 *
 * Consumers should prefer the port for new code; the service stays
 * for vendor-native concerns (interactive payloads, OAuth, user info
 * lookups) that don't fit a cross-vendor abstraction.
 */
@Module({
  controllers: [SlackController],
  providers: [
    SlackService,
    SlackAdapter,
    { provide: MESSAGING_PORT, useExisting: SlackAdapter },
  ],
  exports: [SlackService, MESSAGING_PORT],
})
export class SlackModule {}
