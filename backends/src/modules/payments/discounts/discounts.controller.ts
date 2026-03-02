import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { DiscountService } from '../services/discount.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { ValidateDiscountDto } from '../dto/validate-discount.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountService: DiscountService) {}

  @Post('validate')
  async validateDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ValidateDiscountDto,
  ) {
    // We need the course price to validate
    const { db } = await import('../../../database');
    const { courses } = await import('../../../database/schema');
    const { eq } = await import('drizzle-orm');

    const [course] = await db
      .select({ price: courses.price })
      .from(courses)
      .where(eq(courses.id, dto.courseId))
      .limit(1);

    if (!course) {
      return { valid: false, error: 'Course not found' };
    }

    return this.discountService.validateDiscount(
      dto.code,
      dto.courseId,
      user.id,
      Number(course.price || 0),
    );
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.discountService.findAll(page, limit);
  }

  @Post()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.discountService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discountService.delete(id, user.id);
  }
}
