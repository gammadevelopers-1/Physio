import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'crypto';
import { db } from '../../../database';
import {
  rewardCatalog,
  rewardRedemptions,
  courses,
  sessions,
  users,
  webinarRegistrations,
  discountCodes,
  discountUsage,
  couponCampaigns,
  enrollments,
  pointRedemptions,
  pointTransactions,
  courseRedemptionSettings,
  type Reward,
  type RewardType,
  type NewPointTransaction,
} from '../../../database/schema';
import { PointsLedgerService } from '../points-ledger.service';
import { PointsService } from '../points.service';
import { UserNotificationsService } from '../../user-notifications/user-notifications.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * RewardsService — the redemption side of the points system.
 *
 * A "reward" is an admin-curated item in `reward_catalog`; a "redemption" is
 * one student trading points for a reward. Each reward `type` fulfills
 * differently but every flow shares the same envelope:
 *
 *   1. Validate: reward active, in stock, per-user cap ok, user has balance
 *   2. Debit ledger (idempotency key = redemption row id)
 *   3. Type-specific fulfillment (mint coupon / enroll / register / mark pending)
 *   4. On success: increment counter, mark redemption row 'fulfilled', notify
 *   5. On failure: compensating credit + mark 'failed'
 *
 * We never wrap the ledger insert and the fulfillment call inside a single
 * DB transaction — the fulfillment can involve external side effects (Zoom
 * registration, cache invalidation) that don't rollback with a DB abort.
 * The compensating-credit pattern is what makes the flow safe under partial
 * failure.
 */

interface DiscountCouponPayload {
  percent: number;
  expiryDays: number;
  scope?: 'all_paid' | 'specific_courses' | 'by_delivery_type';
  scopeCourseIds?: string[];
  deliveryTypes?: string[];
}

interface FixedDiscountCouponPayload {
  amountSar: number;
  expiryDays: number;
  scope?: 'all_paid' | 'specific_courses' | 'by_delivery_type';
  scopeCourseIds?: string[];
  deliveryTypes?: string[];
}

interface FreeCoursePayload {
  /**
   * Post-0108: the admin may bundle multiple courses under one reward and
   * the student picks ONE at redeem time. Legacy rows created before
   * 0108_reward_polish stored `{ courseId: "..." }`; the migration
   * converts them to `{ courseIds: ["..."] }`.
   */
  courseIds: string[];
  /** @deprecated pre-0108 shape — kept for defensive reads only. */
  courseId?: string;
}

interface FreeWebinarPayload {
  sessionId: string;
}

interface OtherPayload {
  instructionsEn?: string;
  instructionsAr?: string;
  /**
   * Phase 2 (Other-workflow): how many days after redemption the student
   * should expect the reward to arrive. Required for rewards created via
   * the Phase-2 admin UI; legacy rows created before Phase 2 lack this
   * field and are read with a `?? DEFAULT_EXPECTED_DELIVERY_DAYS` fallback.
   */
  expectedDeliveryDays?: number;
}

/**
 * Fallback delivery window applied when reading legacy `other` rewards that
 * were created before Phase 2 introduced the required field.
 */
const DEFAULT_EXPECTED_DELIVERY_DAYS = 7;

/**
 * Artifact the admin attaches when fulfilling an `other`-type redemption.
 * Stored on `reward_redemptions.fulfillment_artifact` as jsonb.
 */
export interface OtherFulfillmentArtifact {
  kind: 'code' | 'link' | 'note';
  value: string;
  meta?: { note?: string } | Record<string, unknown>;
}

/**
 * Extra input coming from the student's redeem request. Filled from the
 * optional POST body on `POST /points/me/rewards/:id/redeem` and threaded
 * through to the type-specific fulfillment step. Every field is optional
 * — a legacy client that posts an empty body still works for the reward
 * types that don't need a selection.
 */
export interface RedeemContext {
  selectedCourseId?: string;
  selectedDeliveryType?: string;
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly ledger: PointsLedgerService,
    private readonly pointsService: PointsService,
    private readonly notifications: UserNotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Student-facing reads
  // ─────────────────────────────────────────────────────────────

  /**
   * List rewards the student can see. Includes all active + in-window rewards
   * and annotates each with the caller's own eligibility (balance, redemption
   * count, stock left).
   */
  async listForUser(user: AuthenticatedUser) {
    const now = new Date();
    const rows = await db
      .select()
      .from(rewardCatalog)
      .where(eq(rewardCatalog.isActive, true))
      .orderBy(rewardCatalog.displayOrder, rewardCatalog.createdAt);

    const active = rows.filter((r) => this.isWithinWindow(r, now));
    const balance = await this.ledger.getBalance(user.id);

    // Batch per-user redemption counts to avoid an N+1 query on the grid.
    const myCounts = active.length
      ? await db
          .select({
            rewardId: rewardRedemptions.rewardId,
            n: count(),
          })
          .from(rewardRedemptions)
          .where(
            and(
              eq(rewardRedemptions.userId, user.id),
              sql`${rewardRedemptions.status} IN ('pending','fulfilled')`,
            ),
          )
          .groupBy(rewardRedemptions.rewardId)
      : [];
    const myCountMap = new Map(myCounts.map((c) => [c.rewardId, Number(c.n)]));

    // Batch-resolve all free_course reward course rows so the student UI
    // can render a picker without a follow-up round trip.
    const allCourseIds = new Set<string>();
    for (const r of active) {
      if (r.type === 'free_course') {
        for (const id of this.extractCourseIds(r.payload)) {
          allCourseIds.add(id);
        }
      }
    }
    const courseInfoMap = allCourseIds.size
      ? new Map(
          (
            await db
              .select({
                id: courses.id,
                title: courses.title,
                titleAr: courses.titleAr,
                thumbnail: courses.thumbnail,
                price: courses.price,
              })
              .from(courses)
              .where(inArray(courses.id, Array.from(allCourseIds)))
          ).map((c) => [c.id, c]),
        )
      : new Map<string, { id: string; title: string; titleAr: string | null; thumbnail: string | null; price: string | null }>();

    return active.map((r) =>
      this.projectForUser(r, balance, myCountMap.get(r.id) ?? 0, courseInfoMap),
    );
  }

