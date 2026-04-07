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
import { ComponentService } from './component.service.js';
import { CreateComponentDto } from './dto/create-component.dto.js';
import { UpdateComponentDto } from './dto/update-component.dto.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Components')
@ApiBearerAuth()
@Controller('projects/:projectId/components')
@UseGuards(ProjectMemberGuard)
export class ComponentController {
  constructor(private componentService: ComponentService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateComponentDto,
  ) {
    return this.componentService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.componentService.findAll(projectId);
  }

  @Get(':componentId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
  ) {
    return this.componentService.findOne(projectId, componentId);
  }

  @Patch(':componentId')
  update(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.componentService.update(projectId, componentId, dto);
  }

  @Delete(':componentId')
  remove(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
  ) {
    return this.componentService.remove(projectId, componentId);
  }
}
