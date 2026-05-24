import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

enum LocaleParam {
  EN = 'en',
  AR = 'ar',
}

/**
 * Admin Templates page — read + write transactional message
 * templates (email + WhatsApp). Locked to ADMIN / SUPER_ADMIN.
 */
@Controller('admin/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':eventKey/:locale')
  async get(
    @Param('eventKey') eventKey: string,
    @Param('locale', new ParseEnumPipe(LocaleParam)) locale: LocaleParam,
  ) {
    return this.service.get(eventKey, locale);
  }

  @Put(':eventKey/:locale')
  async upsert(
    @Param('eventKey') eventKey: string,
    @Param('locale', new ParseEnumPipe(LocaleParam)) locale: LocaleParam,
    @Body()
    body: {
      subject?: string | null;
      preheader?: string | null;
      body: string;
      designJson?: unknown | null;
      enabled?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsert(eventKey, locale, body, user.id);
  }

  @Delete(':eventKey/:locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(
    @Param('eventKey') eventKey: string,
    @Param('locale', new ParseEnumPipe(LocaleParam)) locale: LocaleParam,
  ) {
    await this.service.reset(eventKey, locale);
  }
}
