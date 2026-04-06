import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LabelService } from './label.service.js';
import { CreateLabelDto } from './dto/create-label.dto.js';
import { UpdateLabelDto } from './dto/update-label.dto.js';
import { Roles } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@ApiTags('Labels')
@ApiBearerAuth()
@Controller('projects/:projectId/labels')
@UseGuards(ProjectMemberGuard)
export class LabelController {
  constructor(private labelService: LabelService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  create(@Param('projectId') projectId: string, @Body() dto: CreateLabelDto) {
    return this.labelService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.labelService.findAll(projectId);
  }

  @Patch(':labelId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  update(
    @Param('projectId') projectId: string,
    @Param('labelId') labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelService.update(projectId, labelId, dto);
  }

  @Delete(':labelId')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  remove(
    @Param('projectId') projectId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelService.remove(projectId, labelId);
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  seed(@Param('projectId') projectId: string) {
    return this.labelService.seedDefaults(projectId);
  }
}
