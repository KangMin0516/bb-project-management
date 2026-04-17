// ── Limits ──────────────────────────────────────────
export const ISSUE_MAX_PER_COLUMN = 50;
export const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
export const ATTACHMENT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
export const NOTIFICATION_LIMIT = 50;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
export const SEARCH_RESULT_LIMIT = 20;
export const MAX_MENTIONS = 10;

// ── Prisma selects ──────────────────────────────────
export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
} as const;

export const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  status: true,
  isSuperuser: true,
  createdAt: true,
} as const;
