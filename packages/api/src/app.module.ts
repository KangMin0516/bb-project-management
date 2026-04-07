import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/index.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { ProjectModule } from './project/project.module.js';
import { ProjectMemberModule } from './project-member/project-member.module.js';
import { IssueModule } from './issue/issue.module.js';
import { LabelModule } from './label/label.module.js';
import { ActivityModule } from './activity/activity.module.js';
import { CommentModule } from './comment/comment.module.js';
import { ApiKeyModule } from './api-key/api-key.module.js';
import { ExternalModule } from './external/external.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { JwtAuthGuard } from './common/guards/index.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ProjectModule,
    ProjectMemberModule,
    IssueModule,
    LabelModule,
    ActivityModule,
    CommentModule,
    ApiKeyModule,
    ExternalModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
