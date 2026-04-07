import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { SuperuserGuard } from '../common/guards/index.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.userService.findAll(search);
  }

  @UseGuards(SuperuserGuard)
  @Get('pending')
  findPending() {
    return this.userService.findPending();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @UseGuards(SuperuserGuard)
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.userService.approve(id);
  }

  @UseGuards(SuperuserGuard)
  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.userService.reject(id);
  }
}
