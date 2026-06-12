import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
  Matches,
  IsArray,
  ArrayMaxSize,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentInputDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  filename?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  mimeType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sizeBytes?: number;
}

export class CreateTicketDto {
  // Slug-shape only — the actual allowed list is validated at the service
  // layer against listTicketCategories() because admins can add custom
  // categories without a schema migration. See SupportService.createTicket.
  @Matches(/^[a-z][a-z0-9_-]{0,29}$/, {
    message: 'category must be a lowercase slug (a-z, 0-9, -, _)',
  })
  @IsNotEmpty()
  category: string;

  @IsIn(['high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsUUID('4')
  @IsOptional()
  courseId?: string;

  // Legacy single attachment. Still accepted so older clients keep
  // working. New clients should use `attachmentUrls` below.
  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  // Multi-file: array of pre-uploaded storage URLs. Each URL is
  // re-validated by the service (origin + extension allowlist). Capped
  // at 10 to keep the chip row readable and the scan workload bounded.
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  attachmentUrls?: string[];

  // Rich attachment payload — when present, the service persists
  // `filename` / `mimeType` / `sizeBytes` alongside the URL so the
  // chip view renders the real file name + PDF/image card instead of
  // a generic "Attachment" placeholder. Preferred over the URL-only
  // `attachmentUrls` for new clients; legacy clients can keep using
  // `attachmentUrls`.
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  @IsOptional()
  attachments?: AttachmentInputDto[];

  // The third-party "subject" of the ticket — when one party files
  // about another. Currently only set by the instructor at-risk
  // interventions flow (instructor raises a follow-up about a
  // struggling student). Service-layer validates that the caller is
  // privileged enough to attach context about another user.
  @IsUUID('4')
  @IsOptional()
  aboutUserId?: string;

  // Provenance: 'intervention' | 'at_risk_alert' | undefined (= direct).
  // Service-layer ignores unknown values rather than rejecting so the
  // catalog can grow without DTO churn.
  @IsString()
  @IsOptional()
  source?: string;
}
