import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  IsBoolean,
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

const validTypes = Object.values(QUESTION_TYPE);
const validDifficulties = Object.values(DIFFICULTY_LEVEL);

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsString()
  textAr?: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type: QuestionType;

  @IsString()
  @IsNotEmpty({ message: 'Question text is required' })
  questionText: string;

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
