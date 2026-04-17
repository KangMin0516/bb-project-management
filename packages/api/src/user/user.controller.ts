import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { SuperuserGuard } from '../common/guards/index.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import {
  AdminUpdateUserDto,
  AdminResetPasswordDto,
} from './dto/admin-user.dto.js';

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

  @UseGuards(SuperuserGuard)
  @Get('admin/all')
  adminFindAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.userService.adminFindAll(status, search);
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

  @UseGuards(SuperuserGuard)
  @Patch(':id/admin/update')
  adminUpdate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.userService.adminUpdate(id, user.sub, dto);
  }

  @UseGuards(SuperuserGuard)
  @Patch(':id/admin/reset-password')
  adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    return this.userService.adminResetPassword(id, dto);
  }

  @UseGuards(SuperuserGuard)
  @Patch(':id/admin/suspend')
  adminSuspend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.userService.adminSuspend(id, user.sub);
  }

  @UseGuards(SuperuserGuard)
  @Patch(':id/admin/activate')
  adminActivate(@Param('id') id: string) {
    return this.userService.adminActivate(id);
  }

  @UseGuards(SuperuserGuard)
  @Delete(':id/admin')
  adminDelete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.userService.adminDelete(id, user.sub);
  }
}
