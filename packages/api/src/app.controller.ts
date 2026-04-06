import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/index.js';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
