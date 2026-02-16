import { IsNotEmpty, IsIn } from 'class-validator';
import { ROLE_NAMES } from '../../../database/schema';

// SUPER_ADMIN is seed-only — never assignable via API
const validRoles = Object.values(ROLE_NAMES).filter(
  (r) => r !== ROLE_NAMES.SUPER_ADMIN,
);

export class AssignRoleDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(validRoles, { message: `Role must be one of: ${validRoles.join(', ')}` })
  role: string;
}
