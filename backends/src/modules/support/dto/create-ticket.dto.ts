import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

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

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
