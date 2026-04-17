import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { UploadService } from './upload.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AVATAR_MAX_SIZE, ATTACHMENT_MAX_SIZE } from '../common/constants.js';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Public()
  @Get('avatar/:userId')
  async getAvatar(@Param('userId') userId: string, @Res() res: Response) {
    const result = await this.uploadService.getAvatar(userId);
    if (!result) {
      throw new NotFoundException('Avatar not found');
    }
    res.set({
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=2592000',
    });
    if (result.stream instanceof Readable) {
      result.stream.pipe(res);
    } else {
      // AWS SDK v3 returns a web ReadableStream
      const reader = (result.stream as ReadableStream).getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    }
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_SIZE } }),
  )
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadService.uploadAvatar(file, user.sub);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ATTACHMENT_MAX_SIZE } }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Query('issueId') issueId?: string,
    @Query('commentId') commentId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadService.upload(file, user.sub, { issueId, commentId });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.uploadService.remove(id, user.sub);
  }
}
