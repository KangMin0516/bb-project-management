import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { UploadModule } from './upload/upload.module.js';
import { TemplateModule } from './template/template.module.js';
import { SearchModule } from './search/search.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { ShareModule } from './share/share.module.js';
import { IssueLinkModule } from './issue-link/issue-link.module.js';
import { IssueSpecLinkModule } from './issue-spec-link/issue-spec-link.module.js';
import { ComponentModule } from './component/component.module.js';
import { SpecificationModule } from './specification/specification.module.js';
import { CredentialModule } from './credential/credential.module.js';
import { SlackModule } from './slack/slack.module.js';
import { ReportModule } from './report/report.module.js';
import { StandupModule } from './standup/standup.module.js';
import { JwtAuthGuard } from './common/guards/index.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
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
    UploadModule,
    TemplateModule,
    SearchModule,
    NotificationModule,
    ShareModule,
    IssueLinkModule,
    IssueSpecLinkModule,
    ComponentModule,
    SpecificationModule,
    CredentialModule,
    SlackModule,
    ReportModule,
    StandupModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
