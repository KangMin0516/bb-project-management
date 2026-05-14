import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StandupConfigService } from './standup-config.service.js';
import { StandupService } from './standup.service.js';
import { CreateConfigDto } from './dto/create-config.dto.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { SuperuserGuard } from '../common/guards/index.js';

@ApiTags('Standup')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('standup')
export class StandupController {
  constructor(
    private readonly configService: StandupConfigService,
    private readonly standupService: StandupService,
  ) {}

  // ─── Questions (config) ───────────────────────────────────

  @Get('questions')
  listQuestions() {
    return this.configService.listQuestions();
  }

  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.configService.createQuestion(dto);
  }

  @Patch('questions/:id')
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.configService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  deleteQuestion(@Param('id') id: string) {
    return this.configService.deleteQuestion(id);
  }

  // ─── Configs (config) ─────────────────────────────────────

  @Get('configs')
  listConfigs() {
    return this.configService.listConfigs();
  }

  @Post('configs')
  createConfig(@Body() dto: CreateConfigDto) {
    return this.configService.createConfig(dto);
  }

  @Patch('configs/:id')
  updateConfig(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    return this.configService.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string) {
    return this.configService.deleteConfig(id);
  }

  @Get('configs/:id/reports')
  getReports(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.configService.getReports(id, limit);
  }

  // ─── Trigger (report lifecycle — stays on legacy) ─────────

  @Post('configs/:id/trigger')
  triggerStandup(@Param('id') id: string) {
    return this.standupService.triggerStandup(id);
  }
}
