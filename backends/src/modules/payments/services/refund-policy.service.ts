import { Injectable, Logger } from '@nestjs/common';
import { and, eq, exists, inArray, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  systemSettings,
  enrollments,
  courses,
  attendance,
  sessions,
  webinarRegistrations,
  certificateRequests,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

/**
 * Refund Policy — finance-manager-controlled rules that gate refund
 * eligibility based on enrollment lifecycle state, plus per-gateway
 * deduction settings used by the existing refund math.
 *
 * Single source of truth lives in `system_settings.refund_policy` (one
 * JSONB row). All reads pass through this service so the rules can be
 * changed at runtime without redeploy.
 */

export type GatewayKey = 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'mock';

export interface RefundPolicy {
  rules: {
    blockAfterCourseStart: boolean;
    blockAfterAttendance: boolean;
    blockAfterCertificate: boolean;
    /** Same underlying check as certificate (CME granted = cert approved
     * in this codebase) — kept as separate toggle for transparency. */
    blockAfterCmeGranted: boolean;
  };
  autoApproveEligible: boolean;
  perGateway: Record<
    GatewayKey,
    {
      deductionPercent: number;
      partialRefundCapable: boolean;
    }
  >;
}

export type EligibilityBlockReason =
  | 'course_started'
  | 'attendance_recorded'
  | 'certificate_issued'
  | 'cme_granted';

export interface EligibilityResult {
  eligible: boolean;
  blockedBy: EligibilityBlockReason | null;
  reason: string | null;
}

const DEFAULT_POLICY: RefundPolicy = {
  rules: {
    blockAfterCourseStart: true,
    blockAfterAttendance: true,
    blockAfterCertificate: true,
    blockAfterCmeGranted: true,
  },
  autoApproveEligible: false,
  perGateway: {
    // All four gateways support partial refunds per their respective API
    // docs — verified before flipping the BNPL flags from false to true:
    //   * Moyasar:     amount field on POST /payments/{id}/refund
    //   * Tabby:       amount + optional items[] on POST /payments/{id}/refunds
    //                  (per docs.tabby.ai/api-reference/payments/refund-a-payment)
    //   * Tamara:      total_amount on POST /payments/simplified-refund/{id}
    //                  (per docs.tamara.co/reference/simplifiedrefund — returns
    //                   status: "partially_refunded" if less than full sent)
    //   * Bank Transf: manual wire — finance enters whatever amount
    moyasar:       { deductionPercent: 0,  partialRefundCapable: true },
    tamara:        { deductionPercent: 10, partialRefundCapable: true },
    tabby:         { deductionPercent: 10, partialRefundCapable: true },
    bank_transfer: { deductionPercent: 0,  partialRefundCapable: true },
    mock:          { deductionPercent: 0,  partialRefundCapable: true },
  },
};

// Reserved for any gateway that genuinely does not support partial refunds.
// Currently empty — all four production gateways do (see DEFAULT_POLICY note).
// Kept as a one-line escape hatch so a future read-only or settle-only gateway
// can opt out without touching the policy merge code.
const NO_PARTIAL_REFUND_GATEWAYS: ReadonlySet<GatewayKey> = new Set();

const CATEGORY = 'refund_policy';
const CACHE_TTL_MS = 30_000;

@Injectable()
export class RefundPolicyService {
  private readonly logger = new Logger(RefundPolicyService.name);
  private cached: { policy: RefundPolicy; expiresAt: number } | null = null;

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Read the current policy. Returns defaults if the row doesn't exist
   * yet so the system always has a working policy even before the
   * finance manager has saved anything.
   */
  async getPolicy(): Promise<RefundPolicy> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.policy;
    }
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.category, CATEGORY))
      .limit(1);

    const policy = this.mergeWithDefaults(row?.value as Partial<RefundPolicy> | undefined);
    this.cached = { policy, expiresAt: Date.now() + CACHE_TTL_MS };
    return policy;
  }

  /**
   * Replace the policy wholesale. Caller is responsible for shape
   * validation (DTO layer). Invalidates the cache and audit-logs the
   * before/after for traceability.
   */
  async updatePolicy(
    input: RefundPolicy,
    actorId: string,
    ipAddress?: string,
  ): Promise<RefundPolicy> {
    const before = await this.getPolicy();
    const normalized = this.enforceGatewayConstraints(input);

    await db
      .insert(systemSettings)
      .values({
        category: CATEGORY,
        value: normalized,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.category,
        set: {
          value: normalized,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      });

    this.cached = null;

    await this.auditLogService.log({
      entityType: 'refund_policy',
      entityId: CATEGORY,
      action: 'refund_policy_updated',
      performedBy: actorId,
      ipAddress,
      metadata: { before, after: normalized },
    });

    return normalized;
  }

  /**
   * Resolve effective settings for a specific gateway. Falls back to
   * Moyasar's defaults if the gateway key is unknown so the math never
   * crashes on a misconfigured legacy payment.
   */
  resolveForGateway(
    policy: RefundPolicy,
    gateway: string,
  ): { deductionPercent: number; partialRefundCapable: boolean } {
    const key = gateway as GatewayKey;
    return policy.perGateway[key] ?? policy.perGateway.moyasar;
  }

  /**
   * Check whether an enrollment is still eligible for refund per the
   * current rules. Each rule is gated by its corresponding toggle.
   *
   * For self-paced courses we skip the course-start check entirely —
   * those don't have a "started" moment, and applying the gate would
   * effectively block all refunds for self-paced.
   */
  async checkEligibility(enrollmentId: string): Promise<EligibilityResult> {
    const policy = await this.getPolicy();

    const [enrollment] = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        studentId: enrollments.studentId,
      })
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);

    if (!enrollment) {
      // No enrollment to check (e.g., refund of a course that was
      // deleted) — allow through; existing refund flow will catch any
      // downstream issues.
      return { eligible: true, blockedBy: null, reason: null };
    }

    // ─── Rule 1: course start date ─────────────────────────────────
    if (policy.rules.blockAfterCourseStart) {
      const [course] = await db
        .select({
          deliveryType: courses.deliveryType,
          startDate: courses.startDate,
        })
        .from(courses)
        .where(eq(courses.id, enrollment.courseId))
        .limit(1);

      if (course && course.deliveryType !== 'self-paced' && course.startDate) {
        const startMs = new Date(course.startDate).getTime();
        if (startMs <= Date.now()) {
          return {
            eligible: false,
            blockedBy: 'course_started',
            reason: 'Refund not allowed after the course has started.',
          };
        }
      }
    }

    // ─── Rule 2: attendance recorded (live sessions or webinars) ───
    if (policy.rules.blockAfterAttendance) {
      const courseSessionIds = db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.courseId, enrollment.courseId));

      const hasLiveAttendance = await db
        .select({ one: sql<number>`1` })
        .from(attendance)
        .where(
          and(
            eq(attendance.studentId, enrollment.studentId),
            inArray(attendance.sessionId, courseSessionIds),
            inArray(attendance.status, ['present', 'late', 'excused']),
          ),
        )
        .limit(1);

      if (hasLiveAttendance.length > 0) {
        return {
          eligible: false,
          blockedBy: 'attendance_recorded',
          reason: 'Refund not allowed after attendance has been recorded.',
        };
      }

      const hasWebinarAttendance = await db
        .select({ one: sql<number>`1` })
        .from(webinarRegistrations)
        .where(
          and(
            eq(webinarRegistrations.userId, enrollment.studentId),
            eq(webinarRegistrations.attended, true),
            exists(
              db
                .select({ id: sessions.id })
                .from(sessions)
                .where(
                  and(
                    eq(sessions.id, webinarRegistrations.sessionId),
                    eq(sessions.courseId, enrollment.courseId),
                  ),
                ),
            ),
          ),
        )
        .limit(1);

      if (hasWebinarAttendance.length > 0) {
        return {
          eligible: false,
          blockedBy: 'attendance_recorded',
          reason: 'Refund not allowed after webinar attendance has been recorded.',
        };
      }
    }

    // ─── Rule 3 + 4: certificate issued / CME granted ──────────────
    // In this codebase CME hours are awarded with the certificate, so
    // both rules share the same DB check. We surface whichever rule the
    // operator has enabled (defaulting to certificate when both are on).
    if (policy.rules.blockAfterCertificate || policy.rules.blockAfterCmeGranted) {
      const [cert] = await db
        .select({ id: certificateRequests.id })
        .from(certificateRequests)
        .where(
          and(
            eq(certificateRequests.courseId, enrollment.courseId),
            eq(certificateRequests.studentId, enrollment.studentId),
            eq(certificateRequests.status, 'approved'),
          ),
        )
        .limit(1);

      if (cert) {
        const blockedBy: EligibilityBlockReason = policy.rules.blockAfterCertificate
          ? 'certificate_issued'
          : 'cme_granted';
        const reason = blockedBy === 'certificate_issued'
          ? 'Refund not allowed after the certificate has been issued.'
          : 'Refund not allowed after CME / CPD hours have been granted.';
        return { eligible: false, blockedBy, reason };
      }
    }

    return { eligible: true, blockedBy: null, reason: null };
  }

  private mergeWithDefaults(stored: Partial<RefundPolicy> | undefined): RefundPolicy {
    const merged: RefundPolicy = !stored
      ? DEFAULT_POLICY
      : {
          rules: { ...DEFAULT_POLICY.rules, ...(stored.rules ?? {}) },
          autoApproveEligible:
            stored.autoApproveEligible ?? DEFAULT_POLICY.autoApproveEligible,
          perGateway: {
            moyasar:       { ...DEFAULT_POLICY.perGateway.moyasar,       ...(stored.perGateway?.moyasar ?? {}) },
            tamara:        { ...DEFAULT_POLICY.perGateway.tamara,        ...(stored.perGateway?.tamara ?? {}) },
            tabby:         { ...DEFAULT_POLICY.perGateway.tabby,         ...(stored.perGateway?.tabby ?? {}) },
            bank_transfer: { ...DEFAULT_POLICY.perGateway.bank_transfer, ...(stored.perGateway?.bank_transfer ?? {}) },
            mock:          { ...DEFAULT_POLICY.perGateway.mock,          ...(stored.perGateway?.mock ?? {}) },
          },
        };
    return this.enforceGatewayConstraints(merged);
  }

  /**
   * Force `partialRefundCapable: false` on any gateway listed in
   * NO_PARTIAL_REFUND_GATEWAYS. Currently empty — kept as a guard against
   * future read-only gateways being toggled on with partial refunds
   * enabled in the DB row. Applied on read AND write to keep the cache,
   * the DB row, and the runtime in sync.
   */
  private enforceGatewayConstraints(policy: RefundPolicy): RefundPolicy {
    const perGateway = { ...policy.perGateway };
    for (const gw of NO_PARTIAL_REFUND_GATEWAYS) {
      if (perGateway[gw]) {
        perGateway[gw] = { ...perGateway[gw], partialRefundCapable: false };
      }
    }
    return { ...policy, perGateway };
  }
}
