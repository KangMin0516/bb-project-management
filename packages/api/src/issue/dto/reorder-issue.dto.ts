import { IsString, IsNumber, Min } from 'class-validator';

export class ReorderIssueDto {
  @IsString()
  status!: string;

  @IsNumber()
  @Min(0)
  order!: number;
}