  /**
   * The comprehensive My Rewards page — one row per redemption, joined with
   * the type-specific artifact (discount code, enrollment, webinar
   * registration, or admin-supplied fulfillment_artifact for `other`).
   *
   * Pagination is server-side (LIMIT/OFFSET) but the projections for each
   * page are batch-fetched so we make at most O(reward-type-buckets) extra
   * queries — never one-per-row.
   *
   * `unusedCouponCount` is computed via a separate cheap subquery so the
   * sidebar red-dot doesn't need to load the full page.
   */
  async listMyRewardHistory(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const safePage = Math.max(1, page);
    const now = new Date();

    // Reward-catalog redemptions (existing source). Fetched UNPAGINATED so we
    // can merge with the point-based course-purchase source below and paginate
    // the union. Per-user volume is small (dozens, not thousands), so the
    // in-memory merge is cheaper to maintain than a DB UNION query with a
    // dynamic ORDER BY across two schemas.
    const rows = await db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        rewardNameEn: rewardCatalog.nameEn,
        rewardNameAr: rewardCatalog.nameAr,
        rewardType: rewardCatalog.type,
        rewardPayload: rewardCatalog.payload,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        fulfillmentPayload: rewardRedemptions.fulfillmentPayload,
        fulfillmentArtifact: rewardRedemptions.fulfillmentArtifact,
        fulfilledAt: rewardRedemptions.fulfilledAt,
        redeemedAt: rewardRedemptions.redeemedAt,
      })
      .from(rewardRedemptions)
      .innerJoin(
        rewardCatalog,
        eq(rewardRedemptions.rewardId, rewardCatalog.id),
      )
      .where(eq(rewardRedemptions.userId, userId))
      .orderBy(desc(rewardRedemptions.redeemedAt));

    // ── Batch-collect the per-type keys we need to resolve ───────────
    const couponCodes = new Set<string>();
    const courseIds = new Set<string>();
    const webinarSessionIds = new Set<string>();

    for (const r of rows) {
      const payload = (r.fulfillmentPayload ?? {}) as Record<string, unknown>;
      if (r.rewardType === 'discount_coupon' || r.rewardType === 'fixed_discount_coupon') {
        const code = typeof payload.discountCode === 'string' ? payload.discountCode : null;
        if (code) couponCodes.add(code);
      } else if (r.rewardType === 'free_course') {
        const cid = typeof payload.courseId === 'string' ? payload.courseId : null;
        if (cid) courseIds.add(cid);
      } else if (r.rewardType === 'free_webinar') {
        const sid = typeof payload.sessionId === 'string' ? payload.sessionId : null;
        if (sid) webinarSessionIds.add(sid);
      }
    }

    // ── Fetch coupon artifacts by code (unique index → cheap lookup) ──
    const couponRows = couponCodes.size
      ? await db
          .select({
            code: discountCodes.code,
            id: discountCodes.id,
            validUntil: discountCodes.validUntil,
            currentUses: discountCodes.currentUses,
            maxUses: discountCodes.maxUses,
          })
          .from(discountCodes)
          .where(inArray(discountCodes.code, Array.from(couponCodes)))
      : [];
    const couponMap = new Map(couponRows.map((c) => [c.code, c]));

    // Look up the payment a coupon was redeemed against (if any) so the
    // history card can deep-link to the receipt in a later phase. We only
    // ever return the newest usage row per discount id.
    const couponIds = couponRows.map((c) => c.id);
    const usageRows = couponIds.length
      ? await db
          .select({
            discountId: discountUsage.discountId,
            paymentId: discountUsage.paymentId,
            usedAt: discountUsage.usedAt,
          })
          .from(discountUsage)
          .where(inArray(discountUsage.discountId, couponIds))
      : [];
    const usageMap = new Map<string, { paymentId: string; usedAt: Date }>();
    for (const u of usageRows) {
      const existing = usageMap.get(u.discountId);
      if (!existing || u.usedAt > existing.usedAt) {
        usageMap.set(u.discountId, { paymentId: u.paymentId, usedAt: u.usedAt });
      }
    }

    // ── Fetch free-course artifacts ─────────────────────────────────
    const courseRows = courseIds.size
      ? await db
          .select({
            id: courses.id,
            title: courses.title,
            titleAr: courses.titleAr,
            thumbnail: courses.thumbnail,
            startDate: courses.startDate,
          })
          .from(courses)
          .where(inArray(courses.id, Array.from(courseIds)))
      : [];
    const courseMap = new Map(courseRows.map((c) => [c.id, c]));

    const enrollmentRows = courseIds.size
      ? await db
          .select({
            id: enrollments.id,
            courseId: enrollments.courseId,
            enrolledAt: enrollments.enrolledAt,
            status: enrollments.status,
          })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, userId),
              inArray(enrollments.courseId, Array.from(courseIds)),
            ),
          )
      : [];
    const enrollmentMap = new Map(enrollmentRows.map((e) => [e.courseId, e]));

    // ── Fetch webinar-registration artifacts ────────────────────────
    const sessionRows = webinarSessionIds.size
      ? await db
          .select({
            id: sessions.id,
            title: sessions.title,
            scheduledAt: sessions.scheduledAt,
          })
          .from(sessions)
          .where(inArray(sessions.id, Array.from(webinarSessionIds)))
      : [];
    const sessionMap = new Map(sessionRows.map((s) => [s.id, s]));

    const registrationRows = webinarSessionIds.size
      ? await db
          .select({
            sessionId: webinarRegistrations.sessionId,
            status: webinarRegistrations.status,
            joinUrl: webinarRegistrations.joinUrl,
          })
          .from(webinarRegistrations)
          .where(
            and(
              eq(webinarRegistrations.userId, userId),
              inArray(webinarRegistrations.sessionId, Array.from(webinarSessionIds)),
            ),
          )
      : [];
    const registrationMap = new Map(registrationRows.map((r) => [r.sessionId, r]));

    // ── Build the per-row projection ────────────────────────────────
    const items = rows.map((r) => {
      const payload = (r.fulfillmentPayload ?? {}) as Record<string, unknown>;
      let projection: unknown;

      if (r.rewardType === 'discount_coupon' || r.rewardType === 'fixed_discount_coupon') {
        const code = typeof payload.discountCode === 'string' ? payload.discountCode : '';
        const dc = code ? couponMap.get(code) : undefined;
        const maxUses = dc?.maxUses ?? 1;
        const currentUses = dc?.currentUses ?? 0;
        const expiresAt = dc?.validUntil ?? null;
        const isExpired = !!expiresAt && expiresAt.getTime() < now.getTime();
        const isUsed = currentUses >= maxUses;
        const status: 'unused' | 'used' | 'expired' = isExpired
          ? 'expired'
          : isUsed
            ? 'used'
            : 'unused';
        const usage = dc ? usageMap.get(dc.id) ?? null : null;
        projection = {
          kind: 'coupon' as const,
          code,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          currentUses,
          maxUses,
          status,
          usedInPaymentId: usage?.paymentId ?? null,
        };
      } else if (r.rewardType === 'free_course') {
        const courseId = typeof payload.courseId === 'string' ? payload.courseId : '';
        const c = courseId ? courseMap.get(courseId) : undefined;
        const enr = courseId ? enrollmentMap.get(courseId) : undefined;
        projection = {
          kind: 'free_course' as const,
          courseId,
          courseTitle: c?.title ?? (typeof payload.courseTitle === 'string' ? payload.courseTitle : ''),
          courseTitleAr: c?.titleAr ?? null,
          thumbnail: c?.thumbnail ?? null,
          enrollmentId: enr?.id ?? null,
          enrolledAt: enr?.enrolledAt ? enr.enrolledAt.toISOString() : null,
          courseStartDate: c?.startDate ?? null,
          courseSlug: null,
        };
      } else if (r.rewardType === 'free_webinar') {
        const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
        const s = sessionId ? sessionMap.get(sessionId) : undefined;
        const reg = sessionId ? registrationMap.get(sessionId) : undefined;
        projection = {
          kind: 'free_webinar' as const,
          sessionId,
          sessionTitle: s?.title ?? (typeof payload.sessionTitle === 'string' ? payload.sessionTitle : ''),
          sessionTitleAr: null,
          sessionStartAt: s?.scheduledAt ? s.scheduledAt.toISOString() : null,
          registrationStatus: reg?.status ?? null,
          joinUrl: reg?.joinUrl ?? null,
        };
      } else {
        // 'other'
        const artifactRaw = r.fulfillmentArtifact as
          | { kind?: string; value?: string; meta?: Record<string, unknown> }
          | null;
        const otherStatus =
          r.status === 'pending' ||
          r.status === 'fulfilled' ||
          r.status === 'failed' ||
          r.status === 'reversed'
            ? r.status
            : 'pending';
        // Only surface the artifact once fulfilled; reversed/failed rows
        // keep their artifact on the row (audit trail) but the student
        // projection should NOT expose it.
        const surfaceArtifact =
          otherStatus === 'fulfilled' &&
          artifactRaw &&
          (artifactRaw.kind === 'code' ||
            artifactRaw.kind === 'link' ||
            artifactRaw.kind === 'note') &&
          typeof artifactRaw.value === 'string'
            ? { kind: artifactRaw.kind, value: artifactRaw.value }
            : null;
        const rewardPayload =
          (r.rewardPayload ?? {}) as Record<string, unknown>;
        const rawDays = rewardPayload.expectedDeliveryDays;
        const expectedDeliveryDays =
          typeof rawDays === 'number' && rawDays > 0
            ? rawDays
            : DEFAULT_EXPECTED_DELIVERY_DAYS;
        projection = {
          kind: 'other' as const,
          status: otherStatus,
          fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
          adminNote:
            artifactRaw?.meta && typeof artifactRaw.meta.note === 'string'
              ? (artifactRaw.meta.note as string)
              : null,
          expectedDeliveryDays,
          redeemedAt: r.redeemedAt.toISOString(),
          artifact: surfaceArtifact,
        };
      }

      return {
        redemptionId: r.id,
        rewardId: r.rewardId,
        rewardName: r.rewardNameEn,
        rewardNameAr: r.rewardNameAr,
        rewardType: r.rewardType as RewardType,
        pointsSpent: r.pointsSpent,
        redeemedAt: r.redeemedAt.toISOString(),
        projection,
      };
    });

    // ── Course purchases via points (`point_redemptions` source) ─────
    //
    // These live in a separate table than reward-catalog redemptions and
    // are what the student sees when they hit "Redeem" on a course they
    // paid for with points. The `enrollmentId` FK is populated by
    // `PointsService.redeemCourseForFree` on successful redemption — no
    // metadata parsing needed. We surface only `status='applied'` rows;
    // pending holds and released cancellations aren't user-facing history.
    const courseRedemptionRows = await db
      .select({
        id: pointRedemptions.id,
        courseId: pointRedemptions.courseId,
        pointsUsed: pointRedemptions.pointsUsed,
        appliedAt: pointRedemptions.appliedAt,
        createdAt: pointRedemptions.createdAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        courseThumbnail: courses.thumbnail,
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
      })
      .from(pointRedemptions)
      .innerJoin(courses, eq(pointRedemptions.courseId, courses.id))
      .leftJoin(enrollments, eq(pointRedemptions.enrollmentId, enrollments.id))
      .where(
        and(
          eq(pointRedemptions.userId, userId),
          eq(pointRedemptions.status, 'applied'),
        ),
      )
      .orderBy(desc(pointRedemptions.appliedAt));

    const coursePurchaseItems = courseRedemptionRows.map((r) => {
      const rawStatus = r.enrollmentStatus ?? null;
      // Normalise to the frontend enum. `pending_payment` and `suspended`
      // map to null so the UI treats them as "no enrollment link yet".
      const enrollmentStatus:
        | 'active'
        | 'completed'
        | 'dropped'
        | 'expired'
        | null =
        rawStatus === 'active' ||
        rawStatus === 'completed' ||
        rawStatus === 'dropped'
          ? rawStatus
          : null;
      const when = r.appliedAt ?? r.createdAt;
      return {
        redemptionId: r.id,
        // Anchor id = course id — keeps the row addressable even though it
        // isn't backed by a reward-catalog entry.
        rewardId: r.courseId ?? r.id,
        rewardName: r.courseTitle ?? '',
        rewardNameAr: r.courseTitleAr ?? null,
        rewardType: 'course_purchase' as const,
        pointsSpent: r.pointsUsed,
        redeemedAt: when.toISOString(),
        projection: {
          kind: 'course_purchase' as const,
          courseId: r.courseId ?? '',
          courseTitle: r.courseTitle ?? '',
          courseTitleAr: r.courseTitleAr ?? null,
          thumbnail: r.courseThumbnail ?? null,
          enrollmentId: r.enrollmentId ?? null,
          enrollmentStatus,
          redeemedAt: when.toISOString(),
          pointsSpent: r.pointsUsed,
        },
      };
    });

    // ── Merge both sources, sort desc by redeemedAt, paginate ────────
    const merged = [...items, ...coursePurchaseItems].sort(
      (a, b) =>
        new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime(),
    );
    const total = merged.length;
    const start = (safePage - 1) * safeLimit;
    const pageItems = merged.slice(start, start + safeLimit);

    // ── Sidebar red-dot: cheap standalone count of unused-not-expired
    // coupons across the ENTIRE user history (not just current page).
    const [{ n: unusedCouponCount } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rewardRedemptions)
      .innerJoin(
        rewardCatalog,
        eq(rewardRedemptions.rewardId, rewardCatalog.id),
      )
      .innerJoin(
        discountCodes,
        sql`${discountCodes.code} = ${rewardRedemptions.fulfillmentPayload}->>'discountCode'`,
      )
      .where(
        and(
          eq(rewardRedemptions.userId, userId),
          eq(rewardRedemptions.status, 'fulfilled'),
          sql`${rewardCatalog.type} IN ('discount_coupon','fixed_discount_coupon')`,
          sql`${discountCodes.currentUses} < COALESCE(${discountCodes.maxUses}, 1)`,
          sql`(${discountCodes.validUntil} IS NULL OR ${discountCodes.validUntil} > NOW())`,
        ),
      );

    return {
      items: pageItems,
      total,
      page: safePage,
      limit: safeLimit,
      unusedCouponCount: Number(unusedCouponCount),
    };
  }

  /**
   * The student's own redemption history (for the drilldown drawer).
   */
  async listUserRedemptions(userId: string, limit = 50) {
    const rows = await db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        rewardNameEn: rewardCatalog.nameEn,
        rewardNameAr: rewardCatalog.nameAr,
        rewardType: rewardCatalog.type,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        fulfillmentPayload: rewardRedemptions.fulfillmentPayload,
        redeemedAt: rewardRedemptions.redeemedAt,
        expiresAt: rewardRedemptions.expiresAt,
      })
      .from(rewardRedemptions)
      .innerJoin(rewardCatalog, eq(rewardRedemptions.rewardId, rewardCatalog.id))
      .where(eq(rewardRedemptions.userId, userId))
      .orderBy(desc(rewardRedemptions.redeemedAt))
      .limit(limit);
    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  // The redemption saga
  // ─────────────────────────────────────────────────────────────

  async redeem(
    rewardId: string,
    user: AuthenticatedUser,
    ctx: RedeemContext = {},
  ) {
    const [reward] = await db
      .select()
      .from(rewardCatalog)
      .where(eq(rewardCatalog.id, rewardId))
      .limit(1);
    if (!reward) throw new NotFoundException('Reward not found');

    // Validate — every gate that can reject BEFORE we touch the ledger.
    this.assertRewardActive(reward);
    await this.assertPerUserCap(reward, user.id);
    this.assertStockAvailable(reward);
    this.assertRedeemInput(reward, ctx);

    const balance = await this.ledger.getBalance(user.id);
    if (balance < reward.pointsCost) {
      throw new BadRequestException(
        `Insufficient points: balance ${balance}, need ${reward.pointsCost}`,
      );
    }

    // 1) Create the redemption row (status 'pending') so we have a stable
    //    id for the idempotency key + fulfillment payload.
    const redemptionId = randomUUID();
    const idempotencyKey = `reward_redeem:${redemptionId}`;
    await db.insert(rewardRedemptions).values({
      id: redemptionId,
      userId: user.id,
      rewardId: reward.id,
      pointsSpent: reward.pointsCost,
      status: 'pending',
    });

    // 2) Debit points via the ledger. On unique-key violation somebody else
    //    already committed this exact redemption id (impossible in practice
    //    since we just minted it), but we still handle it defensively.
    let ledgerTxId: string;
    try {
      const [debitRow] = await db
        .insert(pointTransactions)
        .values({
          userId: user.id,
          delta: -reward.pointsCost,
          reason: 'redeem:hold',
          sourceEntityType: 'reward_redemption',
          sourceEntityId: redemptionId,
          idempotencyKey,
        } satisfies NewPointTransaction)
        .returning({ id: pointTransactions.id });
      ledgerTxId = debitRow.id;
      await db
        .update(rewardRedemptions)
        .set({ ledgerTxId })
        .where(eq(rewardRedemptions.id, redemptionId));
    } catch (err) {
      // Ledger insert failed — kill the pending row so it doesn't leak.
      await db
        .update(rewardRedemptions)
        .set({
          status: 'failed',
          failureReason: (err as Error).message,
        })
        .where(eq(rewardRedemptions.id, redemptionId));
      throw err;
    }

    // 3) Fulfillment (type-specific). On any throw, credit points back
    //    atomically via a compensating ledger entry.
    let fulfillmentPayload: Record<string, unknown> = {};
    let expiresAt: Date | null = null;

    try {
      const outcome = await this.fulfill(reward, user, redemptionId, ctx);
      fulfillmentPayload = outcome.payload;
      expiresAt = outcome.expiresAt ?? null;

      // "other" rewards defer fulfillment to admin — they stay pending until
      // an admin clicks "Mark fulfilled" in the redemptions list.
      const targetStatus: 'fulfilled' | 'pending' =
        reward.type === 'other' ? 'pending' : 'fulfilled';

      await db.transaction(async (tx) => {
        await tx
          .update(rewardRedemptions)
          .set({
            status: targetStatus,
            fulfillmentPayload,
            fulfilledAt: targetStatus === 'fulfilled' ? new Date() : null,
            expiresAt,
          })
          .where(eq(rewardRedemptions.id, redemptionId));

        // Increment stock counter — only when successfully fulfilled.
        // For 'other' we still increment so admin sees stock consumed.
        await tx
          .update(rewardCatalog)
          .set({
            totalRedeemed: sql`${rewardCatalog.totalRedeemed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(rewardCatalog.id, reward.id));

        // Insert the 'committed' ledger marker so the student's transaction
        // history shows this redemption clearly (matching the existing
        // 'redeem:committed' reason strings in the frontend icon map).
        await tx.insert(pointTransactions).values({
          userId: user.id,
          delta: 0,
          reason: 'redeem:committed',
          sourceEntityType: 'reward_redemption',
          sourceEntityId: redemptionId,
          idempotencyKey: `reward_commit:${redemptionId}`,
          metadata: {
            rewardType: reward.type,
            rewardName: reward.nameEn,
          } as never,
        } satisfies NewPointTransaction);
      });
    } catch (err) {
      this.logger.warn(
        `Reward fulfillment failed for redemption ${redemptionId}: ${(err as Error).message}`,
      );
      await this.compensateRefund(redemptionId, user.id, reward.pointsCost, (err as Error).message);
      throw err;
    }

    // 4) Notify (best-effort).
    try {
      await this.notifications.create({
        recipientId: user.id,
        type: 'points_redeemed',
        title: 'Reward redeemed!',
        message: `You redeemed ${reward.pointsCost} points for "${reward.nameEn}"`,
        entityType: 'reward_redemption',
        entityId: redemptionId,
      });
    } catch (e) {
      this.logger.warn(
        `reward-redeemed notification failed: ${(e as Error).message}`,
      );
    }

    return {
      redemptionId,
      pointsSpent: reward.pointsCost,
      newBalance: balance - reward.pointsCost,
      status: reward.type === 'other' ? 'pending' : 'fulfilled',
      type: reward.type,
      fulfillment: fulfillmentPayload,
      expiresAt,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────────────────────

  async listForAdmin() {
    return db
      .select()
      .from(rewardCatalog)
      .orderBy(rewardCatalog.displayOrder, desc(rewardCatalog.createdAt));
  }

  async createReward(input: CreateRewardInput, actorId: string): Promise<Reward> {
    await this.validatePayload(input.type, input.payload);
    const [row] = await db
      .insert(rewardCatalog)
      .values({
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr?.trim() || null,
        descriptionEn: input.descriptionEn?.trim() || null,
        descriptionAr: input.descriptionAr?.trim() || null,
        type: input.type,
        pointsCost: input.pointsCost,
        payload: input.payload,
        isActive: input.isActive ?? true,
        displayOrder: input.displayOrder ?? 0,
        maxPerUser: input.maxPerUser ?? null,
        totalStock: input.totalStock ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        createdBy: actorId,
      })
      .returning();
    return row;
  }

  async updateReward(
    id: string,
    input: UpdateRewardInput,
  ): Promise<Reward> {
    const [existing] = await db
      .select()
      .from(rewardCatalog)
      .where(eq(rewardCatalog.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Reward not found');

    if (input.type && input.type !== existing.type) {
      throw new BadRequestException(
        'Reward type cannot be changed after creation — deactivate and re-create instead',
      );
    }
    if (input.payload) await this.validatePayload(existing.type as RewardType, input.payload);

    const patch: Partial<Reward> = { updatedAt: new Date() };
    if (input.nameEn !== undefined) patch.nameEn = input.nameEn.trim();
    if (input.nameAr !== undefined) patch.nameAr = input.nameAr?.trim() || null;
    if (input.descriptionEn !== undefined) patch.descriptionEn = input.descriptionEn?.trim() || null;
    if (input.descriptionAr !== undefined) patch.descriptionAr = input.descriptionAr?.trim() || null;
    if (input.pointsCost !== undefined) patch.pointsCost = input.pointsCost;
    if (input.payload !== undefined) patch.payload = input.payload;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.displayOrder !== undefined) patch.displayOrder = input.displayOrder;
    if (input.maxPerUser !== undefined) patch.maxPerUser = input.maxPerUser;
    if (input.totalStock !== undefined) patch.totalStock = input.totalStock;
    if (input.validFrom !== undefined) patch.validFrom = input.validFrom ? new Date(input.validFrom) : null;
    if (input.validUntil !== undefined) patch.validUntil = input.validUntil ? new Date(input.validUntil) : null;

    const [updated] = await db
      .update(rewardCatalog)
      .set(patch)
      .where(eq(rewardCatalog.id, id))
      .returning();
    return updated;
  }

  async deleteReward(id: string): Promise<void> {
    // Soft delete — we never hard-delete because there may be historical
    // redemptions FK'd to the row. Flipping is_active hides it from students.
    await db
      .update(rewardCatalog)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(rewardCatalog.id, id));
  }

  async listAllRedemptions(opts: {
    page?: number;
    limit?: number;
    status?: string;
    rewardId?: string;
  } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (opts.status) conditions.push(eq(rewardRedemptions.status, opts.status as any));
    if (opts.rewardId) conditions.push(eq(rewardRedemptions.rewardId, opts.rewardId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rowsRaw, [{ total } = { total: 0 }]] = await Promise.all([
      db
        .select({
          id: rewardRedemptions.id,
          userId: rewardRedemptions.userId,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          rewardId: rewardRedemptions.rewardId,
          rewardName: rewardCatalog.nameEn,
          rewardType: rewardCatalog.type,
          rewardPayload: rewardCatalog.payload,
          pointsSpent: rewardRedemptions.pointsSpent,
          status: rewardRedemptions.status,
          fulfillmentPayload: rewardRedemptions.fulfillmentPayload,
          fulfillmentArtifact: rewardRedemptions.fulfillmentArtifact,
          failureReason: rewardRedemptions.failureReason,
          redeemedAt: rewardRedemptions.redeemedAt,
          fulfilledAt: rewardRedemptions.fulfilledAt,
        })
        .from(rewardRedemptions)
        .innerJoin(users, eq(rewardRedemptions.userId, users.id))
        .innerJoin(rewardCatalog, eq(rewardRedemptions.rewardId, rewardCatalog.id))
        .where(where)
        .orderBy(desc(rewardRedemptions.redeemedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(rewardRedemptions)
        .where(where),
    ]);

    // For `other` rewards, project the catalog payload's expectedDeliveryDays
    // onto the row so the admin table can show the delivery window without a
    // second lookup. Legacy rows without the field fall back to the shared
    // default (7 days).
    const rows = rowsRaw.map((r) => {
      const rewardPayload = (r.rewardPayload ?? {}) as Record<string, unknown>;
      const expectedDeliveryDays =
        r.rewardType === 'other'
          ? typeof rewardPayload.expectedDeliveryDays === 'number' &&
            rewardPayload.expectedDeliveryDays > 0
            ? (rewardPayload.expectedDeliveryDays as number)
            : DEFAULT_EXPECTED_DELIVERY_DAYS
          : null;
      const { rewardPayload: _drop, ...rest } = r;
      return { ...rest, expectedDeliveryDays };
    });

    return { rows, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  /**
   * Admin: transition a redemption between states after off-platform work.
   *
   * Phase 2 shape:
   *   - status: 'fulfilled' — for 'other' rewards MUST include an artifact
   *     (code / link / note). For every other reward type the artifact is
   *     ignored (future-proofing). Sets fulfilledAt only if not already set.
   *   - status: 'failed' — admin couldn't deliver; refund the student.
   *   - status: 'reversed' — admin rolls back a fulfilled row; refund the
   *     student. The `fulfillment_artifact` STAYS on the row for audit but
   *     the student projection is gated on status so the code/link/note is
   *     no longer surfaced to them.
   *
   * `reason` is used for failed/reversed rows; `adminNote` is stored on the
   * artifact's meta.note when fulfilling an 'other' reward.
   */
  async transitionRedemption(
    id: string,
    input: {
      status: 'fulfilled' | 'failed' | 'reversed';
      artifact?: OtherFulfillmentArtifact;
      adminNote?: string;
      reason?: string;
    },
    actorId: string,
  ) {
    const [row] = await db
      .select({
        id: rewardRedemptions.id,
        userId: rewardRedemptions.userId,
        rewardId: rewardRedemptions.rewardId,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        fulfilledAt: rewardRedemptions.fulfilledAt,
        rewardType: rewardCatalog.type,
      })
      .from(rewardRedemptions)
      .innerJoin(rewardCatalog, eq(rewardRedemptions.rewardId, rewardCatalog.id))
      .where(eq(rewardRedemptions.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Redemption not found');

    if (input.status === 'fulfilled') {
      if (row.status !== 'pending') {
        throw new BadRequestException('Only pending redemptions can be fulfilled');
      }

      const patch: Record<string, unknown> = {
        status: 'fulfilled',
        fulfilledAt: row.fulfilledAt ?? new Date(),
      };

      if (row.rewardType === 'other') {
        if (!input.artifact) {
          throw new BadRequestException(
            'Fulfillment artifact is required for Other-type rewards',
          );
        }
        if (
          !['code', 'link', 'note'].includes(input.artifact.kind) ||
          typeof input.artifact.value !== 'string' ||
          input.artifact.value.length < 1
        ) {
          throw new BadRequestException('Invalid fulfillment artifact');
        }
        patch.fulfillmentArtifact = {
          kind: input.artifact.kind,
          value: input.artifact.value,
          meta: input.adminNote ? { note: input.adminNote } : undefined,
        };
      }
      // For non-Other reward types: input.artifact MUST be ignored — do not
      // persist. (Future-proofing so we can add per-type artifacts later
      // without silently accepting the wrong shape now.)

      await db
        .update(rewardRedemptions)
        .set(patch)
        .where(eq(rewardRedemptions.id, id));
      return { ok: true, status: 'fulfilled' as const };
    }

    // failed / reversed — both refund and free the stock slot. We don't
    // touch fulfilledAt (audit trail: if a fulfilled row is later reversed
    // the timestamp of when we thought we delivered stays intact).
    if (input.status === 'failed') {
      if (row.status !== 'pending' && row.status !== 'fulfilled') {
        throw new BadRequestException(
          `Cannot mark a ${row.status} redemption as failed`,
        );
      }
      await this.compensateRefund(
        id,
        row.userId,
        row.pointsSpent,
        input.reason || 'admin_failed',
      );
      // compensateRefund already flips status to 'failed' when the row is
      // pending/fulfilled; ensure failureReason reflects the admin's input.
      await db
        .update(rewardRedemptions)
        .set({ failureReason: input.reason || 'admin_failed' })
        .where(eq(rewardRedemptions.id, id));
      await db
        .update(rewardCatalog)
        .set({
          totalRedeemed: sql`GREATEST(0, ${rewardCatalog.totalRedeemed} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(rewardCatalog.id, row.rewardId));
      return { ok: true, status: 'failed' as const };
    }

    // reversed
    if (row.status !== 'fulfilled' && row.status !== 'pending') {
      throw new BadRequestException(`Cannot reverse a ${row.status} redemption`);
    }
    await this.compensateRefund(
      id,
      row.userId,
      row.pointsSpent,
      input.reason || 'admin_reversed',
    );
    await db
      .update(rewardRedemptions)
      .set({
        status: 'reversed',
        reversedAt: new Date(),
        reversedBy: actorId,
        reversalReason: input.reason || null,
      })
      .where(eq(rewardRedemptions.id, id));
    // Decrement the stock counter so the freed slot reappears.
    await db
      .update(rewardCatalog)
      .set({
        totalRedeemed: sql`GREATEST(0, ${rewardCatalog.totalRedeemed} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(rewardCatalog.id, row.rewardId));
    return { ok: true, status: 'reversed' as const };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private assertRewardActive(reward: Reward): void {
    if (!reward.isActive) throw new BadRequestException('Reward is not active');
    if (!this.isWithinWindow(reward, new Date())) {
      throw new BadRequestException('Reward is outside its validity window');
    }
  }

  private assertStockAvailable(reward: Reward): void {
    if (reward.totalStock == null) return;
    if (reward.totalRedeemed >= reward.totalStock) {
      throw new ConflictException('Reward is out of stock');
    }
  }

  private async assertPerUserCap(reward: Reward, userId: string): Promise<void> {
    if (reward.maxPerUser == null) return;
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rewardRedemptions)
      .where(
        and(
          eq(rewardRedemptions.userId, userId),
          eq(rewardRedemptions.rewardId, reward.id),
          sql`${rewardRedemptions.status} IN ('pending','fulfilled')`,
        ),
      );
    if (n >= reward.maxPerUser) {
      throw new ForbiddenException(
        `You've already redeemed this reward the maximum number of times (${reward.maxPerUser})`,
      );
    }
  }

  /**
   * Reward-type-specific input gates that run BEFORE we touch the ledger.
   * Currently: free_course with more than one course requires the student
   * to pick one.
   */
  private assertRedeemInput(reward: Reward, ctx: RedeemContext): void {
    if (reward.type === 'free_course') {
      const ids = this.extractCourseIds(reward.payload);
      if (ids.length === 0) {
        throw new BadRequestException('This reward has no courses configured');
      }
      if (ids.length === 1) return; // No pick needed.
      if (!ctx.selectedCourseId) {
        throw new BadRequestException(
          'This reward bundles multiple courses — select one before redeeming',
        );
      }
      if (!ids.includes(ctx.selectedCourseId)) {
        throw new BadRequestException(
          'Selected course is not part of this reward',
        );
      }
    }
  }

  private isWithinWindow(reward: Reward, now: Date): boolean {
    if (reward.validFrom && reward.validFrom > now) return false;
    if (reward.validUntil && reward.validUntil < now) return false;
    return true;
  }

  private extractCourseIds(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') return [];
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.courseIds)) {
      return (p.courseIds as unknown[]).filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
    }
    // Legacy shape — the 0108 migration handles the DB-level rewrite but a
    // service-layer fallback keeps things safe if the migration hasn't yet
    // run in an unusual dev environment.
    if (typeof p.courseId === 'string' && p.courseId) return [p.courseId];
    return [];
  }

  private projectForUser(
    reward: Reward,
    balance: number,
    myCount: number,
    courseInfoMap: Map<
      string,
      { id: string; title: string; titleAr: string | null; thumbnail: string | null; price: string | null }
    >,
  ) {
    const stockLeft =
      reward.totalStock == null
        ? null
        : Math.max(0, reward.totalStock - reward.totalRedeemed);
    const perUserLeft =
      reward.maxPerUser == null ? null : Math.max(0, reward.maxPerUser - myCount);
    const canAfford = balance >= reward.pointsCost;
    const inStock = stockLeft == null || stockLeft > 0;
    const withinUserCap = perUserLeft == null || perUserLeft > 0;
    const canRedeem = canAfford && inStock && withinUserCap && reward.isActive;

    let courses: Array<{
      id: string;
      title: string;
      titleAr: string | null;
      thumbnail: string | null;
      priceSar: number;
    }> = [];
    if (reward.type === 'free_course') {
      const ids = this.extractCourseIds(reward.payload);
      courses = ids
        .map((id) => courseInfoMap.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          id: c.id,
          title: c.title,
          titleAr: c.titleAr,
          thumbnail: c.thumbnail,
          priceSar: Number(c.price ?? 0),
        }));
    }

    // Normalize the payload we hand back to the client so `other` rewards
    // always carry an `expectedDeliveryDays` field even when they were
    // created before Phase 2 (in which case the DB row has no such key).
    let payloadOut = reward.payload as Record<string, unknown> | null;
    if (reward.type === 'other') {
      const base = (payloadOut ?? {}) as Record<string, unknown>;
      const raw = base.expectedDeliveryDays;
      const days =
        typeof raw === 'number' && raw > 0 ? raw : DEFAULT_EXPECTED_DELIVERY_DAYS;
      payloadOut = { ...base, expectedDeliveryDays: days };
    }

    return {
      id: reward.id,
      nameEn: reward.nameEn,
      nameAr: reward.nameAr,
      descriptionEn: reward.descriptionEn,
      descriptionAr: reward.descriptionAr,
      icon: reward.icon,
      type: reward.type,
      pointsCost: reward.pointsCost,
      payload: payloadOut,
      stockLeft,
      perUserLeft,
      myRedemptionsCount: myCount,
      canRedeem,
      canAfford,
      inStock,
      withinUserCap,
      courses,
    };
  }

  private async validatePayload(type: RewardType, payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('payload must be an object');
    }
    const p = payload as Record<string, unknown>;
    switch (type) {
      case 'discount_coupon': {
        if (typeof p.percent !== 'number' || p.percent <= 0 || p.percent > 100) {
          throw new BadRequestException('percent must be a number 1-100');
        }
        if (typeof p.expiryDays !== 'number' || p.expiryDays <= 0) {
          throw new BadRequestException('expiryDays must be a positive number');
        }
        break;
      }
      case 'fixed_discount_coupon': {
        if (typeof p.amountSar !== 'number' || p.amountSar <= 0) {
          throw new BadRequestException('amountSar must be a positive number');
        }
        if (typeof p.expiryDays !== 'number' || p.expiryDays <= 0) {
          throw new BadRequestException('expiryDays must be a positive number');
        }
        break;
      }
      case 'free_course': {
        const ids = this.extractCourseIds(p);
        if (ids.length === 0) {
          throw new BadRequestException('courseIds must contain at least one course');
        }
        if (ids.length > 50) {
          throw new BadRequestException('courseIds cannot exceed 50 entries');
        }
        // Confirm each course exists, is active, and not soft-deleted.
        const existing = await db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(
              inArray(courses.id, ids),
              eq(courses.status, 'active'),
              isNull(courses.deletedAt),
            ),
          );
        const existingSet = new Set(existing.map((c) => c.id));
        const missing = ids.filter((id) => !existingSet.has(id));
        if (missing.length) {
          throw new BadRequestException(
            `Unknown or inactive course(s): ${missing.join(', ')}`,
          );
        }
        // Overwrite p.courseIds with the normalized array so downstream
        // callers can rely on the shape regardless of whether the input
        // used the legacy `courseId` field.
        (payload as Record<string, unknown>).courseIds = ids;
        delete (payload as Record<string, unknown>).courseId;
        break;
      }
      case 'free_webinar':
        if (typeof p.sessionId !== 'string' || !p.sessionId) {
          throw new BadRequestException('sessionId is required');
        }
        break;
      case 'other': {
        // Phase 2: expectedDeliveryDays is now required for newly-created
        // rewards. Legacy rows are handled on the read path — the writer
        // path always demands a positive integer 1..365.
        if (
          typeof p.expectedDeliveryDays !== 'number' ||
          !Number.isInteger(p.expectedDeliveryDays) ||
          p.expectedDeliveryDays < 1 ||
          p.expectedDeliveryDays > 365
        ) {
          throw new BadRequestException(
            'expectedDeliveryDays must be an integer between 1 and 365',
          );
        }
        break;
      }
    }
  }

  private async fulfill(
    reward: Reward,
    user: AuthenticatedUser,
    redemptionId: string,
    ctx: RedeemContext,
  ): Promise<{ payload: Record<string, unknown>; expiresAt?: Date | null }> {
    switch (reward.type as RewardType) {
      case 'discount_coupon':
        return this.fulfillDiscountCoupon(reward, user, redemptionId);
      case 'fixed_discount_coupon':
        return this.fulfillFixedDiscountCoupon(reward, user, redemptionId);
      case 'free_course':
        return this.fulfillFreeCourse(reward, user, ctx);
      case 'free_webinar':
        return this.fulfillFreeWebinar(reward, user);
      case 'other':
        return { payload: reward.payload as Record<string, unknown> };
      default:
        throw new BadRequestException(`Unknown reward type: ${reward.type}`);
    }
  }

  private async fulfillDiscountCoupon(
    reward: Reward,
    user: AuthenticatedUser,
    redemptionId: string,
  ) {
    const p = reward.payload as unknown as DiscountCouponPayload;
    const code = this.mintUniqueCode('PTS');
    const expiresAt = this.daysFromNow(p.expiryDays);
    const campaignId = await this.createSourceCampaign(
      reward,
      user,
      redemptionId,
    );
    await db.insert(discountCodes).values({
      code,
      type: 'percentage',
      value: p.percent.toFixed(2),
      maxUses: 1,
      maxUsesPerUser: 1,
      applicableCourses:
        p.scope === 'specific_courses' && p.scopeCourseIds?.length
          ? p.scopeCourseIds
          : [],
      validUntil: expiresAt,
      targetUserId: user.id,
      campaign: `Points Reward: ${reward.nameEn}`,
      campaignId,
      createdBy: user.id,
    });
    return {
      payload: { discountCode: code, percent: p.percent, expiresAt: expiresAt.toISOString() },
      expiresAt,
    };
  }

  private async fulfillFixedDiscountCoupon(
    reward: Reward,
    user: AuthenticatedUser,
    redemptionId: string,
  ) {
    const p = reward.payload as unknown as FixedDiscountCouponPayload;
    const code = this.mintUniqueCode('PTS');
    const expiresAt = this.daysFromNow(p.expiryDays);
    const campaignId = await this.createSourceCampaign(
      reward,
      user,
      redemptionId,
    );
    await db.insert(discountCodes).values({
      code,
      type: 'fixed',
      value: p.amountSar.toFixed(2),
      maxUses: 1,
      maxUsesPerUser: 1,
      applicableCourses:
        p.scope === 'specific_courses' && p.scopeCourseIds?.length
          ? p.scopeCourseIds
          : [],
      validUntil: expiresAt,
      targetUserId: user.id,
      campaign: `Points Reward: ${reward.nameEn}`,
      campaignId,
      createdBy: user.id,
    });
    return {
      payload: { discountCode: code, amountSar: p.amountSar, expiresAt: expiresAt.toISOString() },
      expiresAt,
    };
  }

  /**
   * Mint the coupon_campaigns row that owns the coupon minted by a points
   * reward. Populated so the finance dashboard can trace back from the
   * coupon detail drawer to the reward + redemption + user that spawned it.
   */
  private async createSourceCampaign(
    reward: Reward,
    user: AuthenticatedUser,
    redemptionId: string,
  ): Promise<string> {
    const p = reward.payload as unknown as
      | DiscountCouponPayload
      | FixedDiscountCouponPayload;
    const [row] = await db
      .insert(couponCampaigns)
      .values({
        name: `Points Reward: ${reward.nameEn}`.slice(0, 100),
        nameAr: reward.nameAr
          ? `مكافأة النقاط: ${reward.nameAr}`.slice(0, 100)
          : null,
        // Auto-mint campaigns are always private (no banner) and are
        // scoped exactly the same way as the coupon they own — the
        // coupon's own applicable_courses is what drives checkout, so
        // scope here is descriptive rather than functional.
        showOnSite: false,
        isActive: true,
        scope:
          p.scope === 'by_delivery_type'
            ? 'by_delivery_type'
            : p.scope === 'specific_courses'
              ? 'specific_courses'
              : 'all_paid',
        scopeCourseIds:
          p.scope === 'specific_courses' && p.scopeCourseIds?.length
            ? p.scopeCourseIds
            : [],
        scopeDeliveryTypes:
          p.scope === 'by_delivery_type' && p.deliveryTypes?.length
            ? p.deliveryTypes
            : [],
        discountType: 'none',
        sourceType: 'points_reward',
        sourceRewardId: reward.id,
        sourceRedemptionId: redemptionId,
        sourceUserId: user.id,
        createdBy: user.id,
      })
      .returning({ id: couponCampaigns.id });
    return row.id;
  }

  private async fulfillFreeCourse(
    reward: Reward,
    user: AuthenticatedUser,
    ctx: RedeemContext,
  ) {
    const ids = this.extractCourseIds(reward.payload);
    if (ids.length === 0) {
      throw new BadRequestException('This reward has no courses configured');
    }
    const targetCourseId =
      ids.length === 1 ? ids[0] : (ctx.selectedCourseId as string);
    // assertRedeemInput already validated selectedCourseId when needed,
    // but re-check defensively in case the payload changed mid-flight.
    if (!targetCourseId || !ids.includes(targetCourseId)) {
      throw new BadRequestException(
        'Selected course is not part of this reward',
      );
    }

    // Ensure the course is opted-in for free redemption; if not, opt it in
    // implicitly on behalf of the admin (they set it up here via the reward).
    const [existing] = await db
      .select()
      .from(courseRedemptionSettings)
      .where(eq(courseRedemptionSettings.courseId, targetCourseId))
      .limit(1);
    if (!existing) {
      await db.insert(courseRedemptionSettings).values({
        courseId: targetCourseId,
        redeemableForFree: true,
        freeUnlockCostPoints: reward.pointsCost,
      });
    } else if (!existing.redeemableForFree) {
      await db
        .update(courseRedemptionSettings)
        .set({ redeemableForFree: true, freeUnlockCostPoints: reward.pointsCost })
        .where(eq(courseRedemptionSettings.courseId, targetCourseId));
    }
    // Delegate to the existing (already-tested) free-course flow. It runs
    // its OWN debit + hold cycle — we credit our own hold back first so we
    // don't double-charge the student.
    // NB: this is a stopgap; longer-term the free-course path should be
    // refactored into a shared saga step. See followup.
    // (We already debited above; refund it before the inner service debits again.)
    await this.ledger.insert({
      userId: user.id,
      delta: reward.pointsCost,
      reason: 'redeem:released',
      sourceEntityType: 'reward_redemption',
      sourceEntityId: reward.id,
      idempotencyKey: `reward_freecoursepre:${reward.id}:${user.id}:${Date.now()}`,
      metadata: { reasonCode: 'delegate_to_free_course_saga' } as never,
    });

    // Pass source='reward' so the enrollment row shows the amber "reward"
    // chip on the student's My Courses card (not the violet "points" chip).
    // Same money in the ledger — different provenance for reporting.
    const inner = await this.pointsService.redeemCourseForFree(
      targetCourseId,
      user,
      { source: 'reward' },
    );
    // Look up the course title for the payload so the UI can show it.
    const [c] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, targetCourseId))
      .limit(1);
    return {
      payload: {
        courseId: targetCourseId,
        courseTitle: c?.title,
        enrollmentId: inner.enrollmentId,
        innerRedemptionId: inner.redemptionId,
      },
    };
  }

  private async fulfillFreeWebinar(reward: Reward, user: AuthenticatedUser) {
    const p = reward.payload as unknown as FreeWebinarPayload;
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
      })
      .from(sessions)
      .where(eq(sessions.id, p.sessionId))
      .limit(1);
    if (!session) throw new NotFoundException('Webinar session not found');

    const [me] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!me?.email) throw new BadRequestException('User email missing');

    // Idempotent insert — unique(sessionId, email); if already registered,
    // treat as successful fulfillment (they get their reward without paying
    // again with more points).
    await db
      .insert(webinarRegistrations)
      .values({
        sessionId: session.id,
        userId: user.id,
        email: me.email.toLowerCase(),
        firstName: me.firstName || null,
        lastName: me.lastName || null,
      })
      .onConflictDoNothing({
        target: [webinarRegistrations.sessionId, webinarRegistrations.email],
      });
    return {
      payload: {
        sessionId: session.id,
        sessionTitle: session.title,
      },
    };
  }

  private async compensateRefund(
    redemptionId: string,
    userId: string,
    points: number,
    reasonCode: string,
  ) {
    try {
      await this.ledger.insert({
        userId,
        delta: points,
        reason: 'redeem:released',
        sourceEntityType: 'reward_redemption',
        sourceEntityId: redemptionId,
        idempotencyKey: `reward_released:${redemptionId}`,
        metadata: { reasonCode } as never,
      });
    } catch (err) {
      // Idempotent — already refunded once. Log and move on.
      this.logger.warn(
        `Compensating credit for ${redemptionId} already exists: ${(err as Error).message}`,
      );
    }
    await db
      .update(rewardRedemptions)
      .set({
        status: 'failed',
        failureReason: reasonCode,
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          sql`${rewardRedemptions.status} IN ('pending','fulfilled')`,
        ),
      );
  }

  private mintUniqueCode(prefix: string): string {
    // 8 hex chars from crypto.randomBytes gives 4B combinations — more than
    // enough for the coupon namespace, still short enough to type manually.
    return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

// ─── DTO-ish input types (loose here to keep RewardsService self-contained;
// the controller layer wraps them in class-validator DTOs) ─────────────

export interface CreateRewardInput {
  nameEn: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  type: RewardType;
  pointsCost: number;
  payload: Record<string, unknown>;
  isActive?: boolean;
  displayOrder?: number;
  maxPerUser?: number | null;
  totalStock?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface UpdateRewardInput extends Partial<CreateRewardInput> {}
