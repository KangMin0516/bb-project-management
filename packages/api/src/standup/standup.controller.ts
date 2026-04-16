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
import { StandupService } from './standup.service.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { CreateConfigDto } from './dto/create-config.dto.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { SuperuserGuard } from '../common/guards/index.js';

@ApiTags('Standup')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('standup')
export class StandupController {
  constructor(private standupService: StandupService) {}

  // ─── Questions ────────────────────────────────────────────

  @Get('questions')
  listQuestions() {
    return this.standupService.listQuestions();
  }

  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.standupService.createQuestion(dto);
  }

  @Patch('questions/:id')
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.standupService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  deleteQuestion(@Param('id') id: string) {
    return this.standupService.deleteQuestion(id);
  }

  // ─── Configs ──────────────────────────────────────────────

  @Get('configs')
  listConfigs() {
    return this.standupService.listConfigs();
  }

  @Post('configs')
  createConfig(@Body() dto: CreateConfigDto) {
    return this.standupService.createConfig(dto);
  }

  @Patch('configs/:id')
  updateConfig(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    return this.standupService.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string) {
    return this.standupService.deleteConfig(id);
  }

  @Post('configs/:id/trigger')
  triggerStandup(@Param('id') id: string) {
    return this.standupService.triggerStandup(id);
  }

  @Get('configs/:id/reports')
  getReports(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.standupService.getReports(id, limit);
  }
}
