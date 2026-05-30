import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from './materials.service';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { ReorderMaterialsDto } from './dto/reorder-materials.dto';
import { ReviewMaterialDto } from './dto/review-material.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

/**
 * Handles routes across two prefixes:
 *   /courses/:id/materials  — upload, list
 *   /materials/:id          — update, replace, delete
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private materialsService: MaterialsService) {}

  // ─── Course-scoped Endpoints ──────────────────────────────

  /**
   * POST /courses/:id/materials — Upload a material (multipart/form-data)
   * Max 100 MB at multer level; type-specific limits enforced in service.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Post('courses/:id/materials')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB hard cap
      fileFilter: (_req, file, cb) => {
        const allAllowed = [
          // video
          'video/mp4',
          'video/mpeg',
          'video/webm',
          'video/quicktime',
          'video/x-msvideo',
          // pdf
          'application/pdf',
          // document
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // image
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (allAllowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type '${file.mimetype}' is not allowed`,
            ),
            false,
          );
        }
      },
    }),
  )
  async upload(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body() body: UploadMaterialDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.materialsService.upload(courseId, user, file, body);
  }

  /**
   * GET /courses/:id/materials — List materials (?type, ?status, ?moduleId)
   * moduleId can be a UUID (filter by module) or 'none' (unassigned only)
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('courses/:id/materials')
  async findAll(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('moduleId') moduleId?: string,
  ) {
    return this.materialsService.findAll(courseId, user, { type, status, moduleId });
  }

  /**
   * PATCH /courses/:id/modules/:moduleId/materials/reorder
   * Reorder materials within a module.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Patch('courses/:id/modules/:moduleId/materials/reorder')
  async reorderMaterials(
    @Param('id') courseId: string,
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderMaterialsDto,
  ) {
    return this.materialsService.reorderMaterials(courseId, moduleId, user, dto.materialIds);
  }

  // ─── Content Review Endpoints ────────────────────────────

  /**
   * GET /materials/pending-review — List all materials awaiting review
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('materials/pending-review')
  async getPendingReview(@CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.findPendingReview(user);
  }

  /**
   * PATCH /materials/:id/review — Approve or reject a material
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch('materials/:id/review')
  async reviewMaterial(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewMaterialDto,
  ) {
    return this.materialsService.reviewMaterial(
      materialId,
      user,
      dto.decision,
      dto.comment,
    );
  }

  /**
   * POST /materials/bulk-review — Approve or reject multiple materials at once
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post('materials/bulk-review')
  @HttpCode(HttpStatus.OK)
  async bulkReviewMaterials(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { materialIds: string[]; decision: 'approved' | 'rejected' | 'changes_requested'; comment?: string },
  ) {
    const results = await Promise.allSettled(
      body.materialIds.map((id) =>
        this.materialsService.reviewMaterial(id, user, body.decision, body.comment),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, total: body.materialIds.length };
  }

  /**
   * GET /materials/:id/compliance-checklist — 5-check compliance checklist
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('materials/:id/compliance-checklist')
  async getComplianceChecklist(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getComplianceChecklist(materialId, user);
  }

  // ─── Material-scoped Endpoints ────────────────────────────

  /**
   * GET /materials/:id/status — Lightweight polling endpoint
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('materials/:id/status')
  async getStatus(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getProcessingStatus(materialId, user);
  }

  /**
   * GET /materials/:id/variants — Transcoded video variants
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('materials/:id/variants')
  async getVariants(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getVariants(materialId, user);
  }

  /**
   * PATCH /materials/:id — Update material metadata
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Patch('materials/:id')
  async update(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(materialId, user, dto);
  }

  /**
   * POST /materials/:id/replace — Upload new version
   * Auto-increments version number, links via previousVersionId.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Post('materials/:id/replace')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB hard cap
      fileFilter: (_req, file, cb) => {
        const allAllowed = [
          'video/mp4',
          'video/mpeg',
          'video/webm',
          'video/quicktime',
          'video/x-msvideo',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (allAllowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type '${file.mimetype}' is not allowed`,
            ),
            false,
          );
        }
      },
    }),
  )
  async replace(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body() body?: { title?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.materialsService.replace(materialId, user, file, body);
  }

  // ─── Watch Analytics (Feature 7) ─────────────────────────

  /**
   * GET /materials/:id/watch-analytics — Video retention analytics
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('materials/:id/watch-analytics')
  async getWatchAnalytics(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getWatchAnalytics(materialId, user);
  }

  // ─── Captions (Feature 5) ────────────────────────────────

  /**
   * GET /materials/:id/captions — Fetch parsed VTT captions
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('materials/:id/captions')
  async getCaptions(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getCaptions(materialId, user);
  }

  /**
   * PUT /materials/:id/captions — Save edited caption entries
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Put('materials/:id/captions')
  async saveCaptions(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { entries: { startTime: string; endTime: string; text: string }[] },
  ) {
    return this.materialsService.saveCaptions(materialId, user, body.entries);
  }

  /**
   * POST /materials/:id/captions/upload — Upload a VTT or SRT file
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Post('materials/:id/captions/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['text/vtt', 'text/plain', 'application/x-subrip', 'application/octet-stream'];
        if (allowed.includes(file.mimetype) || file.originalname.endsWith('.vtt') || file.originalname.endsWith('.srt')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only VTT and SRT files are allowed'), false);
        }
      },
    }),
  )
  async uploadCaptionFile(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.materialsService.uploadCaptionFile(materialId, user, file);
  }

  // ─── Version History (Feature 6) ───────────────────────

  /**
   * GET /materials/:id/versions — List version history
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('materials/:id/versions')
  async getVersionHistory(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.getVersionHistory(materialId, user);
  }

  /**
   * POST /materials/:id/rollback/:versionId — Rollback to a previous version
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Post('materials/:id/rollback/:versionId')
  @HttpCode(HttpStatus.CREATED)
  async rollbackToVersion(
    @Param('id') materialId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.rollbackToVersion(materialId, versionId, user);
  }

  /**
   * DELETE /materials/:id — Remove a material
   * Managers can pass a reason in the query string (?reason=...)
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete('materials/:id')
  async remove(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Query('reason') reason?: string,
  ) {
    return this.materialsService.remove(materialId, user, reason, req.ip);
  }
}
