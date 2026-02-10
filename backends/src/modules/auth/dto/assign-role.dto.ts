import { IsNotEmpty, IsIn } from 'class-validator';
import { ROLE_NAMES } from '../../../database/schema';

const validRoles = Object.values(ROLE_NAMES);

export class AssignRoleDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(validRoles, { message: `Role must be one of: ${validRoles.join(', ')}` })
  role: string;
}
