import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, ilike, or, desc, count } from 'drizzle-orm';
import { db } from '../../database';
import {
  roleRequests,
  users,
  userRoles,
  roles,
  blockedNationalIds,
  ROLE_REQUEST_STATUS,
  RoleName,
} from '../../database/schema';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { ReviewRoleRequestDto } from './dto/review-role-request.dto';

@Injectable()
export class RoleRequestsService {
  private readonly logger = new Logger(RoleRequestsService.name);

  constructor(
    private authService: AuthService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  // ===========================================
  // Create - Submit a new role request
  // ===========================================
  async create(userId: string, dto: CreateRoleRequestDto) {
    // Validate requested role
    if (dto.requestedRole !== 'INSTRUCTOR') {
      throw new BadRequestException(
        'Only INSTRUCTOR role can be requested through this workflow',
      );
    }

    // Check if user already has the role
    const existingRoles = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    const hasRole = existingRoles.some(
      (r) => r.roleName === dto.requestedRole,
    );
    if (hasRole) {
      throw new ConflictException(
        `You already have the ${dto.requestedRole} role`,
      );
    }

    // Check for existing PENDING request for same role
    const [existingRequest] = await db
      .select()
      .from(roleRequests)
      .where(
        and(
          eq(roleRequests.userId, userId),
          eq(roleRequests.requestedRole, dto.requestedRole),
          eq(roleRequests.status, ROLE_REQUEST_STATUS.PENDING),
        ),
      )
      .limit(1);

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending application for this role',
      );
    }

    // Extract National ID from profileData
    const profileData = dto.profileData as Record<string, string>;
    const nationalId = profileData?.nationalIqamaId;

    if (nationalId) {
      // Check if this National ID is blocked
      const [blocked] = await db
        .select()
        .from(blockedNationalIds)
        .where(eq(blockedNationalIds.nationalId, nationalId))
        .limit(1);

      if (blocked) {
        throw new ForbiddenException(
          'This National/Iqama ID has been blocked. You cannot submit an application.',
        );
      }

      // Check if another user already has an APPROVED or PENDING/MORE_INFO application with this National ID
      const existingNationalIdRequests = await db
        .select({
          id: roleRequests.id,
          status: roleRequests.status,
          userId: roleRequests.userId,
        })
        .from(roleRequests)
        .where(
          and(
            sql`${roleRequests.profileData}->>'nationalIqamaId' = ${nationalId}`,
            or(
              eq(roleRequests.status, ROLE_REQUEST_STATUS.APPROVED),
              eq(roleRequests.status, ROLE_REQUEST_STATUS.PENDING),
              eq(roleRequests.status, ROLE_REQUEST_STATUS.MORE_INFO),
            ),
          ),
        );

      if (existingNationalIdRequests.length > 0) {
        const hasApproved = existingNationalIdRequests.some(
          (r) => r.status === ROLE_REQUEST_STATUS.APPROVED,
        );
        if (hasApproved) {
          throw new ConflictException(
            'An instructor with this National/Iqama ID already exists.',
          );
        }
        // PENDING or MORE_INFO from another user
        const fromOtherUser = existingNationalIdRequests.some(
          (r) => r.userId !== userId,
        );
        if (fromOtherUser) {
          throw new ConflictException(
            'An application with this National/Iqama ID is already under review.',
          );
        }
      }
    }

    // Insert new role request
    const [request] = await db
      .insert(roleRequests)
      .values({
        userId,
        requestedRole: dto.requestedRole,
        profileData: dto.profileData,
        bankData: dto.bankData || null,
        resumeFiles: dto.resumeFiles || null,
      })
      .returning();

    // Send notification email to admins
    try {
      const profileData = dto.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        'Unknown';

      // Get user email
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Get admin emails
      const adminRoleRecords = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          or(eq(roles.name, 'ADMIN'), eq(roles.name, 'SUPER_ADMIN')),
        );

