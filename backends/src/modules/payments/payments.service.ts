import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database';
import {
  payments,
  courses,
  enrollments,
  COURSE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_PROVIDER,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  /**
   * Placeholder checkout — simulates a successful payment, creates the
   * payments row, and triggers the standard enrollment path (which will
   * auto-register Webinar Course students in Zoom via the existing hook).
   *
   * When the real payment provider is integrated later, replace the
   * placeholder body (lines marked TODO-provider) with the provider's
   * SDK call. The surrounding flow stays identical — finance dashboard,
   * enrollment, Zoom registration, certificates all already read against
   * the same shape.
   */
  async processCheckoutPlaceholder(
    user: AuthenticatedUser,
    courseId: string,
  ) {
    // 1. Load course + validate
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.status !== COURSE_STATUS.ACTIVE) {
      throw new BadRequestException('Course is not available for enrollment');
    }
    const priceValue = course.price ? Number(course.price) : 0;
    if (priceValue <= 0) {
      throw new BadRequestException(
        'This course is free — enroll directly without checkout',
      );
    }
    // Placeholder payment is restricted to Webinar Courses until the real
    // payment provider is wired. Otherwise this endpoint would let students
    // self-enroll in any paid course for free — a regression on the prior
    // "contact us" behaviour for paid Zoom/onsite/blended courses.
    if (course.deliveryType !== 'webinar') {
      throw new BadRequestException(
        'Online checkout is not yet enabled for this course type. Please contact us to complete enrollment.',
      );
    }
    if (
      course.enrollmentDeadline &&
      new Date(course.enrollmentDeadline) <= new Date()
    ) {
      throw new BadRequestException({
        code: 'ENROLLMENT_DEADLINE_PASSED',
        message: 'Enrollment deadline has passed',
      });
    }

    // 2. Block double-pay — already enrolled (active)
    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, user.id),
        ),
      )
      .limit(1);
    if (existing?.status === 'active') {
      throw new BadRequestException('You are already enrolled in this course');
    }

    // 3. TODO-provider: replace this block with real payment provider call
    //    (Stripe checkout session / HyperPay /…). The rest of the flow
    //    stays unchanged — only this single step needs to know the provider.
    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        courseId,
        amount: priceValue.toFixed(2),
        currency: 'SAR',
        status: PAYMENT_STATUS.COMPLETED,
        provider: PAYMENT_PROVIDER.PLACEHOLDER,
        metadata: {
          note: 'Placeholder payment — real provider integration pending',
          deliveryType: course.deliveryType,
        },
      })
      .returning();
    this.logger.log(
      `Placeholder payment ${payment.id} recorded for user ${user.id} on course ${courseId}`,
    );

    // 4. Create the enrollment via the standard path (capacity enforcement,
    //    audit log, TA re-allocation, Webinar Course Zoom auto-register).
    const enrollment = await this.enrollmentsService.createEnrollment(
      courseId,
      user.id,
      user,
    );

    // 5. Link the enrollment back to the payment row
    await db
      .update(payments)
      .set({ enrollmentId: enrollment.id, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    return {
      paymentId: payment.id,
      enrollmentId: enrollment.id,
      courseId,
      amount: priceValue,
      currency: payment.currency,
      provider: payment.provider,
      placeholder: true,
    };
  }
}
