import {
  IsUUID,
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GradeItemDto {
  @IsUUID('4', { message: 'Question ID must be a valid UUID' })
  questionId: string;

  @IsInt()
  @Min(0)
  marksAwarded: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class GradeSubmissionDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one grade item is required' })
  @ValidateNested({ each: true })
  @Type(() => GradeItemDto)
  grades: GradeItemDto[];

  @IsOptional()
  @IsString()
  overallComment?: string;
}
