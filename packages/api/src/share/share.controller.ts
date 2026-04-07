import { Controller, Get, Param, Query, Req, Res, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/index.js';
import { ShareService } from './share.service.js';

const CRAWLER_UA =
  /Slackbot|facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|Googlebot/i;

@Controller('share')
@Public()
export class ShareController {
  constructor(private shareService: ShareService) {}

  @Get(':issueKey')
  async share(
    @Param('issueKey') issueKey: string,
    @Query('from') from: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { projectKey, issueNumber } = this.parseIssueKey(issueKey);
    const issue = await this.shareService.findIssueByKey(projectKey, issueNumber);

    const ua = req.headers['user-agent'] || '';
    if (CRAWLER_UA.test(ua)) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const html = this.shareService.buildOgHtml(issue, baseUrl, issueKey);
      res.type('html').send(html);
      return;
    }

    const page = from === 'board' ? 'board' : 'issues';
    res.redirect(302, `/projects/${issue.projectId}/${page}?open=${issue.id}`);
  }

  private parseIssueKey(issueKey: string): { projectKey: string; issueNumber: number } {
    const dashIdx = issueKey.lastIndexOf('-');
    if (dashIdx <= 0) throw new NotFoundException('Invalid issue key');

    const projectKey = issueKey.substring(0, dashIdx);
    const issueNumber = parseInt(issueKey.substring(dashIdx + 1), 10);
    if (isNaN(issueNumber)) throw new NotFoundException('Invalid issue key');

    return { projectKey, issueNumber };
  }
}
