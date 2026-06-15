import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, count, sql, ilike, or, gte, lte, isNull, gt, lt } from 'drizzle-orm';
import { db } from '../../../database';
import {
  discountCodes,
  discountUsage,
  invoices,
  users,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { BulkDiscountDto } from '../dto/bulk-discount.dto';

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

    // Check course restriction (empty array = global discount)
    if (discount.applicableCourses.length > 0 && !discount.applicableCourses.includes(courseId)) {
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
        applicableCourses: dto.courseIds || [],
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
    if (dto.courseIds !== undefined) updateData.applicableCourses = dto.courseIds;
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

  private buildStatusCondition(status: string) {
    const now = new Date();
    switch (status) {
      case 'active':
        return and(
          eq(discountCodes.isActive, true),
          or(
            isNull(discountCodes.validUntil),
            gt(discountCodes.validUntil, now),
          ),
        );
      case 'expired':
        return and(
          eq(discountCodes.isActive, true),
          lt(discountCodes.validUntil, now),
        );
      case 'disabled':
        return eq(discountCodes.isActive, false);
      default:
        return undefined;
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (status && status !== 'all') {
      const statusCond = this.buildStatusCondition(status);
      if (statusCond) conditions.push(statusCond);
    }
    if (search) {
      conditions.push(ilike(discountCodes.code, `%${search}%`));
    }
    if (startDate) {
      conditions.push(gte(discountCodes.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(discountCodes.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Subquery for total savings per coupon
    const savingsSubquery = db
      .select({
        discountId: discountUsage.discountId,
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`.as('total_saved'),
      })
      .from(discountUsage)
      .groupBy(discountUsage.discountId)
      .as('savings');

    const discounts = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        maxUses: discountCodes.maxUses,
        currentUses: discountCodes.currentUses,
        minOrderAmount: discountCodes.minOrderAmount,
        applicableCourses: discountCodes.applicableCourses,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
        isActive: discountCodes.isActive,
        createdAt: discountCodes.createdAt,
        totalSaved: sql<string>`COALESCE(${savingsSubquery.totalSaved}, '0')`,
      })
      .from(discountCodes)
      .leftJoin(savingsSubquery, eq(discountCodes.id, savingsSubquery.discountId))
      .where(whereClause)
      .orderBy(desc(discountCodes.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(discountCodes)
      .where(whereClause);

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

  async getAnalytics(startDate?: string, endDate?: string) {
    // Build date conditions for usage and invoice queries
    const usageDateConditions: any[] = [];
    const invoiceDateConditions: any[] = [];
    if (startDate) {
      usageDateConditions.push(gte(discountUsage.usedAt, new Date(startDate)));
      invoiceDateConditions.push(gte(invoices.issuedAt, new Date(startDate)));
    }
    if (endDate) {
      usageDateConditions.push(lte(discountUsage.usedAt, new Date(endDate)));
      invoiceDateConditions.push(lte(invoices.issuedAt, new Date(endDate)));
    }

    const usageDateWhere = usageDateConditions.length > 0 ? and(...usageDateConditions) : undefined;
    const invoiceDateWhere = invoiceDateConditions.length > 0 ? and(...invoiceDateConditions) : undefined;

    // Aggregate usage stats
    const [usageStats] = await db
      .select({
        totalRedemptions: count(),
        totalSavings: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`,
      })
      .from(discountUsage)
      .where(usageDateWhere);

    const totalRedemptions = Number(usageStats?.totalRedemptions || 0);
    const totalSavings = Number(usageStats?.totalSavings || 0);
    const avgDiscountPerUse = totalRedemptions > 0 ? totalSavings / totalRedemptions : 0;

    // Revenue lift: compare invoices with discount vs without
    const withCouponConditions = [gt(invoices.discountAmount, sql`0`), ...invoiceDateConditions];
    const [withCouponResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        count: count(),
      })
      .from(invoices)
      .where(and(...withCouponConditions));

    const withoutCouponConditions = [
      or(eq(invoices.discountAmount, sql`0`), isNull(invoices.discountAmount)),
      ...invoiceDateConditions,
    ];
    const [withoutCouponResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        count: count(),
      })
      .from(invoices)
      .where(and(...withoutCouponConditions));

    const withCoupon = Number(withCouponResult?.total || 0);
    const withoutCoupon = Number(withoutCouponResult?.total || 0);
    const withCouponCount = Number(withCouponResult?.count || 0);
    const withoutCouponCount = Number(withoutCouponResult?.count || 0);

    // Avg order value comparison for lift calculation
    const avgWithCoupon = withCouponCount > 0 ? withCoupon / withCouponCount : 0;
    const avgWithoutCoupon = withoutCouponCount > 0 ? withoutCoupon / withoutCouponCount : 0;
    const liftPercentage = avgWithoutCoupon > 0
      ? ((avgWithCoupon - avgWithoutCoupon) / avgWithoutCoupon) * 100
      : 0;

    // Top coupons by conversions (filtered by date range)
    const topCouponJoinConditions: any[] = [eq(discountCodes.id, discountUsage.discountId)];
    if (startDate) topCouponJoinConditions.push(gte(discountUsage.usedAt, new Date(startDate)));
    if (endDate) topCouponJoinConditions.push(lte(discountUsage.usedAt, new Date(endDate)));

    const topCoupons = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        isActive: discountCodes.isActive,
        conversions: count(discountUsage.id),
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`,
      })
      .from(discountCodes)
      .leftJoin(discountUsage, and(...topCouponJoinConditions))
      .groupBy(
        discountCodes.id,
        discountCodes.code,
        discountCodes.type,
        discountCodes.value,
        discountCodes.isActive,
      )
      .orderBy(desc(count(discountUsage.id)))
      .limit(10);

    // Cannibalization: % of coupon users who are repeat buyers
    // (users who had a prior purchase without a coupon)
    let cannibalization = { totalCouponUsers: 0, repeatBuyerCount: 0, rate: 0 };

    const couponUserRows = await db
      .selectDistinct({ userId: discountUsage.userId })
      .from(discountUsage)
      .where(usageDateWhere);

    const couponUserIds = couponUserRows.map((r) => r.userId);
    if (couponUserIds.length > 0) {
      // Count how many of these users had at least one invoice with no discount
      const [repeatResult] = await db
        .select({ count: sql<string>`COUNT(DISTINCT ${invoices.userId})` })
        .from(invoices)
        .where(
          and(
            sql`${invoices.userId} IN (${sql.join(couponUserIds.map((id) => sql`${id}`), sql`, `)})`,
            or(eq(invoices.discountAmount, sql`0`), isNull(invoices.discountAmount)),
          ),
        );

      const repeatBuyerCount = Number(repeatResult?.count || 0);
      cannibalization = {
        totalCouponUsers: couponUserIds.length,
        repeatBuyerCount,
        rate: Math.round((repeatBuyerCount / couponUserIds.length) * 10000) / 100,
      };
    }

    return {
      totalSavings,
      avgDiscountPerUse: Math.round(avgDiscountPerUse * 100) / 100,
      totalRedemptions,
      revenueLift: {
        withCoupon,
        withoutCoupon,
        liftPercentage: Math.round(liftPercentage * 100) / 100,
      },
      cannibalization,
      topCoupons: topCoupons.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: Number(c.value),
        isActive: c.isActive,
        conversions: Number(c.conversions),
        totalSaved: Number(c.totalSaved),
      })),
    };
  }

  async bulkGenerate(dto: BulkDiscountDto, userId: string) {
    const codes: string[] = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = dto.prefix.toUpperCase();

    for (let i = 0; i < dto.count; i++) {
      let suffix = '';
      for (let j = 0; j < 6; j++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codes.push(`${prefix}-${suffix}`);
    }

    const values = codes.map((code) => ({
      code,
      type: dto.type,
      value: dto.value.toFixed(2),
      maxUses: dto.maxUses || null,
      minOrderAmount: dto.minOrderAmount
        ? dto.minOrderAmount.toFixed(2)
        : null,
      applicableCourses: dto.courseIds || [],
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      createdBy: userId,
    }));

    const created = await db
      .insert(discountCodes)
      .values(values)
      .returning({ id: discountCodes.id, code: discountCodes.code });

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: 'bulk',
      action: 'discount_bulk_created',
      performedBy: userId,
      metadata: { prefix, count: dto.count, codes: created.map((c) => c.code) },
    });

    return {
      created: created.length,
      codes: created.map((c) => c.code),
    };
  }

  async exportCsv(status?: string, search?: string, startDate?: string, endDate?: string): Promise<string> {
    const conditions: any[] = [];

    if (status && status !== 'all') {
      const statusCond = this.buildStatusCondition(status);
      if (statusCond) conditions.push(statusCond);
    }
    if (search) {
      conditions.push(ilike(discountCodes.code, `%${search}%`));
    }
    if (startDate) {
      conditions.push(gte(discountCodes.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(discountCodes.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const savingsSubquery = db
      .select({
        discountId: discountUsage.discountId,
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`.as('total_saved'),
      })
      .from(discountUsage)
      .groupBy(discountUsage.discountId)
      .as('savings_export');

    const discounts = await db
      .select({
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        maxUses: discountCodes.maxUses,
        currentUses: discountCodes.currentUses,
        minOrderAmount: discountCodes.minOrderAmount,
        isActive: discountCodes.isActive,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
        createdAt: discountCodes.createdAt,
        totalSaved: sql<string>`COALESCE(${savingsSubquery.totalSaved}, '0')`,
      })
      .from(discountCodes)
      .leftJoin(savingsSubquery, eq(discountCodes.id, savingsSubquery.discountId))
      .where(whereClause)
      .orderBy(desc(discountCodes.createdAt));

    const lines: string[] = [];

    // NELC metadata header
    lines.push(`# PhysioGuidance Platform - Discount Codes Export`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Filters: status=${status || 'all'}, search=${search || 'none'}, startDate=${startDate || 'none'}, endDate=${endDate || 'none'}`);
    lines.push(`# Platform Version: 1.0.0`);
    lines.push('');

    // CSV header
    lines.push('Code,Type,Value,MaxUses,CurrentUses,TotalSaved,MinOrder,Status,ValidFrom,ValidUntil,CreatedAt');

    for (const d of discounts) {
      const now = new Date();
      const validUntil = d.validUntil ? new Date(d.validUntil) : null;
      let computedStatus = 'active';
      if (!d.isActive) computedStatus = 'disabled';
      else if (validUntil && validUntil < now) computedStatus = 'expired';

      lines.push([
        d.code,
        d.type,
        d.value,
        d.maxUses ?? 'unlimited',
        d.currentUses,
        d.totalSaved,
        d.minOrderAmount || '0',
        computedStatus,
        d.validFrom ? new Date(d.validFrom).toISOString().slice(0, 10) : '-',
        d.validUntil ? new Date(d.validUntil).toISOString().slice(0, 10) : '-',
        new Date(d.createdAt).toISOString().slice(0, 10),
      ].join(','));
    }

    return lines.join('\n');
  }

  async getById(discountId: string) {
    // Fetch discount with total saved
    const savingsSubquery = db
      .select({
        discountId: discountUsage.discountId,
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`.as('total_saved_detail'),
      })
      .from(discountUsage)
      .groupBy(discountUsage.discountId)
      .as('savings_detail');

    const [discount] = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        maxUses: discountCodes.maxUses,
        currentUses: discountCodes.currentUses,
        minOrderAmount: discountCodes.minOrderAmount,
        applicableCourses: discountCodes.applicableCourses,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
        isActive: discountCodes.isActive,
        createdBy: discountCodes.createdBy,
        createdAt: discountCodes.createdAt,
        updatedAt: discountCodes.updatedAt,
        totalSaved: sql<string>`COALESCE(${savingsSubquery.totalSaved}, '0')`,
      })
      .from(discountCodes)
      .leftJoin(savingsSubquery, eq(discountCodes.id, savingsSubquery.discountId))
      .where(eq(discountCodes.id, discountId))
      .limit(1);

    if (!discount) {
      throw new NotFoundException('Discount code not found');
    }

    // Recent usage history (last 20)
    const usageHistory = await db
      .select({
        id: discountUsage.id,
        userId: discountUsage.userId,
        email: users.email,
        amountSaved: discountUsage.amountSaved,
        usedAt: discountUsage.usedAt,
      })
      .from(discountUsage)
      .leftJoin(users, eq(discountUsage.userId, users.id))
      .where(eq(discountUsage.discountId, discountId))
      .orderBy(desc(discountUsage.usedAt))
      .limit(20);

    return {
      ...discount,
      usageHistory: usageHistory.map((u) => ({
        id: u.id,
        userId: u.userId,
        email: u.email,
        amountSaved: Number(u.amountSaved),
        usedAt: u.usedAt,
      })),
    };
  }

  async reverseUsage(paymentId: string) {
    // Find discount usage record for this payment
    const [usage] = await db
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.paymentId, paymentId))
      .limit(1);

    if (!usage) {
      // Payment had no discount — nothing to reverse
      return;
    }

    // Decrement currentUses (floor at 0)
    await db
      .update(discountCodes)
      .set({
        currentUses: sql`GREATEST(${discountCodes.currentUses} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(discountCodes.id, usage.discountId));

    // Delete the usage record
    await db
      .delete(discountUsage)
      .where(eq(discountUsage.id, usage.id));

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: usage.discountId,
      action: 'discount_usage_reversed',
      performedBy: 'system',
      metadata: { paymentId, amountSaved: usage.amountSaved },
    });

    this.logger.log(`Reversed discount usage for payment ${paymentId}, discount ${usage.discountId}`);
  }
}
