import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards';
import { JwtOrScopedGuard } from '../auth/guards/jwt-or-scoped.guard';
import { Public } from '../auth/decorators';
import { randomUUID } from 'crypto';

/** Content-type mapping for serving local files */
const CONTENT_TYPE_MAP: Record<string, string> = {
  // Documents
  pdf: 'application/pdf',
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  // Captions & Transcripts
  vtt: 'text/vtt',
  srt: 'application/x-subrip',
  txt: 'text/plain',
};

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  /**
   * Upload a trainer document (PDF, images)
   * Returns { url, filename } for use in role-request body
   *
   * Accepts either a regular logged-in user token OR a trainer-application
   * scoped JWT (issued by /trainer-applications/verify-otp) so anonymous
   * applicants can attach CV/certificate files during the public flow.
   */
  @Public()
  @UseGuards(JwtOrScopedGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (_req, file, cb) => {
        // Kept in sync with SUPPORT_ATTACH_ALLOWED_MIME in
        // support.service.ts so the pre-attach client check and the
        // storage-level check never diverge. If either the reply box
        // or an internal-collab surface (chat, transfer, loop-in)
        // rejects a file, the other must too.
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF, image (JPEG/PNG/WebP), Word (DOC/DOCX), and Excel (XLS/XLSX) files are allowed',
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
   * Upload an avatar image (JPEG, PNG, WebP)
   * Returns { url, filename } for use in profile update
   */
  @UseGuards(JwtAuthGuard)
  @Post('upload-avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only image files (JPEG, PNG, WebP) are allowed for avatars',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const uniqueName = `avatars/${randomUUID()}.${ext}`;

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
        'Avatar upload failed. Storage may not be configured.',
      );
    }
  }

  /**
   * Serve local files in development (STORAGE_DRIVER=local)
   * Supports HTTP Range requests for video seeking/streaming.
   * GET /api/storage/files/:bucket/:path
   *
   * Throttling is disabled here — a single PDF/video preview fans out
   * into many byte-range requests, which trips the global 120 req/min
   * default limit and turns previews into HTTP 429s for anyone
   * scrubbing a video or paging a PDF.
   */
  @SkipThrottle()
  @Public()
  @Get('files/:bucket/*')
  async serveFile(
    @Param('bucket') bucket: string,
    @Param('0') filePath: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const validBuckets = ['public', 'private', 'trainers'] as const;
    if (!validBuckets.includes(bucket as any)) {
      throw new NotFoundException('Invalid bucket');
    }

    // For GCP storage, stream file directly from the bucket
    if (!this.storageService.isLocal) {
      // Malware gate — private + trainers buckets receive user uploads
      // (payment receipts, trainer CVs/certificates, support attachments)
      // that must be blocked until the Eventarc-triggered scanner
      // ([infra/malware-scanner/main.js](infra/malware-scanner/main.js))
      // marks them clean. Public bucket is exempt: it holds system-
      // generated content (invoice PDFs, transcoded materials) and
      // course materials that stay hidden from students until their
      // downstream processing pipeline completes — the scanner has
      // long since finished by then.
      if (bucket === 'private' || bucket === 'trainers') {
        const scan = await this.storageService.getScanStatus(
          bucket,
          filePath,
        );
        if (scan.status === 'quarantined') {
          throw new ForbiddenException(
            'This file was flagged as infected or could not be scanned safely — it has been quarantined and cannot be downloaded',
          );
        }
        if (scan.status === 'pending') {
          // HTTP 425 Too Early — @nestjs/common's HttpStatus enum lacks
          // this code, so use the numeric literal.
          throw new HttpException(
            'Malware scan has not completed yet — please wait a moment and try again',
            425,
          );
        }
        if (scan.status === 'unknown') {
          // Metadata lookup errored (GCS blip). Fail closed — a
          // transient error retried by the client is safer than a
          // scan-bypass window.
          throw new HttpException(
            'Malware scan status could not be verified — please retry',
            425,
          );
        }
      }

      const stream = await this.storageService.getFileStream(
        bucket as 'public' | 'private' | 'trainers',
        filePath,
      );

      if (!stream) {
        throw new NotFoundException('File not found');
      }

      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentType = CONTENT_TYPE_MAP[ext || ''] || 'application/octet-stream';
      const filename = filePath.split('/').pop() || 'file';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      });

      stream.pipe(res);
      return;
    }

    const localPath = this.storageService.getLocalFilePath(bucket, filePath);
    if (!localPath) {
      throw new NotFoundException('File not found');
    }

    const absolutePath = path.resolve(localPath);
    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext || ''] || 'application/octet-stream';
    const filename = filePath.split('/').pop() || 'file';

    const range = req.headers.range;

    if (range) {
      // HTTP Range request — required for video seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fs.createReadStream(absolutePath, { start, end }).pipe(res);
    } else {
      // Full file response with Accept-Ranges so browser knows it can request ranges
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${filename}"`,
      });

      fs.createReadStream(absolutePath).pipe(res);
    }
  }
}
