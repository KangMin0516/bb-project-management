import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Post()
  create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.findAll(user.sub);
  }

  @Delete(':keyId')
  remove(@Param('keyId') keyId: string, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.remove(user.sub, keyId);
  }
}
