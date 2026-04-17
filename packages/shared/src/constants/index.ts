// ─── Issue Status ───────────────────────────────────────────
export const IssueStatus = {
  BACKLOG: "BACKLOG",
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW_QA: "REVIEW_QA",
  DONE: "DONE",
  CANCELED: "CANCELED",
} as const;

export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus];

export const ISSUE_STATUS_LIST: IssueStatus[] = [
  IssueStatus.BACKLOG,
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.REVIEW_QA,
  IssueStatus.DONE,
  IssueStatus.CANCELED,
];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW_QA: "Review/QA",
  DONE: "Done",
  CANCELED: "Canceled",
};

export const STATUS_CATEGORY: Record<
  IssueStatus,
  "todo" | "in_progress" | "done"
> = {
  BACKLOG: "todo",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW_QA: "in_progress",
  DONE: "done",
  CANCELED: "done",
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  BACKLOG: "#94A3B8",
  TODO: "#3B82F6",
  IN_PROGRESS: "#F59E0B",
  REVIEW_QA: "#8B5CF6",
  DONE: "#10B981",
  CANCELED: "#EF4444",
};

// ─── Issue Priority ─────────────────────────────────────────
export const IssuePriority = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type IssuePriority =
  (typeof IssuePriority)[keyof typeof IssuePriority];

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_COLORS: Record<IssuePriority, string> = {
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
};

// ─── Issue Type ─────────────────────────────────────────────
export const IssueType = {
  EPIC: "EPIC",
  TASK: "TASK",
  BUG: "BUG",
  SUB_TASK: "SUB_TASK",
} as const;

export type IssueType = (typeof IssueType)[keyof typeof IssueType];

export const TYPE_LABELS: Record<IssueType, string> = {
  EPIC: "Epic",
  TASK: "Task",
  BUG: "Bug",
  SUB_TASK: "Sub-task",
};

export const TYPE_COLORS: Record<IssueType, string> = {
  EPIC: "#8B5CF6",
  TASK: "#3B82F6",
  BUG: "#EF4444",
  SUB_TASK: "#6B7280",
};

// ─── Project Role ───────────────────────────────────────────
export const ProjectRole = {
  ADMIN: "ADMIN",
  PM: "PM",
  DEVELOPER: "DEVELOPER",
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export const ROLE_LABELS: Record<ProjectRole, string> = {
  ADMIN: "Admin",
  PM: "PM",
  DEVELOPER: "Developer",
};

// ─── Default Labels ─────────────────────────────────────────
export const DEFAULT_LABELS = [
  { name: "frontend", color: "#3B82F6" },
  { name: "backend", color: "#10B981" },
  { name: "mobile", color: "#8B5CF6" },
  { name: "bug", color: "#EF4444" },
  { name: "infra", color: "#6B7280" },
  { name: "qa", color: "#F59E0B" },
] as const;

// ─── Pagination ─────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// ─── Order ──────────────────────────────────────────────────
export const ORDER_GAP = 1000;
