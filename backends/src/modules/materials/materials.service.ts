import {
  Injectable,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../database';
import {
  courseMaterials,
  courses,
  MATERIAL_STATUS,
} from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateMaterialDto } from './dto/update-material.dto';

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
  video: 100 * 1024 * 1024, // 100 MB
  pdf: 10 * 1024 * 1024, // 10 MB
  document: 10 * 1024 * 1024, // 10 MB
  image: 10 * 1024 * 1024, // 10 MB
};

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(private storageService: StorageService) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
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

      // Update status to 'live'
      const [updated] = await db
        .update(courseMaterials)
        .set({
          fileUrl,
          status: MATERIAL_STATUS.LIVE,
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, material.id))
        .returning();

      return updated;
    } catch (error) {
      // Update status to 'failed'
      await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
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
    params: { type?: string; status?: string },
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
    }

    const data = await db
      .select()
      .from(courseMaterials)
      .where(and(...conditions))
      .orderBy(desc(courseMaterials.createdAt));

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

      // Update status to 'live'
      const [updated] = await db
        .update(courseMaterials)
        .set({
          fileUrl,
          status: MATERIAL_STATUS.LIVE,
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, material.id))
        .returning();

      return updated;
    } catch (error) {
      await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
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

  // ─── Delete ───────────────────────────────────────────────

  /**
   * DELETE /materials/:id
   * Remove a material record and delete the file from storage.
   */
  async remove(materialId: string, user: AuthenticatedUser) {
    const existing = await this.verifyMaterialAccess(materialId, user);

    // Delete file from storage if fileUrl exists
    if (existing.fileUrl) {
      const storagePath = this.extractStoragePath(existing.fileUrl);
      if (storagePath) {
        try {
          await this.storageService.deleteFile('public', storagePath);
        } catch (error) {
          this.logger.warn(
            `Failed to delete file from storage: ${storagePath}`,
            error,
          );
        }
      }
    }

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
