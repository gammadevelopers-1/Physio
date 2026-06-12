import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentInputDto } from './create-ticket.dto';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  /**
   * Optional list of attachment URLs (validated against our storage
   * origin allowlist in the service). Capped to 10 to match the
   * student-side multi-file picker. Each URL becomes a row in
   * ticket_attachments with reply_id set to the new reply.
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  attachmentUrls?: string[];

  /**
   * Rich attachment payload preferred over `attachmentUrls` for new
   * clients. When present, persists filename / mimeType / sizeBytes
   * so the chip renders with proper metadata.
   */
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  @IsOptional()
  attachments?: AttachmentInputDto[];
}
