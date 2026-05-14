import { IsNumber, Min, IsIn } from 'class-validator';

const ISSUE_STATUSES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW_QA',
  'RECHECK',
  'DONE',
  'CANCELED',
] as const;

export class ReorderIssueDto {
  @IsIn(ISSUE_STATUSES)
  status!: string;

  @IsNumber()
  @Min(0)
  order!: number;
}
