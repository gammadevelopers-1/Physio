import { IsNotEmpty, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ROLE_NAMES, SUPPORT_SUB_ROLES } from '../../../database/schema';

// SUPER_ADMIN is seed-only — never assignable via API
const validRoles = Object.values(ROLE_NAMES).filter(
  (r) => r !== ROLE_NAMES.SUPER_ADMIN,
);

const validSubRoles = Object.values(SUPPORT_SUB_ROLES);

export class AssignRoleDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(validRoles, { message: `Role must be one of: ${validRoles.join(', ')}` })
  role: string;

  @IsOptional()
  @IsIn(validSubRoles, {
    message: `Support sub-role must be one of: ${validSubRoles.join(', ')}`,
  })
  supportSubRole?: string;

  // Required when role=SUPPORT + supportSubRole=agent. Identifies the
  // supervisor whose team the new agent joins. Enforced server-side.
  @IsOptional()
  @IsUUID('4', { message: 'supervisorId must be a valid UUID' })
  supervisorId?: string;
}
