import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

// Allowed departments mirror schema/ticket-collaborators.ts
// TICKET_COLLAB_DEPARTMENTS. Kept inline (not imported) so the DTO
// stays decoupled from the schema's runtime constant — class-validator
// needs literal arrays.
const ALLOWED_DEPARTMENTS = [
  'course_manager',
  'finance',
  'admin',
  'instructor',
  'ta',
  'supervisor',
] as const;

export class AddCollaboratorDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;

  @IsIn(ALLOWED_DEPARTMENTS)
  department: (typeof ALLOWED_DEPARTMENTS)[number];
}
