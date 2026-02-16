import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, ilike, or, desc, asc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  courseModules,
  COURSE_STATUS,
} from '../../database/schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  // ─── Course CRUD ────────────────────────────────────────────

  /**
   * Create a new course for an instructor
   */
  async create(instructorId: string, dto: CreateCourseDto) {
    const [course] = await db
      .insert(courses)
      .values({
        instructorId,
        title: dto.title,
        titleAr: dto.titleAr,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        deliveryType: dto.deliveryType,
        thumbnail: dto.thumbnail,
        maxEnrollment: dto.maxEnrollment,
        startDate: dto.startDate,
        endDate: dto.endDate,
      })
      .returning();

    return course;
  }

  /**
   * List courses for the authenticated instructor with filtering and pagination
   */
  async findAll(
    instructorId: string,
    params: {
      status?: string;
      delivery?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Build WHERE conditions — always scoped to the instructor
    const conditions: ReturnType<typeof eq>[] = [
      eq(courses.instructorId, instructorId),
    ];

    if (
      params.status &&
      Object.values(COURSE_STATUS).includes(params.status as any)
    ) {
      conditions.push(eq(courses.status, params.status));
    }

    if (params.delivery) {
      conditions.push(eq(courses.deliveryType, params.delivery));
    }

    if (params.search) {
      const searchTerm = `%${params.search}%`;
      conditions.push(
        or(
          ilike(courses.title, searchTerm),
          ilike(courses.titleAr, searchTerm),
          ilike(courses.description, searchTerm),
        ) as any,
      );
    }

    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(courses)
      .where(whereClause)
      .orderBy(desc(courses.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(courses)
      .where(whereClause);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Get course detail with modules — only if owned by instructor
   */
  async findOne(courseId: string, instructorId: string) {
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, instructorId),
        ),
      )
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    return { ...course, modules };
  }

  /**
   * Update a course — only if owned by instructor
   */
  async update(
    courseId: string,
    instructorId: string,
    dto: UpdateCourseDto,
  ) {
    // Verify ownership
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, instructorId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    const [updated] = await db
      .update(courses)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    return updated;
  }

  /**
   * Delete a course — only draft courses, only if owned by instructor
   */
  async remove(courseId: string, instructorId: string) {
    const [existing] = await db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, instructorId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    if (existing.status !== COURSE_STATUS.DRAFT) {
      throw new BadRequestException(
        'Only draft courses can be deleted',
      );
    }

    await db.delete(courses).where(eq(courses.id, courseId));

    return { message: 'Course deleted successfully' };
  }

  // ─── Module CRUD ────────────────────────────────────────────

  /**
   * Add a module to a course — verify course ownership first
   */
  async addModule(
    courseId: string,
    instructorId: string,
    dto: CreateModuleDto,
  ) {
    await this.verifyCourseOwnership(courseId, instructorId);

    // If no orderIndex provided, append at the end
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const [maxResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${courseModules.orderIndex}), -1)` })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));

      orderIndex = (maxResult?.maxOrder ?? -1) + 1;
    }

    const [module] = await db
      .insert(courseModules)
      .values({
        courseId,
        title: dto.title,
        titleAr: dto.titleAr,
        orderIndex,
        type: dto.type,
        durationMinutes: dto.durationMinutes,
      })
      .returning();

    return module;
  }

  /**
   * Update a module — verify course ownership first
   */
  async updateModule(
    courseId: string,
    moduleId: string,
    instructorId: string,
    dto: UpdateModuleDto,
  ) {
    await this.verifyCourseOwnership(courseId, instructorId);

    const [existing] = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    const [updated] = await db
      .update(courseModules)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(courseModules.id, moduleId))
      .returning();

    return updated;
  }

  /**
   * Remove a module — verify course ownership first
   */
  async removeModule(
    courseId: string,
    moduleId: string,
    instructorId: string,
  ) {
    await this.verifyCourseOwnership(courseId, instructorId);

    const [existing] = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    await db
      .delete(courseModules)
      .where(eq(courseModules.id, moduleId));

    return { message: 'Module deleted successfully' };
  }

  /**
   * Reorder modules — verify course ownership, then batch-update orderIndex
   */
  async reorderModules(
    courseId: string,
    instructorId: string,
    dto: ReorderModulesDto,
  ) {
    await this.verifyCourseOwnership(courseId, instructorId);

    // Verify all module IDs belong to this course
    const existingModules = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));

    const existingIds = new Set(existingModules.map((m) => m.id));
    for (const item of dto.modules) {
      if (!existingIds.has(item.id)) {
        throw new BadRequestException(
          `Module ${item.id} does not belong to this course`,
        );
      }
    }

    // Update each module's orderIndex
    for (const item of dto.modules) {
      await db
        .update(courseModules)
        .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
        .where(eq(courseModules.id, item.id));
    }

    // Return updated modules in order
    const updated = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    return updated;
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Verify the instructor owns the course — throws 404 if not
   */
  private async verifyCourseOwnership(
    courseId: string,
    instructorId: string,
  ) {
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, instructorId),
        ),
      )
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }
}
