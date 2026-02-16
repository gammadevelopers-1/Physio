import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QUESTION_TYPE,
  DIFFICULTY_LEVEL,
  QuestionType,
  DifficultyLevel,
} from '../../../database/schema';
import { QuestionOptionDto } from './create-question.dto';

const validTypes = Object.values(QUESTION_TYPE);
const validDifficulties = Object.values(DIFFICULTY_LEVEL);

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type?: QuestionType;

  @IsOptional()
  @IsString()
  questionText?: string;

  @IsOptional()
  @IsString()
  questionTextAr?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  marks?: number;

  @IsOptional()
  @IsString()
  @IsIn(validDifficulties, {
    message: `Difficulty level must be one of: ${validDifficulties.join(', ')}`,
  })
  difficultyLevel?: DifficultyLevel;
}
