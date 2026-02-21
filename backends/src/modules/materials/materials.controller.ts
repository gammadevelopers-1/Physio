import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from './materials.service';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { ReorderMaterialsDto } from './dto/reorder-materials.dto';
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
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB hard cap
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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

  // ─── Material-scoped Endpoints ────────────────────────────

  /**
   * GET /materials/:id/status — Lightweight polling endpoint
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
      limits: { fileSize: 100 * 1024 * 1024 },
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

  /**
   * DELETE /materials/:id — Remove a material
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Delete('materials/:id')
  async remove(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.remove(materialId, user);
  }
}
