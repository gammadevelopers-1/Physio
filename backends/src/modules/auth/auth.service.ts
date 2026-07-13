import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { eq, and, or, gt, inArray, count, sql, ilike, asc, desc, notLike, SQL } from 'drizzle-orm';
import { randomBytes, createHash, randomInt } from 'crypto';
import { db } from '../../database';
import {
  users,
  User,
  refreshTokens,
  roles,
  userRoles,
  twoFactorChallenges,
  trustedDevices,
  ROLE_NAMES,
  RoleName,
  PERMISSION_CATEGORIES,
  RolePermissions,
  supportTeamMembers,
  SUPPORT_SUB_ROLES,
} from '../../database/schema';
import { RegisterDto, LoginDto, CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { EmailService } from '../email/email.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { ModuleRef } from '@nestjs/core';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { PasswordSetupService } from './password-setup.service';
import { XapiService } from '../xapi/xapi.service';
import { encryptPII, decryptPII, decryptUserPII } from '../../common/crypto';
import { validatePasswordPolicy } from '../../common/password-policy';
import { normalizeSaudiPhone } from '../../common/validators/saudi-phone.validator';

/**
 * Canonicalize a phone value before storage. Storage policy is:
 *   - undefined → undefined (caller skips the field; PATCH semantics)
 *   - null      → null      (explicit clear)
 *   - ""        → null      (UI "clear my phone" sentinel)
 *   - valid KSA → "+9665XXXXXXXX" (E.164 canonical)
 *   - anything else → null (defensive — DTO validation should have caught
 *     non-KSA shapes upstream, but if it slips through we refuse to store
 *     garbage rather than encrypting whatever the caller sent)
 *
 * The output is what gets handed to `encryptPII`, so legacy junk in old
 * rows is replaced on the next save instead of being re-encrypted.
 */
function normalizePhoneForStorage(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  return normalizeSaudiPhone(value);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly RESET_OTP_EXPIRY_MINUTES = 10;
  private readonly RESET_MAX_ATTEMPTS = 3;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private moduleRef: ModuleRef,
    private auditLogService: AuditLogService,
    private adminSettings: AdminSettingsService,
    private passwordSetupService: PasswordSetupService,
    private xapiService: XapiService,
  ) {}

  /**
   * Best-effort audit log write. Wrapped in try/catch so a downstream
   * log-DB blip never breaks an auth flow. Used for sensitive admin
   * actions (role changes, user CRUD, login outcomes, 2FA toggles)
   * to satisfy the platform's "audit logs for sensitive admin actions"
   * requirement.
   */
  private async logSecurityEvent(
    actorId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.auditLogService.log({
        entityType,
        entityId,
        action,
        performedBy: actorId || entityId, // self-attributed when no admin actor
        metadata,
        ipAddress,
      });
    } catch (err) {
      this.logger.warn(`audit log write failed for ${action}: ${err}`);
    }
  }

  // ===========================================
  // Register - Creates user with STUDENT role
  // ===========================================
  async register(dto: RegisterDto): Promise<{ user: Partial<User> & { roles?: string[] }; message: string }> {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Enforce admin-configured password policy
    const authSettings = await this.adminSettings.getAuthSettings();
    const policyErrors = validatePasswordPolicy(dto.password, {
      minLength: authSettings.passwordMinLength,
      requireUppercase: authSettings.passwordRequireUppercase,
      requireNumber: authSettings.passwordRequireNumber,
      requireSpecial: authSettings.passwordRequireSpecial,
    });
    if (policyErrors.length) {
      throw new BadRequestException(policyErrors.join('. '));
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Get STUDENT role
    const [studentRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.STUDENT))
      .limit(1);

    if (!studentRole) {
      throw new BadRequestException('System roles not initialized. Run db:seed:roles');
    }

    // Create user with default STUDENT active role.
    // phone / scfhsNumber / nationalId are PII — encrypt at application
    // layer before storing. encryptPII is null-safe + idempotent.
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: encryptPII(normalizePhoneForStorage(dto.phone) ?? null),
        scfhsNumber: encryptPII(dto.scfhsNumber || null),
        // National ID / Iqama is required at registration and immutable
        // once stored. Already validated by the DTO via @IsSaudiNationalId.
        nationalId: encryptPII(dto.nationalId),
        activeRole: ROLE_NAMES.STUDENT,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        activeRole: users.activeRole,
        createdAt: users.createdAt,
      });

    // Assign STUDENT role to user
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: studentRole.id,
    });

    // Award signup points (best-effort — never blocks registration if it fails).
    // ModuleRef avoids a hard import dependency on PointsModule that would
    // create a circular cycle (PointsModule depends on auth guards).
    try {
      const { PointsService } = await import('../points/points.service');
      const pointsService = this.moduleRef.get(PointsService, { strict: false });
      pointsService
        .award(newUser.id, 'signup', { idempotencyKey: `signup:${newUser.id}` })
        .catch((err) =>
          console.error('Signup points award failed', err),
        );
    } catch (err) {
      console.error('Failed to resolve PointsService for signup award', err);
    }

    return {
      user: {
        ...newUser,
        roles: [ROLE_NAMES.STUDENT],
      },
      message: 'Registration successful',
    };
  }

  // ===========================================
  // Login - Returns user with all roles
  // ===========================================
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    user: Partial<User> & { roles: string[]; supportSubRole?: string | null };
    accessToken: string;
    refreshToken: string;
  }> {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.',
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const attempts = parseInt(user.failedLoginAttempts || '0') + 1;

      // Lock account after the admin-configured attempt threshold.
      const authSettings = await this.adminSettings.getAuthSettings();
      if (attempts >= authSettings.lockoutAttempts) {
        const lockUntil = new Date(
          Date.now() + authSettings.lockoutMinutes * 60 * 1000,
        );
        await db
          .update(users)
          .set({
            failedLoginAttempts: String(attempts),
            lockedUntil: lockUntil,
          })
          .where(eq(users.id, user.id));

        await this.logSecurityEvent(
          user.id,
          'user',
          user.id,
          'auth.login_locked',
          { attempts, lockUntil: lockUntil.toISOString() },
          ipAddress,
        );

        throw new UnauthorizedException(
          `Too many failed attempts. Account locked for ${authSettings.lockoutMinutes} minutes.`,
        );
      }

      await db
        .update(users)
        .set({ failedLoginAttempts: String(attempts) })
        .where(eq(users.id, user.id));

      await this.logSecurityEvent(
        user.id,
        'user',
        user.id,
        'auth.login_failed',
        { attempts, reason: 'invalid_password' },
        ipAddress,
      );

      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user's roles
    const userRolesList = await this.getUserRoles(user.id);

    // Fetch supportSubRole if user has SUPPORT role
    let loginSupportSubRole: string | null = null;
    if (userRolesList.includes('SUPPORT')) {
      const supportRoleRecord = await db
        .select({ subRole: userRoles.supportSubRole })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(eq(userRoles.userId, user.id), eq(roles.name, 'SUPPORT')),
        )
        .limit(1);
      if (supportRoleRecord.length > 0) {
        loginSupportSubRole = supportRoleRecord[0].subRole;
      }
    }

    // Reset failed attempts, verify user, and update last login
    await db
      .update(users)
      .set({
        failedLoginAttempts: '0',
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        isVerified: true,
      })
      .where(eq(users.id, user.id));

    // Generate tokens
    const accessToken = await this.generateAccessToken(user, userRolesList);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    await this.logSecurityEvent(
      user.id,
      'user',
      user.id,
      'auth.login_success',
      { activeRole: user.activeRole },
      ipAddress,
    );

    // NELC xAPI — fire & forget. emitLogin swallows its own errors so a
    // missing national_id or LRS hiccup never blocks the auth response.
    void this.xapiService.emitLogin(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        activeRole: user.activeRole,
        language: user.language,
        roles: userRolesList,
        supportSubRole: loginSupportSubRole,
      },
      accessToken,
      refreshToken,
    };
  }

  // ===========================================
  // Switch Role - Change active role
  // ===========================================
  async switchRole(
    userId: string,
    newRole: RoleName,
  ): Promise<{
    accessToken: string;
    activeRole: string;
  }> {
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user's roles
    const userRolesList = await this.getUserRoles(userId);

    // Check if user has the requested role
    if (!userRolesList.includes(newRole)) {
      throw new ForbiddenException(`You don't have the ${newRole} role`);
    }

    // Update active role
    await db
      .update(users)
      .set({ activeRole: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Generate new token with updated active role
    const updatedUser = { ...user, activeRole: newRole };
    const accessToken = await this.generateAccessToken(updatedUser, userRolesList);

    return {
      accessToken,
      activeRole: newRole,
    };
  }

  // ===========================================
  // Assign Role - Add role to user (Admin only)
  // ===========================================
  async assignRole(
    userId: string,
    roleName: RoleName,
    assignedBy: string,
    supportSubRole?: string,
    supervisorId?: string,
  ): Promise<{ message: string; roles: string[] }> {
    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new BadRequestException(`Role ${roleName} does not exist`);
    }

    // Check if user already has this role
    const [existingRole] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)))
      .limit(1);

    if (existingRole) {
      throw new ConflictException(`User already has the ${roleName} role`);
    }

    // Strict role isolation: STUDENT and INSTRUCTOR are mutually exclusive.
    if (roleName === ROLE_NAMES.STUDENT || roleName === ROLE_NAMES.INSTRUCTOR) {
      const conflictingRole =
        roleName === ROLE_NAMES.STUDENT
          ? ROLE_NAMES.INSTRUCTOR
          : ROLE_NAMES.STUDENT;
      const currentRoles = await this.getUserRoles(userId);
      if (currentRoles.includes(conflictingRole as RoleName)) {
        throw new ConflictException(
          `User already has the ${conflictingRole} role. Student and Instructor are mutually exclusive — remove the existing role first.`,
        );
      }
    }

    // Same no-orphan-agent invariant as createUser: when an existing
    // user is granted SUPPORT/agent, the admin must pick the team
    // supervisor up front so we never leave the agent in limbo. For
    // SUPPORT/supervisor promotion, if the user was previously on
    // another supervisor's team as an agent, that membership is
    // dropped — a supervisor doesn't sit inside another supervisor's
    // team.
    if (roleName === ROLE_NAMES.SUPPORT) {
      if (supportSubRole === SUPPORT_SUB_ROLES.AGENT) {
        if (!supervisorId) {
          throw new BadRequestException(
            'A supervisor must be assigned when granting the Support Agent role. Pick one from the Supervisor field — or create a Support Supervisor first if none exist.',
          );
        }
        const [supervisor] = await db
          .select({
            userId: userRoles.userId,
            supportSubRole: userRoles.supportSubRole,
            isActive: users.isActive,
          })
          .from(userRoles)
          .innerJoin(users, eq(userRoles.userId, users.id))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(
              eq(userRoles.userId, supervisorId),
              eq(roles.name, ROLE_NAMES.SUPPORT),
            ),
          )
          .limit(1);
        if (
          !supervisor ||
          supervisor.supportSubRole !== SUPPORT_SUB_ROLES.SUPERVISOR
        ) {
          throw new BadRequestException(
            'Selected supervisor does not exist or is not a Support Supervisor',
          );
        }
        if (!supervisor.isActive) {
          throw new BadRequestException(
            'Selected supervisor is suspended — pick an active supervisor instead',
          );
        }
      }
      if (supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR) {
        // Promotion: if this user used to be someone else's agent,
        // drop that membership. They now lead their own team.
        await db
          .delete(supportTeamMembers)
          .where(eq(supportTeamMembers.agentId, userId));
      }
    }

    // Assign role
    await db.insert(userRoles).values({
      userId,
      roleId: role.id,
      assignedBy,
      supportSubRole:
        roleName === 'SUPPORT' ? supportSubRole || null : null,
    });

    // For SUPPORT agents, write the supervisor membership in the same
    // request so creation and team-binding are atomic from the
    // admin's perspective.
    if (
      roleName === ROLE_NAMES.SUPPORT &&
      supportSubRole === SUPPORT_SUB_ROLES.AGENT &&
      supervisorId
    ) {
      await db.insert(supportTeamMembers).values({
        supervisorId,
        agentId: userId,
        addedBy: assignedBy,
      });
    }

    // Admin-assigned roles implicitly verify the user
    if (!user.isVerified) {
      await db
        .update(users)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    // Revoke all sessions: role change invalidates existing trust & tokens
    await this.revokeAllUserSessions(userId);

    // Get updated roles list
    const updatedRoles = await this.getUserRoles(userId);

    // Fix activeRole if it points to a role the user doesn't actually have.
    // Placeholder users from the public Become-a-Trainer flow are created
    // with activeRole='STUDENT' as a label (no STUDENT row in user_roles).
    // After admin assigns their real role (e.g. INSTRUCTOR), flip activeRole
    // so the magic-link auto-login lands them on the correct dashboard.
    if (!updatedRoles.includes(user.activeRole as RoleName)) {
      await db
        .update(users)
        .set({ activeRole: roleName, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    await this.logSecurityEvent(
      assignedBy,
      'user',
      userId,
      'role.assigned',
      { role: roleName, targetEmail: user.email, roles: updatedRoles },
    );

    return {
      message: `Role ${roleName} assigned successfully`,
      roles: updatedRoles,
    };
  }

  // ===========================================
  // Remove Role - Remove role from user (Admin only)
  // ===========================================
  async removeRole(
    userId: string,
    roleName: RoleName,
    removedBy?: string,
  ): Promise<{ message: string; roles: string[] }> {
    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new BadRequestException(`Role ${roleName} does not exist`);
    }

    // Get user's current roles
    const currentRoles = await this.getUserRoles(userId);

    // Don't allow removing the last role
    if (currentRoles.length <= 1) {
      throw new BadRequestException('Cannot remove the last role. User must have at least one role.');
    }

    // Force-reassign guard: removing SUPPORT from a supervisor with
    // active agents would orphan every agent on their team. Block the
    // removal until the admin reassigns the team to another supervisor
    // via `POST /support/team/reassign`. The error message tells the
    // UI exactly how many agents need to move so it can show the right
    // modal.
    if (roleName === ROLE_NAMES.SUPPORT) {
      const [subRoleRow] = await db
        .select({ supportSubRole: userRoles.supportSubRole })
        .from(userRoles)
        .where(
          and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)),
        )
        .limit(1);
      if (subRoleRow?.supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR) {
        const [{ teamSize } = { teamSize: 0 }] = await db
          .select({ teamSize: sql<number>`count(*)::int` })
          .from(supportTeamMembers)
          .where(eq(supportTeamMembers.supervisorId, userId));
        if (Number(teamSize) > 0) {
          throw new BadRequestException(
            `Cannot remove the Support role — this supervisor still has ${teamSize} agent${
              Number(teamSize) === 1 ? '' : 's'
            } on their team. Reassign their agents to another supervisor first.`,
          );
        }
      }
    }

    // Remove role
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));

    // If we just removed SUPPORT from an agent, drop their team
    // membership too — without the SUPPORT role they can't be on a
    // team. Idempotent for users who weren't on any team.
    if (roleName === ROLE_NAMES.SUPPORT) {
      await db
        .delete(supportTeamMembers)
        .where(eq(supportTeamMembers.agentId, userId));
    }

    // If removed role was active, switch to first available role
    if (user.activeRole === roleName) {
      const remainingRoles = currentRoles.filter((r) => r !== roleName);
      await db
        .update(users)
        .set({ activeRole: remainingRoles[0], updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    // Revoke all sessions: role change invalidates existing trust & tokens
    await this.revokeAllUserSessions(userId);

    // Get updated roles list
    const updatedRoles = await this.getUserRoles(userId);

    await this.logSecurityEvent(
      removedBy ?? null,
      'user',
      userId,
      'role.removed',
      { role: roleName, targetEmail: user.email, roles: updatedRoles },
    );

    return {
      message: `Role ${roleName} removed successfully`,
      roles: updatedRoles,
    };
  }

  // ===========================================
  // Get User Roles - List all roles for a user
  // ===========================================
  async getUserRoles(userId: string): Promise<string[]> {
    const result = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return result.map((r) => r.roleName);
  }

  // ===========================================
  // Logout
  // ===========================================
  async logout(refreshToken: string): Promise<{ message: string }> {
    await db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.token, refreshToken));

    return { message: 'Logged out successfully' };
  }

  // ===========================================
  // Refresh Token
  // ===========================================
  async refreshTokens(
    oldRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Find the refresh token
    const [tokenRecord] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, oldRefreshToken),
          eq(refreshTokens.isRevoked, false),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Get user's roles
    const userRolesList = await this.getUserRoles(user.id);

    // Revoke old token (token rotation)
    await db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // Generate new tokens
    const accessToken = await this.generateAccessToken(user, userRolesList);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    return { accessToken, refreshToken };
  }

  // ===========================================
  // Get Current User
  // ===========================================
  async getCurrentUser(userId: string): Promise<Partial<User> & { roles: string[]; supportSubRole?: string | null }> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        phone: users.phone,
        avatar: users.avatar,
        activeRole: users.activeRole,
        department: users.department,
        bio: users.bio,
        scfhsNumber: users.scfhsNumber,
        nationalId: users.nationalId,
        nationality: users.nationality,
        gender: users.gender,
        dateOfBirth: users.dateOfBirth,
        // Trainer-application fields — seeded from role_requests.profileData
        // on approval. The instructor settings page reads these to pre-fill
        // the Professional Information block; without them in the /auth/me
        // SELECT the form was always blank for newly-approved trainers.
        specialty: users.specialty,
        profession: users.profession,
        qualification: users.qualification,
        twitter: users.twitter,
        linkedin: users.linkedin,
        isActive: users.isActive,
        isVerified: users.isVerified,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRolesList = await this.getUserRoles(userId);

    // Fetch supportSubRole if user has SUPPORT role
    let supportSubRole: string | null = null;
    if (userRolesList.includes('SUPPORT')) {
      const supportRoleRecord = await db
        .select({ subRole: userRoles.supportSubRole })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(eq(userRoles.userId, userId), eq(roles.name, 'SUPPORT')),
        )
        .limit(1);
      if (supportRoleRecord.length > 0) {
        supportSubRole = supportRoleRecord[0].subRole;
      }
    }

    return {
      ...decryptUserPII(user),
      roles: userRolesList,
      supportSubRole,
    };
  }

  // ===========================================
  // Helper: Generate Access Token
  // ===========================================
  private async generateAccessToken(
    user: User,
    userRoles: string[],
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      activeRole: user.activeRole,
      roles: userRoles,
    };

    // Admin's Settings → Authentication → Access Token Lifetime wins;
    // fall back to env then to "15m" if neither configured.
    const authSettings = await this.adminSettings.getAuthSettings();
    const expiresIn =
      `${authSettings.sessionTimeoutMinutes}m` ||
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') ||
      '15m';

    return this.jwtService.sign(payload as any, {
      expiresIn: expiresIn as any,
    });
  }

  // ===========================================
  // Helper: Generate Refresh Token
  // ===========================================
  private async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    // Admin's Settings → Authentication → Refresh Token Lifetime wins;
    // env fallback for safety.
    const authSettings = await this.adminSettings.getAuthSettings();
    const days =
      authSettings.refreshTokenDays ||
      parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS') || '7');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt,
      ipAddress,
      deviceInfo: userAgent,
    });

    return token;
  }

  // ===========================================
  // Logout All Devices
  // ===========================================
  async logoutAllDevices(userId: string): Promise<{ message: string }> {
    await db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.userId, userId));

    return { message: 'Logged out from all devices' };
  }

  // ===========================================
  // Helper: Revoke all trusted devices + refresh tokens
  // Used when roles change, user is suspended, etc.
  // ===========================================
  private async revokeAllUserSessions(userId: string): Promise<void> {
    await Promise.all([
      db.delete(trustedDevices).where(eq(trustedDevices.userId, userId)),
      db
        .update(refreshTokens)
        .set({ isRevoked: true, revokedAt: new Date() })
        .where(eq(refreshTokens.userId, userId)),
    ]);
  }

  // ===========================================
  // Admin: Create User
  // ===========================================
  async createUser(
    dto: CreateUserDto,
    createdBy: string,
  ): Promise<Partial<User> & { roles: string[]; inviteSent?: boolean }> {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // INVITE PATH (recommended) — admin omits password. The user
    // sets their own via a magic-link email. Admin never sees or
    // chooses the user's password. Aligns with the trainer-approval
    // and webinar-auto-enroll flows that already use this pattern.
    const useInviteFlow = !dto.password;

    if (!useInviteFlow) {
      // Legacy "admin sets password" path — kept for direct API
      // consumers, but unreachable from the UI. Enforce policy.
      const authSettings = await this.adminSettings.getAuthSettings();
      const policyErrors = validatePasswordPolicy(dto.password!, {
        minLength: authSettings.passwordMinLength,
        requireUppercase: authSettings.passwordRequireUppercase,
        requireNumber: authSettings.passwordRequireNumber,
        requireSpecial: authSettings.passwordRequireSpecial,
      });
      if (policyErrors.length) {
        throw new BadRequestException(policyErrors.join('. '));
      }
    }

    // For the invite path we still need *some* hash in the column
    // (NOT NULL on users.passwordHash). A 64-byte random secret makes
    // the placeholder hash unguessable — only the magic-link path
    // unlocks the account.
    const passwordHash = useInviteFlow
      ? await argon2.hash(randomBytes(64).toString('hex'))
      : await argon2.hash(dto.password!);

    // Get the requested role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, dto.role))
      .limit(1);

    if (!role) {
      throw new BadRequestException(`Role ${dto.role} does not exist`);
    }

    // No-orphan-agent invariant: when creating a Support Agent, the
    // admin must pick the supervisor whose team the agent joins. The
    // membership row is written in the same transaction below, so an
    // orphan agent (SUPPORT user with no team) cannot exist by
    // construction. Resolved once here so we can fail fast before
    // any writes hit the DB.
    const isSupportAgentCreation =
      dto.role === ROLE_NAMES.SUPPORT &&
      dto.supportSubRole === SUPPORT_SUB_ROLES.AGENT;
    if (isSupportAgentCreation) {
      if (!dto.supervisorId) {
        throw new BadRequestException(
          'A supervisor must be assigned when creating a Support Agent. Pick one from the Supervisor field — or create a Support Supervisor first if none exist.',
        );
      }
      const [supervisor] = await db
        .select({
          userId: userRoles.userId,
          supportSubRole: userRoles.supportSubRole,
          isActive: users.isActive,
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(userRoles.userId, dto.supervisorId),
            eq(roles.name, ROLE_NAMES.SUPPORT),
          ),
        )
        .limit(1);
      if (
        !supervisor ||
        supervisor.supportSubRole !== SUPPORT_SUB_ROLES.SUPERVISOR
      ) {
        throw new BadRequestException(
          'Selected supervisor does not exist or is not a Support Supervisor',
        );
      }
      if (!supervisor.isActive) {
        throw new BadRequestException(
          'Selected supervisor is suspended — pick an active supervisor instead',
        );
      }
    }

    // Create user with the specified active role. Phone is encrypted at
    // application layer (same as register flow above). Invite-flow
    // users stay `isVerified: false` until they complete password
    // setup — the login guard at the top of this service already
    // blocks unverified users, so they cannot sign in with anything
    // until the email link is consumed.
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: encryptPII(normalizePhoneForStorage(dto.phone) ?? null),
        activeRole: dto.role,
        isVerified: !useInviteFlow,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        activeRole: users.activeRole,
        isActive: users.isActive,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      });

    // Assign the role
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: role.id,
      assignedBy: createdBy,
      supportSubRole:
        dto.role === 'SUPPORT' ? dto.supportSubRole || null : null,
    });

    // Bind the new Support Agent to the chosen supervisor's team so
    // the orphan-agent state never arises. Done in the same request
    // path; if this insert fails the whole createUser fails and the
    // outer 500 surfaces so the admin can retry.
    if (isSupportAgentCreation && dto.supervisorId) {
      await db.insert(supportTeamMembers).values({
        supervisorId: dto.supervisorId,
        agentId: newUser.id,
        addedBy: createdBy,
      });
    }

    // Send password-setup invite for the new (recommended) path.
    // Email send is best-effort — a network failure shouldn't roll
    // back the user creation; the admin can use "Resend invite".
    let inviteSent = false;
    if (useInviteFlow) {
      try {
        const recipientName =
          `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() ||
          newUser.email;
        await this.passwordSetupService.sendAdminAccountInviteEmail({
          email: newUser.email,
          recipientName,
          locale: 'en',
        });
        inviteSent = true;
      } catch (err) {
        this.logger.warn(
          `Invite email send failed for ${newUser.email}: ${err}. Admin can resend.`,
        );
      }
    }

    await this.logSecurityEvent(
      createdBy,
      'user',
      newUser.id,
      useInviteFlow ? 'user.invited' : 'user.created',
      {
        email: newUser.email,
        role: dto.role,
        ...(useInviteFlow ? { inviteSent } : {}),
      },
    );

    return {
      ...newUser,
      roles: [dto.role],
      inviteSent,
    };
  }

  /**
   * Resend the admin-account invite. Used by the user-list "Resend
   * invite" action when the original email got lost or the 24h token
   * expired. Generates a fresh token (invalidating any prior unused
   * one) and re-sends the email.
   */
  async resendUserInvite(targetUserId: string, adminId: string): Promise<{ sent: boolean }> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isVerified) {
      throw new BadRequestException(
        'User has already completed setup. Invite cannot be resent.',
      );
    }

    const recipientName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    await this.passwordSetupService.sendAdminAccountInviteEmail({
      email: user.email,
      recipientName,
      locale: 'en',
    });

    await this.logSecurityEvent(adminId, 'user', user.id, 'user.invite_resent', {
      email: user.email,
    });

    return { sent: true };
  }

  // ===========================================
  // Self-Service: Update Own Profile
  // ===========================================
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Partial<User> & { roles: string[] }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.firstNameAr !== undefined) updateData.firstNameAr = dto.firstNameAr;
    if (dto.lastNameAr !== undefined) updateData.lastNameAr = dto.lastNameAr;
    if (dto.phone !== undefined) {
      const canonical = normalizePhoneForStorage(dto.phone);
      updateData.phone = canonical === null ? null : encryptPII(canonical);
    }
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.scfhsNumber !== undefined) updateData.scfhsNumber = encryptPII(dto.scfhsNumber);

    // National ID / Iqama is a one-time-set field. New users provide it
    // at registration; legacy users (pre-this-feature) have a NULL value
    // and may set it ONCE via this endpoint. After that, any attempt to
    // change it is rejected — uneditable from the student profile UI.
    //
    // Note: user.nationalId is stored encrypted, so we decrypt before
    // comparing to the plaintext dto value (otherwise the check would
    // always succeed / fail nonsensically).
    if (dto.nationalId !== undefined && dto.nationalId !== null && dto.nationalId !== '') {
      const currentNationalId = decryptPII(user.nationalId);
      if (currentNationalId && currentNationalId !== dto.nationalId) {
        throw new BadRequestException({
          code: 'NATIONAL_ID_LOCKED',
          message: 'National ID / Iqama cannot be changed once set',
        });
      }
      // Only persist if currently null (first-time set). If client
      // re-sends the same value, treat as no-op.
      if (!currentNationalId) updateData.nationalId = encryptPII(dto.nationalId);
    }
    if (dto.nationality !== undefined) updateData.nationality = dto.nationality;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = dto.dateOfBirth;
    if (dto.specialty !== undefined) updateData.specialty = dto.specialty;
    if (dto.profession !== undefined) updateData.profession = dto.profession;
    if (dto.qualification !== undefined) updateData.qualification = dto.qualification;
    if (dto.twitter !== undefined) updateData.twitter = dto.twitter;
    if (dto.linkedin !== undefined) updateData.linkedin = dto.linkedin;

    // Compute the diff BEFORE updating so we can audit + notify with the
    // before/after pair. Only fields the user actually changed (DTO key
    // present AND value differs from current) end up in `changes`.
    const trackedKeys = [
      'firstName', 'lastName', 'firstNameAr', 'lastNameAr',
      'phone', 'avatar', 'bio', 'location', 'language',
      'department', 'scfhsNumber', 'nationalId', 'nationality',
      'gender', 'dateOfBirth', 'specialty', 'profession',
      'qualification', 'twitter', 'linkedin',
    ] as const;
    // For PII fields the stored value is ciphertext and updateData also
    // holds ciphertext — but two encryptions of the same plaintext yield
    // different ciphertext (random IV), so a naive `before !== after`
    // would always flag a "change" on every save. Decrypt both sides for
    // these fields so the diff reflects actual plaintext changes.
    const PII_KEYS = new Set(['phone', 'scfhsNumber', 'nationalId']);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of trackedKeys) {
      if (key in updateData) {
        const rawBefore = (user as Record<string, unknown>)[key];
        const rawAfter = updateData[key];
        const before = PII_KEYS.has(key)
          ? decryptPII(rawBefore as string | null)
          : rawBefore;
        const after = PII_KEYS.has(key)
          ? decryptPII(rawAfter as string | null)
          : rawAfter;
        if (before !== after) {
          changes[key] = { from: before ?? null, to: after ?? null };
        }
      }
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    // Side effects (best-effort) — never block the user-facing response.
    if (Object.keys(changes).length > 0) {
      this.recordProfileEditSideEffects(user, changes).catch((err) =>
        this.logger.warn(
          `Profile edit side-effects failed for ${userId}: ${(err as Error).message}`,
        ),
      );
    }

    return this.getCurrentUser(userId);
  }

  /**
   * Audit log + admin notification for instructor profile edits. Fired
   * once per save with a diff. Best-effort — failures are logged, not
   * propagated, so the user always sees a successful save.
   *
   * Services are pulled via ModuleRef to avoid circular-import chains
   * with audit-logs / admin-notifications modules at boot.
   */
  private async recordProfileEditSideEffects(
    user: User,
    changes: Record<string, { from: unknown; to: unknown }>,
  ): Promise<void> {
    // Audit row first — single source of truth even if notification fails.
    try {
      const { AuditLogService } = await import('../audit-logs/audit-logs.service');
      const auditService = this.moduleRef.get(AuditLogService, { strict: false });
      await auditService.log({
        entityType: 'USER',
        entityId: user.id,
        action: 'PROFILE_UPDATE',
        performedBy: user.id,
        metadata: { changes, by: 'self' },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log failed for profile edit ${user.id}: ${(err as Error).message}`,
      );
    }

    // Notify admin only when an instructor edits their own trainer
    // profile fields — student profile edits are not interesting to admins.
    if (user.activeRole !== 'INSTRUCTOR') return;

    try {
      const { NotificationsService } = await import(
        '../notifications/notifications.service'
      );
      const notificationsService = this.moduleRef.get(NotificationsService, {
        strict: false,
      });
      const userName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email;
      const fieldList = Object.keys(changes).join(', ');
      await notificationsService.create({
        type: 'info',
        title: 'Instructor profile updated',
        description: `${userName} updated their profile fields: ${fieldList}`,
        titleKey: 'notifications.instructor.profile_updated.title',
        descriptionKey: 'notifications.instructor.profile_updated.description',
        descriptionParams: { userName, fieldList },
        link: `/dashboard/admin/users?userId=${user.id}`,
      });
    } catch (err) {
      this.logger.warn(
        `Admin notification failed for profile edit ${user.id}: ${(err as Error).message}`,
      );
    }
  }

  // ===========================================
  // Change Password
  // ===========================================
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Both current and new passwords are required');
    }

    // Enforce admin-configured password policy
    const authSettings = await this.adminSettings.getAuthSettings();
    const policyErrors = validatePasswordPolicy(newPassword, {
      minLength: authSettings.passwordMinLength,
      requireUppercase: authSettings.passwordRequireUppercase,
      requireNumber: authSettings.passwordRequireNumber,
      requireSpecial: authSettings.passwordRequireSpecial,
    });
    if (policyErrors.length) {
      throw new BadRequestException(policyErrors.join('. '));
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await argon2.hash(newPassword);
    await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Revoke all trusted devices and refresh tokens — forces re-login on all devices
    await this.revokeAllUserSessions(userId);

    return { message: 'Password changed successfully' };
  }

  // ===========================================
  // Forgot Password — send OTP to email
  // ===========================================
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select({ id: users.id, email: users.email, language: users.language })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    // Generate 6-digit OTP
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + this.RESET_OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store in two_factor_challenges with a special fingerprint prefix
    await db.insert(twoFactorChallenges).values({
      userId: user.id,
      codeHash,
      fingerprint: `password-reset::${normalizedEmail}`,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });

    // Send email
    const locale = (user.language || 'en') as 'en' | 'ar';
    await this.emailService.sendPasswordReset(normalizedEmail, code, locale);

    return { message: 'If an account exists with that email, a reset code has been sent.' };
  }

  // ===========================================
  // Reset Password — verify OTP + set new password
  // ===========================================
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!newPassword) {
      throw new BadRequestException('Password is required');
    }

    // Enforce admin-configured password policy
    const authSettings = await this.adminSettings.getAuthSettings();
    const policyErrors = validatePasswordPolicy(newPassword, {
      minLength: authSettings.passwordMinLength,
      requireUppercase: authSettings.passwordRequireUppercase,
      requireNumber: authSettings.passwordRequireNumber,
      requireSpecial: authSettings.passwordRequireSpecial,
    });
    if (policyErrors.length) {
      throw new BadRequestException(policyErrors.join('. '));
    }

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    // Find the latest valid challenge for this user
    const [challenge] = await db
      .select()
      .from(twoFactorChallenges)
      .where(
        and(
          eq(twoFactorChallenges.userId, user.id),
          eq(twoFactorChallenges.fingerprint, `password-reset::${normalizedEmail}`),
          eq(twoFactorChallenges.isUsed, false),
          gt(twoFactorChallenges.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(twoFactorChallenges.createdAt))
      .limit(1);

    if (!challenge) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    // Check attempts
    if (challenge.attempts >= this.RESET_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Please request a new reset code.');
    }

    // Verify code
    const codeHash = createHash('sha256').update(code).digest('hex');
    if (codeHash !== challenge.codeHash) {
      // Increment attempts
      await db
        .update(twoFactorChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(twoFactorChallenges.id, challenge.id));
      throw new BadRequestException('Invalid or expired reset code');
    }

    // Check new password isn't the same as current
    const isSamePassword = await argon2.verify(user.passwordHash, newPassword);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from your current password');
    }

    // Mark challenge as used
    await db
      .update(twoFactorChallenges)
      .set({ isUsed: true })
      .where(eq(twoFactorChallenges.id, challenge.id));

    // Update password
    const hashedPassword = await argon2.hash(newPassword);
    await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Revoke all sessions for security
    await this.revokeAllUserSessions(user.id);

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // ===========================================
  // Admin: Update User
  // ===========================================
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    updatedBy?: string,
  ): Promise<Partial<User> & { roles: string[] }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) {
      const canonical = normalizePhoneForStorage(dto.phone);
      updateData.phone = canonical === null ? null : encryptPII(canonical);
    }
    // Zoom seat email — stored plaintext (not PII): host resolution reads
    // it directly when creating meetings/webinars. Empty clears it.
    if (dto.zoomEmail !== undefined)
      updateData.zoomEmail = dto.zoomEmail?.trim() || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isVerified !== undefined) updateData.isVerified = dto.isVerified;
    if (dto.activeRole !== undefined) {
      // Verify the user has this role before setting it active
      const userRolesList = await this.getUserRoles(userId);
      if (!userRolesList.includes(dto.activeRole)) {
        throw new BadRequestException(
          `User does not have the ${dto.activeRole} role. Assign it first.`,
        );
      }
      updateData.activeRole = dto.activeRole;
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    // If user was suspended, revoke all sessions and cascade TA deactivation (EC-15)
    if (dto.isActive === false && user.isActive === true) {
      await this.revokeAllUserSessions(userId);
      // EC-15: Cascade TA deactivation — reject all course assignments, warn managers
      // Use ModuleRef to lazily resolve CourseAssistantsService (avoids circular module dependency)
      try {
        const { CourseAssistantsService } = await import('../course-assistants/course-assistants.service');
        const caService = this.moduleRef.get(CourseAssistantsService, { strict: false });
        caService
          .handleTAAccountDeactivation(userId)
          .catch((err) => console.error('TA deactivation cascade failed', err));
      } catch (err) {
        console.error('Failed to resolve CourseAssistantsService for TA cascade', err);
      }
    }

    // If active role changed, revoke all sessions
    if (dto.activeRole !== undefined && dto.activeRole !== user.activeRole) {
      await this.revokeAllUserSessions(userId);
    }

    // Return updated user
    const [updated] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        zoomEmail: users.zoomEmail,
        activeRole: users.activeRole,
        isActive: users.isActive,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const updatedRoles = await this.getUserRoles(userId);

    // Pick out the security-relevant changes only — the rest is just
    // profile metadata. Suspended / verified / role-switch are the
    // ones the admin Logs page wants to see at a glance.
    const audit: Record<string, unknown> = {};
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      audit.suspended = !dto.isActive;
    }
    if (dto.isVerified !== undefined && dto.isVerified !== user.isVerified) {
      audit.verifiedChange = dto.isVerified;
    }
    if (dto.activeRole !== undefined && dto.activeRole !== user.activeRole) {
      audit.activeRoleChange = { from: user.activeRole, to: dto.activeRole };
    }
    if (Object.keys(audit).length > 0) {
      await this.logSecurityEvent(
        updatedBy ?? null,
        'user',
        userId,
        'user.updated',
        { email: user.email, ...audit },
      );
    }

    return {
      ...updated,
      roles: updatedRoles,
    };
  }

  // ===========================================
  // Admin: Delete User
  // ===========================================
  async deleteUser(userId: string, adminId: string): Promise<{ message: string }> {
    // Prevent self-deletion
    if (userId === adminId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft-delete by anonymization. A hard DELETE would fail for any user
    // that has ever performed an audited action (audit_logs.performed_by,
    // courses.reviewed_by, attendance.marked_by, etc.) since most metadata
    // FKs to users.id don't cascade by design — those records are part of
    // the historical audit trail and must be preserved.
    //
    // Strategy: scrub PII + deactivate, free up the email so the person
    // can sign up again, and strip all roles + refresh tokens so the
    // anonymized account can't authenticate.
    const anonEmail = `deleted-${userId}@deleted.local`;
    await db
      .update(users)
      .set({
        email: anonEmail,
        firstName: null,
        lastName: null,
        firstNameAr: null,
        lastNameAr: null,
        phone: null,
        avatar: null,
        bio: null,
        location: null,
        scfhsNumber: null,
        nationalId: null,
        nationality: null,
        gender: null,
        dateOfBirth: null,
        department: null,
        specialty: null,
        instructorStatus: null,
        zoomEmail: null,
        isActive: false,
        isVerified: false,
        twoFactorEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Strip all role assignments so they can't authenticate as anything
    await db.delete(userRoles).where(eq(userRoles.userId, userId));

    // Invalidate all active sessions
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    await this.logSecurityEvent(
      adminId,
      'user',
      userId,
      'user.deleted',
      { originalEmail: user.email },
    );

    return { message: 'User deleted successfully' };
  }

  // ===========================================
  // Get Instructors (Manager / Admin) — lightweight list for dropdowns
  // ===========================================
  async getInstructors(): Promise<
    Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }>
  > {
    const instructorRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.INSTRUCTOR as RoleName))
      .limit(1);

    if (!instructorRole.length) return [];

    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, instructorRole[0].id),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.firstName));
  }

  // ===========================================
  // Get All Users (Admin) — with pagination, search, filter, sort
  // ===========================================
  async getAllUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const search = query.search?.trim() || '';
    const role = query.role?.trim().toUpperCase() || '';
    const status = query.status?.trim().toLowerCase() || '';
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    const offset = (page - 1) * limit;

    // Build WHERE conditions. Always exclude anonymized (soft-deleted) users
    // — their email is rewritten to `deleted-<uuid>@deleted.local` on delete.
    const conditions: (SQL | undefined)[] = [
      notLike(users.email, 'deleted-%@deleted.local'),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      );
    }

    if (role) {
      // Match users who HOLD this role in the user_roles join table —
      // not just those whose currently-active role is this one. A user
      // can be both an instructor and a student; filtering "Instructor"
      // must surface them either way, matching the per-role count
      // shown in the header (which also reads from user_roles).
      conditions.push(
        sql`${users.id} IN (
          SELECT ${userRoles.userId}
          FROM ${userRoles}
          INNER JOIN ${roles} ON ${roles.id} = ${userRoles.roleId}
          WHERE ${roles.name} = ${role}
        )`,
      );
    }

    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
      conditions.push(eq(users.isVerified, true));
    } else if (status === 'suspended' || status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    } else if (status === 'pending') {
      conditions.push(eq(users.isActive, true));
      conditions.push(eq(users.isVerified, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Sort column mapping
    const sortColumnMap: Record<string, typeof users.createdAt> = {
      email: users.email as any,
      firstName: users.firstName as any,
      lastName: users.lastName as any,
      lastLoginAt: users.lastLoginAt as any,
      createdAt: users.createdAt,
    };
    const sortColumn = sortColumnMap[sortBy] || users.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Execute count, data, stats, and role-breakdown queries in parallel
    const [countResult, allUsers, statsResult, roleBreakdownRows] = await Promise.all([
      db.select({ value: count() }).from(users).where(whereClause),
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
          zoomEmail: users.zoomEmail,
          scfhsNumber: users.scfhsNumber,
          activeRole: users.activeRole,
          isActive: users.isActive,
          isVerified: users.isVerified,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          lastLoginIp: users.lastLoginIp,
        })
        .from(users)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset),
      db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          active: sql<number>`cast(count(*) filter (where ${users.isActive} = true and ${users.isVerified} = true) as int)`,
          pending: sql<number>`cast(count(*) filter (where ${users.isActive} = true and ${users.isVerified} = false) as int)`,
          suspended: sql<number>`cast(count(*) filter (where ${users.isActive} = false) as int)`,
        })
        .from(users),
      // Per-role breakdown via user_roles join. A user with multiple
      // roles is counted once per role — matches the admin's mental
      // model where the population on the "Instructors" filter is the
      // count of users WITH that role, even if they're also a student.
      db
        .select({
          role: roles.name,
          count: sql<number>`cast(count(distinct ${userRoles.userId}) as int)`,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .groupBy(roles.name),
    ]);

    const total = Number(countResult[0].value);
    const totalPages = Math.ceil(total / limit);

    // Flatten the role-breakdown rows into a name → count map. Roles
    // with zero users aren't returned by the query (INNER JOIN) so we
    // don't need to manually zero them out — the frontend just shows
    // 0 when a role is absent from the map.
    const byRole: Record<string, number> = {};
    for (const row of roleBreakdownRows) {
      byRole[row.role] = Number(row.count);
    }

    // Batch fetch roles for all users on this page (avoids N+1)
    let usersWithRoles: (typeof allUsers[number] & { roles: string[] })[];
    if (allUsers.length > 0) {
      const userIds = allUsers.map((u) => u.id);
      const allUserRoles = await db
        .select({
          userId: userRoles.userId,
          roleName: roles.name,
          supportSubRole: userRoles.supportSubRole,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds));

      const rolesByUserId = new Map<string, string[]>();
      const subRoleByUserId = new Map<string, string | null>();
      for (const ur of allUserRoles) {
        const existing = rolesByUserId.get(ur.userId) || [];
        existing.push(ur.roleName);
        rolesByUserId.set(ur.userId, existing);
        if (ur.roleName === 'SUPPORT' && ur.supportSubRole) {
          subRoleByUserId.set(ur.userId, ur.supportSubRole);
        }
      }

      usersWithRoles = allUsers.map((user) => ({
        ...decryptUserPII(user),
        roles: rolesByUserId.get(user.id) || [],
        supportSubRole: subRoleByUserId.get(user.id) || null,
      }));
    } else {
      usersWithRoles = [];
    }

    return {
      data: usersWithRoles,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats: {
        total: Number(statsResult[0].total),
        active: Number(statsResult[0].active),
        pending: Number(statsResult[0].pending),
        suspended: Number(statsResult[0].suspended),
        byRole,
      },
    };
  }

  // ===========================================
  // Export Users (Admin) — flat list for CSV. Honors the same
  // search/role/status filters as getAllUsers but ignores pagination
  // and caps at a hard ceiling so a single click can't OOM the dyno.
  // ===========================================
  async exportAllUsers(query: {
    search?: string;
    role?: string;
    status?: string;
  } = {}): Promise<
    Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      scfhsNumber: string | null;
      activeRole: string | null;
      roles: string[];
      isActive: boolean;
      isVerified: boolean;
      createdAt: Date;
      lastLoginAt: Date | null;
    }>
  > {
    const EXPORT_HARD_CAP = 10000;
    const search = query.search?.trim() || '';
    const role = query.role?.trim().toUpperCase() || '';
    const status = query.status?.trim().toLowerCase() || '';

    const conditions: (SQL | undefined)[] = [
      notLike(users.email, 'deleted-%@deleted.local'),
    ];
    if (search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      );
    }
    if (role) {
      // Same membership-based match as getAllUsers — see note there.
      conditions.push(
        sql`${users.id} IN (
          SELECT ${userRoles.userId}
          FROM ${userRoles}
          INNER JOIN ${roles} ON ${roles.id} = ${userRoles.roleId}
          WHERE ${roles.name} = ${role}
        )`,
      );
    }
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
      conditions.push(eq(users.isVerified, true));
    } else if (status === 'suspended' || status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    } else if (status === 'pending') {
      conditions.push(eq(users.isActive, true));
      conditions.push(eq(users.isVerified, false));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        scfhsNumber: users.scfhsNumber,
        activeRole: users.activeRole,
        isActive: users.isActive,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(EXPORT_HARD_CAP);

    if (rows.length === 0) return [];

    const userIds = rows.map((u) => u.id);
    const allUserRoles = await db
      .select({ userId: userRoles.userId, roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(inArray(userRoles.userId, userIds));

    const rolesByUserId = new Map<string, string[]>();
    for (const ur of allUserRoles) {
      const existing = rolesByUserId.get(ur.userId) || [];
      existing.push(ur.roleName);
      rolesByUserId.set(ur.userId, existing);
    }

    return rows.map((u) => ({
      ...decryptUserPII(u),
      roles: rolesByUserId.get(u.id) || [],
    }));
  }

  // ===========================================
  // Get All Roles with User Counts (Admin)
  // ===========================================
  async getAllRoles(): Promise<
    {
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      permissions: RolePermissions;
      createdAt: Date;
      usersCount: number;
    }[]
  > {
    // Get all roles
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        displayName: roles.displayName,
        description: roles.description,
        permissions: roles.permissions,
        createdAt: roles.createdAt,
      })
      .from(roles)
      .orderBy(roles.createdAt);

    // Get user counts per role
    const roleCounts = await db
      .select({
        roleId: userRoles.roleId,
        count: count(),
      })
      .from(userRoles)
      .groupBy(userRoles.roleId);

    const countMap = new Map(roleCounts.map((rc) => [rc.roleId, rc.count]));

    return allRoles.map((role) => ({
      ...role,
      permissions: (role.permissions as RolePermissions) || {},
      usersCount: countMap.get(role.id) || 0,
    }));
  }

  // ===========================================
  // Update Role Permissions (Admin)
  // Sanitizes the incoming matrix against the known categories so a
  // client can't smuggle in arbitrary keys.
  // ===========================================
  async updateRolePermissions(
    roleId: string,
    permissions: RolePermissions,
  ): Promise<{ id: string; name: string; permissions: RolePermissions }> {
    const [role] = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const sanitized: RolePermissions = {};
    for (const category of PERMISSION_CATEGORIES) {
      const incoming = permissions?.[category];
      if (!incoming) continue;
      sanitized[category] = {
        view: !!incoming.view,
        create: !!incoming.create,
        edit: !!incoming.edit,
        delete: !!incoming.delete,
      };
    }

    await db
      .update(roles)
      .set({ permissions: sanitized })
      .where(eq(roles.id, roleId));

    return { id: role.id, name: role.name, permissions: sanitized };
  }

  // ===========================================
  // Update Role (Admin)
  // ===========================================
  async updateRole(
    roleId: string,
    data: { displayName?: string; description?: string },
  ): Promise<{ id: string; name: string; displayName: string; description: string | null }> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;

    if (Object.keys(updateData).length === 0) {
      return { id: role.id, name: role.name, displayName: role.displayName, description: role.description };
    }

    await db.update(roles).set(updateData).where(eq(roles.id, roleId));

    const [updated] = await db
      .select({
        id: roles.id,
        name: roles.name,
        displayName: roles.displayName,
        description: roles.description,
      })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return updated;
  }

  // ===========================================
  // Create Role (Admin)
  // ===========================================
  async createRole(data: {
    name: string;
    displayName: string;
    description?: string;
  }): Promise<{ id: string; name: string; displayName: string; description: string | null; createdAt: Date }> {
    // Check if role name already exists
    const [existing] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, data.name.toUpperCase()))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Role ${data.name} already exists`);
    }

    const [newRole] = await db
      .insert(roles)
      .values({
        name: data.name.toUpperCase(),
        displayName: data.displayName,
        description: data.description || null,
      })
      .returning({
        id: roles.id,
        name: roles.name,
        displayName: roles.displayName,
        description: roles.description,
        createdAt: roles.createdAt,
      });

    return newRole;
  }

  // ===========================================
  // Delete Role (Admin)
  // ===========================================
  async deleteRole(roleId: string): Promise<{ message: string }> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Protect system roles
    const systemRoles = Object.values(ROLE_NAMES);
    if (systemRoles.includes(role.name as RoleName)) {
      throw new BadRequestException(`Cannot delete system role: ${role.name}`);
    }

    // Check if any users have this role
    const [assignment] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId))
      .limit(1);

    if (assignment) {
      throw new BadRequestException('Cannot delete role that is assigned to users. Remove role from all users first.');
    }

    await db.delete(roles).where(eq(roles.id, roleId));

    return { message: 'Role deleted successfully' };
  }

  // ===========================================
  // Issue Tokens for User (post-2FA verification)
  // ===========================================
  async issueTokensForUser(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    user: Partial<User> & { roles: string[] };
    accessToken: string;
    refreshToken: string;
  }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const userRolesList = await this.getUserRoles(userId);
    const accessToken = await this.generateAccessToken(user, userRolesList);
    const refreshToken = await this.generateRefreshToken(userId, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        activeRole: user.activeRole,
        roles: userRolesList,
      },
      accessToken,
      refreshToken,
    };
  }

  // ===========================================
  // Get Challenge User Info (for resend-2fa)
  // ===========================================
  async getChallengeUserInfo(
    challengeId: string,
  ): Promise<{ userId: string; fingerprint: string; email: string; language: string } | null> {
    const [challenge] = await db
      .select({
        userId: twoFactorChallenges.userId,
        fingerprint: twoFactorChallenges.fingerprint,
      })
      .from(twoFactorChallenges)
      .where(eq(twoFactorChallenges.id, challengeId))
      .limit(1);

    if (!challenge) return null;

    const [user] = await db
      .select({ email: users.email, language: users.language })
      .from(users)
      .where(eq(users.id, challenge.userId))
      .limit(1);

    if (!user) return null;

    return {
      userId: challenge.userId,
      fingerprint: challenge.fingerprint,
      email: user.email,
      language: user.language || 'en',
    };
  }
}
