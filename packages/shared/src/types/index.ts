import type {
  IssueStatus,
  IssuePriority,
  IssueType,
  ProjectRole,
} from "../constants";

// ─── User ───────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  isSuperuser: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserSummary = Pick<User, "id" | "name" | "email" | "avatar">;

// ─── Project ────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithDetails extends Project {
  members: ProjectMember[];
  issueCount: number;
}

// ─── Project Member ─────────────────────────────────────────
export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  user: UserSummary;
  createdAt: string;
}

// ─── Issue ──────────────────────────────────────────────────
export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  order: number;
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueWithRelations extends Issue {
  assignee: UserSummary | null;
  creator: UserSummary;
  project: Pick<Project, "id" | "key" | "name">;
  parent: Pick<Issue, "id" | "number" | "title" | "type"> | null;
  children: IssueSummary[];
  labels: Label[];
  childCount: number;
}

export type IssueSummary = Pick<
  Issue,
  "id" | "number" | "title" | "status" | "type" | "priority"
> & {
  assignee: UserSummary | null;
};

export interface IssueCard extends Issue {
  assignee: UserSummary | null;
  labels: Label[];
  childCount: number;
}

// ─── Label ──────────────────────────────────────────────────
export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
}

// ─── Activity ───────────────────────────────────────────────
export interface Activity {
  id: string;
  issueId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  user: Pick<User, "id" | "name">;
  createdAt: string;
}

// ─── API Response ───────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Auth ───────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string;
  user: UserSummary;
}

// ─── WebSocket Events ───────────────────────────────────────
export interface WsIssueUpdated {
  issueId: string;
  changes: Partial<Issue>;
  updatedBy: string;
}

export interface WsIssueCreated {
  issue: IssueCard;
  createdBy: string;
}

export interface WsIssueDeleted {
  issueId: string;
  deletedBy: string;
}
