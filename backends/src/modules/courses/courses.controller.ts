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
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
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
  ) {
    return this.coursesService.findAll(user, {
      status,
      delivery,
      search,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
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
   * DELETE /courses/:id — Delete a draft course
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
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
   * POST /courses/:id/ratings — Rate a course (student)
   */
  @Post(':id/ratings')
  async rateCourse(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { rating: number; reviewText?: string },
  ) {
    return this.coursesService.rateCourse(courseId, user.id, body.rating, body.reviewText);
  }

  /**
   * GET /courses/:id/ratings — Get all ratings for a course
   */
  @Get(':id/ratings')
  async getCourseRatings(@Param('id') courseId: string) {
    return this.coursesService.getCourseRatings(courseId);
  }

  /**
   * GET /courses/:id/ratings/stats — Get average rating for a course
   */
  @Get(':id/ratings/stats')
  async getCourseRatingStats(@Param('id') courseId: string) {
    return this.coursesService.getCourseRatingStats(courseId);
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
   * DELETE /courses/:id/ratings/:ratingId — Delete a rating (admin/manager)
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':id/ratings/:ratingId')
  async deleteRating(@Param('ratingId') ratingId: string) {
    return this.coursesService.deleteRating(ratingId);
  }
}
