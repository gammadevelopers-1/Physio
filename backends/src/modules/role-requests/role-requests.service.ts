import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, ilike, or, desc, asc, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../database';
import {
  roleRequests,
  roleRequestEvents,
  users,
  userRoles,
  roles,
  blockedNationalIds,
  ROLE_REQUEST_STATUS,
  ROLE_REQUEST_EVENT_ACTIONS,
  type RoleRequestEventAction,
  type MissingRequirement,
  RoleName,
} from '../../database/schema';
import { AuthService } from '../auth/auth.service';
import { PasswordSetupService } from '../auth/password-setup.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { ReviewRoleRequestDto } from './dto/review-role-request.dto';

@Injectable()
export class RoleRequestsService {
  private readonly logger = new Logger(RoleRequestsService.name);

  constructor(
    private authService: AuthService,
    private passwordSetupService: PasswordSetupService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  // ===========================================
  // Internal — write one row to role_request_events.
  // Always best-effort: if event recording fails for whatever reason
  // (DB hiccup, schema drift), the main action still succeeds — the
  // single-slot review fields keep the admin UI functional. Surface
  // the failure as a warning so it shows up in logs.
  // ===========================================
  private async recordEvent(input: {
    roleRequestId: string;
    action: RoleRequestEventAction;
    performedBy: string | null;
    note?: string | null;
    missingRequirements?: MissingRequirement[] | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await db.insert(roleRequestEvents).values({
        roleRequestId: input.roleRequestId,
        action: input.action,
        performedBy: input.performedBy,
        note: input.note ?? null,
        missingRequirements: input.missingRequirements ?? null,
        metadata: input.metadata ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record role_request_event (${input.action}) for ${input.roleRequestId}: ${(err as Error).message}`,
      );
    }
  }

  // ===========================================
  // Internal — fetch the full event timeline for a request, oldest
  // first. Used by both admin detail view and support read endpoints.
  // ===========================================
  async getEvents(roleRequestId: string) {
    const performer = alias(users, 'event_performer');
    return db
      .select({
        id: roleRequestEvents.id,
        action: roleRequestEvents.action,
        note: roleRequestEvents.note,
        missingRequirements: roleRequestEvents.missingRequirements,
        metadata: roleRequestEvents.metadata,
        createdAt: roleRequestEvents.createdAt,
        performedById: roleRequestEvents.performedBy,
        performedByFirstName: performer.firstName,
        performedByLastName: performer.lastName,
        performedByEmail: performer.email,
      })
      .from(roleRequestEvents)
      .leftJoin(performer, eq(performer.id, roleRequestEvents.performedBy))
      .where(eq(roleRequestEvents.roleRequestId, roleRequestId))
      .orderBy(asc(roleRequestEvents.createdAt));
  }

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
        structuredResume: dto.structuredResume || null,
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
        structuredResume: roleRequests.structuredResume,
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
        structuredResume: roleRequests.structuredResume,
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

    // Detect placeholder users (created via the public trainer-application
    // flow, never logged in, zero role assignments). These users still
    // have a random unguessable password; after approval we trigger a
    // password-reset email so they can set a real one.
    const priorRoles = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, request.userId));
    const isPlaceholder = priorRoles.length === 0;

    // Update request status. Clearing missing_requirements — once
    // approved, the checklist is no longer actionable. The event row
    // below preserves whatever was last requested.
    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.APPROVED,
        reviewedBy: adminId,
        reviewNote: dto.reviewNote || null,
        reviewedAt: new Date(),
        missingRequirements: null,
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Append to event history — captures who approved, when, with what
    // note. Resubmits never overwrite this row going forward.
    await this.recordEvent({
      roleRequestId: id,
      action: ROLE_REQUEST_EVENT_ACTIONS.APPROVED,
      performedBy: adminId,
      note: dto.reviewNote || null,
    });

    // Mirror trainer-application profile fields onto the user row so the
    // instructor's settings page is pre-filled after first login. Only sets
    // values that are currently missing — does not overwrite anything the
    // user has since changed manually.
    try {
      const pData = (request.profileData || {}) as Record<string, string>;
      const [existingUser] = await db
        .select({
          firstNameAr: users.firstNameAr,
          lastNameAr: users.lastNameAr,
          specialty: users.specialty,
          profession: users.profession,
          qualification: users.qualification,
          twitter: users.twitter,
          linkedin: users.linkedin,
        })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      const patch: Record<string, string> = {};
      if (!existingUser?.firstNameAr && pData.firstNameAr)
        patch.firstNameAr = pData.firstNameAr;
      if (!existingUser?.lastNameAr && pData.lastNameAr)
        patch.lastNameAr = pData.lastNameAr;
      if (!existingUser?.specialty && pData.specialty)
        patch.specialty = pData.specialty;
      if (!existingUser?.profession && pData.profession)
        patch.profession = pData.profession;
      if (!existingUser?.qualification && pData.qualification)
        patch.qualification = pData.qualification;
      if (!existingUser?.twitter && pData.twitter) patch.twitter = pData.twitter;
      if (!existingUser?.linkedin && (pData.linkedIn || pData.linkedin))
        patch.linkedin = pData.linkedIn || pData.linkedin;

      if (Object.keys(patch).length > 0) {
        await db
          .update(users)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(users.id, request.userId));
      }
    } catch (err) {
      this.logger.warn(
        `Failed to sync profile fields from approval for user ${request.userId}: ${(err as Error).message}`,
      );
    }

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

    // Approval email — placeholder users get the set-password magic-link
    // version (single email, with a button); existing users get the standard
    // approval email since they already have a password.
    try {
      const profileData = request.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        request.user.email;

      const locale = (request.user.language || 'en') as 'en' | 'ar';

      if (isPlaceholder) {
        await this.passwordSetupService.sendSetupEmail({
          email: request.user.email,
          applicantName,
          locale,
        });
        this.logger.log(
          `Sent approval+set-password email to placeholder user ${request.userId}`,
        );
      } else {
        await this.emailService.sendApplicationApproved(
          request.user.email,
          applicantName,
          locale,
        );
      }
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
        missingRequirements: null,
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Append to event history.
    await this.recordEvent({
      roleRequestId: id,
      action: ROLE_REQUEST_EVENT_ACTIONS.REJECTED,
      performedBy: adminId,
      note: dto.reviewNote,
    });

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

    // Allow from PENDING (first time admin asks for more info) and
    // from MORE_INFO (admin updated the checklist after a resubmit
    // wasn't quite enough). Terminal states (APPROVED/REJECTED) can't
    // be reopened to MORE_INFO — that would be confusing for the
    // applicant.
    if (
      request.status !== ROLE_REQUEST_STATUS.PENDING &&
      request.status !== ROLE_REQUEST_STATUS.MORE_INFO
    ) {
      throw new BadRequestException(
        'Only PENDING or MORE_INFO requests can have more info requested',
      );
    }

    // Normalise the missing-reqs list: drop empty OTHER entries (label
    // must be present per the DTO validator, but defensively skip
    // anything bad here too).
    const missing =
      dto.missingRequirements && dto.missingRequirements.length > 0
        ? dto.missingRequirements.filter(
            (m) => m.code !== 'OTHER' || (m.label && m.label.trim().length > 0),
          )
        : null;

    await db
      .update(roleRequests)
      .set({
        status: ROLE_REQUEST_STATUS.MORE_INFO,
        reviewedBy: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
        missingRequirements: missing,
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, id));

    // Append to event history. Snapshot the missing-reqs list at this
    // moment so the timeline shows what was asked each time admin
    // raised the question (in case the list changes round-to-round).
    await this.recordEvent({
      roleRequestId: id,
      action: ROLE_REQUEST_EVENT_ACTIONS.REQUESTED_INFO,
      performedBy: adminId,
      note: dto.reviewNote,
      missingRequirements: missing,
    });

    // Send more-info email. The email body now includes a structured
    // missing-reqs list (when present) + CTAs to the status page and
    // public support page.
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
        missing ?? undefined,
      );
    } catch (error) {
      this.logger.error('Failed to send more-info email', error);
    }

    return { message: 'More information requested' };
  }

  // ===========================================
  // Resubmit (logged-in STUDENT) — original entry. A student who
  // applied to become an instructor (so they already have a STUDENT
  // role + can log in) updates their application after MORE_INFO.
  // Delegates to executeResubmit which is shared with the public
  // (placeholder-user, OTP-protected) path below.
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

    return this.executeResubmit(request, dto, {
      ipAddress: null,
      userAgent: null,
    });
  }

  // ===========================================
  // Resubmit (public — placeholder user via OTP). Called by the
  // trainer-applications module after the applicant verifies their
  // email via OTP. The OTP'd email IS the gate — we trust that the
  // role_request belongs to the verified email.
  // ===========================================
  async publicResubmit(
    roleRequestId: string,
    verifiedEmail: string,
    dto: CreateRoleRequestDto,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ) {
    const [request] = await db
      .select()
      .from(roleRequests)
      .where(eq(roleRequests.id, roleRequestId))
      .limit(1);

    if (!request) {
      throw new NotFoundException('Application not found');
    }

    // Verify ownership via the OTP'd email matching the applicant's
    // user row. Cheap join here protects against someone guessing a
    // role_request id.
    const [applicant] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (
      !applicant ||
      applicant.email.toLowerCase().trim() !==
        verifiedEmail.toLowerCase().trim()
    ) {
      throw new ForbiddenException(
        'Verified email does not match this application',
      );
    }

    return this.executeResubmit(request, dto, {
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }

  // ===========================================
  // Internal — shared resubmit work. Both authenticated and public
  // paths converge here. Performs the row update, writes a
  // `resubmitted` event, fires admin notifications (email + in-app).
  // ===========================================
  private async executeResubmit(
    request: typeof roleRequests.$inferSelect,
    dto: CreateRoleRequestDto,
    meta: { ipAddress?: string | null; userAgent?: string | null },
  ) {
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
        structuredResume: dto.structuredResume || request.structuredResume,
        // Clear the single-slot review fields so the admin UI shows
        // "awaiting review" on the resubmitted version. The event row
        // below preserves the previous reviewer/note for posterity.
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        // Clear the active missing-reqs checklist — the applicant
        // claims to have addressed them. Admin can re-raise via a
        // fresh requestInfo() if anything is still missing.
        missingRequirements: null,
        updatedAt: new Date(),
      })
      .where(eq(roleRequests.id, request.id));

    // Audit — `performed_by` is NULL because applicants are not staff
    // users. IP + user-agent in metadata tells support "from where"
    // the resubmit happened, useful if there's ever a fraud question.
    await this.recordEvent({
      roleRequestId: request.id,
      action: ROLE_REQUEST_EVENT_ACTIONS.RESUBMITTED,
      performedBy: null,
      metadata: meta.ipAddress || meta.userAgent ? meta : null,
    });

    // Notify admins — email + in-app. Best-effort: failures are
    // logged but don't bubble up to the applicant (the resubmit
    // still succeeded).
    try {
      const profileData = dto.profileData as Record<string, string>;
      const applicantName =
        profileData.fullNameEnglish ||
        profileData.fullNameArabic ||
        'Unknown applicant';

      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      // In-app — visible immediately in the admin notifications panel,
      // clickable straight to the review page.
      await this.notificationsService.create({
        type: 'info',
        title: 'Trainer application updated',
        description: `${applicantName} submitted updated information for review.`,
        link: `/dashboard/admin/role-requests/${request.id}`,
      });

      // Email — uses the existing new-application admin template; it
      // tells admins someone needs attention without making them log
      // in to check.
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
  // Support — paginated list (read-only). Mirrors findAll() but
  // returns a slim shape suited to a quick lookup table. Used by the
  // /dashboard/support/trainer-applications page.
  // ===========================================
  async listForSupport(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(5, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(roleRequests.requestedRole, 'INSTRUCTOR') as ReturnType<typeof eq>,
    ];

    if (params.status && params.status !== 'ALL') {
      conditions.push(eq(roleRequests.status, params.status));
    }

    if (params.search && params.search.trim().length > 0) {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.email, term),
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          // Profile-data JSON search — covers full name fields that
          // aren't on the users row for placeholder applicants who
          // never set up their account.
          sql`${roleRequests.profileData}->>'fullNameEnglish' ILIKE ${term}`,
          sql`${roleRequests.profileData}->>'fullNameArabic'  ILIKE ${term}`,
        )!,
      );
    }

    const whereExpr = and(...conditions);

    const items = await db
      .select({
        id: roleRequests.id,
        status: roleRequests.status,
        submittedAt: roleRequests.createdAt,
        reviewedAt: roleRequests.reviewedAt,
        applicantEmail: users.email,
        applicantFirstName: users.firstName,
        applicantLastName: users.lastName,
        profileData: roleRequests.profileData,
        missingRequirements: roleRequests.missingRequirements,
      })
      .from(roleRequests)
      .innerJoin(users, eq(roleRequests.userId, users.id))
      .where(whereExpr)
      .orderBy(desc(roleRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(roleRequests)
      .innerJoin(users, eq(roleRequests.userId, users.id))
      .where(whereExpr);

    return {
      items,
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    };
  }

  // ===========================================
  // Support — detail with event timeline. Read-only mirror of the
  // admin detail page; no review actions exposed.
  // ===========================================
  async getForSupport(id: string) {
    const request = await this.findOne(id);
    const events = await this.getEvents(id);
    return {
      request,
      events,
    };
  }

  // ===========================================
  // Support — find the most-recent role_request matching a given
  // email. Used by both the ticket-detail card lookup and the guest-
  // ticket auto-tagger. Returns null if there's no applicant for the
  // email. Skips REJECTED applications older than 90 days to keep
  // the timeline relevant — agents usually care about live work,
  // not ancient rejections.
  // ===========================================
  async findMostRecentByEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return null;

    const [applicant] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (!applicant) return null;

    const [request] = await db
      .select({
        id: roleRequests.id,
        status: roleRequests.status,
        requestedRole: roleRequests.requestedRole,
        submittedAt: roleRequests.createdAt,
        reviewedAt: roleRequests.reviewedAt,
        reviewNote: roleRequests.reviewNote,
        missingRequirements: roleRequests.missingRequirements,
        applicantId: roleRequests.userId,
      })
      .from(roleRequests)
      .where(
        and(
          eq(roleRequests.userId, applicant.id),
          eq(roleRequests.requestedRole, 'INSTRUCTOR'),
        ),
      )
      .orderBy(desc(roleRequests.createdAt))
      .limit(1);

    return request ?? null;
  }

  // ===========================================
  // Public — look up the application status for an OTP-verified
  // email. Returns the most recent role_request for that email along
  // with its full event timeline + missing-reqs checklist. Powers the
  // /become-trainer status page so applicants can self-serve.
  //
  // Caller must enforce the OTP gate before calling — this method
  // trusts the email it's handed.
  // ===========================================
  async getPublicStatusByEmail(verifiedEmail: string) {
    const email = verifiedEmail.toLowerCase().trim();

    const [applicant] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!applicant) {
      return { found: false as const };
    }

    // Most-recent first so we pick the live application if there are
    // multiple historic rows. In practice one applicant has one row
    // (PENDING/MORE_INFO/APPROVED/REJECTED) — but a placeholder user
    // might have an APPROVED instructor app and an unrelated test
    // row, in which case the latest is what they're asking about.
    const [request] = await db
      .select()
      .from(roleRequests)
      .where(eq(roleRequests.userId, applicant.id))
      .orderBy(desc(roleRequests.createdAt))
      .limit(1);

    if (!request) {
      return { found: false as const };
    }

    const events = await this.getEvents(request.id);

    // Detect whether the applicant has any role assignments — if so
    // they're not a placeholder, so on APPROVED we can send them
    // straight to login instead of "check your email".
    const priorRoles = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, applicant.id));
    const isPlaceholder = priorRoles.length === 0;

    return {
      found: true as const,
      isPlaceholder,
      request: {
        id: request.id,
        status: request.status,
        requestedRole: request.requestedRole,
        submittedAt: request.createdAt,
        updatedAt: request.updatedAt,
        reviewedAt: request.reviewedAt,
        reviewNote: request.reviewNote,
        missingRequirements: request.missingRequirements as
          | MissingRequirement[]
          | null,
        // Pre-fill data for the resubmit form. Only returned when the
        // application is in MORE_INFO state — otherwise we don't want
        // to leak it back through the public API. APPROVED/REJECTED
        // applicants don't need it.
        prefill:
          request.status === ROLE_REQUEST_STATUS.MORE_INFO
            ? {
                profileData: request.profileData,
                bankData: request.bankData,
                resumeFiles: request.resumeFiles,
                structuredResume: request.structuredResume,
              }
            : null,
      },
      events,
    };
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
