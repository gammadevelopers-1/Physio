import {
  Injectable,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, isNull, sql, count, inArray, sum } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../database';
import {
  courseMaterials,
  courses,
  courseModules,
  assessments,
  users,
  materialVariants,
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
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

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
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('MANAGER')
    );
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
    body: { title: string; type: string; moduleId?: string },
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
    await this.verifyCourseAccess(courseId, user);

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
    const newVersion = existing.version + 1;
    const [material] = await db
      .insert(courseMaterials)
      .values({
        courseId: existing.courseId,
        moduleId: existing.moduleId,
        title: body?.title || existing.title,
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
    const material = await this.verifyMaterialAccess(materialId, user);
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
    await this.verifyMaterialAccess(materialId, user);

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
   * Returns all materials with status='pending_review'.
   * MANAGER/ADMIN see all, INSTRUCTOR sees own.
   */
  async findPendingReview(user: AuthenticatedUser) {
    // Include both pending_review and changes_requested materials
    const statusCondition = sql`${courseMaterials.status} IN ('pending_review', 'changes_requested')`;

    const conditions: ReturnType<typeof eq>[] = [statusCondition as any];

    if (!this.isAdmin(user)) {
      conditions.push(eq(courseMaterials.uploadedBy, user.id));
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

    // Get counts by status for stats
    const [pendingCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(eq(courseMaterials.status, MATERIAL_STATUS.PENDING_REVIEW));

    const [changesRequestedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(eq(courseMaterials.status, MATERIAL_STATUS.CHANGES_REQUESTED));

    const [approvedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(eq(courseMaterials.status, MATERIAL_STATUS.LIVE));

    const [rejectedCount] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.status, MATERIAL_STATUS.FAILED),
          sql`${courseMaterials.reviewedBy} IS NOT NULL`,
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

    return updated;
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
    const material = await this.verifyMaterialAccess(materialId, user);

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
  async remove(materialId: string, user: AuthenticatedUser) {
    const existing = await this.verifyMaterialAccess(materialId, user);

    if (existing.status === MATERIAL_STATUS.PROCESSING) {
      throw new BadRequestException(
        'Cannot delete a material that is currently being processed. Wait for processing to complete or fail.',
      );
    }

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

    return { message: 'Material deleted successfully' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
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
  ) {
    const [material] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    // Verify course access
    if (!this.isAdmin(user)) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(
            eq(courses.id, material.courseId),
            eq(courses.instructorId, user.id),
          ),
        )
        .limit(1);

      if (!course) {
        throw new NotFoundException('Material not found');
      }
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
}
