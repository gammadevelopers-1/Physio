import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionAssistantsService } from './session-assistants.service';
import { AssignAssistantDto } from './dto/assign-assistant.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('sessions/:sessionId/assistants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionAssistantsController {
  constructor(private readonly assistantsService: SessionAssistantsService) {}

  /**
   * GET /sessions/:sessionId/assistants — List assigned assistants
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get()
  async getAssistants(@Param('sessionId') sessionId: string) {
    return this.assistantsService.getAssistants(sessionId);
  }

  /**
   * POST /sessions/:sessionId/assistants — Manually assign an assistant
   */
  @Roles('ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async assignAssistant(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignAssistantDto,
  ) {
    return this.assistantsService.manualAssign(
      sessionId,
      dto.userId,
      dto.role || 'assistant',
      user.id,
    );
  }

  /**
   * DELETE /sessions/:sessionId/assistants/:userId — Remove an assistant
   */
  @Roles('ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete(':userId')
  async removeAssistant(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
  ) {
    return this.assistantsService.remove(sessionId, userId);
  }
}
