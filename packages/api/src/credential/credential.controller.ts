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
import { CredentialService } from './credential.service.js';
import { CreateCredentialDto } from './dto/create-credential.dto.js';
import { UpdateCredentialDto } from './dto/update-credential.dto.js';
import {
  CurrentUser,
  Roles,
  type JwtPayload,
} from '../common/decorators/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@ApiTags('Credentials')
@ApiBearerAuth()
@Controller('projects/:projectId/credentials')
@UseGuards(ProjectMemberGuard)
export class CredentialController {
  constructor(private credentialService: CredentialService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.credentialService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.credentialService.findOne(projectId, id);
  }

  @Get(':id/reveal')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  reveal(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.credentialService.reveal(projectId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCredentialDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.credentialService.create(projectId, user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.credentialService.update(projectId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.ADMIN, ProjectRole.PM)
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.credentialService.remove(projectId, id);
  }
}
