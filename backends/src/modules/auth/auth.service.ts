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
import { eq, and, inArray, count, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../../database';
import {
  users,
  User,
  refreshTokens,
  roles,
  userRoles,
  ROLE_NAMES,
  RoleName,
} from '../../database/schema';
import { RegisterDto, LoginDto, CreateUserDto, UpdateUserDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
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

    // Reset failed attempts and update last login
    await db
      .update(users)
      .set({
        failedLoginAttempts: '0',
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
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
        phone: users.phone,
        avatar: users.avatar,
        activeRole: users.activeRole,
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
  // Get All Users (Admin)
  // ===========================================
  async getAllUsers(): Promise<(Partial<User> & { roles: string[] })[]> {
    const allUsers = await db
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
      .orderBy(users.createdAt);

    // Get roles for all users
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => ({
        ...user,
        roles: await this.getUserRoles(user.id),
      })),
    );

    return usersWithRoles;
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
}
