import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareLinkRow,
} from './ports/share-link.repository.js';

export interface RevokeShareLinkCommand {
  id: string;
  projectId: string;
}

@Injectable()
export class RevokeShareLinkUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
  ) {}

  async execute(cmd: RevokeShareLinkCommand): Promise<ShareLinkRow> {
    // Scoped lookup — a PM on project A cannot revoke a link on project
    // B by guessing the id. Path enforces projectId; the repo enforces
    // the (id, projectId) tuple.
    const link = await this.repo.findByIdScoped(cmd.id, cmd.projectId);
    if (!link) throw new NotFoundException('Share link not found');
    if (link.revokedAt) return link; // Idempotent.
    return this.repo.revoke(link.id, new Date());
  }
}
