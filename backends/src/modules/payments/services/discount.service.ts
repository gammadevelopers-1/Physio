import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, count, sql, ilike, or, gte, lte, isNull, gt, lt, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../../database';
import {
  discountCodes,
  discountUsage,
  discountCodeBatches,
  couponCampaigns,
  invoices,
  payments,
  users,
  courses,
  auditLogs,
  enrollments,
} from '../../../database/schema';
import { parseStartDate, parseEndDate } from '../../../common/date-range';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { BulkDiscountDto } from '../dto/bulk-discount.dto';
import { SetCourseSaleDto } from '../dto/set-course-sale.dto';
import { getEffectivePrice } from '../../courses/pricing.util';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  // ── Course-level sales (finance-managed; no coupon required) ──────────────
  // Sales live on the course row but are owned by the finance dashboard, not
  // the course editor. List + set/clear here, audited like other finance ops.

  async listCourseSales(search?: string) {
    // Only show courses that are currently open for public enrollment.
    // A sale on a closed/full/ended course is dead weight in the dashboard
    // and risks finance setting promos that never apply. Filter:
    //   • status = 'active' (publishable; excludes draft/pending/archived/completed)
    //   • soft-delete clear
    //   • enrollment deadline not yet passed (or unset)
    //   • end date not yet passed (or unset)
    //   • not full — checked in JS against enrolled count vs maxEnrollment
    //     (NULL maxEnrollment means uncapped, never full)
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);

    const conditions: any[] = [
      isNull(courses.deletedAt),
      eq(courses.status, 'active'),
      or(
        isNull(courses.enrollmentDeadline),
        gt(courses.enrollmentDeadline, now),
      )!,
      or(isNull(courses.endDate), gte(courses.endDate, todayISO))!,
    ];
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(courses.title, q), ilike(courses.titleAr, q))!);
    }

    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        thumbnail: courses.thumbnail,
        status: courses.status,
        price: courses.price,
        salePercent: courses.salePercent,
        saleStartsAt: courses.saleStartsAt,
        saleEndsAt: courses.saleEndsAt,
        saleAllowsCoupon: courses.saleAllowsCoupon,
        maxEnrollment: courses.maxEnrollment,
        enrolledCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM enrollments WHERE enrollments.course_id = courses.id AND enrollments.status <> 'dropped'), 0)`,
      })
      .from(courses)
      .where(and(...conditions))
      .orderBy(desc(courses.createdAt));

    return rows
      .filter((c) => {
        // Exclude courses that have reached their seat cap. NULL = uncapped.
        if (c.maxEnrollment == null) return true;
        return c.enrolledCount < c.maxEnrollment;
      })
      .map((c) => {
        const sale = getEffectivePrice(c, now);
        return {
          id: c.id,
          title: c.title,
          titleAr: c.titleAr,
          thumbnail: c.thumbnail,
          status: c.status,
          price: sale.originalPrice,
          effectivePrice: sale.effectivePrice,
          onSale: sale.onSale,
          salePercent: c.salePercent,
          saleStartsAt: c.saleStartsAt ? c.saleStartsAt.toISOString() : null,
          saleEndsAt: c.saleEndsAt ? c.saleEndsAt.toISOString() : null,
          saleAllowsCoupon: c.saleAllowsCoupon,
        };
      });
  }

  async setCourseSale(courseId: string, dto: SetCourseSaleDto, userId: string) {
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .limit(1);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Only provided fields change; null clears. (whitelist strips by name, so a
    // null value still reaches us here.)
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.salePercent !== undefined) updateData.salePercent = dto.salePercent;
    if (dto.saleStartsAt !== undefined)
      updateData.saleStartsAt = dto.saleStartsAt ? new Date(dto.saleStartsAt) : null;
    if (dto.saleEndsAt !== undefined)
      updateData.saleEndsAt = dto.saleEndsAt ? new Date(dto.saleEndsAt) : null;
    if (dto.saleAllowsCoupon !== undefined)
      updateData.saleAllowsCoupon = dto.saleAllowsCoupon;

    // Validate the RESULTING window order (merge incoming with existing) so a
    // bad range returns a clean 400 instead of tripping the DB CHECK as a 500.
    const finalStart =
      updateData.saleStartsAt !== undefined
        ? updateData.saleStartsAt
        : course.saleStartsAt;
    const finalEnd =
      updateData.saleEndsAt !== undefined
        ? updateData.saleEndsAt
        : course.saleEndsAt;
    if (finalStart && finalEnd && new Date(finalEnd) <= new Date(finalStart)) {
      throw new BadRequestException('Sale end must be after the sale start');
    }

    const [updated] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, courseId))
      .returning();

    await this.auditLogService.log({
      entityType: 'course',
      entityId: courseId,
      action: 'course_sale_updated',
      performedBy: userId,
      metadata: {
        salePercent: updated.salePercent,
        saleStartsAt: updated.saleStartsAt,
        saleEndsAt: updated.saleEndsAt,
        saleAllowsCoupon: updated.saleAllowsCoupon,
      },
    });

    const sale = getEffectivePrice(updated);
    return {
      id: updated.id,
      title: updated.title,
      titleAr: updated.titleAr,
      thumbnail: updated.thumbnail,
      status: updated.status,
      price: sale.originalPrice,
      effectivePrice: sale.effectivePrice,
      onSale: sale.onSale,
      salePercent: updated.salePercent,
      saleStartsAt: updated.saleStartsAt
        ? updated.saleStartsAt.toISOString()
        : null,
      saleEndsAt: updated.saleEndsAt ? updated.saleEndsAt.toISOString() : null,
      saleAllowsCoupon: updated.saleAllowsCoupon,
    };
  }

  async validateDiscount(
    code: string,
    courseId: string,
    userId: string,
    coursePrice: number,
    opts?: { ipAddress?: string },
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

    const fail = async (error: string) => {
      // Write failed validation to the audit trail so finance can spot
      // brute-force fraud / abuse patterns. Best-effort; never blocks
      // the user-facing response.
      try {
        await this.auditLogService.log({
          entityType: 'discount',
          entityId: discount?.id || 'unknown',
          action: 'discount_validation_failed',
          performedBy: userId,
          ipAddress: opts?.ipAddress,
          metadata: { code: code.toUpperCase(), courseId, coursePrice, error },
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed to audit failed validation: ${err?.message || err}`,
        );
      }
      return { valid: false, discountAmount: 0, discountId: null, error };
    };

    if (!discount) {
      return fail('Discount code not found');
    }

    // Check validity period
    const now = new Date();
    if (discount.validFrom && new Date(discount.validFrom) > now) {
      return fail('Discount code is not yet active');
    }
    if (discount.validUntil && new Date(discount.validUntil) < now) {
      return fail('Discount code has expired');
    }

    // Check parent campaign (if attached) — auto-deactivates child codes
    // when campaign ends or hits budget. No cron needed; checked here.
    if (discount.campaignId) {
      const [campaign] = await db
        .select({
          id: couponCampaigns.id,
          isActive: couponCampaigns.isActive,
          endsAt: couponCampaigns.endsAt,
          budget: couponCampaigns.budget,
          currentSpend: couponCampaigns.currentSpend,
        })
        .from(couponCampaigns)
        .where(eq(couponCampaigns.id, discount.campaignId))
        .limit(1);
      if (!campaign || !campaign.isActive) {
        return fail('Discount code campaign is not active');
      }
      if (campaign.endsAt && new Date(campaign.endsAt) < now) {
        return fail('Discount code campaign has ended');
      }
      if (
        campaign.budget !== null &&
        Number(campaign.currentSpend) >= Number(campaign.budget)
      ) {
        return fail('Discount code campaign budget has been used up');
      }
    }

    // Check max uses
    if (
      discount.maxUses !== null &&
      discount.currentUses >= discount.maxUses
    ) {
      return fail('Discount code has reached its maximum usage limit');
    }

    // Check course restriction (empty array = global discount)
    if (discount.applicableCourses.length > 0 && !discount.applicableCourses.includes(courseId)) {
      return fail('Discount code is not valid for this course');
    }

    // Check min order amount
    if (
      discount.minOrderAmount &&
      coursePrice < Number(discount.minOrderAmount)
    ) {
      return fail(`Minimum order amount is SAR ${discount.minOrderAmount}`);
    }

    // Check per-user usage limit (configurable; NULL column = unlimited per user)
    if (
      discount.maxUsesPerUser !== null &&
      discount.maxUsesPerUser !== undefined
    ) {
      const [{ used }] = await db
        .select({ used: count() })
        .from(discountUsage)
        .where(
          and(
            eq(discountUsage.discountId, discount.id),
            eq(discountUsage.userId, userId),
          ),
        );
      if (Number(used) >= discount.maxUsesPerUser) {
        return fail(
          'You have already used this discount code the maximum number of times',
        );
      }
    }

    // Calculate discount amount
    let discountAmount: number;
    if (discount.type === 'percentage') {
      discountAmount = (coursePrice * Number(discount.value)) / 100;
    } else {
      discountAmount = Number(discount.value);
    }

    // Cap at course price first
    discountAmount = Math.min(discountAmount, coursePrice);

    // Apply per-course safety cap (`maxDiscountPct`). Defaults to 100
    // (= no cap) so existing courses behave unchanged.
    const [courseRow] = await db
      .select({ maxDiscountPct: courses.maxDiscountPct })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    const maxPct = Number(courseRow?.maxDiscountPct ?? 100);
    if (maxPct < 100) {
      const capAbsolute = (coursePrice * maxPct) / 100;
      discountAmount = Math.min(discountAmount, capAbsolute);
    }

    // Round to 2 decimals so the SAME value flows into the VAT base,
    // the persisted invoice, and amountSaved (no ~0.01 SAR drift).
    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      discountAmount,
      discountId: discount.id,
    };
  }

  /**
   * Return the single best auto-apply discount for a given cart, or null.
   * Used by the public checkout to surface early-bird savings without the
   * buyer needing to type a code. Picks the discount with the highest
   * absolute savings on the cart's largest line.
   *
   * Honours validity windows, per-user caps, max-uses, campaign state,
   * and the per-course `maxDiscountPct` cap. Falls back to null if no
   * eligible discount exists.
   */
  async getBestAutoApplyDiscount(
    courseIds: string[],
    userId: string | null,
  ): Promise<{
    code: string;
    discountId: string;
    discountAmount: number;
    applicableCourseId: string;
    campaign: { id: string; name: string } | null;
  } | null> {
    if (courseIds.length === 0) return null;

    const now = new Date();

    // Pull all currently-active auto-apply codes. Set is small (early-bird
    // codes are scarce), so we filter in memory by course-scope and per-
    // user caps. Avoids a heavy JOIN.
    const codes = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.autoApply, true),
          eq(discountCodes.isActive, true),
          or(
            isNull(discountCodes.validFrom),
            lte(discountCodes.validFrom, now),
          )!,
          or(
            isNull(discountCodes.validUntil),
            gte(discountCodes.validUntil, now),
          )!,
        ),
      );
    if (codes.length === 0) return null;

    // Fetch cart courses (id, price, maxDiscountPct) in one go.
    const cartCourses = await db
      .select({
        id: courses.id,
        price: courses.price,
        maxDiscountPct: courses.maxDiscountPct,
        salePercent: courses.salePercent,
        saleStartsAt: courses.saleStartsAt,
        saleEndsAt: courses.saleEndsAt,
        saleAllowsCoupon: courses.saleAllowsCoupon,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));
    if (cartCourses.length === 0) return null;

    // Fetch any attached campaigns in one go.
    const campaignIds = codes
      .map((c) => c.campaignId)
      .filter((x): x is string => !!x);
    const campaigns = campaignIds.length
      ? await db
          .select()
          .from(couponCampaigns)
          .where(inArray(couponCampaigns.id, campaignIds))
      : [];
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));

    let best: {
      code: string;
      discountId: string;
      discountAmount: number;
      applicableCourseId: string;
      campaign: { id: string; name: string } | null;
    } | null = null;

    for (const code of codes) {
      // Campaign gate
      if (code.campaignId) {
        const camp = campaignById.get(code.campaignId);
        if (!camp || !camp.isActive) continue;
        if (camp.endsAt && new Date(camp.endsAt) < now) continue;
        if (
          camp.budget !== null &&
          Number(camp.currentSpend) >= Number(camp.budget)
        ) {
          continue;
        }
      }

      // Global max-uses gate
      if (code.maxUses !== null && code.currentUses >= code.maxUses) continue;

      // Per-user cap gate (only when we have a user)
      if (
        userId &&
        code.maxUsesPerUser !== null &&
        code.maxUsesPerUser !== undefined
      ) {
        const [{ used }] = await db
          .select({ used: count() })
          .from(discountUsage)
          .where(
            and(
              eq(discountUsage.discountId, code.id),
              eq(discountUsage.userId, userId),
            ),
          );
        if (Number(used) >= code.maxUsesPerUser) continue;
      }

      // Pick the best matching line in the cart. Course-scoped codes can
      // only apply to scoped courses; global codes can apply to any line.
      const eligibleLines =
        code.applicableCourses.length > 0
          ? cartCourses.filter((c) => code.applicableCourses.includes(c.id))
          : cartCourses;
      if (eligibleLines.length === 0) continue;

      for (const line of eligibleLines) {
        const effective = getEffectivePrice(line, now);
        const linePrice = effective.effectivePrice;
        // Sales + coupons mutually exclusive unless flagged
        if (effective.onSale && !line.saleAllowsCoupon) continue;
        if (linePrice <= 0) continue;
        if (
          code.minOrderAmount &&
          linePrice < Number(code.minOrderAmount)
        ) {
          continue;
        }

        let amount =
          code.type === 'percentage'
            ? (linePrice * Number(code.value)) / 100
            : Number(code.value);
        amount = Math.min(amount, linePrice);
        const maxPct = Number(line.maxDiscountPct ?? 100);
        if (maxPct < 100) amount = Math.min(amount, (linePrice * maxPct) / 100);
        amount = Math.round(amount * 100) / 100;
        if (amount <= 0) continue;

        if (!best || amount > best.discountAmount) {
          best = {
            code: code.code,
            discountId: code.id,
            discountAmount: amount,
            applicableCourseId: line.id,
            campaign: code.campaignId
              ? {
                  id: code.campaignId,
                  name: campaignById.get(code.campaignId)?.name || '',
                }
              : null,
          };
        }
      }
    }

    return best;
  }

  async recordUsage(
    discountId: string,
    userId: string,
    paymentId: string,
    amountSaved: number,
  ) {
    await db.transaction(async (tx) => {
      // Lock the coupon row so concurrent redemptions serialise on it — enforces
      // BOTH the global and per-user caps atomically (fixes the race where two
      // concurrent checkouts by the same user both slip past the validate check).
      const [discount] = await tx
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.id, discountId))
        .for('update')
        .limit(1);

      if (!discount) {
        throw new BadRequestException('Discount code not found');
      }

      // Idempotency: a duplicate webhook for the SAME payment must not
      // double-count (the unique index also guards this).
      const [already] = await tx
        .select({ id: discountUsage.id })
        .from(discountUsage)
        .where(
          and(
            eq(discountUsage.discountId, discountId),
            eq(discountUsage.paymentId, paymentId),
          ),
        )
        .limit(1);
      if (already) return;

      // Global usage cap
      if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
        throw new BadRequestException(
          'Discount code has reached its maximum usage limit',
        );
      }

      // Per-user usage cap (NULL = unlimited per user)
      if (
        discount.maxUsesPerUser !== null &&
        discount.maxUsesPerUser !== undefined
      ) {
        const [{ used }] = await tx
          .select({ used: count() })
          .from(discountUsage)
          .where(
            and(
              eq(discountUsage.discountId, discountId),
              eq(discountUsage.userId, userId),
            ),
          );
        if (Number(used) >= discount.maxUsesPerUser) {
          throw new BadRequestException(
            'You have already used this discount code the maximum number of times',
          );
        }
      }

      // Record usage + bump the global counter atomically inside the tx.
      await tx.insert(discountUsage).values({
        discountId,
        userId,
        paymentId,
        amountSaved: amountSaved.toFixed(2),
      });
      await tx
        .update(discountCodes)
        .set({
          currentUses: sql`${discountCodes.currentUses} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(discountCodes.id, discountId));

      // If this code belongs to a campaign, bump its currentSpend so
      // budget enforcement stays accurate across all child codes.
      if (discount.campaignId) {
        await tx
          .update(couponCampaigns)
          .set({
            currentSpend: sql`${couponCampaigns.currentSpend} + ${amountSaved.toFixed(2)}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(couponCampaigns.id, discount.campaignId));
      }
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
    if (dto.type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

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
        maxUsesPerUser: dto.maxUsesPerUser ?? 1,
        campaign: dto.campaign?.trim() || null,
        campaignId: (dto as { campaignId?: string }).campaignId || null,
        autoApply: (dto as { autoApply?: boolean }).autoApply ?? false,
        earlyBird: (dto as { earlyBird?: boolean }).earlyBird ?? false,
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

    // Percentage cap, evaluated against the effective (post-update) type/value.
    const effectiveType = dto.type ?? existing.type;
    const effectiveValue = dto.value ?? Number(existing.value);
    if (effectiveType === 'percentage' && effectiveValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const updateData: any = { updatedAt: new Date() };
    if (dto.code !== undefined) updateData.code = dto.code.toUpperCase();
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.value !== undefined) updateData.value = dto.value.toFixed(2);
    if (dto.maxUses !== undefined) updateData.maxUses = dto.maxUses;
    if (dto.maxUsesPerUser !== undefined)
      updateData.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.campaign !== undefined)
      updateData.campaign = dto.campaign?.trim() || null;
    if (dto.minOrderAmount !== undefined)
      updateData.minOrderAmount = dto.minOrderAmount?.toFixed(2) || null;
    if (dto.courseIds !== undefined) updateData.applicableCourses = dto.courseIds;
    if (dto.validFrom !== undefined)
      updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined)
      updateData.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    const anyDto = dto as {
      campaignId?: string | null;
      autoApply?: boolean;
      earlyBird?: boolean;
    };
    if (anyDto.campaignId !== undefined) updateData.campaignId = anyDto.campaignId;
    if (anyDto.autoApply !== undefined) updateData.autoApply = anyDto.autoApply;
    if (anyDto.earlyBird !== undefined) updateData.earlyBird = anyDto.earlyBird;

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

    // Hard delete. `discount_usage` cascades via FK, so any redemption
    // history is removed with the code (audit_logs are NOT cascaded —
    // they remain for compliance).
    await db.delete(discountCodes).where(eq(discountCodes.id, discountId));

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: discountId,
      action: 'discount_deleted',
      performedBy: userId,
      metadata: { code: existing.code, hardDelete: true },
    });

    return { deleted: true };
  }

  private buildStatusCondition(status: string) {
    const now = new Date();
    switch (status) {
      case 'active':
        // Active = enabled + within validity window + still has uses left.
        // A code that's hit its max uses is functionally expired even
        // though `isActive` is still true.
        return and(
          eq(discountCodes.isActive, true),
          or(
            isNull(discountCodes.validUntil),
            gt(discountCodes.validUntil, now),
          ),
          or(
            isNull(discountCodes.maxUses),
            sql`${discountCodes.currentUses} < ${discountCodes.maxUses}`,
          ),
        );
      case 'expired':
        // Expired = enabled but past the validity window OR fully used.
        return and(
          eq(discountCodes.isActive, true),
          or(
            lt(discountCodes.validUntil, now),
            sql`${discountCodes.maxUses} IS NOT NULL AND ${discountCodes.currentUses} >= ${discountCodes.maxUses}`,
          ),
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
    extra: {
      type?: 'percentage' | 'fixed';
      autoApply?: boolean;
      earlyBird?: boolean;
      campaignId?: string;
      scope?: 'all' | 'global' | 'course';
    } = {},
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
      conditions.push(gte(discountCodes.createdAt, parseStartDate(startDate)!));
    }
    if (endDate) {
      conditions.push(lte(discountCodes.createdAt, parseEndDate(endDate)!));
    }
    if (extra.type) {
      conditions.push(eq(discountCodes.type, extra.type));
    }
    if (extra.autoApply !== undefined) {
      conditions.push(eq(discountCodes.autoApply, extra.autoApply));
    }
    if (extra.earlyBird !== undefined) {
      conditions.push(eq(discountCodes.earlyBird, extra.earlyBird));
    }
    if (extra.campaignId) {
      conditions.push(eq(discountCodes.campaignId, extra.campaignId));
    }
    if (extra.scope === 'global') {
      conditions.push(sql`array_length(${discountCodes.applicableCourses}, 1) IS NULL`);
    } else if (extra.scope === 'course') {
      conditions.push(sql`array_length(${discountCodes.applicableCourses}, 1) > 0`);
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
        campaign: discountCodes.campaign,
        campaignId: discountCodes.campaignId,
        autoApply: discountCodes.autoApply,
        earlyBird: discountCodes.earlyBird,
        batchId: discountCodes.batchId,
        maxUsesPerUser: discountCodes.maxUsesPerUser,
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
      usageDateConditions.push(gte(discountUsage.usedAt, parseStartDate(startDate)!));
      invoiceDateConditions.push(gte(invoices.issuedAt, parseStartDate(startDate)!));
    }
    if (endDate) {
      usageDateConditions.push(lte(discountUsage.usedAt, parseEndDate(endDate)!));
      invoiceDateConditions.push(lte(invoices.issuedAt, parseEndDate(endDate)!));
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
    const withCouponConditions = [
      gt(invoices.discountAmount, sql`0`),
      sql`${invoices.status} NOT IN ('refunded', 'cancelled')`,
      ...invoiceDateConditions,
    ];
    const [withCouponResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        count: count(),
      })
      .from(invoices)
      .where(and(...withCouponConditions));

    const withoutCouponConditions = [
      or(eq(invoices.discountAmount, sql`0`), isNull(invoices.discountAmount)),
      sql`${invoices.status} NOT IN ('refunded', 'cancelled')`,
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
    if (startDate) topCouponJoinConditions.push(gte(discountUsage.usedAt, parseStartDate(startDate)!));
    if (endDate) topCouponJoinConditions.push(lte(discountUsage.usedAt, parseEndDate(endDate)!));

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

  /**
   * Per-campaign rollup for promotional-campaign reporting. Includes disabled
   * codes so historical campaign totals are not silently dropped.
   */
  async getCampaignReport(startDate?: string, endDate?: string) {
    const joinConds: any[] = [eq(discountCodes.id, discountUsage.discountId)];
    if (startDate) joinConds.push(gte(discountUsage.usedAt, parseStartDate(startDate)!));
    if (endDate) joinConds.push(lte(discountUsage.usedAt, parseEndDate(endDate)!));

    const rows = await db
      .select({
        campaign: discountCodes.campaign,
        codeCount: sql<string>`COUNT(DISTINCT ${discountCodes.id})`,
        totalRedemptions: count(discountUsage.id),
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}), 0)`,
      })
      .from(discountCodes)
      .leftJoin(discountUsage, and(...joinConds))
      .where(isNotNull(discountCodes.campaign))
      .groupBy(discountCodes.campaign)
      .orderBy(desc(sql`COALESCE(SUM(${discountUsage.amountSaved}), 0)`));

    return rows.map((r) => ({
      campaign: r.campaign,
      codeCount: Number(r.codeCount),
      totalRedemptions: Number(r.totalRedemptions),
      totalSaved: Number(r.totalSaved),
    }));
  }

  async bulkGenerate(dto: BulkDiscountDto, userId: string) {
    if (dto.type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = dto.prefix.toUpperCase();
    const gen = () => {
      let suffix = '';
      for (let j = 0; j < 6; j++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${prefix}-${suffix}`;
    };

    // Generate in-batch-unique codes (Set), then drop any that already exist in
    // the DB — so a single collision can't crash the whole batch.
    const wanted = new Set<string>();
    let guard = 0;
    while (wanted.size < dto.count && guard < dto.count * 50) {
      wanted.add(gen());
      guard++;
    }
    let candidates = Array.from(wanted);
    if (candidates.length > 0) {
      const existingRows = await db
        .select({ code: discountCodes.code })
        .from(discountCodes)
        .where(inArray(discountCodes.code, candidates));
      const taken = new Set(existingRows.map((r) => r.code));
      candidates = candidates.filter((c) => !taken.has(c));
    }

    const anyDto = dto as {
      campaignId?: string;
      autoApply?: boolean;
      earlyBird?: boolean;
    };

    // Record the batch first so we have an id to link generated codes back to.
    // Codes link via `batch_id` — lets the dashboard show per-batch redemption
    // rates without aggregating on the prefix string (prefixes can collide
    // across different campaigns).
    const [batch] = await db
      .insert(discountCodeBatches)
      .values({
        prefix,
        requestedCount: dto.count,
        createdCount: 0, // updated after insert
        type: dto.type,
        value: dto.value.toFixed(2),
        maxUses: dto.maxUses ?? 1,
        maxUsesPerUser: dto.maxUsesPerUser ?? 1,
        campaignId: anyDto.campaignId || null,
        campaignLabel: dto.campaign?.trim() || prefix,
        minOrderAmount: dto.minOrderAmount
          ? dto.minOrderAmount.toFixed(2)
          : null,
        applicableCourses: dto.courseIds || [],
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        earlyBird: anyDto.earlyBird ?? false,
        autoApply: anyDto.autoApply ?? false,
        createdBy: userId,
      })
      .returning();

    // Auto-create a campaign for every bulk batch that doesn't already
    // have one. Lets finance treat the batch as a unit (track total
    // savings, set a budget cap, end it early) without manually creating
    // a campaign first. The `bulk_batch_id` link + "Bulk: <prefix>" name
    // pattern make it discoverable on the Campaigns tab.
    let effectiveCampaignId = anyDto.campaignId || null;
    if (!effectiveCampaignId) {
      const [autoCampaign] = await db
        .insert(couponCampaigns)
        .values({
          name: `Bulk: ${prefix}`,
          description: `Auto-created from bulk-generation batch (${dto.count} codes${
            dto.validUntil ? `, expires ${new Date(dto.validUntil).toISOString().slice(0, 10)}` : ''
          })`,
          startsAt: dto.validFrom ? new Date(dto.validFrom) : new Date(),
          endsAt: dto.validUntil ? new Date(dto.validUntil) : null,
          budget: null,
          isActive: true,
          showOnSite: false,
          bulkBatchId: batch.id,
          createdBy: userId,
        })
        .returning();
      effectiveCampaignId = autoCampaign.id;

      // Backfill the batch row with the auto-created campaign id so the
      // batches table can cross-link.
      await db
        .update(discountCodeBatches)
        .set({ campaignId: autoCampaign.id })
        .where(eq(discountCodeBatches.id, batch.id));
    }

    const values = candidates.map((code) => ({
      code,
      type: dto.type,
      value: dto.value.toFixed(2),
      // Bulk codes are unique single-distribution codes: default to one use each
      // unless overridden (so a leaked code isn't unlimited-use).
      maxUses: dto.maxUses ?? 1,
      maxUsesPerUser: dto.maxUsesPerUser ?? 1,
      // Group the batch under its campaign (falls back to the prefix).
      campaign: dto.campaign?.trim() || prefix,
      campaignId: effectiveCampaignId,
      autoApply: anyDto.autoApply ?? false,
      earlyBird: anyDto.earlyBird ?? false,
      batchId: batch.id,
      minOrderAmount: dto.minOrderAmount
        ? dto.minOrderAmount.toFixed(2)
        : null,
      applicableCourses: dto.courseIds || [],
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      createdBy: userId,
    }));

    // onConflictDoNothing makes any residual race a no-op rather than a 500.
    const created = values.length
      ? await db
          .insert(discountCodes)
          .values(values)
          .onConflictDoNothing({ target: discountCodes.code })
          .returning({ id: discountCodes.id, code: discountCodes.code })
      : [];

    // Patch the actual created count on the batch row
    await db
      .update(discountCodeBatches)
      .set({ createdCount: created.length })
      .where(eq(discountCodeBatches.id, batch.id));

    await this.auditLogService.log({
      entityType: 'discount_code',
      entityId: batch.id,
      action: 'discount_bulk_created',
      performedBy: userId,
      metadata: {
        batchId: batch.id,
        prefix,
        count: dto.count,
        created: created.length,
      },
    });

    return {
      batchId: batch.id,
      created: created.length,
      codes: created.map((c) => c.code),
    };
  }

  // ─── Batches ───────────────────────────────────────────────────────

  /**
   * Paginated list of bulk-generation batches with per-batch redemption
   * stats. Powers the "Batches" sub-table inside the Codes tab.
   */
  async listBatches(opts: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 20));
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: discountCodeBatches.id,
        prefix: discountCodeBatches.prefix,
        requestedCount: discountCodeBatches.requestedCount,
        createdCount: discountCodeBatches.createdCount,
        type: discountCodeBatches.type,
        value: discountCodeBatches.value,
        campaignLabel: discountCodeBatches.campaignLabel,
        campaignId: discountCodeBatches.campaignId,
        earlyBird: discountCodeBatches.earlyBird,
        autoApply: discountCodeBatches.autoApply,
        validUntil: discountCodeBatches.validUntil,
        createdAt: discountCodeBatches.createdAt,
        redeemed: sql<number>`COALESCE((SELECT SUM(discount_codes.current_uses)::int FROM discount_codes WHERE discount_codes.batch_id = discount_code_batches.id), 0)`,
        totalSaved: sql<string>`COALESCE((SELECT SUM(discount_usage.amount_saved) FROM discount_usage JOIN discount_codes ON discount_codes.id = discount_usage.discount_id WHERE discount_codes.batch_id = discount_code_batches.id), 0)`,
      })
      .from(discountCodeBatches)
      .orderBy(desc(discountCodeBatches.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(discountCodeBatches);

    return {
      data: rows.map((r) => ({
        id: r.id,
        prefix: r.prefix,
        requestedCount: r.requestedCount,
        createdCount: r.createdCount,
        type: r.type,
        value: Number(r.value),
        campaignLabel: r.campaignLabel,
        campaignId: r.campaignId,
        earlyBird: r.earlyBird,
        autoApply: r.autoApply,
        validUntil: r.validUntil,
        createdAt: r.createdAt,
        redeemed: r.redeemed,
        totalSaved: Number(r.totalSaved),
      })),
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit) || 1,
      },
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
      conditions.push(gte(discountCodes.createdAt, parseStartDate(startDate)!));
    }
    if (endDate) {
      conditions.push(lte(discountCodes.createdAt, parseEndDate(endDate)!));
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
        maxUsesPerUser: discountCodes.maxUsesPerUser,
        currentUses: discountCodes.currentUses,
        minOrderAmount: discountCodes.minOrderAmount,
        campaign: discountCodes.campaign,
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

    // CSV cell escaper: quote when needed + neutralise spreadsheet formula injection.
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    // CSV header
    lines.push('Code,Type,Value,MaxUses,PerUserLimit,CurrentUses,TotalSaved,MinOrder,Campaign,Status,ValidFrom,ValidUntil,CreatedAt');

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
        d.maxUsesPerUser ?? 'unlimited',
        d.currentUses,
        d.totalSaved,
        d.minOrderAmount || '0',
        d.campaign || '-',
        computedStatus,
        d.validFrom ? new Date(d.validFrom).toISOString().slice(0, 10) : '-',
        d.validUntil ? new Date(d.validUntil).toISOString().slice(0, 10) : '-',
        new Date(d.createdAt).toISOString().slice(0, 10),
      ].map(esc).join(','));
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
        campaign: discountCodes.campaign,
        campaignId: discountCodes.campaignId,
        autoApply: discountCodes.autoApply,
        earlyBird: discountCodes.earlyBird,
        batchId: discountCodes.batchId,
        maxUsesPerUser: discountCodes.maxUsesPerUser,
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

    // Resolve parent campaign (if any) so we can decrement spend.
    const [code] = await db
      .select({ campaignId: discountCodes.campaignId })
      .from(discountCodes)
      .where(eq(discountCodes.id, usage.discountId))
      .limit(1);

    // Decrement currentUses (floor at 0)
    await db
      .update(discountCodes)
      .set({
        currentUses: sql`GREATEST(${discountCodes.currentUses} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(discountCodes.id, usage.discountId));

    // Decrement campaign spend if applicable (floor at 0)
    if (code?.campaignId) {
      await db
        .update(couponCampaigns)
        .set({
          currentSpend: sql`GREATEST(${couponCampaigns.currentSpend} - ${usage.amountSaved}::numeric, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(couponCampaigns.id, code.campaignId));
    }

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

  // ─── Campaigns CRUD ─────────────────────────────────────────────────

  async listCampaigns(opts: {
    status?: 'active' | 'expired' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const status = opts.status || 'all';
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (status === 'active') {
      conditions.push(eq(couponCampaigns.isActive, true));
      conditions.push(
        or(
          isNull(couponCampaigns.endsAt),
          gte(couponCampaigns.endsAt, new Date()),
        )!,
      );
    } else if (status === 'expired') {
      conditions.push(
        or(
          eq(couponCampaigns.isActive, false),
          lt(couponCampaigns.endsAt, new Date()),
        )!,
      );
    }
    if (opts.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      conditions.push(ilike(couponCampaigns.name, q));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: couponCampaigns.id,
        name: couponCampaigns.name,
        description: couponCampaigns.description,
        startsAt: couponCampaigns.startsAt,
        endsAt: couponCampaigns.endsAt,
        budget: couponCampaigns.budget,
        currentSpend: couponCampaigns.currentSpend,
        isActive: couponCampaigns.isActive,
        showOnSite: couponCampaigns.showOnSite,
        bannerCta: couponCampaigns.bannerCta,
        bulkBatchId: couponCampaigns.bulkBatchId,
        createdAt: couponCampaigns.createdAt,
        // Raw SQL with explicit table names — drizzle's template embedding
        // of column references inside a correlated subquery doesn't reliably
        // resolve the outer-scope row, leaving the count at 0 even when
        // child codes exist. Spelling out the column names sidesteps that.
        codeCount: sql<number>`(SELECT COUNT(*) FROM discount_codes WHERE discount_codes.campaign_id = coupon_campaigns.id)::int`,
      })
      .from(couponCampaigns)
      .where(where)
      .orderBy(desc(couponCampaigns.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(couponCampaigns)
      .where(where);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit) || 1,
      },
    };
  }

  async createCampaign(
    dto: {
      name: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      budget?: number;
      showOnSite?: boolean;
      bannerCta?: string;
    },
    userId: string,
    ipAddress?: string,
  ) {
    const [created] = await db
      .insert(couponCampaigns)
      .values({
        name: dto.name,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        budget: dto.budget !== undefined ? dto.budget.toFixed(2) : null,
        showOnSite: dto.showOnSite ?? false,
        bannerCta: dto.bannerCta,
        createdBy: userId,
      })
      .returning();

    await this.auditLogService.log({
      entityType: 'coupon_campaign',
      entityId: created.id,
      action: 'campaign_created',
      performedBy: userId,
      ipAddress,
      metadata: { name: dto.name, budget: dto.budget },
    });

    return created;
  }

  async updateCampaign(
    id: string,
    dto: Partial<{
      name: string;
      description: string | null;
      startsAt: string | null;
      endsAt: string | null;
      budget: number | null;
      isActive: boolean;
      showOnSite: boolean;
      bannerCta: string | null;
    }>,
    userId: string,
    ipAddress?: string,
  ) {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.startsAt !== undefined)
      updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      updates.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.budget !== undefined)
      updates.budget = dto.budget === null ? null : dto.budget.toFixed(2);
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.showOnSite !== undefined) updates.showOnSite = dto.showOnSite;
    if (dto.bannerCta !== undefined) updates.bannerCta = dto.bannerCta;

    const [updated] = await db
      .update(couponCampaigns)
      .set(updates)
      .where(eq(couponCampaigns.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException('Campaign not found');
    }

    await this.auditLogService.log({
      entityType: 'coupon_campaign',
      entityId: id,
      action: 'campaign_updated',
      performedBy: userId,
      ipAddress,
      metadata: { updates: Object.keys(updates) },
    });

    return updated;
  }

  async deleteCampaign(id: string, userId: string, ipAddress?: string) {
    // Hard delete + cascade-clear: detach all child codes (set their
    // campaign_id to NULL) so the megaphone/campaign chip stops showing
    // on the code rows and Early-Bird cards. Audit logs are preserved.
    const detached = await db
      .update(discountCodes)
      .set({ campaignId: null, updatedAt: new Date() })
      .where(eq(discountCodes.campaignId, id))
      .returning({ id: discountCodes.id });

    const [deletedRow] = await db
      .delete(couponCampaigns)
      .where(eq(couponCampaigns.id, id))
      .returning({ id: couponCampaigns.id });

    if (!deletedRow) {
      throw new NotFoundException('Campaign not found');
    }

    await this.auditLogService.log({
      entityType: 'coupon_campaign',
      entityId: id,
      action: 'campaign_deleted',
      performedBy: userId,
      ipAddress,
      metadata: { detachedCodeCount: detached.length },
    });

    return { id, deleted: true, detachedCodeCount: detached.length };
  }

  async getCampaignById(id: string) {
    const [campaign] = await db
      .select()
      .from(couponCampaigns)
      .where(eq(couponCampaigns.id, id))
      .limit(1);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const codes = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        currentUses: discountCodes.currentUses,
        maxUses: discountCodes.maxUses,
        isActive: discountCodes.isActive,
        autoApply: discountCodes.autoApply,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
      })
      .from(discountCodes)
      .where(eq(discountCodes.campaignId, id))
      .orderBy(desc(discountCodes.createdAt));
    return { ...campaign, codes };
  }

  /**
   * Active campaign with `showOnSite=true` for the public banner.
   * Returns the most recently-started active campaign, or null. Used by
   * the homepage / courses page banner strip.
   */
  async getActiveBannerCampaign() {
    const now = new Date();
    const [campaign] = await db
      .select({
        id: couponCampaigns.id,
        name: couponCampaigns.name,
        description: couponCampaigns.description,
        startsAt: couponCampaigns.startsAt,
        endsAt: couponCampaigns.endsAt,
        bannerCta: couponCampaigns.bannerCta,
      })
      .from(couponCampaigns)
      .where(
        and(
          eq(couponCampaigns.isActive, true),
          eq(couponCampaigns.showOnSite, true),
          or(
            isNull(couponCampaigns.startsAt),
            lte(couponCampaigns.startsAt, now),
          )!,
          or(
            isNull(couponCampaigns.endsAt),
            gte(couponCampaigns.endsAt, now),
          )!,
        ),
      )
      .orderBy(desc(couponCampaigns.startsAt))
      .limit(1);
    return campaign || null;
  }

  // ─── Finance dashboard summary + audit ──────────────────────────────

  /**
   * KPIs for the Finance > Discounts page header. Honours date range.
   * Single round-trip via grouped query.
   */
  async getDiscountSummary(opts: {
    startDate?: string;
    endDate?: string;
  } = {}) {
    const startDate = opts.startDate ? new Date(opts.startDate) : null;
    const endDateRaw = opts.endDate ? new Date(opts.endDate) : null;
    if (endDateRaw) endDateRaw.setHours(23, 59, 59, 999);

    const now = new Date();

    // Live counts that ignore the date range (current state)
    const [liveRow] = await db
      .select({
        activeCodes: sql<number>`COUNT(CASE WHEN ${discountCodes.isActive} = true AND (${discountCodes.validUntil} IS NULL OR ${discountCodes.validUntil} >= ${now}) THEN 1 END)::int`,
        autoApplyCodes: sql<number>`COUNT(CASE WHEN ${discountCodes.autoApply} = true AND ${discountCodes.isActive} = true THEN 1 END)::int`,
      })
      .from(discountCodes);

    const [campRow] = await db
      .select({
        activeCampaigns: sql<number>`COUNT(CASE WHEN ${couponCampaigns.isActive} = true AND (${couponCampaigns.endsAt} IS NULL OR ${couponCampaigns.endsAt} >= ${now}) THEN 1 END)::int`,
      })
      .from(couponCampaigns);

    // Window-based usage metrics
    const windowConds: any[] = [];
    if (startDate) windowConds.push(gte(discountUsage.usedAt, startDate));
    if (endDateRaw) windowConds.push(lte(discountUsage.usedAt, endDateRaw));
    const windowWhere =
      windowConds.length > 0 ? and(...windowConds) : undefined;

    const [usageRow] = await db
      .select({
        redemptions: sql<number>`COUNT(*)::int`,
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}::numeric), 0)`,
        avgSaved: sql<string>`COALESCE(AVG(${discountUsage.amountSaved}::numeric), 0)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${discountUsage.userId})::int`,
      })
      .from(discountUsage)
      .where(windowWhere);

    return {
      live: {
        activeCodes: liveRow?.activeCodes ?? 0,
        autoApplyCodes: liveRow?.autoApplyCodes ?? 0,
        activeCampaigns: campRow?.activeCampaigns ?? 0,
      },
      window: {
        redemptions: usageRow?.redemptions ?? 0,
        totalSaved: Number(usageRow?.totalSaved ?? 0),
        avgSaved: Number(
          Number(usageRow?.avgSaved ?? 0).toFixed(2),
        ),
        uniqueUsers: usageRow?.uniqueUsers ?? 0,
      },
    };
  }

  // ─── Overview / charts ──────────────────────────────────────────────

  /**
   * Daily savings + redemptions series for the period, plus a type-breakdown
   * (percentage vs fixed vs early-bird vs campaign), top 10 codes by savings,
   * and a validation funnel (attempted → validated → redeemed). Powers the
   * Overview tab on the finance discounts page.
   */
  async getDiscountChartSeries(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : null;
    const endRaw = endDate ? new Date(endDate) : null;
    if (endRaw) endRaw.setHours(23, 59, 59, 999);

    // Daily savings + redemptions
    const dailyConds: any[] = [];
    if (start) dailyConds.push(gte(discountUsage.usedAt, start));
    if (endRaw) dailyConds.push(lte(discountUsage.usedAt, endRaw));
    const dailyWhere = dailyConds.length > 0 ? and(...dailyConds) : undefined;

    const daily = await db
      .select({
        day: sql<string>`TO_CHAR(${discountUsage.usedAt}::date, 'YYYY-MM-DD')`,
        saved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}::numeric), 0)`,
        redemptions: sql<number>`COUNT(*)::int`,
      })
      .from(discountUsage)
      .where(dailyWhere)
      .groupBy(sql`${discountUsage.usedAt}::date`)
      .orderBy(sql`${discountUsage.usedAt}::date`);

    // Type breakdown — percentage / fixed / early-bird / campaign-bound
    // (counts of currently-active codes; not period-dependent).
    const [typeRow] = await db
      .select({
        percentage: sql<number>`COUNT(CASE WHEN ${discountCodes.type} = 'percentage' AND ${discountCodes.isActive} = true THEN 1 END)::int`,
        fixed: sql<number>`COUNT(CASE WHEN ${discountCodes.type} = 'fixed' AND ${discountCodes.isActive} = true THEN 1 END)::int`,
        earlyBird: sql<number>`COUNT(CASE WHEN ${discountCodes.earlyBird} = true AND ${discountCodes.isActive} = true THEN 1 END)::int`,
        campaign: sql<number>`COUNT(CASE WHEN ${discountCodes.campaignId} IS NOT NULL AND ${discountCodes.isActive} = true THEN 1 END)::int`,
        autoApply: sql<number>`COUNT(CASE WHEN ${discountCodes.autoApply} = true AND ${discountCodes.isActive} = true THEN 1 END)::int`,
      })
      .from(discountCodes);

    // Top 10 codes by saved amount in the window
    const topJoinConds: any[] = [eq(discountCodes.id, discountUsage.discountId)];
    if (start) topJoinConds.push(gte(discountUsage.usedAt, start));
    if (endRaw) topJoinConds.push(lte(discountUsage.usedAt, endRaw));
    const top = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        totalSaved: sql<string>`COALESCE(SUM(${discountUsage.amountSaved}::numeric), 0)`,
        conversions: count(discountUsage.id),
      })
      .from(discountCodes)
      .innerJoin(discountUsage, and(...topJoinConds))
      .groupBy(
        discountCodes.id,
        discountCodes.code,
        discountCodes.type,
        discountCodes.value,
      )
      .orderBy(desc(sql`COALESCE(SUM(${discountUsage.amountSaved}::numeric), 0)`))
      .limit(10);

    // Validation funnel — audit_logs has `discount_validation_failed`
    // entries (write-time). Count attempted = success+fail, validated=success,
    // redeemed = discount_usage rows.
    const funnelConds: any[] = [
      eq(auditLogs.entityType, 'discount'),
      eq(auditLogs.action, 'discount_validation_failed'),
    ];
    if (start) funnelConds.push(gte(auditLogs.createdAt, start));
    if (endRaw) funnelConds.push(lte(auditLogs.createdAt, endRaw));
    const [{ failed }] = await db
      .select({ failed: sql<number>`COUNT(*)::int` })
      .from(auditLogs)
      .where(and(...funnelConds));

    const [{ redeemed }] = await db
      .select({ redeemed: sql<number>`COUNT(*)::int` })
      .from(discountUsage)
      .where(dailyWhere);

    return {
      daily: daily.map((d) => ({
        day: d.day,
        saved: Number(d.saved),
        redemptions: d.redemptions,
      })),
      typeBreakdown: {
        percentage: typeRow?.percentage ?? 0,
        fixed: typeRow?.fixed ?? 0,
        earlyBird: typeRow?.earlyBird ?? 0,
        campaign: typeRow?.campaign ?? 0,
        autoApply: typeRow?.autoApply ?? 0,
      },
      topCodes: top.map((t) => ({
        id: t.id,
        code: t.code,
        type: t.type,
        value: Number(t.value),
        totalSaved: Number(t.totalSaved),
        conversions: Number(t.conversions),
      })),
      funnel: {
        attempted: Number(failed) + Number(redeemed),
        validated: Number(redeemed),
        redeemed: Number(redeemed),
        failed: Number(failed),
      },
    };
  }

  /**
   * Recent redemptions + recent failed validations. Used by the
   * Overview tab's activity feeds.
   */
  async getRecentActivity(limit: number = 10) {
    const recentRedemptions = await db
      .select({
        id: discountUsage.id,
        discountId: discountUsage.discountId,
        code: discountCodes.code,
        userEmail: users.email,
        amountSaved: discountUsage.amountSaved,
        paymentId: discountUsage.paymentId,
        usedAt: discountUsage.usedAt,
      })
      .from(discountUsage)
      .leftJoin(discountCodes, eq(discountCodes.id, discountUsage.discountId))
      .leftJoin(users, eq(users.id, discountUsage.userId))
      .orderBy(desc(discountUsage.usedAt))
      .limit(Math.min(limit, 50));

    const recentFailures = await db
      .select({
        id: auditLogs.id,
        metadata: auditLogs.metadata,
        performedBy: auditLogs.performedBy,
        userEmail: users.email,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.performedBy))
      .where(
        and(
          eq(auditLogs.entityType, 'discount'),
          eq(auditLogs.action, 'discount_validation_failed'),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(Math.min(limit, 50));

    return {
      recentRedemptions: recentRedemptions.map((r) => ({
        id: r.id,
        discountId: r.discountId,
        code: r.code,
        userEmail: r.userEmail,
        amountSaved: Number(r.amountSaved),
        paymentId: r.paymentId,
        usedAt: r.usedAt,
      })),
      recentFailures: recentFailures.map((r) => ({
        id: r.id,
        code: (r.metadata as { code?: string })?.code ?? null,
        error: (r.metadata as { error?: string })?.error ?? null,
        userEmail: r.userEmail,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Early-bird listing for the dedicated tab. Returns active early-bird
   * codes (those with the explicit `earlyBird` flag set) sorted by
   * validity-end ascending so the soonest-to-expire is first.
   */
  async listEarlyBirdCodes() {
    const now = new Date();
    const rows = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        currentUses: discountCodes.currentUses,
        maxUses: discountCodes.maxUses,
        autoApply: discountCodes.autoApply,
        applicableCourses: discountCodes.applicableCourses,
        validFrom: discountCodes.validFrom,
        validUntil: discountCodes.validUntil,
        isActive: discountCodes.isActive,
        campaign: discountCodes.campaign,
        campaignId: discountCodes.campaignId,
        totalSaved: sql<string>`COALESCE((SELECT SUM(discount_usage.amount_saved::numeric) FROM discount_usage WHERE discount_usage.discount_id = discount_codes.id), 0)`,
      })
      .from(discountCodes)
      // Hide deleted (isActive=false) codes from the Early-Bird tab so
      // disabled codes don't keep showing as ghosts after the user
      // deletes them.
      .where(and(eq(discountCodes.earlyBird, true), eq(discountCodes.isActive, true)))
      .orderBy(sql`COALESCE(${discountCodes.validUntil}, '9999-12-31'::timestamp) ASC`);

    return rows.map((r) => {
      const validUntil = r.validUntil ? new Date(r.validUntil) : null;
      const validFrom = r.validFrom ? new Date(r.validFrom) : null;
      let phase: 'scheduled' | 'live' | 'expired' = 'live';
      if (validFrom && validFrom > now) phase = 'scheduled';
      else if (validUntil && validUntil < now) phase = 'expired';
      else if (!r.isActive) phase = 'expired';
      return {
        id: r.id,
        code: r.code,
        type: r.type,
        value: Number(r.value),
        currentUses: r.currentUses,
        maxUses: r.maxUses,
        autoApply: r.autoApply,
        applicableCourses: r.applicableCourses,
        validFrom: r.validFrom,
        validUntil: r.validUntil,
        isActive: r.isActive,
        campaign: r.campaign,
        campaignId: r.campaignId,
        totalSaved: Number(r.totalSaved),
        phase,
      };
    });
  }

  /**
   * Audit timeline for a discount: discount events + linked campaign
   * events (if any) + every payment that used this code.
   */
  async getDiscountAudit(discountId: string, limit: number = 100) {
    const [discount] = await db
      .select({ campaignId: discountCodes.campaignId })
      .from(discountCodes)
      .where(eq(discountCodes.id, discountId))
      .limit(1);
    if (!discount) return [];

    const cap = Math.min(limit, 200);
    const result = await db.execute(sql`
      SELECT a.id,
             a.action,
             a.entity_type AS "entityType",
             a.entity_id AS "entityId",
             a.performed_by AS "performedBy",
             a.metadata,
             a.created_at AS "createdAt",
             CASE
               WHEN u.id IS NULL THEN NULL
               ELSE CONCAT(u.first_name, ' ', u.last_name)
             END AS "actorName",
             u.email AS "actorEmail"
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.id
      WHERE
        (a.entity_type = 'discount_code' AND a.entity_id = ${discountId})
        OR (a.entity_type = 'discount' AND a.entity_id = ${discountId})
        ${discount.campaignId ? sql`OR (a.entity_type = 'coupon_campaign' AND a.entity_id = ${discount.campaignId})` : sql``}
      ORDER BY a.created_at DESC
      LIMIT ${cap}
    `);
    return result.rows as Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>;
  }
}
