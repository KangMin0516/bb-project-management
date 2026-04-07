import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TemplateService } from './template.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Post()
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.templateService.create(dto, user.sub);
  }

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.templateService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.templateService.remove(id, user.sub);
  }
}
