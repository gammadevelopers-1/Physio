import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  discountCodes,
  discountUsage,
  courses,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  async validateDiscount(
    code: string,
    courseId: string,
    userId: string,
    coursePrice: number,
  ): Promise<{
    valid: boolean;
    discountAmount: number;
    discountId: string | null;
    error?: string;
  }> {
    const [discount] = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.code, code.toUpperCase()),
          eq(discountCodes.isActive, true),
        ),
      )
      .limit(1);

    if (!discount) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'Discount code not found' };
    }

    // Check validity period
    const now = new Date();
    if (discount.validFrom && new Date(discount.validFrom) > now) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'Discount code is not yet active' };
    }
    if (discount.validUntil && new Date(discount.validUntil) < now) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'Discount code has expired' };
    }

    // Check max uses
    if (
      discount.maxUses !== null &&
      discount.currentUses >= discount.maxUses
    ) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'Discount code has reached its maximum usage limit' };
    }

    // Check course restriction
    if (discount.courseId && discount.courseId !== courseId) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'Discount code is not valid for this course' };
    }

    // Check min order amount
    if (
      discount.minOrderAmount &&
      coursePrice < Number(discount.minOrderAmount)
    ) {
      return {
        valid: false,
        discountAmount: 0,
        discountId: null,
        error: `Minimum order amount is SAR ${discount.minOrderAmount}`,
      };
    }

    // Check if user already used this code
    const [existingUsage] = await db
      .select()
      .from(discountUsage)
      .where(
        and(
          eq(discountUsage.discountId, discount.id),
          eq(discountUsage.userId, userId),
        ),
      )
      .limit(1);

    if (existingUsage) {
      return { valid: false, discountAmount: 0, discountId: null, error: 'You have already used this discount code' };
    }

    // Calculate discount amount
    let discountAmount: number;
    if (discount.type === 'percentage') {
      discountAmount = (coursePrice * Number(discount.value)) / 100;
    } else {
      discountAmount = Number(discount.value);
    }

    // Cap at course price
    discountAmount = Math.min(discountAmount, coursePrice);

    return {
      valid: true,
      discountAmount,
      discountId: discount.id,
    };
  }

  async recordUsage(
    discountId: string,
    userId: string,
    paymentId: string,
    amountSaved: number,
  ) {
    // Atomic conditional increment — prevents maxUses race condition
    const result = await db
      .update(discountCodes)
      .set({
        currentUses: sql`${discountCodes.currentUses} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(discountCodes.id, discountId),
          sql`(${discountCodes.maxUses} IS NULL OR ${discountCodes.currentUses} < ${discountCodes.maxUses})`,
        ),
      )
      .returning({ id: discountCodes.id });

    if (result.length === 0) {
      throw new BadRequestException(
        'Discount code has reached its maximum usage limit',
      );
    }

    await db.insert(discountUsage).values({
      discountId,
      userId,
      paymentId,
      amountSaved: amountSaved.toFixed(2),
    });

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: discountId,
      action: 'discount_used',
      performedBy: userId,
      metadata: { paymentId, amountSaved },
    });
  }

  async create(dto: CreateDiscountDto, userId: string) {
    // Check for existing code
    const [existing] = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.code, dto.code.toUpperCase()))
      .limit(1);

    if (existing) {
      throw new BadRequestException('Discount code already exists');
    }

    const [discount] = await db
      .insert(discountCodes)
      .values({
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value.toFixed(2),
        maxUses: dto.maxUses || null,
        minOrderAmount: dto.minOrderAmount
          ? dto.minOrderAmount.toFixed(2)
          : null,
        courseId: dto.courseId || null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        createdBy: userId,
      })
      .returning();

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: discount.id,
      action: 'discount_created',
      performedBy: userId,
      metadata: { code: discount.code, type: dto.type, value: dto.value },
    });

    return discount;
  }

  async update(discountId: string, dto: UpdateDiscountDto, userId: string) {
    const [existing] = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.id, discountId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Discount code not found');
    }

    const updateData: any = { updatedAt: new Date() };
    if (dto.code !== undefined) updateData.code = dto.code.toUpperCase();
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.value !== undefined) updateData.value = dto.value.toFixed(2);
    if (dto.maxUses !== undefined) updateData.maxUses = dto.maxUses;
    if (dto.minOrderAmount !== undefined)
      updateData.minOrderAmount = dto.minOrderAmount?.toFixed(2) || null;
    if (dto.courseId !== undefined) updateData.courseId = dto.courseId || null;
    if (dto.validFrom !== undefined)
      updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined)
      updateData.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(discountCodes)
      .set(updateData)
      .where(eq(discountCodes.id, discountId))
      .returning();

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: discountId,
      action: 'discount_updated',
      performedBy: userId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async delete(discountId: string, userId: string) {
    const [existing] = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.id, discountId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Discount code not found');
    }

    // Soft delete by setting isActive to false
    await db
      .update(discountCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(discountCodes.id, discountId));

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: discountId,
      action: 'discount_deleted',
      performedBy: userId,
    });

    return { deleted: true };
  }

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const discounts = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        maxUses: discountCodes.maxUses,
        currentUses: discountCodes.currentUses,
        minOrderAmount: discountCodes.minOrderAmount,
        courseId: discountCodes.courseId,
        courseTitle: courses.title,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
        isActive: discountCodes.isActive,
        createdAt: discountCodes.createdAt,
      })
      .from(discountCodes)
      .leftJoin(courses, eq(discountCodes.courseId, courses.id))
      .orderBy(desc(discountCodes.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(discountCodes);

    return {
      data: discounts,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }
}
