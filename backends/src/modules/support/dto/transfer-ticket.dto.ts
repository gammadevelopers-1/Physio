import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// Mirrors TICKET_COLLAB_DEPARTMENTS from the schema. Inline literal
// so the validator can use it directly.
const ALLOWED_DEPARTMENTS = [
  'course_manager',
  'finance',
  'admin',
  'instructor',
  'ta',
  'supervisor',
] as const;

export class TransferTicketDto {
  // New category slug. Validated at service layer against the live
  // category list (built-ins + admin custom) so typos can't slip in.
  @Matches(/^[a-z][a-z0-9_-]{0,29}$/, {
    message: 'toCategory must be a lowercase slug (a-z, 0-9, -, _)',
  })
  @IsNotEmpty()
  toCategory: string;

  @IsIn(ALLOWED_DEPARTMENTS)
  toDepartment: (typeof ALLOWED_DEPARTMENTS)[number];

  // Specific user to loop in. When omitted, the service picks the
  // first active member of the department (or — for course-bound
  // roles like instructor/ta/course_manager — the one tied to the
  // ticket's courseId).
  @IsUUID('4')
  @IsOptional()
  userId?: string;

  // Optional supervisor override of the system-thread message. When
  // empty the service falls back to support_config.transfer_message_template_en/ar.
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  noteToRequester?: string;
}
