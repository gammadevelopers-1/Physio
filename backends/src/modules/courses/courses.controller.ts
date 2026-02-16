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
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INSTRUCTOR' as UserRole)
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  // ─── Course Endpoints ───────────────────────────────────────

  /**
   * POST /courses — Create a new course
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') instructorId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.create(instructorId, dto);
  }

  /**
   * GET /courses — List my courses with filtering & pagination
   */
  @Get()
  async findAll(
    @CurrentUser('id') instructorId: string,
    @Query('status') status?: string,
    @Query('delivery') delivery?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.findAll(instructorId, {
      status,
      delivery,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /courses/:id — Course detail with modules
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') instructorId: string,
  ) {
    return this.coursesService.findOne(id, instructorId);
  }

  /**
   * PATCH /courses/:id — Update a course
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') instructorId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, instructorId, dto);
  }

  /**
   * DELETE /courses/:id — Delete a draft course
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') instructorId: string,
  ) {
    return this.coursesService.remove(id, instructorId);
  }

  // ─── Module Endpoints ───────────────────────────────────────

  /**
   * POST /courses/:id/modules — Add a module to a course
   */
  @Post(':id/modules')
  @HttpCode(HttpStatus.CREATED)
  async addModule(
    @Param('id') courseId: string,
    @CurrentUser('id') instructorId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.coursesService.addModule(courseId, instructorId, dto);
  }

  /**
   * PATCH /courses/:id/modules/reorder — Reorder modules
   * NOTE: Must be defined BEFORE :mid param route to avoid "reorder" matching as :mid
   */
  @Patch(':id/modules/reorder')
  async reorderModules(
    @Param('id') courseId: string,
    @CurrentUser('id') instructorId: string,
    @Body() dto: ReorderModulesDto,
  ) {
    return this.coursesService.reorderModules(
      courseId,
      instructorId,
      dto,
    );
  }

  /**
   * PATCH /courses/:id/modules/:mid — Update a module
   */
  @Patch(':id/modules/:mid')
  async updateModule(
    @Param('id') courseId: string,
    @Param('mid') moduleId: string,
    @CurrentUser('id') instructorId: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.coursesService.updateModule(
      courseId,
      moduleId,
      instructorId,
      dto,
    );
  }

  /**
   * DELETE /courses/:id/modules/:mid — Remove a module
   */
  @Delete(':id/modules/:mid')
  async removeModule(
    @Param('id') courseId: string,
    @Param('mid') moduleId: string,
    @CurrentUser('id') instructorId: string,
  ) {
    return this.coursesService.removeModule(
      courseId,
      moduleId,
      instructorId,
    );
  }
}
