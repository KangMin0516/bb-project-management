import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuperuserGuard } from '../common/guards/index.js';
import { OutboxHealthService } from './outbox-health.service.js';

/**
 * Operator-only outbox status. Mounted under `/admin` because anyone
 * who can read this could see internal event payloads + pending
 * recipients. Lives in OutboxModule so it ships with the rest of the
 * outbox infrastructure as one unit.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('admin/outbox')
export class OutboxAdminController {
  constructor(private readonly health: OutboxHealthService) {}

  @Get('health')
  getHealth() {
    return this.health.snapshot();
  }
}
