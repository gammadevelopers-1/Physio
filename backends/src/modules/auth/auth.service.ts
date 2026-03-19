import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { eq, and, or, gt, inArray, count, sql, ilike, asc, desc, SQL } from 'drizzle-orm';
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
} from '../../database/schema';
import { RegisterDto, LoginDto, CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { EmailService } from '../email/email.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class AuthService {
  private readonly RESET_OTP_EXPIRY_MINUTES = 10;
  private readonly RESET_MAX_ATTEMPTS = 3;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private moduleRef: ModuleRef,
  ) {}

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

    // Create user with default STUDENT active role
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        scfhsNumber: dto.scfhsNumber || null,
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
    user: Partial<User> & { roles: string[] };
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

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await db
          .update(users)
          .set({
            failedLoginAttempts: String(attempts),
            lockedUntil: lockUntil,
          })
          .where(eq(users.id, user.id));

        throw new UnauthorizedException(
          'Too many failed attempts. Account locked for 15 minutes.',
        );
      }

      await db
        .update(users)
        .set({ failedLoginAttempts: String(attempts) })
        .where(eq(users.id, user.id));

      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user's roles
    const userRolesList = await this.getUserRoles(user.id);

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
    const accessToken = this.generateAccessToken(user, userRolesList);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

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
    const accessToken = this.generateAccessToken(updatedUser, userRolesList);

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

    // Assign role
    await db.insert(userRoles).values({
      userId,
      roleId: role.id,
      assignedBy,
    });

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

    // Remove role
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));

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
    const accessToken = this.generateAccessToken(user, userRolesList);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    return { accessToken, refreshToken };
  }

  // ===========================================
  // Get Current User
  // ===========================================
  async getCurrentUser(userId: string): Promise<Partial<User> & { roles: string[] }> {
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

    return {
      ...user,
      roles: userRolesList,
    };
  }

  // ===========================================
  // Helper: Generate Access Token
  // ===========================================
  private generateAccessToken(user: User, userRoles: string[]): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      activeRole: user.activeRole,
      roles: userRoles,
    };

    return this.jwtService.sign(payload as any, {
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any,
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
    const expiresAt = new Date(
      Date.now() +
        parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS') || '7') *
          24 *
          60 *
          60 *
          1000,
    );

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
  ): Promise<Partial<User> & { roles: string[] }> {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Get the requested role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, dto.role))
      .limit(1);

    if (!role) {
      throw new BadRequestException(`Role ${dto.role} does not exist`);
    }

    // Create user with the specified active role
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        activeRole: dto.role,
        isVerified: true, // Admin-created users are pre-verified
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
    });

    return {
      ...newUser,
      roles: [dto.role],
    };
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
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.scfhsNumber !== undefined) updateData.scfhsNumber = dto.scfhsNumber;
    if (dto.nationalId !== undefined) updateData.nationalId = dto.nationalId;
    if (dto.nationality !== undefined) updateData.nationality = dto.nationality;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = dto.dateOfBirth;

    await db.update(users).set(updateData).where(eq(users.id, userId));

    return this.getCurrentUser(userId);
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

    if (newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
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
      .select({ id: users.id, email: users.email })
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
    await this.emailService.sendPasswordReset(normalizedEmail, code);

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

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
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
    if (dto.phone !== undefined) updateData.phone = dto.phone;
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

    // Delete user (cascade will handle userRoles and refreshTokens)
    await db.delete(users).where(eq(users.id, userId));

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

    // Build WHERE conditions
    const conditions: (SQL | undefined)[] = [];

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
      conditions.push(eq(users.activeRole, role));
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

    // Execute count, data, and stats queries in parallel
    const [countResult, allUsers, statsResult] = await Promise.all([
      db.select({ value: count() }).from(users).where(whereClause),
      db
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
    ]);

    const total = Number(countResult[0].value);
    const totalPages = Math.ceil(total / limit);

    // Batch fetch roles for all users on this page (avoids N+1)
    let usersWithRoles: (typeof allUsers[number] & { roles: string[] })[];
    if (allUsers.length > 0) {
      const userIds = allUsers.map((u) => u.id);
      const allUserRoles = await db
        .select({
          userId: userRoles.userId,
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds));

      const rolesByUserId = new Map<string, string[]>();
      for (const ur of allUserRoles) {
        const existing = rolesByUserId.get(ur.userId) || [];
        existing.push(ur.roleName);
        rolesByUserId.set(ur.userId, existing);
      }

      usersWithRoles = allUsers.map((user) => ({
        ...user,
        roles: rolesByUserId.get(user.id) || [],
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
      },
    };
  }

  // ===========================================
  // Get All Roles with User Counts (Admin)
  // ===========================================
  async getAllRoles(): Promise<
    { id: string; name: string; displayName: string; description: string | null; createdAt: Date; usersCount: number }[]
  > {
    // Get all roles
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        displayName: roles.displayName,
        description: roles.description,
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
      usersCount: countMap.get(role.id) || 0,
    }));
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
    const accessToken = this.generateAccessToken(user, userRolesList);
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
  ): Promise<{ userId: string; fingerprint: string; email: string } | null> {
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
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, challenge.userId))
      .limit(1);

    if (!user) return null;

    return {
      userId: challenge.userId,
      fingerprint: challenge.fingerprint,
      email: user.email,
    };
  }
}
