import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto, RequestChangesDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
import { RateCourseDto } from './dto/rate-course.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles, Public } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  // ─── Course Endpoints ───────────────────────────────────────

  /**
   * POST /courses — Create a new course
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.create(user, dto);
  }

  /**
   * GET /courses/public — List active courses (no auth required)
   */
  @Public()
  @Get('public')
  async findAllPublic(
    @Query('search') search?: string,
    @Query('delivery') delivery?: string,
    @Query('pricing') pricing?: string,
    @Query('cmeAccredited') cmeAccredited?: string,
    @Query('language') language?: string,
    @Query('availability') availability?: string,
    @Query('scope') scope?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.findAllPublic({
      search,
      delivery,
      pricing,
      cmeAccredited:
        cmeAccredited === 'true'
          ? true
          : cmeAccredited === 'false'
            ? false
            : undefined,
      language,
      availability,
      scope: scope === 'archived' ? 'archived' : 'open',
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /courses/public/:id — Get a single public course detail
   */
  @Public()
  @Get('public/:id')
  async findOnePublic(@Param('id') id: string) {
    return this.coursesService.findOnePublic(id);
  }

  /**
   * GET /courses/instructors/:id/public — Public instructor profile
   * (profile + stats + their public courses + recent reviews).
   * Powers the dedicated /instructors/:id page on the marketing site.
   */
  @Public()
  @Get('instructors/:id/public')
  async findInstructorPublicProfile(@Param('id') id: string) {
    return this.coursesService.findInstructorPublicProfile(id);
  }

  /**
   * GET /courses/featured-home — Public featured-courses mix for homepage.
   * Fair round-robin across managers, random-picked each request.
   * NOTE: declared BEFORE the generic @Get(':id') so 'featured-home' is not
   * interpreted as an :id param.
   */
  @Public()
  @Get('featured-home')
  async findFeaturedForHome(@Query('limit') limit?: string) {
    return this.coursesService.findFeaturedForHome(
      limit ? Math.min(parseInt(limit, 10) || 4, 12) : 4,
    );
  }

  /**
   * GET /courses — List courses (instructor: own only, admin: all)
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('delivery') delivery?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('instructorId') instructorId?: string,
    @Query('managerId') managerId?: string,
  ) {
    return this.coursesService.findAll(user, {
      status,
      delivery,
      search,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      instructorId,
      managerId,
    });
  }

  /**
   * POST /courses/:id/activate — Activate a course after content review
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.activate(courseId, user);
  }

  /**
   * POST /courses/:id/deactivate — Deactivate (archive) an active course
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.deactivate(courseId, user);
  }

  /**
   * POST /courses/:id/complete — Mark an active course as completed
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.complete(courseId, user);
  }

  /**
   * POST /courses/:id/submit-review — Instructor submits course for manager review
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/submit-review')
  @HttpCode(HttpStatus.OK)
  async submitForReview(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.submitForReview(courseId, user);
  }

  /**
   * POST /courses/:id/request-changes — Manager requests changes on a course
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestChangesDto,
  ) {
    return this.coursesService.requestChanges(courseId, user, dto.note);
  }

  /**
   * PATCH /courses/:id/assign-instructor — Reassign instructor for a course
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/assign-instructor')
  async assignInstructor(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { instructorId: string },
  ) {
    return this.coursesService.reassignInstructor(courseId, body.instructorId, user);
  }

  /**
   * GET /courses/:id — Course detail with modules
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole, 'TEACHING_ASSISTANT' as UserRole)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.findOne(id, user);
  }

  /**
   * PATCH /courses/:id — Update a course
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, user, dto);
  }

  /**
   * DELETE /courses/:id — Delete a draft course (manager/admin only)
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.remove(id, user);
  }

  // ─── Module Endpoints ───────────────────────────────────────

  /**
   * POST /courses/:id/modules — Add a module to a course
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/modules')
  @HttpCode(HttpStatus.CREATED)
  async addModule(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateModuleDto,
  ) {
    return this.coursesService.addModule(courseId, user, dto);
  }

  /**
   * PATCH /courses/:id/modules/reorder — Reorder modules
   * NOTE: Must be defined BEFORE :mid param route to avoid "reorder" matching as :mid
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/modules/reorder')
  async reorderModules(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderModulesDto,
  ) {
    return this.coursesService.reorderModules(courseId, user, dto);
  }

  /**
   * PATCH /courses/:id/modules/:mid — Update a module
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/modules/:mid')
  async updateModule(
    @Param('id') courseId: string,
    @Param('mid') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.coursesService.updateModule(courseId, moduleId, user, dto);
  }

  /**
   * DELETE /courses/:id/modules/:mid — Remove a module
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':id/modules/:mid')
  async removeModule(
    @Param('id') courseId: string,
    @Param('mid') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.removeModule(courseId, moduleId, user);
  }

  // ─── Course Ratings ─────────────────────────────────────────

  /**
   * POST /courses/:id/ratings — Rate a course (student, one-time)
   */
  @Roles('STUDENT' as UserRole)
  @Post(':id/ratings')
  async rateCourse(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RateCourseDto,
  ) {
    return this.coursesService.rateCourse(courseId, user.id, dto.rating, dto.reviewText);
  }

  /**
   * GET /courses/:id/ratings/me — Get the current student's rating for a course (or null)
   */
  @Roles('STUDENT' as UserRole)
  @Get(':id/ratings/me')
  async getMyRating(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.getMyRating(courseId, user.id);
  }

  /**
   * GET /courses/:id/ratings — Paginated + filterable ratings for a course (public read)
   */
  @Public()
  @Get(':id/ratings')
  async getCourseRatings(
    @Param('id') courseId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.getCourseRatings(courseId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      rating: rating ? Number(rating) : undefined,
      sort: sort as 'newest' | 'oldest' | 'highest' | 'lowest' | undefined,
      search: search || undefined,
    });
  }

  /**
   * GET /courses/:id/ratings/stats — Get average rating for a course
   */
  @Get(':id/ratings/stats')
  async getCourseRatingStats(@Param('id') courseId: string) {
    return this.coursesService.getCourseRatingStats(courseId);
  }

  /**
   * PATCH /courses/:id/feature — Toggle the featured flag.
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/feature')
  async toggleFeatured(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.toggleFeatured(courseId, user);
  }

  /**
   * GET /courses/ratings/all — Get all course rating averages (for dashboard)
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('ratings/all')
  async getAllCourseRatings() {
    return this.coursesService.getAllCourseRatings();
  }

  /**
   * GET /courses/ratings/manager-stats — Manager review analytics
   * (overall avg rating across their courses + top 5 rated courses).
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('ratings/manager-stats')
  async getManagerRatingStats(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getManagerRatingStats(user);
  }

  /**
   * GET /courses/reviews/manager — Manager all-reviews moderation list
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('reviews/manager')
  async getManagerReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('moderationStatus') moderationStatus?: string,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('unpublishedOnly') unpublishedOnly?: string,
    @Query('courseId') courseId?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.coursesService.getManagerReviews(user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      moderationStatus: moderationStatus as 'pending' | 'approved' | 'rejected' | undefined,
      publishedOnly: publishedOnly === 'true',
      unpublishedOnly: unpublishedOnly === 'true',
      courseId: courseId || undefined,
      search: search || undefined,
      sort: sort as 'newest' | 'oldest' | 'highest' | 'lowest' | undefined,
    });
  }

  /**
   * POST /courses/:id/ratings/:ratingId/approve — Approve + publish a review
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/ratings/:ratingId/approve')
  async approveReview(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.approveReview(ratingId, user);
  }

  /**
   * POST /courses/:id/ratings/:ratingId/reject — Reject + unpublish a review
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/ratings/:ratingId/reject')
  async rejectReview(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.rejectReview(ratingId, user);
  }

  /**
   * PATCH /courses/:id/ratings/:ratingId/publish — Set is_published flag
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/ratings/:ratingId/publish')
  async setReviewPublished(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { published: boolean },
  ) {
    return this.coursesService.setReviewPublished(ratingId, user, !!body.published);
  }

  /**
   * DELETE /courses/:id/ratings/:ratingId — Delete a rating (admin/manager, scoped)
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':id/ratings/:ratingId')
  async deleteRating(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.deleteRating(ratingId, user);
  }

  /**
   * GET /courses/instructor-reviews/featured — Shuffled, round-robin sample
   * of approved+published instructor reviews across ALL instructors.
   * Powers the Strapi "Instructor Reviews" homepage block. Default limit 6.
   */
  @Public()
  @Get('instructor-reviews/featured')
  async getFeaturedInstructorReviews(@Query('limit') limit?: string) {
    return this.coursesService.getFeaturedInstructorReviews({
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ─── Instructor Ratings ────────────────────────────────────

  @Roles('STUDENT' as UserRole)
  @Post(':id/instructor-ratings')
  async rateInstructor(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RateCourseDto,
  ) {
    return this.coursesService.rateInstructor(
      courseId,
      user.id,
      dto.rating,
      dto.reviewText,
    );
  }

  @Roles('STUDENT' as UserRole)
  @Get(':id/instructor-ratings/me')
  async getMyInstructorRating(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.getMyInstructorRating(courseId, user.id);
  }

  /**
   * GET /courses/:id/review-status — Whether this student has submitted
   * the course + instructor reviews required to request a certificate.
   * Powers the student-side dual-review prompt and "Request Certificate"
   * gate (UI parity with the backend gate in CertificatesService).
   */
  @Roles('STUDENT' as UserRole)
  @Get(':id/review-status')
  async getMyReviewStatus(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.hasSubmittedRequiredReviews(courseId, user.id);
  }

  /**
   * GET /courses/:id/instructor-aggregated-ratings — Public instructor reviews
   * across EVERY course this instructor has taught (not just this course).
   * Used by the public course-detail Reviews block when toggled to
   * "Instructor" — each card carries a course-name chip so the reader
   * understands the cross-course context.
   */
  @Public()
  @Get(':id/instructor-aggregated-ratings')
  async getInstructorAggregatedRatings(
    @Param('id') courseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.getInstructorAggregatedRatingsByCourse(courseId, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * GET /courses/:id/instructor-ratings — Paginated published instructor
   * reviews for a course. Manager course detail uses this; public surface
   * is gated client-side until product confirms.
   */
  @Public()
  @Get(':id/instructor-ratings')
  async getInstructorRatings(
    @Param('id') courseId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.getInstructorRatings(courseId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      rating: rating ? Number(rating) : undefined,
      sort: sort as 'newest' | 'oldest' | 'highest' | 'lowest' | undefined,
      search: search || undefined,
    });
  }

  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('instructor-reviews/manager')
  async getManagerInstructorReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('moderationStatus') moderationStatus?: string,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('unpublishedOnly') unpublishedOnly?: string,
    @Query('courseId') courseId?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    return this.coursesService.getManagerInstructorReviews(user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      moderationStatus: moderationStatus as
        | 'pending'
        | 'approved'
        | 'rejected'
        | undefined,
      publishedOnly: publishedOnly === 'true',
      unpublishedOnly: unpublishedOnly === 'true',
      courseId: courseId || undefined,
      search: search || undefined,
      sort: sort as 'newest' | 'oldest' | 'highest' | 'lowest' | undefined,
    });
  }

  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/instructor-ratings/:ratingId/approve')
  async approveInstructorReview(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.approveInstructorReview(ratingId, user);
  }

  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/instructor-ratings/:ratingId/reject')
  async rejectInstructorReview(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.rejectInstructorReview(ratingId, user);
  }

  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/instructor-ratings/:ratingId/publish')
  async setInstructorReviewPublished(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { published: boolean },
  ) {
    return this.coursesService.setInstructorReviewPublished(
      ratingId,
      user,
      !!body.published,
    );
  }

  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':id/instructor-ratings/:ratingId')
  async deleteInstructorRating(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.deleteInstructorRating(ratingId, user);
  }
}
