import { Module } from '@nestjs/common';
import { GitHubController } from './github.controller.js';
import { GitHubService } from './github.service.js';
import { GitHubWebhookService } from './github-webhook.service.js';
import { GitHubSyncService } from './github-sync.service.js';

@Module({
  controllers: [GitHubController],
  providers: [GitHubService, GitHubWebhookService, GitHubSyncService],
  exports: [GitHubService],
})
export class GitHubModule {}
