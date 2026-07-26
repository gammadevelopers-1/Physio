import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Admin/manager removal of an enrolled student. Reason is mandatory —
 * finance reads this on the removed-students list to decide whether a
 * refund is warranted. Deliberately no auto-refund; finance owns that
 * decision.
 */
export class RemoveEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
