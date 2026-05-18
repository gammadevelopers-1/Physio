import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('student')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /student/courses/:id/checkout — Placeholder checkout for paid
   * courses. Simulates a successful payment, creates the payments row,
   * and enrolls the student. For Webinar Courses the enrollment hook
   * also auto-registers the student in Zoom.
   *
   * When the real payment provider is wired, replace the placeholder
   * inside PaymentsService.processCheckoutPlaceholder — this endpoint's
   * contract stays the same.
   */
  @Post('courses/:id/checkout')
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') courseId: string,
  ) {
    return this.paymentsService.processCheckoutPlaceholder(user, courseId);
  }
}
