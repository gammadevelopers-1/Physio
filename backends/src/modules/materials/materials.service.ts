import {
  Injectable,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, isNull, sql, count, inArray, sum, or, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../database';
import {
  courseMaterials,
  courses,
  courseModules,
  assessments,
  users,
  materialVariants,
  videoWatchEvents,
  MATERIAL_STATUS,
} from '../../database/schema';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { ProcessingService } from '../processing/processing.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isManagerOrAbove } from '../../common/role-helpers';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';

/** Allowed MIME types per material type */
const ALLOWED_MIMES: Record<string, string[]> = {
  video: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ],
  pdf: ['application/pdf'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

/** File size limits per material type (bytes) */
const SIZE_LIMITS: Record<string, number> = {
  video: 500 * 1024 * 1024, // 500 MB
  pdf: 50 * 1024 * 1024, // 50 MB
  document: 50 * 1024 * 1024, // 50 MB
  image: 20 * 1024 * 1024, // 20 MB
};

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private storageService: StorageService,
    private processingService: ProcessingService,
    private auditLogService: AuditLogService,
    private configService: ConfigService,
    private userNotificationsService: UserNotificationsService,
    private emailService: EmailService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private addCourseOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    } else {
      conditions.push(eq(courses.instructorId, user.id));
    }
  }

  // ─── Upload ───────────────────────────────────────────────

  /**
   * POST /courses/:id/materials
   * Upload a course material via multipart/form-data.
   * 1. Validates MIME type against declared material type
   * 2. Enforces file size limits (100MB video, 10MB documents)
   * 3. Creates record with status='processing'
   * 4. Uploads to storage
   * 5. Updates status to 'live' on success, 'failed' on error
   */
  async upload(
    courseId: string,
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    body: { title: string; type: string; moduleId?: string; autoTranscribe?: string },
  ) {
    await this.verifyCourseAccess(courseId, user);

    const materialType = body.type;

    // Validate MIME type
    const allowedMimes = ALLOWED_MIMES[materialType];
    if (!allowedMimes) {
      throw new BadRequestException(
        `Invalid material type: ${materialType}`,
      );
    }
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type '${file.mimetype}' is not allowed for type '${materialType}'. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    // Validate file size
    const sizeLimit = SIZE_LIMITS[materialType];
    if (file.size > sizeLimit) {
      throw new PayloadTooLargeException(
        `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds the ${(sizeLimit / (1024 * 1024)).toFixed(0)}MB limit for '${materialType}'`,
      );
    }

    // Parse autoTranscribe flag (FormData sends strings)
    const autoTranscribe = body.autoTranscribe !== 'false';

    // Create record with status='processing'
    const [material] = await db
      .insert(courseMaterials)
      .values({
        courseId,
        moduleId: body.moduleId || null,
        title: body.title,
        type: materialType,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: user.id,
        status: MATERIAL_STATUS.PROCESSING,
        autoTranscribe,
      })
      .returning();

    // Upload to storage
    const ext = file.originalname.split('.').pop() || 'bin';
    const storagePath = `materials/${courseId}/${randomUUID()}.${ext}`;

    try {
      const fileUrl = await this.storageService.uploadPublic(
        file.buffer,
        storagePath,
        file.mimetype,
      );

      // Update fileUrl but keep status='processing'
      await db
        .update(courseMaterials)
        .set({ fileUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, material.id));

      // Dispatch background processing pipeline
      try {
        await this.processingService.dispatchProcessing(
          material.id,
          materialType,
          fileUrl,
          courseId,
          file.mimetype,
          autoTranscribe,
        );
      } catch (dispatchError) {
        this.logger.warn(
          `Processing dispatch failed for ${material.id}; marking with skipped processing`,
          dispatchError,
        );
        const autoApprove = this.configService.get<boolean>('processing.autoApprove');
        await db
          .update(courseMaterials)
          .set({
            status: autoApprove ? MATERIAL_STATUS.LIVE : MATERIAL_STATUS.PENDING_REVIEW,
            wcagStatus: 'skipped',
            processingError: 'Processing pipeline unavailable — uploaded without processing',
            updatedAt: new Date(),
          })
          .where(eq(courseMaterials.id, material.id));
      }

      // Return the material
      const [updated] = await db
        .select()
        .from(courseMaterials)
        .where(eq(courseMaterials.id, material.id))
        .limit(1);

      return updated;
    } catch (error) {
      // Update status to 'failed'
      await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
          processingError: 'File upload to storage failed',
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, material.id));

      this.logger.error(
        `File upload failed for material ${material.id}`,
        error,
      );
      throw new BadRequestException(
        'File upload failed. Storage may not be configured.',
      );
    }
  }

  // ─── List ─────────────────────────────────────────────────

  /**
   * GET /courses/:id/materials
   * List materials for a course with optional type and status filters.
   */
  async findAll(
    courseId: string,
    user: AuthenticatedUser,
    params: { type?: string; status?: string; moduleId?: string },
  ) {
    await this.verifyCourseAccess(courseId, user, { allowCompleted: true });

    const conditions: ReturnType<typeof eq>[] = [
      eq(courseMaterials.courseId, courseId),
    ];

    if (
      params.type &&
      Object.values(ALLOWED_MIMES).length &&
      ['video', 'pdf', 'document', 'image'].includes(params.type)
    ) {
      conditions.push(eq(courseMaterials.type, params.type));
    }

    if (
      params.status &&
      Object.values(MATERIAL_STATUS).includes(params.status as any)
    ) {
      conditions.push(eq(courseMaterials.status, params.status));
    } else {
      // By default, exclude archived materials (old replaced versions)
      conditions.push(sql`${courseMaterials.status} != 'archived'`);
    }

    // Filter by moduleId: specific UUID, 'none' for unassigned, or omit for all
    if (params.moduleId) {
      if (params.moduleId === 'none') {
        conditions.push(isNull(courseMaterials.moduleId));
      } else {
        conditions.push(eq(courseMaterials.moduleId, params.moduleId));
      }
    }

    // Order by orderIndex when filtering by module, otherwise by createdAt
    const orderClause =
      params.moduleId && params.moduleId !== 'none'
        ? asc(courseMaterials.orderIndex)
        : desc(courseMaterials.createdAt);

    const data = await db
      .select()
      .from(courseMaterials)
      .where(and(...conditions))
      .orderBy(orderClause);

    return data;
  }

  // ─── Update Metadata ──────────────────────────────────────

  /**
   * PATCH /materials/:id
   * Update material metadata (title, type, wcagStatus, captionsUrl, etc.)
   */
  async update(
    materialId: string,
    user: AuthenticatedUser,
    dto: UpdateMaterialDto,
  ) {
    await this.verifyMaterialAccess(materialId, user);

    const [updated] = await db
      .update(courseMaterials)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(courseMaterials.id, materialId))
      .returning();

    return updated;
  }

  // ─── Replace (Versioning) ─────────────────────────────────

  /**
   * POST /materials/:id/replace
   * Create a new version of a material:
   * 1. Get the existing material
   * 2. Upload the new file
   * 3. Create a NEW record with version+1, previousVersionId = old ID
   * The old record stays in the database for version history.
   */
  async replace(
    materialId: string,
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    body?: { title?: string },
  ) {
    const existing = await this.verifyMaterialAccess(materialId, user);

    const materialType = existing.type;

    // Validate MIME type
    const allowedMimes = ALLOWED_MIMES[materialType];
    if (allowedMimes && !allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type '${file.mimetype}' is not allowed for type '${materialType}'. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    // Validate file size
    const sizeLimit = SIZE_LIMITS[materialType] || SIZE_LIMITS.document;
    if (file.size > sizeLimit) {
      throw new PayloadTooLargeException(
        `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds the ${(sizeLimit / (1024 * 1024)).toFixed(0)}MB limit for '${materialType}'`,
      );
    }

    // Archive the old version
    await db
      .update(courseMaterials)
      .set({ status: MATERIAL_STATUS.ARCHIVED, updatedAt: new Date() })
      .where(eq(courseMaterials.id, existing.id));

    // Create new version record with status='processing'
    // Use new file's name (without extension) if no explicit title provided
    const inferredTitle =
      body?.title ||
      file.originalname.replace(/\.[^.]+$/, '') ||
      existing.title;
    const newVersion = existing.version + 1;
    const [material] = await db
      .insert(courseMaterials)
      .values({
        courseId: existing.courseId,
        moduleId: existing.moduleId,
        title: inferredTitle,
        type: materialType,
        fileSize: file.size,
        mimeType: file.mimetype,
        version: newVersion,
        previousVersionId: existing.id,
        uploadedBy: user.id,
        status: MATERIAL_STATUS.PROCESSING,
        wcagStatus: 'pending',
      })
      .returning();

    // Upload to storage
    const ext = file.originalname.split('.').pop() || 'bin';
    const storagePath = `materials/${existing.courseId}/${randomUUID()}.${ext}`;

    try {
      const fileUrl = await this.storageService.uploadPublic(
        file.buffer,
        storagePath,
        file.mimetype,
      );

      // Update fileUrl but keep status='processing'
      await db
        .update(courseMaterials)
        .set({ fileUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, material.id));

      // Dispatch background processing pipeline
      try {
        await this.processingService.dispatchProcessing(
          material.id,
          materialType,
          fileUrl,
          existing.courseId,
          file.mimetype,
        );
      } catch (dispatchError) {
        this.logger.warn(
          `Processing dispatch failed for ${material.id}; marking with skipped processing`,
          dispatchError,
        );
        const autoApprove = this.configService.get<boolean>('processing.autoApprove');
        await db
          .update(courseMaterials)
          .set({
            status: autoApprove ? MATERIAL_STATUS.LIVE : MATERIAL_STATUS.PENDING_REVIEW,
            wcagStatus: 'skipped',
            processingError: 'Processing pipeline unavailable — uploaded without processing',
            updatedAt: new Date(),
          })
          .where(eq(courseMaterials.id, material.id));
      }

      // Return the material
      const [updated] = await db
        .select()
        .from(courseMaterials)
        .where(eq(courseMaterials.id, material.id))
        .limit(1);

      return updated;
    } catch (error) {
      await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
          processingError: 'File upload to storage failed',
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, material.id));

      this.logger.error(
        `File upload failed for material version ${material.id}`,
        error,
      );
      throw new BadRequestException(
        'File upload failed. Storage may not be configured.',
      );
    }
  }

  // ─── Reorder Materials in Module ─────────────────────────

  /**
   * PATCH /courses/:id/modules/:moduleId/materials/reorder
   * Reorder materials within a module by updating orderIndex.
   */
  async reorderMaterials(
    courseId: string,
    moduleId: string,
    user: AuthenticatedUser,
    materialIds: string[],
  ) {
    await this.verifyCourseAccess(courseId, user);

    for (let i = 0; i < materialIds.length; i++) {
      await db
        .update(courseMaterials)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(
          and(
            eq(courseMaterials.id, materialIds[i]),
            eq(courseMaterials.courseId, courseId),
            eq(courseMaterials.moduleId, moduleId),
          ),
        );
    }

    return { message: 'Materials reordered successfully' };
  }

  // ─── Processing Status ───────────────────────────────────

  /**
   * GET /materials/:id/status
   * Lightweight status check for frontend polling.
   */
  async getProcessingStatus(materialId: string, user: AuthenticatedUser) {
    const material = await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });
    return {
      id: material.id,
      status: material.status,
      processingStep: material.processingStep,
      wcagStatus: material.wcagStatus,
      wcagDetails: material.wcagDetails,
      captionsUrl: material.captionsUrl,
      transcriptUrl: material.transcriptUrl,
      processingError: material.processingError,
    };
  }

  // ─── Variants ───────────────────────────────────────────

  /**
   * GET /materials/:id/variants
   * Returns the transcoded video variants (resolutions).
   */
  async getVariants(materialId: string, user: AuthenticatedUser) {
    await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });

    const variants = await db
      .select()
      .from(materialVariants)
      .where(eq(materialVariants.materialId, materialId))
      .orderBy(asc(materialVariants.resolution));

    return variants;
  }

  // ─── Content Review (Course Manager) ─────────────────────

  /**
   * GET /materials/pending-review
   * Returns all reviewed/reviewable materials (pending, changes_requested, live, rejected).
   * Content stays visible after action for audit compliance.
   * MANAGER/ADMIN see all, INSTRUCTOR sees own.
   */
  async findPendingReview(user: AuthenticatedUser) {
    // Show all content that has been through the review pipeline (exclude processing/archived/failed)
    const statusCondition = sql`${courseMaterials.status} IN ('pending_review', 'changes_requested', 'live', 'failed')`;

    const conditions: ReturnType<typeof eq>[] = [statusCondition as any];

    if (!isManagerOrAbove(user)) {
      conditions.push(eq(courseMaterials.uploadedBy, user.id));
    }
    // For managers, scope to materials in courses they manage
    if (isManager(user)) {
      conditions.push(
        sql`${courseMaterials.courseId} IN (SELECT id FROM courses WHERE manager_id = ${user.id} OR manager_id IS NULL)`,
      );
    }

    const data = await db
      .select({
        id: courseMaterials.id,
        courseId: courseMaterials.courseId,
        moduleId: courseMaterials.moduleId,
        title: courseMaterials.title,
        type: courseMaterials.type,
        status: courseMaterials.status,
        fileUrl: courseMaterials.fileUrl,
        fileSize: courseMaterials.fileSize,
        mimeType: courseMaterials.mimeType,
        wcagStatus: courseMaterials.wcagStatus,
        wcagDetails: courseMaterials.wcagDetails,
        reviewNote: courseMaterials.reviewNote,
        createdAt: courseMaterials.createdAt,
        courseTitle: courses.title,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
        instructorEmail: users.email,
      })
      .from(courseMaterials)
      .innerJoin(courses, eq(courseMaterials.courseId, courses.id))
      .innerJoin(users, eq(courses.instructorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(courseMaterials.createdAt));

    // Get counts by status for stats — scoped to the same courses as the data query
    const scopeConditions: SQL[] = [];
    if (!isManagerOrAbove(user)) {
      scopeConditions.push(eq(courseMaterials.uploadedBy, user.id));
    }
    if (isManager(user)) {
      scopeConditions.push(
        sql`${courseMaterials.courseId} IN (SELECT id FROM courses WHERE manager_id = ${user.id} OR manager_id IS NULL)`,
      );
    }

    const [pendingCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(and(eq(courseMaterials.status, MATERIAL_STATUS.PENDING_REVIEW), ...scopeConditions));

    const [changesRequestedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(and(eq(courseMaterials.status, MATERIAL_STATUS.CHANGES_REQUESTED), ...scopeConditions));

    const [approvedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(and(eq(courseMaterials.status, MATERIAL_STATUS.LIVE), ...scopeConditions));

    const [rejectedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.status, MATERIAL_STATUS.FAILED),
          sql`${courseMaterials.reviewedBy} IS NOT NULL`,
          ...scopeConditions,
        ),
      );

    return {
      data,
      stats: {
        pending: Number(pendingCount?.count || 0),
        changesRequested: Number(changesRequestedCount?.count || 0),
        approved: Number(approvedCount?.count || 0),
        rejected: Number(rejectedCount?.count || 0),
      },
    };
  }

  /**
   * PATCH /materials/:id/review
   * Approve or reject a pending material.
   */
  async reviewMaterial(
    materialId: string,
    user: AuthenticatedUser,
    decision: 'approved' | 'rejected' | 'changes_requested',
    comment?: string,
  ) {
    const [material] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    // Allow review from pending_review or changes_requested status
    if (
      material.status !== MATERIAL_STATUS.PENDING_REVIEW &&
      material.status !== MATERIAL_STATUS.CHANGES_REQUESTED
    ) {
      throw new BadRequestException(
        'Only materials with pending_review or changes_requested status can be reviewed',
      );
    }

    // Require comment for changes_requested and rejected decisions
    if ((decision === 'changes_requested' || decision === 'rejected') && !comment) {
      throw new BadRequestException(
        'A comment is required when requesting changes or rejecting',
      );
    }

    const statusMap: Record<string, string> = {
      approved: MATERIAL_STATUS.LIVE,
      rejected: MATERIAL_STATUS.FAILED,
      changes_requested: MATERIAL_STATUS.CHANGES_REQUESTED,
    };
    const newStatus = statusMap[decision];

    const [updated] = await db
      .update(courseMaterials)
      .set({
        status: newStatus,
        reviewedBy: user.id,
        reviewNote: comment || null,
        updatedAt: new Date(),
      })
      .where(eq(courseMaterials.id, materialId))
      .returning();

    const actionMap: Record<string, string> = {
      approved: 'material.approved',
      rejected: 'material.rejected',
      changes_requested: 'material.changes_requested',
    };
    await this.auditLogService.log({
      entityType: 'material',
      entityId: materialId,
      action: actionMap[decision],
      performedBy: user.id,
      metadata: { courseId: material.courseId, decision, comment },
    }).catch(() => {});

    // Notify the uploader (instructor) about the review decision
    this.notifyContentReview(material, decision, comment).catch((err) => {
      this.logger.warn('Failed to send content review notification', err);
    });

    return updated;
  }

  /**
   * Send in-app + email notification to the material uploader about review decision.
   */
  private async notifyContentReview(
    material: { id: string; uploadedBy: string; courseId: string; title: string },
    decision: 'approved' | 'rejected' | 'changes_requested',
    comment?: string | null,
  ) {
    // Fetch uploader info
    const [uploader] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, language: users.language })
      .from(users)
      .where(eq(users.id, material.uploadedBy))
      .limit(1);
    if (!uploader) return;

    // Fetch course name
    const [course] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, material.courseId))
      .limit(1);
    const courseName = course?.title || 'Unknown Course';

    const locale = (uploader.language || 'en') as 'en' | 'ar';
    const isAr = locale === 'ar';

    const decisionLabelsEn: Record<string, string> = {
      approved: 'Content Approved',
      rejected: 'Content Rejected',
      changes_requested: 'Changes Requested',
    };
    const decisionLabelsAr: Record<string, string> = {
      approved: 'تمت الموافقة على المحتوى',
      rejected: 'تم رفض المحتوى',
      changes_requested: 'مطلوب تعديلات',
    };
    const label = isAr ? decisionLabelsAr[decision] : decisionLabelsEn[decision];
    const recipientName = `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() || 'Instructor';

    // In-app notification
    await this.userNotificationsService.create({
      recipientId: uploader.id,
      type: 'content_review',
      title: label,
      message: isAr
        ? `"${material.title}" في ${courseName} — ${label}${comment ? `: ${comment}` : ''}`
        : `"${material.title}" in ${courseName} — ${label.toLowerCase()}${comment ? `: ${comment}` : ''}`,
      link: '/dashboard/instructor/content',
      entityType: 'material',
      entityId: material.id,
    });

    // Email (fire-and-forget)
    this.emailService.sendContentReview(uploader.email, {
      recipientName,
      materialTitle: material.title,
      courseName,
      decision,
      comment: comment || null,
    }, locale).catch(() => {});
  }

  // ─── Compliance Checklist ─────────────────────────────────

  /**
   * GET /materials/:id/compliance-checklist
   * Computes 5 compliance checks for the material's course:
   * 1. Learning Objectives (>=3 modules)
   * 2. Assessment Alignment (each module has at least 1 assessment)
   * 3. Hours Compliance (total hours >= NELC minimum)
   * 4. WCAG Compliance (captions, wcagStatus)
   * 5. NELC Checklist (mandatory fields filled, bilingual content)
   */
  async getComplianceChecklist(materialId: string, user: AuthenticatedUser) {
    const material = await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, material.courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Fetch course modules
    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, course.id));

    // Fetch assessments for the course
    const courseAssessments = await db
      .select()
      .from(assessments)
      .where(eq(assessments.courseId, course.id));

    // Fetch all materials for the course (non-archived)
    const allMaterials = await db
      .select()
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.courseId, course.id),
          sql`${courseMaterials.status} != 'archived'`,
        ),
      );

    // ── Check 1: Learning Objectives (>=3 modules in the course)
    const moduleCount = modules.length;
    const learningObjectives = {
      rule: 'learning_objectives',
      status: moduleCount >= 3 ? ('passed' as const) : ('failed' as const),
      detail:
        moduleCount >= 3
          ? `Course has ${moduleCount} modules (minimum 3)`
          : `Course has only ${moduleCount} module(s) — at least 3 required`,
    };

    // ── Check 2: Assessment Alignment (each module covered by at least 1 assessment)
    const modulesWithAssessments = new Set(
      courseAssessments.filter((a) => a.moduleId).map((a) => a.moduleId),
    );
    const uncoveredModules = modules.filter(
      (m) => !modulesWithAssessments.has(m.id),
    );
    const assessmentAlignment = {
      rule: 'assessment_alignment',
      status:
        modules.length === 0
          ? ('failed' as const)
          : uncoveredModules.length === 0
            ? ('passed' as const)
            : ('failed' as const),
      detail:
        modules.length === 0
          ? 'No modules exist to assess'
          : uncoveredModules.length === 0
            ? `All ${modules.length} modules covered by assessments`
            : `${uncoveredModules.length} of ${modules.length} module(s) have no linked assessment`,
    };

    // ── Check 3: Hours Compliance (total duration vs NELC minimum)
    const totalMinutes = modules.reduce(
      (s, m) => s + (m.durationMinutes || 0),
      0,
    );
    const classification = classifyCourse(course.startDate, course.endDate);
    const nelcMinHours = classification === 'long' ? 25 : 5;
    const totalHours = totalMinutes / 60;
    const hoursCompliance = {
      rule: 'hours_compliance',
      status: totalHours >= nelcMinHours ? ('passed' as const) : ('failed' as const),
      detail:
        totalHours >= nelcMinHours
          ? `${totalHours.toFixed(1)} hours meets ${nelcMinHours}h minimum for ${classification} course`
          : `${totalHours.toFixed(1)} hours is below ${nelcMinHours}h minimum for ${classification} course`,
    };

    // ── Check 4: WCAG Compliance (captions, transcript, wcagStatus)
    const videoMaterials = allMaterials.filter((m) => m.type === 'video');
    const videosWithCaptions = videoMaterials.filter((m) => m.captionsUrl).length;
    const wcagCompliant = allMaterials.filter(
      (m) => m.wcagStatus === 'pass' || m.wcagStatus === 'compliant',
    ).length;
    const currentMaterialWcag = material.wcagStatus === 'pass' || material.wcagStatus === 'compliant';
    const allWcagOk =
      allMaterials.length > 0 &&
      wcagCompliant === allMaterials.length &&
      (videoMaterials.length === 0 || videosWithCaptions === videoMaterials.length);
    const wcagCheck = {
      rule: 'wcag_compliance',
      status: allWcagOk
        ? ('passed' as const)
        : currentMaterialWcag
          ? ('review' as const)
          : ('failed' as const),
      detail: allWcagOk
        ? `All ${allMaterials.length} materials WCAG compliant, ${videosWithCaptions}/${videoMaterials.length} videos captioned`
        : `${wcagCompliant}/${allMaterials.length} materials compliant, ${videosWithCaptions}/${videoMaterials.length} videos captioned`,
    };

    // ── Check 5: NELC Checklist (mandatory fields)
    const missingFields: string[] = [];
    if (!course.title) missingFields.push('title');
    if (!course.titleAr) missingFields.push('titleAr');
    if (!course.description) missingFields.push('description');
    if (!course.startDate) missingFields.push('startDate');
    if (!course.endDate) missingFields.push('endDate');
    const nelcChecklist = {
      rule: 'nelc_checklist',
      status: missingFields.length === 0 ? ('passed' as const) : ('failed' as const),
      detail:
        missingFields.length === 0
          ? 'All mandatory fields filled (title, titleAr, description, dates)'
          : `Missing: ${missingFields.join(', ')}`,
    };

    const checks = [
      learningObjectives,
      assessmentAlignment,
      hoursCompliance,
      wcagCheck,
      nelcChecklist,
    ];

    const passedCount = checks.filter((c) => c.status === 'passed').length;
    const overallStatus =
      passedCount === checks.length
        ? 'passed'
        : passedCount >= 3
          ? 'review'
          : 'failed';

    return {
      materialId,
      courseId: course.id,
      overallStatus,
      passedCount,
      totalChecks: checks.length,
      checks,
    };
  }

  // ─── Delete ───────────────────────────────────────────────

  /**
   * DELETE /materials/:id
   * Remove a material record and delete the file from storage.
   */
  async remove(materialId: string, user: AuthenticatedUser, reason?: string) {
    const existing = await this.verifyMaterialAccess(materialId, user);

    if (existing.status === MATERIAL_STATUS.PROCESSING) {
      throw new BadRequestException(
        'Cannot delete a material that is currently being processed. Wait for processing to complete or fail.',
      );
    }

    // If removed by manager, notify the instructor
    const isManagerRemoval = user.roles.includes('MANAGER') && existing.uploadedBy !== user.id;
    const materialInfo = { id: existing.id, uploadedBy: existing.uploadedBy, courseId: existing.courseId, title: existing.title };

    // Delete variant files from storage (before cascade deletes the rows)
    const variants = await db
      .select()
      .from(materialVariants)
      .where(eq(materialVariants.materialId, materialId));

    for (const variant of variants) {
      const variantPath = this.extractStoragePath(variant.fileUrl);
      if (variantPath) {
        try {
          await this.storageService.deleteFile('public', variantPath);
        } catch (error) {
          this.logger.warn(`Failed to delete variant file: ${variantPath}`, error);
        }
      }
    }

    // Delete main file from storage
    if (existing.fileUrl) {
      const storagePath = this.extractStoragePath(existing.fileUrl);
      if (storagePath) {
        try {
          await this.storageService.deleteFile('public', storagePath);
        } catch (error) {
          this.logger.warn(`Failed to delete file from storage: ${storagePath}`, error);
        }
      }
    }

    // Delete captions file
    if (existing.captionsUrl) {
      const captionsPath = this.extractStoragePath(existing.captionsUrl);
      if (captionsPath) {
        try {
          await this.storageService.deleteFile('public', captionsPath);
        } catch (error) {
          this.logger.warn(`Failed to delete captions file: ${captionsPath}`, error);
        }
      }
    }

    // Delete transcript file
    if (existing.transcriptUrl) {
      const transcriptPath = this.extractStoragePath(existing.transcriptUrl);
      if (transcriptPath) {
        try {
          await this.storageService.deleteFile('public', transcriptPath);
        } catch (error) {
          this.logger.warn(`Failed to delete transcript file: ${transcriptPath}`, error);
        }
      }
    }

    // Delete the material record (cascades to variants)
    await db
      .delete(courseMaterials)
      .where(eq(courseMaterials.id, materialId));

    // Notify instructor if removed by manager
    if (isManagerRemoval) {
      this.notifyContentReview(materialInfo, 'rejected', reason ? `Content removed by manager: ${reason}` : 'Content removed by course manager').catch(() => {});
    }

    return { message: 'Material deleted successfully' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
    options?: { allowCompleted?: boolean },
  ) {
    const conditions: any[] = [eq(courses.id, courseId)];
    this.addCourseOwnershipCondition(conditions, user);

    const [course] = await db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!options?.allowCompleted && (course.status === 'completed' || course.status === 'archived')) {
      throw new BadRequestException('Cannot modify a completed or archived course');
    }

    return course;
  }

  /**
   * Verify the user can access the material.
   * Returns the full material row.
   */
  private async verifyMaterialAccess(
    materialId: string,
    user: AuthenticatedUser,
    options?: { allowCompleted?: boolean },
  ) {
    const [material] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    // Verify course access and status
    const courseConditions: any[] = [eq(courses.id, material.courseId)];
    if (!isGlobalAdmin(user)) {
      if (isManager(user)) {
        courseConditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
      } else {
        courseConditions.push(eq(courses.instructorId, user.id));
      }
    }

    const [course] = await db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(and(...courseConditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Material not found');
    }

    if (!options?.allowCompleted && (course.status === 'completed' || course.status === 'archived')) {
      throw new BadRequestException('Cannot modify a completed or archived course');
    }

    return material;
  }

  /**
   * Extract the storage-relative path from a file URL.
   * Local:  http://localhost:8080/api/storage/files/public/materials/...
   * GCP:    https://storage.googleapis.com/bucket/materials/...
   */
  private extractStoragePath(fileUrl: string): string | null {
    // Local pattern
    const localPattern = '/storage/files/public/';
    const localIdx = fileUrl.indexOf(localPattern);
    if (localIdx !== -1) {
      return fileUrl.substring(localIdx + localPattern.length);
    }

    // GCP pattern
    const gcpPattern = 'storage.googleapis.com/';
    const gcpIdx = fileUrl.indexOf(gcpPattern);
    if (gcpIdx !== -1) {
      const afterDomain = fileUrl.substring(gcpIdx + gcpPattern.length);
      const slashIdx = afterDomain.indexOf('/');
      return slashIdx !== -1
        ? afterDomain.substring(slashIdx + 1)
        : afterDomain;
    }

    return null;
  }

  // ─── Captions (Feature 5) ──────────────────────────────

  /**
   * GET /materials/:id/captions
   * Fetch the VTT file, parse into entries.
   */
  async getCaptions(
    materialId: string,
    user: AuthenticatedUser,
  ): Promise<{ entries: import('./vtt-utils').CaptionEntry[]; raw: string }> {
    const material = await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });

    if (!material.captionsUrl) {
      return { entries: [], raw: '' };
    }

    const buffer = await this.storageService.downloadBuffer(material.captionsUrl);
    const raw = buffer.toString('utf-8');

    const { parseVtt } = await import('./vtt-utils');
    const entries = parseVtt(raw);
    return { entries, raw };
  }

  /**
   * PUT /materials/:id/captions
   * Serialize entries to VTT, upload, update captionsUrl.
   */
  async saveCaptions(
    materialId: string,
    user: AuthenticatedUser,
    entries: import('./vtt-utils').CaptionEntry[],
  ) {
    await this.verifyMaterialAccess(materialId, user);

    const { serializeVtt } = await import('./vtt-utils');
    const vttContent = serializeVtt(entries);
    const buffer = Buffer.from(vttContent, 'utf-8');

    const filename = `captions/${materialId}.vtt`;
    const url = await this.storageService.uploadPublic(
      buffer,
      filename,
      'text/vtt',
    );

    const [updated] = await db
      .update(courseMaterials)
      .set({ captionsUrl: url, updatedAt: new Date() })
      .where(eq(courseMaterials.id, materialId))
      .returning();

    return updated;
  }

  /**
   * POST /materials/:id/captions/upload
   * Accept a VTT or SRT file, convert SRT→VTT if needed, upload.
   */
  async uploadCaptionFile(
    materialId: string,
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    await this.verifyMaterialAccess(materialId, user);

    let vttContent: string;
    const raw = file.buffer.toString('utf-8');

    if (
      file.originalname.endsWith('.srt') ||
      file.mimetype === 'application/x-subrip'
    ) {
      const { srtToVtt } = await import('./vtt-utils');
      vttContent = srtToVtt(raw);
    } else {
      vttContent = raw;
    }

    const buffer = Buffer.from(vttContent, 'utf-8');
    const filename = `captions/${materialId}.vtt`;
    const url = await this.storageService.uploadPublic(
      buffer,
      filename,
      'text/vtt',
    );

    const [updated] = await db
      .update(courseMaterials)
      .set({ captionsUrl: url, updatedAt: new Date() })
      .where(eq(courseMaterials.id, materialId))
      .returning();

    return updated;
  }

  // ─── Version History (Feature 6) ───────────────────────

  /**
   * GET /materials/:id/versions
   * Walk the previousVersionId chain to build full version history.
   */
  async getVersionHistory(materialId: string, user: AuthenticatedUser) {
    const material = await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });

    // Collect all versions by walking backward then forward
    const versions: Array<{
      id: string;
      version: number;
      title: string;
      fileSize: number | null;
      mimeType: string | null;
      status: string;
      createdAt: Date;
      isCurrent: boolean;
    }> = [];

    // Walk backward from current material
    let current = material;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      versions.push({
        id: current.id,
        version: current.version,
        title: current.title,
        fileSize: current.fileSize,
        mimeType: current.mimeType,
        status: current.status,
        createdAt: current.createdAt,
        isCurrent: current.id === material.id,
      });

      if (current.previousVersionId) {
        const [prev] = await db
          .select()
          .from(courseMaterials)
          .where(eq(courseMaterials.id, current.previousVersionId))
          .limit(1);
        if (prev) {
          current = prev;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Walk forward: find materials that point to this one
    let forwardId = material.id;
    for (let i = 0; i < 10; i++) {
      const [newer] = await db
        .select()
        .from(courseMaterials)
        .where(eq(courseMaterials.previousVersionId, forwardId))
        .limit(1);
      if (newer && !visited.has(newer.id)) {
        visited.add(newer.id);
        versions.push({
          id: newer.id,
          version: newer.version,
          title: newer.title,
          fileSize: newer.fileSize,
          mimeType: newer.mimeType,
          status: newer.status,
          createdAt: newer.createdAt,
          isCurrent: false,
        });
        forwardId = newer.id;
      } else {
        break;
      }
    }

    // Sort by version descending, limit 10
    versions.sort((a, b) => b.version - a.version);
    return versions.slice(0, 10);
  }

  /**
   * POST /materials/:id/rollback/:versionId
   * Reactivate the target version (set it to LIVE) and archive the current one.
   * No new version is created — we simply swap which version is active.
   */
  async rollbackToVersion(
    currentId: string,
    targetVersionId: string,
    user: AuthenticatedUser,
  ) {
    const current = await this.verifyMaterialAccess(currentId, user);

    const [target] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, targetVersionId))
      .limit(1);

    if (!target) {
      throw new NotFoundException('Target version not found');
    }

    if (target.courseId !== current.courseId) {
      throw new BadRequestException('Target version does not belong to the same course');
    }

    // Archive the current version
    await db
      .update(courseMaterials)
      .set({ status: MATERIAL_STATUS.ARCHIVED, updatedAt: new Date() })
      .where(eq(courseMaterials.id, current.id));

    // Reactivate the target version (set it back to LIVE)
    const [rolled] = await db
      .update(courseMaterials)
      .set({
        status: MATERIAL_STATUS.LIVE,
        orderIndex: current.orderIndex,
        updatedAt: new Date(),
      })
      .where(eq(courseMaterials.id, target.id))
      .returning();

    return rolled;
  }

  // ─── Video Watch Analytics (Feature 7) ─────────────────

  /**
   * GET /materials/:id/watch-analytics
   * Bucket heartbeat events into ~50 segments, compute retention curve.
   */
  async getWatchAnalytics(materialId: string, user: AuthenticatedUser) {
    await this.verifyMaterialAccess(materialId, user, { allowCompleted: true });

    // Get total unique viewers
    const [viewerResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${videoWatchEvents.studentId})` })
      .from(videoWatchEvents)
      .where(eq(videoWatchEvents.materialId, materialId));

    const totalViewers = Number(viewerResult?.count ?? 0);
    if (totalViewers === 0) {
      return { totalViewers: 0, bucketSize: 0, retention: [], dropOffPoints: [] };
    }

    // Find max position (approximate duration)
    const [maxPosResult] = await db
      .select({ maxPos: sql<number>`MAX(${videoWatchEvents.position})` })
      .from(videoWatchEvents)
      .where(
        and(
          eq(videoWatchEvents.materialId, materialId),
          eq(videoWatchEvents.eventType, 'heartbeat'),
        ),
      );

    const maxPos = Number(maxPosResult?.maxPos ?? 0);
    if (maxPos === 0) {
      return { totalViewers, bucketSize: 0, retention: [], dropOffPoints: [] };
    }

    const numBuckets = Math.min(50, maxPos);
    const bucketSize = Math.max(1, Math.ceil(maxPos / numBuckets));

    // Query distinct students per bucket (inline bucketSize as literal to avoid parameter type issues)
    const bucketExpr = sql`FLOOR(${videoWatchEvents.position} / ${sql.raw(String(bucketSize))})`;
    const bucketData = await db
      .select({
        bucket: sql<number>`${bucketExpr}`.as('bucket'),
        viewers: sql<number>`COUNT(DISTINCT ${videoWatchEvents.studentId})`,
      })
      .from(videoWatchEvents)
      .where(
        and(
          eq(videoWatchEvents.materialId, materialId),
          eq(videoWatchEvents.eventType, 'heartbeat'),
        ),
      )
      .groupBy(bucketExpr)
      .orderBy(sql`1`);

    // Build retention array
    const retention: { bucket: number; viewers: number; percent: number }[] = [];
    const bucketMap = new Map<number, number>();
    for (const row of bucketData) {
      bucketMap.set(Number(row.bucket), Number(row.viewers));
    }

    for (let i = 0; i < numBuckets; i++) {
      const viewers = bucketMap.get(i) ?? 0;
      retention.push({
        bucket: i,
        viewers,
        percent: Math.round((viewers / totalViewers) * 100),
      });
    }

    // Identify drop-off points (>10% drop between consecutive buckets)
    const dropOffPoints: { bucket: number; drop: number }[] = [];
    for (let i = 1; i < retention.length; i++) {
      const drop = retention[i - 1].percent - retention[i].percent;
      if (drop > 10) {
        dropOffPoints.push({ bucket: i, drop });
      }
    }

    return {
      totalViewers,
      bucketSize,
      retention,
      dropOffPoints,
    };
  }
}