      if (adminRoleRecords.length > 0) {
        const adminUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(
            or(
              ...adminRoleRecords.map((r) => eq(users.id, r.userId)),
            ),
          );

        const adminEmails = adminUsers.map((u) => u.email);
        if (adminEmails.length > 0) {
          await this.emailService.sendNewApplicationAdmin(
            adminEmails,
            applicantName,
            user?.email || '',
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to send admin notification email', error);
    }

    // Create dashboard notification for admins
    try {
      const pData = dto.profileData as Record<string, string>;
      const name =
        pData.fullNameEnglish || pData.fullNameArabic || 'A student';
      await this.notificationsService.create({
        type: 'info',
        title: 'New Trainer Application',
        description: `${name} has submitted an application to become an instructor.`,
        link: `/dashboard/admin/role-requests/${request.id}`,
      });
    } catch (error) {
      this.logger.error('Failed to create dashboard notification', error);
    }

    return request;
  }

  // ===========================================
  // Find Mine - Get all requests for current user
  // ===========================================
  async findMine(userId: string) {
    const requests = await db
      .select()
      .from(roleRequests)
      .where(eq(roleRequests.userId, userId))
      .orderBy(desc(roleRequests.createdAt));

    return requests;
  }

  // ===========================================
  // Find All - Admin list with pagination
  // ===========================================
  async findAll(params: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (
      params.status &&
      params.status !== 'all' &&
      Object.values(ROLE_REQUEST_STATUS).includes(
        params.status as any,
      )
    ) {
      conditions.push(eq(roleRequests.status, params.status));
    }

    if (params.search) {
      const searchTerm = `%${params.search}%`;
      // We'll filter by search after joining
    }

    // Build the base query with user join
    const baseWhere =
      conditions.length > 0
        ? and(...conditions)
        : undefined;

    // Get data with user info
    let query = db
      .select({
        id: roleRequests.id,
        userId: roleRequests.userId,
        requestedRole: roleRequests.requestedRole,
        status: roleRequests.status,
        profileData: roleRequests.profileData,
        bankData: roleRequests.bankData,
        resumeFiles: roleRequests.resumeFiles,
        reviewedBy: roleRequests.reviewedBy,
        reviewNote: roleRequests.reviewNote,
        reviewedAt: roleRequests.reviewedAt,
        createdAt: roleRequests.createdAt,
        updatedAt: roleRequests.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(roleRequests)
      .innerJoin(users, eq(roleRequests.userId, users.id));

    // Apply conditions
    const allConditions = [...conditions];

    if (params.search) {
      const searchTerm = `%${params.search}%`;
      allConditions.push(
        or(
          ilike(users.email, searchTerm),
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm),
        ) as any,
      );
    }

    const whereClause =
      allConditions.length > 0 ? and(...allConditions) : undefined;

    const data = await query
      .where(whereClause)
      .orderBy(desc(roleRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(roleRequests)
      .innerJoin(users, eq(roleRequests.userId, users.id))
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get stats (unfiltered)
    const statsQuery = await db
      .select({
        status: roleRequests.status,
        count: count(),
      })
      .from(roleRequests)
      .groupBy(roleRequests.status);

    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const row of statsQuery) {
      stats.total += row.count;
      if (row.status === ROLE_REQUEST_STATUS.PENDING) stats.pending = row.count;
      if (row.status === ROLE_REQUEST_STATUS.APPROVED)
        stats.approved = row.count;
      if (row.status === ROLE_REQUEST_STATUS.REJECTED)
        stats.rejected = row.count;
    }

    // Format response
    const formattedData = data.map((r) => ({
      id: r.id,
      userId: r.userId,
      requestedRole: r.requestedRole,
      status: r.status,
      profileData: r.profileData,
      bankData: r.bankData,
      resumeFiles: r.resumeFiles,
      reviewedBy: r.reviewedBy,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
      },
    }));

    return {
      data: formattedData,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats,
    };
  }

  // ===========================================
  // Find One - Get single request with user details
  // ===========================================
  async findOne(id: string) {
    const [result] = await db
      .select({
        id: roleRequests.id,
        userId: roleRequests.userId,
        requestedRole: roleRequests.requestedRole,
        status: roleRequests.status,
        profileData: roleRequests.profileData,
        bankData: roleRequests.bankData,
        resumeFiles: roleRequests.resumeFiles,
        reviewedBy: roleRequests.reviewedBy,
        reviewNote: roleRequests.reviewNote,
        reviewedAt: roleRequests.reviewedAt,
        createdAt: roleRequests.createdAt,
        updatedAt: roleRequests.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userAvatar: users.avatar,
        userLanguage: users.language,
      })
      .from(roleRequests)
      .innerJoin(users, eq(roleRequests.userId, users.id))
      .where(eq(roleRequests.id, id))
      .limit(1);

    if (!result) {
      throw new NotFoundException('Role request not found');
    }

    return {
      ...result,
      user: {
        email: result.userEmail,
        firstName: result.userFirstName,
        lastName: result.userLastName,
        avatar: result.userAvatar,
        language: result.userLanguage,
      },
    };
  }

  // ===========================================
  // Approve - Approve request and assign role
  // ===========================================
  async approve(id: string, adminId: string, dto: ReviewRoleRequestDto) {
    const request = await this.findOne(id);

    if (
      request.status !== ROLE_REQUEST_STATUS.PENDING &&
      request.status !== ROLE_REQUEST_STATUS.MORE_INFO
    ) {
      throw new BadRequestException(
        'Only PENDING or MORE_INFO requests can be approved',
      );
    }

    // Update request status
    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.APPROVED,
        reviewedBy: adminId,
        reviewNote: dto.reviewNote || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Assign the INSTRUCTOR role
    try {
      await this.authService.assignRole(
        request.userId,
        request.requestedRole as RoleName,
        adminId,
      );
    } catch (error) {
      // If role assignment fails (e.g., already has role), log but don't fail
      this.logger.warn(
        `Role assignment after approval failed for user ${request.userId}: ${error.message}`,
      );
    }

    // Send approval email
    try {
      const profileData = request.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        request.user.email;

      const locale = (request.user.language || 'en') as 'en' | 'ar';
      await this.emailService.sendApplicationApproved(
        request.user.email,
        applicantName,
        locale,
      );
    } catch (error) {
      this.logger.error('Failed to send approval email', error);
    }

    return { message: 'Application approved successfully' };
  }

  // ===========================================
  // Reject - Reject request with reason
  // ===========================================
  async reject(id: string, adminId: string, dto: ReviewRoleRequestDto) {
    if (!dto.reviewNote) {
      throw new BadRequestException(
        'Review note is required when rejecting an application',
      );
    }

    const request = await this.findOne(id);

    if (
      request.status !== ROLE_REQUEST_STATUS.PENDING &&
      request.status !== ROLE_REQUEST_STATUS.MORE_INFO
    ) {
      throw new BadRequestException(
        'Only PENDING or MORE_INFO requests can be rejected',
      );
    }

    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.REJECTED,
        reviewedBy: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Optionally block the National ID
    if (dto.blockNationalId) {
      const profileData = request.profileData as Record<string, string>;
      const nationalId = profileData?.nationalIqamaId;
      if (nationalId) {
        try {
          await this.blockNationalId(nationalId, dto.reviewNote, adminId);
        } catch {
          // Already blocked or other error — continue with rejection
        }
      }
    }

    // Send rejection email
    try {
      const profileData = request.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        request.user.email;

      const locale = (request.user.language || 'en') as 'en' | 'ar';
      await this.emailService.sendApplicationRejected(
        request.user.email,
        applicantName,
        dto.reviewNote,
        locale,
      );
    } catch (error) {
      this.logger.error('Failed to send rejection email', error);
    }

    const message = dto.blockNationalId
      ? 'Application rejected and National ID blocked'
      : 'Application rejected';
    return { message };
  }

  // ===========================================
  // Request Info - Ask for more information
  // ===========================================
  async requestInfo(id: string, adminId: string, dto: ReviewRoleRequestDto) {
    if (!dto.reviewNote) {
      throw new BadRequestException(
        'Review note is required when requesting more information',
      );
    }

    const request = await this.findOne(id);

    if (request.status !== ROLE_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(
        'Only PENDING requests can be moved to MORE_INFO',
      );
    }

    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.MORE_INFO,
        reviewedBy: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Send more-info email
    try {
      const profileData = request.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        request.user.email;

      const locale = (request.user.language || 'en') as 'en' | 'ar';
      await this.emailService.sendApplicationMoreInfo(
        request.user.email,
        applicantName,
        dto.reviewNote,
        locale,
      );
    } catch (error) {
      this.logger.error('Failed to send more-info email', error);
    }

    return { message: 'More information requested' };
  }

  // ===========================================
  // Resubmit - Student updates after MORE_INFO
  // ===========================================
  async resubmit(id: string, userId: string, dto: CreateRoleRequestDto) {
    const [request] = await db
      .select()
      .from(roleRequests)
      .where(eq(roleRequests.id, id))
      .limit(1);

    if (!request) {
      throw new NotFoundException('Role request not found');
    }

    if (request.userId !== userId) {
      throw new ForbiddenException(
        'You can only resubmit your own applications',
      );
    }

    if (request.status !== ROLE_REQUEST_STATUS.MORE_INFO) {
      throw new BadRequestException(
        'Only applications with MORE_INFO status can be resubmitted',
      );
    }

    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.PENDING,
        profileData: dto.profileData,
        bankData: dto.bankData || request.bankData,
        resumeFiles: dto.resumeFiles || request.resumeFiles,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Notify admins about resubmission
    try {
      const profileData = dto.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        'Unknown';

      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const adminRoleRecords = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          or(eq(roles.name, 'ADMIN'), eq(roles.name, 'SUPER_ADMIN')),
        );

      if (adminRoleRecords.length > 0) {
        const adminUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(
            or(
              ...adminRoleRecords.map((r) => eq(users.id, r.userId)),
            ),
          );

        const adminEmails = adminUsers.map((u) => u.email);
        if (adminEmails.length > 0) {
          await this.emailService.sendNewApplicationAdmin(
            adminEmails,
            applicantName,
            user?.email || '',
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to send resubmission notification', error);
    }

    return { message: 'Application resubmitted successfully' };
  }

  // ===========================================
  // Block National ID - Prevent future applications
  // ===========================================
  async blockNationalId(
    nationalId: string,
    reason: string,
    adminId: string,
  ) {
    // Check if already blocked
    const [existing] = await db
      .select()
      .from(blockedNationalIds)
      .where(eq(blockedNationalIds.nationalId, nationalId))
      .limit(1);

    if (existing) {
      throw new ConflictException('This National/Iqama ID is already blocked');
    }

    const [blocked] = await db
      .insert(blockedNationalIds)
      .values({
        nationalId,
        reason,
        blockedBy: adminId,
      })
      .returning();

    return blocked;
  }

  // ===========================================
  // Unblock National ID
  // ===========================================
  async unblockNationalId(nationalId: string) {
    const [existing] = await db
      .select()
      .from(blockedNationalIds)
      .where(eq(blockedNationalIds.nationalId, nationalId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('This National/Iqama ID is not blocked');
    }

    await db
      .delete(blockedNationalIds)
      .where(eq(blockedNationalIds.nationalId, nationalId));

    return { message: 'National/Iqama ID unblocked successfully' };
  }

  // ===========================================
  // List Blocked National IDs
  // ===========================================
  async getBlockedNationalIds() {
    return db
      .select({
        id: blockedNationalIds.id,
        nationalId: blockedNationalIds.nationalId,
        reason: blockedNationalIds.reason,
        blockedBy: blockedNationalIds.blockedBy,
        blockedAt: blockedNationalIds.blockedAt,
      })
      .from(blockedNationalIds)
      .orderBy(desc(blockedNationalIds.blockedAt));
  }

  // ===========================================
  // Check if National ID is blocked
  // ===========================================
  async isNationalIdBlocked(nationalId: string): Promise<boolean> {
    const [blocked] = await db
      .select()
      .from(blockedNationalIds)
      .where(eq(blockedNationalIds.nationalId, nationalId))
      .limit(1);

    return !!blocked;
  }
}
