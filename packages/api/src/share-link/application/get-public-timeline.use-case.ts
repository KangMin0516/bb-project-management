import { GoneException, Inject, Injectable } from '@nestjs/common';
import { canUnlock } from '../domain/share-link.entity.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
} from './ports/share-link.repository.js';
import { IssueQueryService } from '../../issue/application/issue-query.service.js';

/**
 * Whitelist of fields the public timeline view is allowed to leak.
 * Hand-curated — do NOT derive this from `IssueQueryService` shapes, or
 * the next field added to internal queries silently becomes public.
 */
export interface PublicTimelineIssue {
  id: string;
  number: number;
  title: string;
  type: 'DOMAIN' | 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK';
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  parentId: string | null;
  assignee: { name: string; avatar: string | null } | null;
  labels: Array<{ name: string; color: string }>;
}

/**
 * Cap aligns with the FE Timeline (`useTimelineData` requests `limit=200`).
 * Public surface mirrors the internal cap — a project larger than this
 * will truncate either way; the truncation is not new.
 */
const PUBLIC_TIMELINE_LIMIT = 200;

export interface GetPublicTimelineCommand {
  shareLinkId: string;
  projectId: string;
}

@Injectable()
export class GetPublicTimelineUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
    private readonly issues: IssueQueryService,
  ) {}

  async execute(
    cmd: GetPublicTimelineCommand,
  ): Promise<{ issues: PublicTimelineIssue[] }> {
    // Re-check link state every read. A valid share JWT does NOT mean
    // the underlying link still works — revoke/expiry must take effect
    // immediately, not 2h later when the JWT itself dies.
    const link = await this.repo.findByIdScoped(cmd.shareLinkId, cmd.projectId);
    if (!link)
      throw new GoneException('This share link is no longer available');
    const state = canUnlock(link, new Date());
    if (!state.ok)
      throw new GoneException('This share link is no longer available');

    const result = await this.issues.findAll(cmd.projectId, {
      limit: PUBLIC_TIMELINE_LIMIT,
      includeArchived: false,
    });

    const items = (result as { items?: unknown[] }).items ?? result;
    if (!Array.isArray(items)) return { issues: [] };

    return { issues: items.map(toPublicTimelineIssue) };
  }
}

interface InternalIssueShape {
  id: string;
  number: number;
  title: string;
  type: PublicTimelineIssue['type'];
  status: string;
  priority: string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  parentId: string | null;
  assignee?: { name: string; avatar: string | null } | null;
  labels?: Array<{ label: { name: string; color: string } }> | null;
}

/**
 * Pure mapper. Anything not on `PublicTimelineIssue` is dropped — that's
 * the whole point. Exported for unit testing.
 */
export function toPublicTimelineIssue(raw: unknown): PublicTimelineIssue {
  const i = raw as InternalIssueShape;
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    type: i.type,
    status: i.status,
    priority: i.priority,
    startDate: toIsoString(i.startDate),
    dueDate: toIsoString(i.dueDate),
    parentId: i.parentId,
    assignee: i.assignee
      ? { name: i.assignee.name, avatar: i.assignee.avatar }
      : null,
    labels: (i.labels ?? []).map((l) => ({
      name: l.label.name,
      color: l.label.color,
    })),
  };
}

function toIsoString(d: Date | string | null): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : d;
}
