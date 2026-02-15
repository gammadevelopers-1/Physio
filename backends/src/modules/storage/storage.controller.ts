import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards';
import { randomUUID } from 'crypto';

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  /**
   * Upload a trainer document (PDF, images)
   * Returns { url, filename } for use in role-request body
   */
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF and image files (JPEG, PNG, WebP) are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Generate unique filename
    const ext = file.originalname.split('.').pop() || 'pdf';
    const uniqueName = `trainer-docs/${randomUUID()}.${ext}`;

    try {
      const url = await this.storageService.uploadTrainerDocument(
        file.buffer,
        uniqueName,
        file.mimetype,
      );

      return {
        url,
        filename: file.originalname,
      };
    } catch {
      throw new BadRequestException(
        'File upload failed. Storage may not be configured.',
      );
    }
  }

  /**
   * Serve local files in development (STORAGE_DRIVER=local)
   * GET /api/storage/files/:bucket/:path
   */
  @Get('files/:bucket/*')
  async serveFile(
    @Param('bucket') bucket: string,
    @Param('0') filePath: string,
    @Res() res: Response,
  ) {
    if (!this.storageService.isLocal) {
      throw new NotFoundException('Local file serving is only available in dev mode');
    }

    const validBuckets = ['public', 'private', 'trainers'];
    if (!validBuckets.includes(bucket)) {
      throw new NotFoundException('Invalid bucket');
    }

    const localPath = this.storageService.getLocalFilePath(bucket, filePath);
    if (!localPath) {
      throw new NotFoundException('File not found');
    }

    // Determine content type from extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    res.setHeader('Content-Type', contentTypeMap[ext || ''] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);
    res.sendFile(localPath, { root: '/' });
  }
}
