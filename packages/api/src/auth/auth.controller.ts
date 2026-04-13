// TODO: Add rate limiting (@nestjs/throttler) to prevent brute force attacks
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  Public,
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/index.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Patch('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.auth.getProfile(user.sub);
  }
}
