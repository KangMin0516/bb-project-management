import { IsInt, IsOptional, IsString } from 'class-validator';

export class ConfigQuestionDto {
  @IsString()
  questionId: string;

  @IsInt()
  order: number;
}

export class ConfigMemberDto {
  @IsString()
  slackUserId: string;

  @IsOptional()
  @IsString()
  username?: string;
}
