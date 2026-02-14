import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
}
