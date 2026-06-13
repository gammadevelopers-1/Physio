import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import PDFDocument from 'pdfkit';
import { eq, and, or, desc, asc, sql, ilike, count, inArray, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../database';
import {
  tickets,
  ticketReplies,
  users,
  courses,
  userRoles,
  roles,
  slaPolicies,
  slaEvents,
  csatSurveys,
  courseRatings,
  supportConfig,
  supportMacros,
  supportMacroUses,
  kbArticles,
  kbCategories,
  enrollments,
  attendance,
  webinarRegistrations,
  sessions,
  submissions,
  certificateRequests,
  payments,
  supportTeamMembers,
  supportTeamRequests,
  ticketTags,
  ticketTagAssignments,
  ticketTagRules,
  type TagRuleScope,
  ticketAttachments,
  kbSearchEvents,
  attachmentDownloadEvents,
  ticketAttachmentScans,
  cronRuns,
  auditLogs,
  ticketHoldRequests,
  HOLD_REQUEST_STATUS,
  HOLD_REASONS,
  TICKET_STATUS,
  TICKET_PRIORITY,
  ROLE_NAMES,
  SUPPORT_SUB_ROLES,
  SLA_EVENT_TYPES,
  GUEST_USER_ID,
  SUPPORT_TEAM_REQUEST_KIND,
  SUPPORT_TEAM_REQUEST_STATUS,
  interventions,
  courseAssistants,
  ticketCollaborators,
  TICKET_COLLAB_DEPARTMENTS,
  type TicketCollabDepartment,
} from '../../database/schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AddCommentDto,
  ListTicketsQueryDto,
  CreateTicketOnBehalfDto,
  CreateMacroDto,
  UpdateMacroDto,
  CreateKbArticleDto,
  UpdateKbArticleDto,
} from './dto';
import {
  calculateBusinessMinutesElapsed,
  calculateBusinessDeadline,
  effectiveBusinessMinutesElapsed,
  effectiveOnHoldMinutes,
  isWithinBusinessHours,
  clampToBusinessHours,
  getNextBusinessOpen,
  setBusinessHoursConfig,
  getBusinessHoursConfig,
  refreshBusinessHoursConfigIfStale,
  describeExpectedResponse,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHoursConfig,
} from './business-hours.util';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';
import { RecaptchaService } from '../auth/recaptcha.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { RoleRequestsService } from '../role-requests/role-requests.service';

// Fallback auto-priority mapping for the 8 built-ins. Used only when the
// stored ticket_categories config row has no entry for that slug (which
// happens for built-ins by default; custom rows always carry their own
// autoPriority because the admin form requires it). See
// resolveCategoryPriority() for the live lookup that wraps this.
const CATEGORY_PRIORITY_MAP: Record<string, string> = {
  billing: TICKET_PRIORITY.HIGH,
  login: TICKET_PRIORITY.HIGH,
  technical: TICKET_PRIORITY.HIGH,
  webinar: TICKET_PRIORITY.HIGH,
  certificate: TICKET_PRIORITY.MEDIUM,
  cme: TICKET_PRIORITY.MEDIUM,
  content: TICKET_PRIORITY.LOW,
  other: TICKET_PRIORITY.LOW,
};

// ─── Attachment validation ───────────────────────────────────
//
// The createTicket DTO accepts an `attachmentUrl: string` that the
// client gets back from POST /api/storage/upload. Without server-side
// validation a malicious client could:
//   1) Submit any external URL — turning the platform into an open
//      redirect (and a phishing vector when staff click).
//   2) Submit a URL pointing to a non-allowlisted file type (e.g. .exe)
//      that survived the upload (because they didn't go through /upload
//      at all).
// We therefore enforce two checks at ticket creation:
//   - The URL must point at one of OUR storage origins (local serve
//     route, or a known GCS bucket host).
//   - The extension must be in the allowlist below.
// Size is enforced upstream by the upload endpoint (10MB cap in
// storage.controller.ts); we can't re-check it here without a HEAD
// request, which isn't worth the latency for a single chip.
// Kept aligned with the /storage/upload MIME allowlist (PDF + JPEG/PNG/
// WebP). If we ever broaden one we should broaden both — diverging would
// either reject valid uploads at ticket-create time or accept files we
// can't actually serve.
export const TICKET_ATTACHMENT_ALLOWED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
] as const;

export const TICKET_ATTACHMENT_MAX_URL_LENGTH = 500;

export function validateTicketAttachmentUrl(
  url: string | null | undefined,
): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > TICKET_ATTACHMENT_MAX_URL_LENGTH) {
    throw new BadRequestException('Attachment URL is too long');
  }

  // Resolve the URL so we can inspect the host + path. URLs that don't
  // parse (e.g. a raw `../../etc/passwd`) bail with a 400 — never a 5xx.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('Attachment URL is malformed');
  }

  // Allowed origins: our own storage proxy (path-prefix match) or a
  // known GCS bucket. We don't lock to a single host name because the
  // app runs across Cloud Run revisions + a static GCS bucket;
  // matching on the path prefix is sufficient.
  const pathLower = parsed.pathname.toLowerCase();
  const host = parsed.host.toLowerCase();
  const isLocalStoragePath = pathLower.startsWith('/api/storage/files/');
  const isGcsHost =
    host.endsWith('.storage.googleapis.com') ||
    host === 'storage.googleapis.com' ||
    host === 'storage.cloud.google.com';
  if (!isLocalStoragePath && !isGcsHost) {
    throw new BadRequestException(
      'Attachments must be uploaded through our storage endpoint',
    );
  }

  // Extension allowlist. We pull the last `.` segment of the path and
  // lowercase it; query strings are stripped because pathname excludes
  // them.
  const lastDot = pathLower.lastIndexOf('.');
  const ext =
    lastDot >= 0 && lastDot < pathLower.length - 1
      ? pathLower.slice(lastDot + 1)
      : '';
  if (
    !(TICKET_ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    throw new BadRequestException(
      `Attachment type ".${ext || 'unknown'}" is not allowed. Use one of: ${TICKET_ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')}.`,
    );
  }

  return trimmed;
}

@Injectable()
export class SupportService implements OnModuleInit {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly notificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    private readonly recaptchaService: RecaptchaService,
    private readonly adminNotifications: NotificationsService,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly roleRequestsService: RoleRequestsService,
  ) {}

  // Stable action labels for support audit-log entries — used both when
  // writing rows and when filtering the admin audit-trail surface.
  // Keep the names short and machine-readable; the FE maps them to
  // translated display strings.
  private static readonly SUPPORT_AUDIT_ACTIONS = {
    TICKET_CREATED: 'ticket_created',
    TICKET_REPLIED: 'ticket_replied',
    INTERNAL_NOTE_ADDED: 'internal_note_added',
    ASSIGNEE_CHANGED: 'assignee_changed',
    PRIORITY_CHANGED: 'priority_changed',
    STATUS_CHANGED: 'status_changed',
    TICKET_RESOLVED: 'ticket_resolved',
    TICKET_CLOSED: 'ticket_closed',
    TICKET_REOPENED: 'ticket_reopened',
    TICKET_MERGED: 'merged',
    TICKET_MERGE_RECEIVED: 'merge_received',
    TICKET_TRANSFERRED: 'transferred',
    TAG_ADDED: 'tag_added',
    TAG_REMOVED: 'tag_removed',
    TAG_AUTO_APPLIED: 'tag_auto_applied',
    TICKET_ESCALATED: 'ticket_escalated',
  } as const;

  // Load business-hours config from DB on boot so SLA math reflects
  // the admin's saved settings without a process restart. Falls back
  // to the util's defaults if the row is missing or unreadable.
  async onModuleInit() {
    try {
      const cfg = await this.getBusinessHours();
      setBusinessHoursConfig(cfg);
    } catch (err) {
      this.logger.warn(
        `Failed to bootstrap business hours from DB — using defaults. ${err}`,
      );
    }
  }

  // Build the public tracking URL a guest uses to follow + reply to
  // their ticket. Honours the FRONTEND_URL env (set by the infra deploy
  // script) so dev/staging point at the right host. Falls back to the
  // production marketing domain.
  private buildGuestTrackingUrl(trackingToken: string): string {
    const base =
      (process.env.FRONTEND_URL || '').split(',')[0].trim() ||
      'https://www.physioguidance.org';
    return `${base.replace(/\/$/, '')}/en/support/track/${trackingToken}`;
  }

  // ─── Agent Ownership Check ──────────────────────────────
  // Ensures that non-supervisor agents can only act on tickets
  // assigned to them. Supervisors and admins bypass this check.

  private async assertAgentOwnership(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    // Supervisors and admins can access any ticket
    if (isSupervisorOrAdmin) return;

    // Students are handled separately in each method — skip here
    const isSupportAgent = user.roles.includes(ROLE_NAMES.SUPPORT);
    if (!isSupportAgent) return;

    // Agent: must be the assignee
    const [ticket] = await db
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.assigneeId !== user.id) {
      throw new ForbiddenException(
        'You are not assigned to this ticket',
      );
    }
  }

  // ─── About-user context composition ─────────────────────
  //
  // Builds the inline context block that gets prepended to the ticket
  // description when one party files about another (instructor → support
  // follow-up about a student). Lives server-side so the agent sees the
  // same fields the FE card shows, and so audit-log / email exports
  // carry the context inline.
  //
  // Defensive: every lookup is wrapped so a missing enrollment / no
  // assessments / blank name never break ticket creation. Worst case we
  // surface a smaller block — never blow up the parent flow.
  private async composeAboutUserContextBlock(
    aboutUserId: string,
    courseId: string | null,
  ): Promise<string | null> {
    try {
      const [user] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, aboutUserId))
        .limit(1);
      if (!user) return null;

      const name =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const lines: string[] = [];
      lines.push('─── About this student ───');
      lines.push(`Name: ${name}`);
      lines.push(`Email: ${user.email}`);

      // Pick the focal enrollment — the courseId the filer chose, or
      // fall back to the student's most recent active enrollment.
      let focalCourseId = courseId;
      if (focalCourseId) {
        const [enrol] = await db
          .select({
            courseId: enrollments.courseId,
            progress: enrollments.progress,
            enrolledAt: enrollments.enrolledAt,
            lastAccessedAt: enrollments.lastAccessedAt,
            status: enrollments.status,
            title: courses.title,
            titleAr: courses.titleAr,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .where(
            and(
              eq(enrollments.studentId, aboutUserId),
              eq(enrollments.courseId, focalCourseId),
            ),
          )
          .limit(1);
        if (enrol) {
          lines.push(`Course: ${enrol.title}`);
          lines.push(
            `Enrolled: ${enrol.enrolledAt ? enrol.enrolledAt.toISOString().slice(0, 10) : '—'}`,
          );
          lines.push(`Progress: ${enrol.progress ?? 0}%`);
          if (enrol.lastAccessedAt) {
            const days = Math.floor(
              (Date.now() - enrol.lastAccessedAt.getTime()) /
                (1000 * 60 * 60 * 24),
            );
            lines.push(`Last accessed: ${days} day(s) ago`);
          }
        } else {
          focalCourseId = null;
        }
      }

      // Attendance percentage on the focal course's sessions. Pull all
      // sessions for the course, count present+late vs total. Cheap
      // single aggregate query.
      if (focalCourseId) {
        const [att] = await db
          .select({
            attended: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as(
              'attended',
            ),
            total: sql<number>`COUNT(*)`.as('total'),
          })
          .from(attendance)
          .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
          .where(
            and(
              eq(sessions.courseId, focalCourseId),
              eq(attendance.studentId, aboutUserId),
            ),
          );
        const attended = Number(att?.attended || 0);
        const total = Number(att?.total || 0);
        if (total > 0) {
          const pct = Math.round((attended / total) * 100);
          lines.push(`Attendance: ${pct}% (${attended}/${total} sessions)`);
        }
      }

      // Recent assessment average — last 5 graded submissions across
      // this student's record. Filtered to the focal course's
      // assessments if we have one.
      const subWhere = focalCourseId
        ? and(
            eq(submissions.studentId, aboutUserId),
            isNotNull(submissions.percentage),
            sql`${submissions.assessmentId} IN (
              SELECT id FROM assessments WHERE course_id = ${focalCourseId}
            )`,
          )
        : and(
            eq(submissions.studentId, aboutUserId),
            isNotNull(submissions.percentage),
          );
      const recentSubs = await db
        .select({ percentage: submissions.percentage })
        .from(submissions)
        .where(subWhere)
        .orderBy(desc(submissions.submittedAt))
        .limit(5);
      if (recentSubs.length > 0) {
        const avg =
          recentSubs.reduce(
            (sum, s) => sum + Number(s.percentage || 0),
            0,
          ) / recentSubs.length;
        lines.push(
          `Recent assessment average: ${avg.toFixed(0)}% (last ${recentSubs.length})`,
        );
      }

      return lines.join('\n');
    } catch (err) {
      this.logger.warn(
        `composeAboutUserContextBlock failed for user ${aboutUserId}: ${err}`,
      );
      return null;
    }
  }

  // ─── Create Ticket ──────────────────────────────────────

  async createTicket(userId: string, dto: CreateTicketDto) {
    // Refresh business-hours cache if stale before we compute the SLA
    // deadline shown to the customer — guards against the "wrong ETA"
    // race on a Cloud Run instance that didn't handle the admin PATCH.
    await refreshBusinessHoursConfigIfStale(() => this.getBusinessHours());

    // Priority always auto-assigned by category — student input ignored (PR-09).
    // Live resolution consults admin-managed categories so custom slugs work.
    const { priority: autoPriority, isValidSlug } =
      await this.resolveCategoryPriority(dto.category);
    if (!isValidSlug) {
      throw new BadRequestException(
        `Unknown category "${dto.category}". Ask an admin to add it under Settings → Categories.`,
      );
    }

    // Phase 2 — enforce course requirement per category. Categories
    // flagged requiresCourse=true (refund_invoice, course_content,
    // certificate, etc.) must carry a courseId so support has
    // immediate context and the loop-in modal can scope course-bound
    // depts (instructor / ta / course_manager) to the right people.
    const allCategories = await this.listTicketCategories();
    const categoryDef = allCategories.find((c) => c.slug === dto.category);
    if (categoryDef?.requiresCourse && !dto.courseId) {
      throw new BadRequestException({
        message: 'course_required_for_category',
        category: dto.category,
      });
    }

    // Round-robin: find agent with fewest open tickets
    const assigneeId = await this.findNextAgent();

    // Build the full attachment list. We accept three input shapes:
    //   - dto.attachmentUrl  — legacy single URL
    //   - dto.attachmentUrls — URL-only multi (older clients)
    //   - dto.attachments    — rich multi with filename/mimeType/size
    // Rich entries are preferred when both rich + URL-only carry the
    // same URL, because we want the metadata. URL validation runs on
    // every entry; metadata is sanitized to safe lengths/types.
    const rich = Array.isArray(dto.attachments) ? dto.attachments : [];
    const multi = Array.isArray(dto.attachmentUrls) ? dto.attachmentUrls : [];
    const combinedRaw: {
      url: string;
      filename?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }[] = [
      ...(dto.attachmentUrl
        ? [{ url: dto.attachmentUrl }]
        : []),
      ...multi.map((u) => ({ url: u })),
      ...rich.map((a) => ({
        url: a.url,
        filename: a.filename ?? null,
        mimeType: a.mimeType ?? null,
        sizeBytes: a.sizeBytes ?? null,
      })),
    ]
      .map((a) => ({ ...a, url: typeof a.url === 'string' ? a.url.trim() : '' }))
      .filter((a) => Boolean(a.url));

    // Dedupe by URL but keep the entry with the richest metadata.
    const byUrl = new Map<
      string,
      {
        url: string;
        filename?: string | null;
        mimeType?: string | null;
        sizeBytes?: number | null;
      }
    >();
    for (const raw of combinedRaw) {
      const safe = validateTicketAttachmentUrl(raw.url);
      if (!safe) continue;
      const prev = byUrl.get(safe);
      if (!prev) {
        byUrl.set(safe, { ...raw, url: safe });
      } else {
        byUrl.set(safe, {
          url: safe,
          filename: prev.filename || raw.filename || null,
          mimeType: prev.mimeType || raw.mimeType || null,
          sizeBytes:
            prev.sizeBytes != null && prev.sizeBytes >= 0
              ? prev.sizeBytes
              : raw.sizeBytes ?? null,
        });
      }
    }
    const safeAttachments = Array.from(byUrl.values());
    const safeAttachmentUrls = safeAttachments.map((a) => a.url);
    // Single-column legacy slot still holds the first attachment so
    // pre-junction code paths (older email templates, exports) keep
    // working without reading the new table.
    const firstAttachmentUrl = safeAttachmentUrls[0] ?? null;

    // The description is now the filer's note verbatim — no auto-
    // prepended student context. The structured student card on the
    // ticket detail (composeAboutUserCard / AboutThisStudentCard FE)
    // already shows the same data more cleanly, so the inline block
    // is redundant and ugly. Exports + emails read the card too.
    const finalDescription = dto.description;

    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId: userId,
        category: dto.category,
        priority: autoPriority,
        subject: dto.subject,
        description: finalDescription,
        courseId: dto.courseId || null,
        attachmentUrl: firstAttachmentUrl,
        status: TICKET_STATUS.NEW,
        assigneeId,
        aboutUserId: dto.aboutUserId || null,
        source: dto.source || null,
      })
      .returning();

    // ─── Auto-tag intervention tickets ─────────────────────
    // Tag `at-risk-follow-up` so supervisors can filter the queue by
    // these high-context tickets. Tag creation is idempotent —
    // existing rows are matched, missing ones are seeded once.
    if (dto.source === 'intervention') {
      try {
        await this.applyAutoTag(ticket.id, 'at-risk-follow-up', userId);
      } catch (err) {
        this.logger.warn(
          `Failed to auto-tag intervention ticket ${ticket.id}: ${err}`,
        );
      }
    }

    // Junction rows — one per URL. The (ticket_id, url) unique index
    // means onConflictDoNothing absorbs accidental double-submits.
    if (safeAttachments.length > 0) {
      try {
        await db
          .insert(ticketAttachments)
          .values(
            safeAttachments.map((a) => ({
              ticketId: ticket.id,
              url: a.url,
              uploadedBy: userId,
              filename: a.filename || null,
              mimeType: a.mimeType || null,
              sizeBytes: a.sizeBytes != null ? a.sizeBytes : -1,
            })),
          )
          .onConflictDoNothing();
      } catch (err) {
        // Don't fail the ticket create over a junction insert hiccup —
        // log so ops can spot a pattern of dropped attachment rows.
        this.logger.warn(
          `Failed to insert ticket_attachments for ticket ${ticket.id}: ${err}`,
        );
      }

      // Record a 'pending' scan row per attachment. The pluggable scanner
      // (ClamAV side-car, Cloud Storage scanner, manual) writes back to
      // the same row.
      for (const url of safeAttachmentUrls) {
        await this.recordAttachmentScanPending(ticket.id, url);
      }
    }

    // Step 4: Calculate SLA deadline (P-04)
    const [slaPolicy] = await db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.priority, autoPriority));

    // Expected-response phrasing branches on whether the ticket was
    // submitted during business hours. In-hours → "4 hours". Off-hours
    // → "Sunday at 9:00 AM AST" (when the team is next online). The
    // structured fields ride along so the FE pill can re-render in any
    // locale without recomputing.
    const expected = slaPolicy
      ? describeExpectedResponse(ticket.createdAt, slaPolicy.frtMinutes)
      : null;
    const expectedResponseTime = expected ? expected.deadline.toISOString() : null;
    const expectedResponsePhrasing = expected
      ? expected.phrasing
      : 'within business hours';
    const expectedResponseMode = expected ? expected.mode : null;

    // Step 5: Notifications (P-01, SYS-05)
    // Notify student: ticket received
    try {
      const learnerNoticeBody =
        expected?.mode === 'queued_until_resume'
          ? `Your ticket ${ticket.referenceNumber} is queued. We'll respond when business hours resume on ${expected.phrasing}.`
          : `Your ticket ${ticket.referenceNumber} has been received. Expected response within ${expected?.phrasing ?? 'business hours'}.`;
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ticket_created',
        title: 'Ticket Received',
        message: learnerNoticeBody,
        link: `/dashboard/student/support`,
        entityType: 'ticket',
        entityId: ticket.id,
      });

      // Notify agent: new ticket assigned (respects support staff in-app master)
      if (assigneeId && (await this.shouldNotifySupport(assigneeId, 'inApp'))) {
        await this.notificationsService.create({
          recipientId: assigneeId,
          type: 'ticket_assigned',
          title: 'New Ticket Assigned',
          message: `New ${autoPriority.toUpperCase()} priority ticket: "${ticket.subject}"`,
          link: `/dashboard/support/agent/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      }
    } catch {
      // Notifications are non-blocking (P-07)
    }

    // Send email to student. Email phrasing matches the in-app
    // notification — in-hours = "within 4 hours"; off-hours = "when
    // business hours resume on Sunday at 9:00 AM AST".
    try {
      const [studentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, userId));
      if (studentInfo?.email) {
        await this.emailService.sendTicketCreatedLearner(
          studentInfo.email,
          studentInfo.firstName || 'Student',
          ticket.referenceNumber,
          expectedResponsePhrasing,
          expectedResponseMode || undefined,
        );
      }
    } catch { /* non-blocking */ }

    // Send email to agent. Initial assignment is treated as a
    // transactional event — the agent needs to know they own a ticket
    // even if their general notification prefs are off. (Routine
    // reassignments downstream still respect prefs.)
    if (assigneeId) {
      try {
        const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, assigneeId));
        if (agentInfo?.email) {
          await this.emailService.sendTicketAssignedAgent(
            agentInfo.email,
            agentInfo.firstName || 'Agent',
            ticket.referenceNumber,
            dto.subject,
            autoPriority,
            expectedResponsePhrasing,
          );
        }
      } catch { /* non-blocking */ }
    }

    // Audit log — ticket creation is the first event on the trail.
    await this.auditLogService.log({
      entityType: 'ticket',
      entityId: ticket.id,
      action: SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_CREATED,
      performedBy: userId,
      metadata: {
        referenceNumber: ticket.referenceNumber,
        subject: dto.subject,
        category: dto.category,
        priority: autoPriority,
        assigneeId: assigneeId || null,
      },
    });

    // Auto-tag rule engine — scans subject + description against every
    // enabled rule on non-archived tags and attaches matches. Failure
    // is swallowed: ticket creation has already committed, so a bad
    // rule shouldn't surface as "creation failed".
    try {
      const matches = await this.matchAutoApplyTags({
        subject: dto.subject,
        description: dto.description,
      });
      if (matches.length > 0) {
        await this.applyAutoTagsToTicket(ticket.id, userId, matches);
      }
    } catch (err) {
      this.logger.warn(
        `Auto-tag scan failed for ticket ${ticket.id}: ${err}`,
      );
    }

    return {
      ...ticket,
      expectedResponseTime,
      expectedResponsePhrasing,
      expectedResponseMode,
      slaPolicy: slaPolicy || null,
    };
  }

  // ─── List Tickets ──────────────────────────────────────

  async listTickets(
    user: AuthenticatedUser,
    query: ListTicketsQueryDto,
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const offset = (page - 1) * limit;

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const conditions: any[] = [];

    // Non-support users can only see their own tickets
    if (!isSupportOrAdmin) {
      conditions.push(eq(tickets.studentId, user.id));
    }

    // Agent isolation: non-supervisor support agents can only see their
    // own assigned tickets. Supervisors and admins see everything.
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (isSupportOrAdmin && !isSupervisorOrAdmin) {
      conditions.push(eq(tickets.assigneeId, user.id));
    }

    if (query.status) conditions.push(eq(tickets.status, query.status));
    if (query.priority) conditions.push(eq(tickets.priority, query.priority));
    if (query.category) conditions.push(eq(tickets.category, query.category));
    if (query.assigneeId) conditions.push(eq(tickets.assigneeId, query.assigneeId));
    if (query.source) {
      // Role-aligned source filters need to include their provenance
      // variants. Intervention tickets filed from the instructor's
      // at-risk panel carry `source='intervention'`, not 'instructor'
      // — without this expansion they'd silently drop out of the
      // instructor's Support tab even though the instructor IS the
      // requester. Same idea applies to any future `at_risk_alert`
      // automated tickets.
      const SOURCE_EXPANSION: Record<string, string[]> = {
        instructor: ['instructor', 'intervention', 'at_risk_alert'],
        course_manager: ['course_manager'],
        ta: ['ta'],
        finance: ['finance'],
      };
      const accepted = SOURCE_EXPANSION[query.source] ?? [query.source];
      conditions.push(
        accepted.length === 1
          ? eq(tickets.source, accepted[0])
          : inArray(tickets.source, accepted),
      );
    }
    if (query.escalated === '1' || query.escalated === 'true') {
      conditions.push(isNotNull(tickets.escalatedAt));
    } else if (query.escalated === '0' || query.escalated === 'false') {
      conditions.push(isNull(tickets.escalatedAt));
    }

    // Tag filter: AND semantics — every requested tag must be present.
    // Implemented as a correlated EXISTS subquery per tag so additional
    // chips compose without multiplying the join.
    if (query.tags) {
      const tagIds = query.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const tagId of tagIds) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${ticketTagAssignments}
            WHERE ${ticketTagAssignments.ticketId} = ${tickets.id}
              AND ${ticketTagAssignments.tagId} = ${tagId}
          )`,
        );
      }
    }
    if (query.search) {
      // Match on subject, human-readable reference (e.g. "T-000123"),
      // or customer name/email. The reference column is the primary
      // way staff find a ticket from an email or phone call, so it
      // sits at the top of the OR chain. Customer columns are on the
      // joined `users` row; the join is added below.
      //
      // NB: we deliberately do NOT ILIKE on tickets.id — Postgres
      // can't apply ILIKE to a uuid column without a ::text cast, so
      // including it errors the whole query and silently breaks
      // search across the list view. Users search by reference
      // (T-000123), not by raw UUID.
      const term = query.search.trim();
      conditions.push(
        or(
          ilike(tickets.referenceNumber, `%${term}%`),
          ilike(tickets.subject, `%${term}%`),
          ilike(users.firstName, `%${term}%`),
          ilike(users.lastName, `%${term}%`),
          ilike(users.email, `%${term}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Second alias of `users` so we can join twice: once for the student
    // (ticket creator) and once for the assignee (support agent).
    const assigneeUsers = alias(users, 'assignee_users');

    const [ticketsList, totalResult, policies] = await Promise.all([
      db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          studentId: tickets.studentId,
          category: tickets.category,
          priority: tickets.priority,
          subject: tickets.subject,
          status: tickets.status,
          assigneeId: tickets.assigneeId,
          firstResponseAt: tickets.firstResponseAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
          onHoldAt: tickets.onHoldAt,
          onHoldTotalMinutes: tickets.onHoldTotalMinutes,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          resolvedAt: tickets.resolvedAt,
          closedAt: tickets.closedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
          studentIdRaw: tickets.studentId,
          guestName: tickets.guestName,
          guestEmail: tickets.guestEmail,
          assigneeFirstName: assigneeUsers.firstName,
          assigneeLastName: assigneeUsers.lastName,
          escalatedAt: tickets.escalatedAt,
        })
        .from(tickets)
        .leftJoin(users, eq(tickets.studentId, users.id))
        .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
        .where(where)
        .orderBy(desc(tickets.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(tickets)
        .leftJoin(users, eq(tickets.studentId, users.id))
        .where(where),
      db.select().from(slaPolicies),
    ]);

    // Compute FRT + TTR remaining-minutes per ticket so the UI can show
    // SLA timers without re-fetching policies. Negative = breached.
    // `null` when the ticket is in a terminal state where the SLA no
    // longer ticks (resolved, closed) or there is no policy for the
    // priority.
    const policyMap = new Map(policies.map((p) => [p.priority, p]));
    const TERMINAL_STATUSES = new Set([
      TICKET_STATUS.RESOLVED,
      TICKET_STATUS.CLOSED,
    ]);

    // Hoist once so every row sees the same `now` and pause snapshot.
    // Off-hours is a process-wide state; per-row checks would re-read
    // the same clock and waste cycles.
    const listNow = new Date();
    const listInBusinessHours = isWithinBusinessHours(listNow);

    const enriched = ticketsList.map((t) => {
      const policy = policyMap.get(t.priority);
      const terminal = TERMINAL_STATUSES.has(t.status as any);

      let frtRemainingMinutes: number | null = null;
      let ttrRemainingMinutes: number | null = null;

      if (policy && !terminal) {
        // Use the helper so on-hold tickets correctly subtract the
        // in-flight hold period from elapsed. The previous FRT path
        // didn't subtract holds at all, so a ticket sitting on hold
        // before first response would breach FRT on the list view
        // even though the per-ticket detail showed it paused.
        const effective = effectiveBusinessMinutesElapsed(t, listNow);
        if (!t.firstResponseAt) {
          frtRemainingMinutes = policy.frtMinutes - effective;
        }
        ttrRemainingMinutes = policy.ttrMinutes - effective;
      }

      // Per-row pause flag so the list/badge views have the SAME
      // source of truth as the per-ticket detail view. Without this
      // the FE falls back to the global supportOnline signal, which
      // drifts from BE math (on-hold tickets never showed as paused
      // in the list, and a manual admin online-toggle could hide the
      // off-hours pause). Terminal tickets are never paused.
      const onHold = t.status === TICKET_STATUS.ON_HOLD;
      const slaPaused = !terminal && (onHold || !listInBusinessHours);
      const slaPausedReason: 'on_hold' | 'off_hours' | null = !slaPaused
        ? null
        : onHold
          ? 'on_hold'
          : 'off_hours';

      // Guest overlay — for tickets opened anonymously via the public
      // form, the joined `users` row is the GUEST sentinel ("Guest User"
      // / guest@system.internal). Surface the real submitter name and
      // email the form captured, and flag the row so the FE can render
      // a small "Guest" indicator if it wants to.
      const isGuestTicket = t.studentIdRaw === GUEST_USER_ID;
      let studentFirstName = t.studentFirstName;
      let studentLastName = t.studentLastName;
      let studentEmail = t.studentEmail;
      if (isGuestTicket) {
        if (t.guestName) {
          const parts = t.guestName.trim().split(/\s+/);
          studentFirstName = parts[0] || t.guestName;
          studentLastName = parts.slice(1).join(' ') || null;
        }
        if (t.guestEmail) studentEmail = t.guestEmail;
      }
      return {
        ...t,
        studentFirstName,
        studentLastName,
        studentEmail,
        isGuestTicket,
        frtRemainingMinutes,
        ttrRemainingMinutes,
        slaPaused,
        slaPausedReason,
      };
    });

    // Bulk-fetch tag assignments for the rendered page in one query, then
    // group by ticketId in memory. Avoids the N+1 we'd get from a
    // per-ticket call to getTicketTags().
    const ticketIds = enriched.map((t) => t.id);
    const tagsByTicket = new Map<
      string,
      { id: string; name: string; color: string }[]
    >();
    if (ticketIds.length > 0) {
      const tagRows = await db
        .select({
          ticketId: ticketTagAssignments.ticketId,
          id: ticketTags.id,
          name: ticketTags.name,
          color: ticketTags.color,
        })
        .from(ticketTagAssignments)
        .innerJoin(
          ticketTags,
          eq(ticketTagAssignments.tagId, ticketTags.id),
        )
        .where(inArray(ticketTagAssignments.ticketId, ticketIds))
        .orderBy(asc(ticketTags.name));
      for (const row of tagRows) {
        const list = tagsByTicket.get(row.ticketId) ?? [];
        list.push({ id: row.id, name: row.name, color: row.color });
        tagsByTicket.set(row.ticketId, list);
      }
    }

    const withTags = enriched.map((t) => ({
      ...t,
      tags: tagsByTicket.get(t.id) ?? [],
    }));

    return {
      tickets: withTags,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    };
  }

  // ─── Get Ticket Detail ──────────────────────────────────

  async getTicketDetail(user: AuthenticatedUser, ticketId: string) {
    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        category: tickets.category,
        priority: tickets.priority,
        subject: tickets.subject,
        description: tickets.description,
        attachmentUrl: tickets.attachmentUrl,
        courseId: tickets.courseId,
        status: tickets.status,
        assigneeId: tickets.assigneeId,
        satisfactionRating: tickets.satisfactionRating,
        firstResponseAt: tickets.firstResponseAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        onHoldReason: tickets.onHoldReason,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        mergedIntoTicketId: tickets.mergedIntoTicketId,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
        aboutUserId: tickets.aboutUserId,
        source: tickets.source,
        escalatedAt: tickets.escalatedAt,
        escalatedBy: tickets.escalatedBy,
        escalationReason: tickets.escalationReason,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Phase 2 — collaborator admission. A user who isn't support/admin
    // and isn't the requester may still be a looped-in collaborator,
    // in which case they get to see both public + internal channels
    // (but the controller hides the right-panel collab list from
    // non-staff via the viewerRole field).
    const isRequester = ticket.studentId === user.id;
    const isCollab =
      !isSupportOrAdmin && !isRequester
        ? await this.isCollaborator(ticketId, user.id)
        : false;

    // Access check: owner, support/admin, OR active collaborator.
    if (!isSupportOrAdmin && !isRequester && !isCollab) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Agent isolation: non-supervisor agents can only view their assigned tickets
    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    // Fetch comments. Requesters never see internal notes; support/admin
    // and active collaborators see both channels.
    const commentsConditions = [eq(ticketReplies.ticketId, ticketId)];
    if (!isSupportOrAdmin && !isCollab) {
      commentsConditions.push(eq(ticketReplies.isInternal, false));
    }

    const commentRows = await db
      .select({
        id: ticketReplies.id,
        message: ticketReplies.message,
        isStaffReply: ticketReplies.isStaffReply,
        isInternal: ticketReplies.isInternal,
        createdAt: ticketReplies.createdAt,
        userId: ticketReplies.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(ticketReplies)
      .leftJoin(users, eq(ticketReplies.userId, users.id))
      .where(and(...commentsConditions))
      .orderBy(asc(ticketReplies.createdAt));

    // Bulk-fetch reply-level attachments for the rendered comments in a
    // single query, then enrich each with the GCS scan verdict. A reply
    // typically has 0–3 files; we keep the bulk to one query but still
    // hit the scan-status helper per file because the verdict comes
    // from object metadata, not the DB.
    type ReplyAttachment = {
      id: string;
      url: string;
      filename: string | null;
      sizeBytes: number | null;
      mimeType: string | null;
      uploadedAt: Date;
      scanStatus: 'clean' | 'pending' | 'quarantined' | 'unknown';
      scannedAt: string | null;
    };
    const replyIds = commentRows.map((c) => c.id);
    const replyAttachmentsByReply = new Map<string, ReplyAttachment[]>();

    if (replyIds.length > 0) {
      const rows = await db
        .select({
          id: ticketAttachments.id,
          replyId: ticketAttachments.replyId,
          url: ticketAttachments.url,
          filename: ticketAttachments.filename,
          sizeBytes: ticketAttachments.sizeBytes,
          mimeType: ticketAttachments.mimeType,
          uploadedAt: ticketAttachments.uploadedAt,
        })
        .from(ticketAttachments)
        .where(
          and(
            inArray(ticketAttachments.replyId, replyIds),
            // Soft-delete filter — removed attachments only surface
            // via the explicit /attachment-history endpoint.
            isNull(ticketAttachments.removedAt),
          ),
        );
      for (const row of rows) {
        if (!row.replyId) continue;
        const scan = await this.lookupScanStatusForUrl(row.url);
        const enriched = {
          id: row.id,
          url: row.url,
          filename: row.filename,
          sizeBytes: row.sizeBytes,
          mimeType: row.mimeType,
          uploadedAt: row.uploadedAt,
          scanStatus: scan.status,
          scannedAt: scan.scannedAt,
        };
        const bucket = replyAttachmentsByReply.get(row.replyId) || [];
        bucket.push(enriched);
        replyAttachmentsByReply.set(row.replyId, bucket);
      }
    }

    // Resolve each commenter's primary role so the FE can show a more
    // specific badge than just "Staff" — admin / supervisor / agent /
    // student. Batched in a single query keyed by distinct userIds; the
    // pick order below picks the most-meaningful role when a user holds
    // multiple (rare, but possible for super admins).
    const distinctCommenterIds = Array.from(
      new Set(commentRows.map((c) => c.userId).filter((id): id is string => !!id)),
    );
    const commenterRoleMap = new Map<
      string,
      'super_admin' | 'admin' | 'supervisor' | 'agent' | 'student' | null
    >();
    if (distinctCommenterIds.length > 0) {
      const roleRows = await db
        .select({
          userId: userRoles.userId,
          roleName: roles.name,
          supportSubRole: userRoles.supportSubRole,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, distinctCommenterIds));
      const grouped = new Map<
        string,
        { roleName: string; supportSubRole: string | null }[]
      >();
      for (const r of roleRows) {
        const list = grouped.get(r.userId) || [];
        list.push({ roleName: r.roleName, supportSubRole: r.supportSubRole });
        grouped.set(r.userId, list);
      }
      for (const id of distinctCommenterIds) {
        const list = grouped.get(id) || [];
        let chosen:
          | 'super_admin'
          | 'admin'
          | 'supervisor'
          | 'agent'
          | 'student'
          | null = null;
        if (list.some((x) => x.roleName === ROLE_NAMES.SUPER_ADMIN)) {
          chosen = 'super_admin';
        } else if (list.some((x) => x.roleName === ROLE_NAMES.ADMIN)) {
          chosen = 'admin';
        } else {
          const support = list.find((x) => x.roleName === ROLE_NAMES.SUPPORT);
          if (support) {
            chosen =
              support.supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR
                ? 'supervisor'
                : 'agent';
          } else if (list.some((x) => x.roleName === ROLE_NAMES.STUDENT)) {
            chosen = 'student';
          }
        }
        commenterRoleMap.set(id, chosen);
      }
    }

    // Pre-compute the guest's display name so we can overlay the
    // sentinel "Guest User" on any replies the guest left through the
    // public tracking page. Staff replies stay untouched.
    const guestParts = ticket.guestName
      ? ticket.guestName.trim().split(/\s+/)
      : null;
    const guestFirst = guestParts ? guestParts[0] || ticket.guestName : null;
    const guestLast = guestParts ? guestParts.slice(1).join(' ') || null : null;

    const comments = commentRows.map((c) => {
      const isGuestReply =
        !c.isStaffReply &&
        ticket.studentId === GUEST_USER_ID &&
        c.userId === GUEST_USER_ID;
      return {
        ...c,
        userFirstName: isGuestReply && guestFirst ? guestFirst : c.userFirstName,
        userLastName: isGuestReply && guestLast ? guestLast : c.userLastName,
        userRole: c.userId ? commenterRoleMap.get(c.userId) ?? null : null,
        attachments: replyAttachmentsByReply.get(c.id) || [],
      };
    });

    // Fetch assignee name
    let assigneeName: string | null = null;
    if (ticket.assigneeId) {
      const [assignee] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, ticket.assigneeId));
      if (assignee) {
        assigneeName = [assignee.firstName, assignee.lastName]
          .filter(Boolean)
          .join(' ');
      }
    }

    // Fetch course name
    let courseName: string | null = null;
    if (ticket.courseId) {
      const [course] = await db
        .select({ title: courses.title, titleAr: courses.titleAr })
        .from(courses)
        .where(eq(courses.id, ticket.courseId));
      if (course) courseName = course.title || course.titleAr || null;
    }

    // Fetch SLA policy for this ticket's priority
    const [slaPolicy] = await db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.priority, ticket.priority));

    // Compute SLA deadlines and remaining time
    let frtDeadline: string | null = null;
    let ttrDeadline: string | null = null;
    let frtRemainingMinutes: number | null = null;
    let ttrRemainingMinutes: number | null = null;

    // Detect pause state up-front so the math anchors on the right
    // reference timestamp:
    //   • on-hold:      paused — the timer should not advance at all
    //   • off-hours:    paused — clamp `now` to last business close
    //                   so the snapshot is the EXACT remaining at the
    //                   moment business hours ended (no drift while
    //                   the user is viewing during off-hours)
    //   • neither:      live — use the real `now`
    const realNow = new Date();
    const inBusinessHours = isWithinBusinessHours(realNow);
    const slaPaused =
      ticket.status === TICKET_STATUS.ON_HOLD || !inBusinessHours;
    const slaPausedReason: 'on_hold' | 'off_hours' | null =
      ticket.status === TICKET_STATUS.ON_HOLD
        ? 'on_hold'
        : !inBusinessHours
          ? 'off_hours'
          : null;

    if (slaPolicy) {
      // For paused tickets we clamp the math anchor to the last
      // business close. Live tickets compute against actual `now`.
      const calcNow = slaPaused ? clampToBusinessHours(realNow) : realNow;
      // Effective math — accounts for the IN-FLIGHT on-hold period as
      // well as completed hold time. The raw onHoldTotalMinutes only
      // updates on transition OFF hold, so reading it directly let the
      // SLA clock keep ticking during the hold (root cause of the
      // "ticket was on hold but timer never stopped" bug).
      const holdMinutes = effectiveOnHoldMinutes(ticket, calcNow);
      const effectiveBizMinutes = effectiveBusinessMinutesElapsed(
        ticket,
        calcNow,
      );

      // FRT deadline — only if not yet responded and not breached
      if (!ticket.firstResponseAt) {
        const deadline = calculateBusinessDeadline(
          ticket.createdAt,
          slaPolicy.frtMinutes + holdMinutes,
        );
        frtDeadline = deadline.toISOString();
        frtRemainingMinutes = Math.max(
          0,
          slaPolicy.frtMinutes - effectiveBizMinutes,
        );
        if (ticket.slaBreachedFrt) {
          frtRemainingMinutes = -(effectiveBizMinutes - slaPolicy.frtMinutes);
        }
      }

      // TTR deadline — only if not yet resolved
      if (
        ticket.status !== TICKET_STATUS.RESOLVED &&
        ticket.status !== TICKET_STATUS.CLOSED
      ) {
        const deadline = calculateBusinessDeadline(
          ticket.createdAt,
          slaPolicy.ttrMinutes + holdMinutes,
        );
        ttrDeadline = deadline.toISOString();
        ttrRemainingMinutes = Math.max(
          0,
          slaPolicy.ttrMinutes - effectiveBizMinutes,
        );
        if (ticket.slaBreachedTtr) {
          ttrRemainingMinutes = -(effectiveBizMinutes - slaPolicy.ttrMinutes);
        }
      }
    }

    // Bundle tags + attachments for the detail view. Both are bulk
    // fetches by ticketId — no N+1 worry because we're already on a
    // single-ticket path.
    const tags = await this.getTicketTags(ticket.id);
    const attachments = await this.getTicketAttachments(ticket.id);

    // Surface any pending hold request inline so the FE doesn't have
    // to make a second call. Visible to the requester (so they see
    // their "pending" state) and to anyone with decision power.
    const pendingHoldRequest = await this.getPendingHoldRequest(ticket.id);

    // Merge breadcrumbs — surface both directions inline so the FE
    // can show a clear banner without a second round-trip:
    //   • mergedInto:  this ticket was rolled INTO another (target)
    //   • mergedFrom:  other tickets were rolled INTO this one (sources)
    let mergedInto: {
      ticketId: string;
      referenceNumber: string;
      subject: string;
    } | null = null;
    if (ticket.mergedIntoTicketId) {
      const [target] = await db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          subject: tickets.subject,
        })
        .from(tickets)
        .where(eq(tickets.id, ticket.mergedIntoTicketId));
      if (target) {
        mergedInto = {
          ticketId: target.id,
          referenceNumber: target.referenceNumber,
          subject: target.subject,
        };
      }
    }

    const mergedFrom = await db
      .select({
        ticketId: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .where(eq(tickets.mergedIntoTicketId, ticket.id))
      .orderBy(desc(tickets.closedAt));

    // Latest submitted CSAT survey for this ticket — surfaces the
    // customer's score + comment on the detail view so staff (and the
    // customer themselves) can see the feedback inline instead of
    // hunting through the Reports tab. Falls back to null if no
    // survey was sent or the customer never responded.
    const [csatRow] = await db
      .select({
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        channel: csatSurveys.channel,
      })
      .from(csatSurveys)
      .where(
        and(
          eq(csatSurveys.ticketId, ticket.id),
          isNotNull(csatSurveys.submittedAt),
        ),
      )
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(1);
    const csatReview = csatRow
      ? {
          score: csatRow.score,
          comment: csatRow.comment,
          submittedAt: csatRow.submittedAt?.toISOString() ?? null,
          channel: csatRow.channel,
        }
      : null;

    // "About this user" card — populated for tickets filed about a
    // third party (instructor → student follow-up). Rendered for
    // support agents, supervisors, admins, AND the filer themselves
    // (so the instructor sees the same structured snapshot in their
    // own Support tab instead of having to remember what they sent).
    // The student the ticket is about never sees this ticket because
    // it isn't in their inbox.
    const isFilerOfAboutTicket =
      ticket.aboutUserId != null && ticket.studentId === user.id;
    const aboutUser =
      ticket.aboutUserId && (isSupportOrAdmin || isFilerOfAboutTicket)
        ? await this.composeAboutUserCard(ticket.aboutUserId, ticket.courseId)
        : null;

    // Guest overlay — surface the real submitter name + email captured
    // by the public form, not the GUEST sentinel row. Also flag the
    // ticket so the FE can render a small "Guest" badge.
    const isGuestTicket = ticket.studentId === GUEST_USER_ID;
    const displayStudentFirstName =
      isGuestTicket && guestFirst ? guestFirst : ticket.studentFirstName;
    const displayStudentLastName =
      isGuestTicket && guestLast !== null ? guestLast : ticket.studentLastName;
    const displayStudentEmail =
      isGuestTicket && ticket.guestEmail
        ? ticket.guestEmail
        : ticket.studentEmail;

    // Phase 2 — collaborators + viewer role. Requesters get an empty
    // collab list (and the FE hides the panel based on viewerRole);
    // support/admin + collaborators see the real list.
    const viewerRole: 'support' | 'collaborator' | 'requester' | 'none' =
      isSupportOrAdmin
        ? 'support'
        : isCollab
        ? 'collaborator'
        : isRequester
        ? 'requester'
        : 'none';
    const collaborators =
      viewerRole === 'requester' ? [] : await this.listCollaborators(ticketId);

    return {
      ...ticket,
      studentFirstName: displayStudentFirstName,
      studentLastName: displayStudentLastName,
      studentEmail: displayStudentEmail,
      isGuestTicket,
      assigneeName,
      courseName,
      comments,
      slaPolicy: slaPolicy || null,
      frtDeadline,
      ttrDeadline,
      frtRemainingMinutes,
      ttrRemainingMinutes,
      // True when the SLA clock is not advancing right now — used by
      // the FE to render an amber "Paused at X" badge and explain why.
      // The remaining-minutes values above are anchored at the moment
      // the pause began (last business close, or the on-hold transition
      // for on_hold tickets), so the badge stays stable across refreshes.
      slaPaused,
      slaPausedReason,
      tags,
      attachments,
      pendingHoldRequest,
      mergedInto,
      mergedFrom,
      csatReview,
      aboutUser,
      collaborators,
      viewerRole,
    };
  }

  // ─── Structured "about this user" card data ───────────────
  //
  // Same data source as composeAboutUserContextBlock but returns a
  // shaped object so the FE can render a styled card without parsing
  // markdown. Hidden from non-staff requesters by getTicketDetail.
  private async composeAboutUserCard(
    aboutUserId: string,
    courseId: string | null,
  ): Promise<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    course: {
      id: string;
      title: string;
      titleAr: string | null;
      enrolledAt: string | null;
      progress: number;
      lastAccessedAt: string | null;
      status: string | null;
    } | null;
    attendance: { attended: number; total: number; percentage: number } | null;
    assessmentAvg: { avgPercentage: number; count: number } | null;
  } | null> {
    try {
      const [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, aboutUserId))
        .limit(1);
      if (!user) return null;

      const name =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

      let courseCard: {
        id: string;
        title: string;
        titleAr: string | null;
        enrolledAt: string | null;
        progress: number;
        lastAccessedAt: string | null;
        status: string | null;
      } | null = null;
      let focalCourseId = courseId;
      if (focalCourseId) {
        const [enrol] = await db
          .select({
            id: enrollments.courseId,
            progress: enrollments.progress,
            enrolledAt: enrollments.enrolledAt,
            lastAccessedAt: enrollments.lastAccessedAt,
            status: enrollments.status,
            title: courses.title,
            titleAr: courses.titleAr,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .where(
            and(
              eq(enrollments.studentId, aboutUserId),
              eq(enrollments.courseId, focalCourseId),
            ),
          )
          .limit(1);
        if (enrol) {
          courseCard = {
            id: enrol.id,
            title: enrol.title,
            titleAr: enrol.titleAr ?? null,
            enrolledAt: enrol.enrolledAt?.toISOString() ?? null,
            progress: enrol.progress ?? 0,
            lastAccessedAt: enrol.lastAccessedAt?.toISOString() ?? null,
            status: enrol.status,
          };
        } else {
          focalCourseId = null;
        }
      }

      let attendanceCard: {
        attended: number;
        total: number;
        percentage: number;
      } | null = null;
      if (focalCourseId) {
        const [att] = await db
          .select({
            attended: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as(
              'attended',
            ),
            total: sql<number>`COUNT(*)`.as('total'),
          })
          .from(attendance)
          .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
          .where(
            and(
              eq(sessions.courseId, focalCourseId),
              eq(attendance.studentId, aboutUserId),
            ),
          );
        const attended = Number(att?.attended || 0);
        const total = Number(att?.total || 0);
        if (total > 0) {
          attendanceCard = {
            attended,
            total,
            percentage: Math.round((attended / total) * 100),
          };
        }
      }

      const subWhere = focalCourseId
        ? and(
            eq(submissions.studentId, aboutUserId),
            isNotNull(submissions.percentage),
            sql`${submissions.assessmentId} IN (
              SELECT id FROM assessments WHERE course_id = ${focalCourseId}
            )`,
          )
        : and(
            eq(submissions.studentId, aboutUserId),
            isNotNull(submissions.percentage),
          );
      const recentSubs = await db
        .select({ percentage: submissions.percentage })
        .from(submissions)
        .where(subWhere)
        .orderBy(desc(submissions.submittedAt))
        .limit(5);

      let assessmentCard: { avgPercentage: number; count: number } | null = null;
      if (recentSubs.length > 0) {
        const avg =
          recentSubs.reduce(
            (sum, s) => sum + Number(s.percentage || 0),
            0,
          ) / recentSubs.length;
        assessmentCard = {
          avgPercentage: Math.round(avg),
          count: recentSubs.length,
        };
      }

      return {
        id: user.id,
        name,
        email: user.email,
        avatar: user.avatar ?? null,
        course: courseCard,
        attendance: attendanceCard,
        assessmentAvg: assessmentCard,
      };
    } catch (err) {
      this.logger.warn(
        `composeAboutUserCard failed for user ${aboutUserId}: ${err}`,
      );
      return null;
    }
  }

  // ─── Update Ticket ──────────────────────────────────────

  async updateTicket(ticketId: string, dto: UpdateTicketDto, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only update their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
    const [existing] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        assigneeId: tickets.assigneeId,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!existing) throw new NotFoundException('Ticket not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (dto.status) {
      // M1: Status transition validation.
      // RESOLVED → IN_PROGRESS and CLOSED → IN_PROGRESS both allow staff
      // to explicitly reopen a ticket (e.g. customer escalated via another
      // channel, or a closed-too-early call). For non-staff customers the
      // CLOSED reopen path is still gated by the 48h grace check in
      // addComment() — only deliberate staff action takes the CLOSED →
      // IN_PROGRESS path here.
      const validTransitions: Record<string, string[]> = {
        [TICKET_STATUS.NEW]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.IN_PROGRESS]: [
          TICKET_STATUS.ON_HOLD,
          TICKET_STATUS.RESOLVED,
          TICKET_STATUS.CLOSED,
        ],
        [TICKET_STATUS.ON_HOLD]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.RESOLVED]: [
          TICKET_STATUS.CLOSED,
          TICKET_STATUS.IN_PROGRESS,
        ],
        [TICKET_STATUS.CLOSED]: [TICKET_STATUS.IN_PROGRESS],
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${dto.status}`,
        );
      }

      updateData.status = dto.status;

      // Transitioning TO on_hold (BH-05). Plain agents can NOT flip
      // a ticket directly — they must submit a hold request via the
      // dedicated endpoint, which a supervisor/admin then approves.
      // Supervisors and admins keep the direct path so they can
      // self-hold without going through their own approval queue.
      if (dto.status === TICKET_STATUS.ON_HOLD) {
        if (!dto.onHoldReason) {
          throw new BadRequestException(
            'On hold reason is required when setting status to on_hold',
          );
        }
        if (user) {
          const isPrivileged =
            user.supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR ||
            user.roles.includes(ROLE_NAMES.ADMIN) ||
            user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
          if (!isPrivileged) {
            throw new ForbiddenException(
              'Agents must submit a hold request — a supervisor or admin will decide.',
            );
          }
        }
        updateData.onHoldReason = dto.onHoldReason;
        updateData.onHoldAt = new Date();
        updateData.onHoldResumedAt = null;
      }

      // Transitioning FROM on_hold — accumulate hold duration (BH-05, BH-06)
      if (
        existing.status === TICKET_STATUS.ON_HOLD &&
        dto.status !== TICKET_STATUS.ON_HOLD &&
        existing.onHoldAt
      ) {
        const holdDuration = calculateBusinessMinutesElapsed(
          existing.onHoldAt,
          new Date(),
        );
        updateData.onHoldTotalMinutes =
          (existing.onHoldTotalMinutes || 0) + holdDuration;
        updateData.onHoldResumedAt = new Date();
        updateData.onHoldAt = null;
        updateData.onHoldReason = null;
      }

      if (dto.status === TICKET_STATUS.RESOLVED) {
        updateData.resolvedAt = new Date();
      }
      if (dto.status === TICKET_STATUS.CLOSED) {
        updateData.closedAt = new Date();
      }

      // Reopening clears terminal timestamps so reporting and SLA
      // counters reflect the active in-progress state again. Covers both
      // RESOLVED → IN_PROGRESS and CLOSED → IN_PROGRESS staff reopens.
      if (
        (existing.status === TICKET_STATUS.RESOLVED ||
          existing.status === TICKET_STATUS.CLOSED) &&
        dto.status === TICKET_STATUS.IN_PROGRESS
      ) {
        updateData.resolvedAt = null;
        updateData.closedAt = null;
      }
    }

    // M1: Block non-status property changes on resolved/closed tickets.
    // Once a ticket is resolved or closed, only status transitions
    // (e.g., RESOLVED → CLOSED) are allowed — not priority, category,
    // or assignee changes, which would corrupt the audit trail.
    const isTerminal =
      existing.status === TICKET_STATUS.RESOLVED ||
      existing.status === TICKET_STATUS.CLOSED;

    if (dto.priority && isTerminal) {
      throw new BadRequestException(
        'Cannot change priority on a resolved/closed ticket',
      );
    }
    if (dto.assigneeId && isTerminal) {
      throw new BadRequestException(
        'Cannot reassign a resolved/closed ticket',
      );
    }

    if (dto.priority && !isTerminal) updateData.priority = dto.priority;
    if (dto.assigneeId && !isTerminal) updateData.assigneeId = dto.assigneeId;

    const [updated] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticketId))
      .returning();

    // Status-change notification (P-04 follow-up).
    //
    // Notifies the student whenever the status actually changed.
    // Intermediate transitions (IN_PROGRESS, ON_HOLD, reopen) only get
    // surfaced here — RESOLVED and CLOSED are intentionally skipped
    // because their dedicated email helpers already fire from
    // resolveTicket / closeTicket with a richer payload. Best-effort —
    // a failed notification never blocks the underlying write.
    if (dto.status && dto.status !== existing.status) {
      // Resolve a display reason for the email body. ON_HOLD is the
      // only transition that comes with a user-supplied reason.
      const reason =
        dto.status === TICKET_STATUS.ON_HOLD ? dto.onHoldReason : null;

      try {
        await this.notificationsService.create({
          recipientId: existing.studentId,
          type: 'ticket_status_change',
          title: 'Ticket status updated',
          message: `Your ticket "${existing.subject}" is now ${dto.status.replace('_', ' ')}.`,
          link: `/dashboard/student/support`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } catch {
        // Non-blocking (P-07)
      }

      // Email only for the intermediate transitions — skip resolved /
      // closed to avoid duplicate emails with the dedicated templates.
      const SKIP_EMAIL_FOR = new Set([
        TICKET_STATUS.RESOLVED,
        TICKET_STATUS.CLOSED,
      ]);
      if (!SKIP_EMAIL_FOR.has(dto.status as any)) {
        try {
          const [studentInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, existing.studentId));
          if (studentInfo?.email) {
            await this.emailService.sendTicketStatusChange(
              studentInfo.email,
              studentInfo.firstName || 'Student',
              existing.referenceNumber,
              dto.status,
              reason,
            );
          }
        } catch {
          // Non-blocking
        }
      }
    }

    // Assignee-change notifications. When a supervisor reassigns a
    // ticket via PATCH /tickets/:id, three parties need to know:
    //   - the OLD agent loses the ticket (drop it off their queue
    //     view in their head)
    //   - the NEW agent gains it (otherwise they only discover via
    //     the next list refresh)
    //   - the learner sees "now with {name}" so they don't worry the
    //     ticket got dropped
    // Best-effort; failures here never block the ticket write.
    if (
      dto.assigneeId &&
      !isTerminal &&
      dto.assigneeId !== existing.assigneeId
    ) {
      try {
        const [newAgent] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, dto.assigneeId));
        const newAgentName =
          [newAgent?.firstName, newAgent?.lastName].filter(Boolean).join(' ') ||
          'an agent';

        // Notify the learner
        try {
          await this.notificationsService.create({
            recipientId: existing.studentId,
            type: 'ticket_assigned',
            title: 'Ticket reassigned',
            message: `Your ticket "${existing.subject}" is now with ${newAgentName}.`,
            link: `/dashboard/student/support`,
            entityType: 'ticket',
            entityId: ticketId,
          });
        } catch {
          /* non-blocking */
        }

        // Notify the new agent
        try {
          if (await this.shouldNotifySupport(dto.assigneeId, 'inApp')) {
            await this.notificationsService.create({
              recipientId: dto.assigneeId,
              type: 'ticket_assigned',
              title: 'New Ticket Assigned',
              message: `${existing.referenceNumber} — ${existing.subject}`,
              link: `/dashboard/support/agent/tickets/${ticketId}`,
              entityType: 'ticket',
              entityId: ticketId,
            });
          }
          if (newAgent?.email) {
            // Assignment emails are transactional — the receiving agent
            // needs to know they own a ticket regardless of their
            // general support-notification opt-outs.
            await this.emailService.sendTicketAssignedAgent(
              newAgent.email,
              newAgent.firstName || 'Agent',
              existing.referenceNumber,
              existing.subject,
              dto.priority || existing.priority,
              existing.assigneeId ? 'reassigned by supervisor' : 'assigned by supervisor',
            );
          }
        } catch {
          /* non-blocking */
        }

        // Notify the previous agent that they've been unassigned
        try {
          if (
            existing.assigneeId &&
            (await this.shouldNotifySupport(existing.assigneeId, 'inApp'))
          ) {
            await this.notificationsService.create({
              recipientId: existing.assigneeId,
              type: 'ticket_assigned',
              title: 'Ticket reassigned',
              message: `${existing.referenceNumber} has been reassigned to ${newAgentName}.`,
              link: `/dashboard/support/agent`,
              entityType: 'ticket',
              entityId: ticketId,
            });
          }
        } catch {
          /* non-blocking */
        }
      } catch {
        /* non-blocking */
      }
    }

    // Priority-change notifications. A supervisor manually re-prioritising
    // a ticket should land on the same surfaces as the auto-escalation
    // cron — the learner sees the new urgency, the assigned agent sees
    // the reshuffle in their queue.
    if (
      dto.priority &&
      !isTerminal &&
      dto.priority !== existing.priority
    ) {
      try {
        await this.notificationsService.create({
          recipientId: existing.studentId,
          type: 'ticket_status_change',
          title: 'Ticket priority updated',
          message: `Your ticket "${existing.subject}" is now ${dto.priority} priority.`,
          link: `/dashboard/student/support`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } catch {
        /* non-blocking */
      }

      const notifyAssignee = dto.assigneeId || existing.assigneeId;
      if (notifyAssignee) {
        try {
          if (await this.shouldNotifySupport(notifyAssignee, 'inApp')) {
            await this.notificationsService.create({
              recipientId: notifyAssignee,
              type: 'ticket_status_change',
              title: 'Ticket priority changed',
              message: `${existing.referenceNumber} is now ${dto.priority} priority.`,
              link: `/dashboard/support/agent/tickets/${ticketId}`,
              entityType: 'ticket',
              entityId: ticketId,
            });
          }
        } catch {
          /* non-blocking */
        }
      }
    }

    // Audit log — record each field that actually changed so the trail
    // shows a separate row per action (assignee | priority | status).
    // Best-effort; an audit-write failure never blocks the response.
    if (user) {
      if (dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId) {
        await this.auditLogService.log({
          entityType: 'ticket',
          entityId: ticketId,
          action: SupportService.SUPPORT_AUDIT_ACTIONS.ASSIGNEE_CHANGED,
          performedBy: user.id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            previousAssigneeId: existing.assigneeId,
            newAssigneeId: dto.assigneeId,
          },
        });
      }
      if (dto.priority && dto.priority !== existing.priority) {
        await this.auditLogService.log({
          entityType: 'ticket',
          entityId: ticketId,
          action: SupportService.SUPPORT_AUDIT_ACTIONS.PRIORITY_CHANGED,
          performedBy: user.id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            previousPriority: existing.priority,
            newPriority: dto.priority,
          },
        });
      }
      if (dto.status && dto.status !== existing.status) {
        await this.auditLogService.log({
          entityType: 'ticket',
          entityId: ticketId,
          action: SupportService.SUPPORT_AUDIT_ACTIONS.STATUS_CHANGED,
          performedBy: user.id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            previousStatus: existing.status,
            newStatus: dto.status,
          },
        });
      }
    }

    return updated;
  }

  // ─── Add Comment ──────────────────────────────────────

  async addComment(
    user: AuthenticatedUser,
    ticketId: string,
    dto: AddCommentDto,
  ) {
    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        status: tickets.status,
        firstResponseAt: tickets.firstResponseAt,
        closedAt: tickets.closedAt,
        subject: tickets.subject,
        assigneeId: tickets.assigneeId,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
        guestTrackingToken: tickets.guestTrackingToken,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Phase 2 — collaborator admission. A non-support, non-requester
    // user who is a looped-in collaborator can post replies, but ONLY
    // on the internal channel. The visibility matrix is enforced below.
    const isRequester = ticket.studentId === user.id;
    const isCollab =
      !isSupportOrAdmin && !isRequester
        ? await this.isCollaborator(ticketId, user.id)
        : false;

    if (!isSupportOrAdmin && !isRequester && !isCollab) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Collaborators are pure brokered participants — they cannot post
    // public messages. If the FE sends `isInternal=false` from a
    // collaborator, reject loudly so we never accidentally leak their
    // voice into the requester's channel.
    if (isCollab && dto.isInternal === false) {
      throw new BadRequestException(
        'Collaborators can only post internal replies',
      );
    }

    // Agent isolation: non-supervisor agents can only comment on their assigned tickets
    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    // 48h grace period for closed tickets (ST-12, ST-13)
    if (ticket.status === TICKET_STATUS.CLOSED && !isSupportOrAdmin) {
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
      const closedTime = ticket.closedAt
        ? new Date(ticket.closedAt).getTime()
        : 0;
      if (Date.now() - closedTime > GRACE_PERIOD_MS) {
        throw new BadRequestException(
          'This ticket has been closed for more than 48 hours. Please create a new ticket.',
        );
      }
    }

    // Visibility derivation per the Phase 2 matrix:
    //   requester       → public only (isInternal=false)
    //   collaborator    → internal only (isInternal=true)
    //   support/admin   → caller's choice, default public
    const isInternal = isCollab
      ? true
      : isSupportOrAdmin
        ? (dto.isInternal ?? false)
        : false;

    // 48h grace check for student reopen must happen BEFORE the
    // transaction so we don't open + immediately roll back the comment
    // insert when grace is expired.
    if (
      !isSupportOrAdmin &&
      ticket.status === TICKET_STATUS.CLOSED &&
      ticket.closedAt
    ) {
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
      if (
        Date.now() - new Date(ticket.closedAt).getTime() >
        GRACE_PERIOD_MS
      ) {
        throw new BadRequestException(
          'This ticket has been closed for more than 48 hours and cannot be reopened.',
        );
      }
    }

    // Pre-validate reply-attachment URLs outside the transaction so a
    // 400 doesn't trigger a needless rollback. Dedup to defeat
    // double-submit double-clicks before we touch the DB. Accepts
    // both URL-only `attachmentUrls` and rich `attachments` — rich
    // wins on metadata when both refer to the same URL.
    const rawReplyUrls = Array.isArray(dto.attachmentUrls)
      ? dto.attachmentUrls
      : [];
    const rawReplyRich = Array.isArray(dto.attachments) ? dto.attachments : [];
    const replyByUrl = new Map<
      string,
      {
        url: string;
        filename?: string | null;
        mimeType?: string | null;
        sizeBytes?: number | null;
      }
    >();
    for (const u of rawReplyUrls) {
      const safe = validateTicketAttachmentUrl(u);
      if (safe && !replyByUrl.has(safe)) {
        replyByUrl.set(safe, { url: safe });
      }
    }
    for (const a of rawReplyRich) {
      const safe = validateTicketAttachmentUrl(a.url);
      if (!safe) continue;
      const prev = replyByUrl.get(safe);
      replyByUrl.set(safe, {
        url: safe,
        filename: prev?.filename || a.filename || null,
        mimeType: prev?.mimeType || a.mimeType || null,
        sizeBytes:
          prev?.sizeBytes != null && prev.sizeBytes >= 0
            ? prev.sizeBytes
            : a.sizeBytes ?? null,
      });
    }
    const safeReplyAttachments = Array.from(replyByUrl.values());
    const safeReplyAttachmentUrls = safeReplyAttachments.map((a) => a.url);

    // Captured by the inner txn block if a student reply causes a
    // resolved/closed ticket to reopen — used for the audit log row
    // after the txn commits.
    let reopenedFrom: string | null = null;

    // All writes go in one transaction so a crash mid-flow can't leave
    // an orphaned reply with no corresponding ticket-state update
    // (e.g. firstResponseAt set but status still NEW, or a student
    // reopen reply with the ticket still RESOLVED).
    const comment = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(ticketReplies)
        .values({
          ticketId,
          userId: user.id,
          message: dto.message,
          // Collaborators are staff members from another dept — flag
          // their internal replies as staff so the bubble renders on
          // the staff side. FRT/notification logic downstream gates
          // on (!isInternal) too, so this doesn't leak into the public
          // channel or trip first-response timing.
          isStaffReply: isSupportOrAdmin || isCollab,
          isInternal,
        })
        .returning();

      // Persist any reply-scoped attachments inside the same txn so
      // they vanish if the reply insert later rolls back.
      if (safeReplyAttachments.length > 0) {
        await tx
          .insert(ticketAttachments)
          .values(
            safeReplyAttachments.map((a) => ({
              ticketId,
              replyId: inserted.id,
              url: a.url,
              uploadedBy: user.id,
              filename: a.filename || null,
              mimeType: a.mimeType || null,
              sizeBytes: a.sizeBytes != null ? a.sizeBytes : -1,
            })),
          )
          .onConflictDoNothing();
      }

      const now = new Date();
      const ticketUpdate: Record<string, unknown> = { updatedAt: now };

      // First-response + auto NEW → IN_PROGRESS on first public staff reply
      if (isSupportOrAdmin && !isInternal) {
        if (!ticket.firstResponseAt) {
          ticketUpdate.firstResponseAt = now;
        }
        if (ticket.status === TICKET_STATUS.NEW) {
          ticketUpdate.status = TICKET_STATUS.IN_PROGRESS;
        }
      }

      // Student reply on resolved/closed (within 48h grace) → reopen (ST-12, ST-13).
      // Gated on isRequester so a collaborator's internal reply on a
      // resolved/closed ticket doesn't accidentally reopen it.
      if (
        isRequester &&
        (ticket.status === TICKET_STATUS.RESOLVED ||
          ticket.status === TICKET_STATUS.CLOSED)
      ) {
        ticketUpdate.status = TICKET_STATUS.NEW;
        ticketUpdate.resolvedAt = null;
        ticketUpdate.closedAt = null;
        reopenedFrom = ticket.status;
      }

      await tx
        .update(tickets)
        .set(ticketUpdate)
        .where(eq(tickets.id, ticketId));

      return inserted;
    });

    // Kick off scan tracking for each reply-scoped upload. The Eventarc
    // scanner writes its verdict back to the GCS object metadata; this
    // row exists so the UI has a row to look up even before that runs.
    for (const url of safeReplyAttachmentUrls) {
      await this.recordAttachmentScanPending(ticketId, url);
    }

    // Notifications for comments (AR-01, AR-02)
    try {
      if (isSupportOrAdmin && !isInternal) {
        // Agent replied publicly → notify student (IN-03: no email for internal notes)
        await this.notificationsService.create({
          recipientId: ticket.studentId,
          type: 'ticket_reply',
          title: 'New Reply on Your Ticket',
          message: `Support has replied to your ticket "${ticket.subject || ''}"`,
          link: `/dashboard/student/support`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } else if (
        isRequester &&
        ticket.assigneeId &&
        (await this.shouldNotifySupport(ticket.assigneeId, 'inApp'))
      ) {
        // Student replied → notify assigned agent (gated by their in-app master)
        await this.notificationsService.create({
          recipientId: ticket.assigneeId,
          type: 'ticket_reply',
          title: 'Student Replied',
          message: `Student replied to ticket ${ticket.referenceNumber}`,
          link: `/dashboard/support/agent/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } else if (
        isCollab &&
        ticket.assigneeId &&
        (await this.shouldNotifySupport(ticket.assigneeId, 'inApp'))
      ) {
        // Collaborator posted an internal reply → notify assigned
        // agent so they can relay to the requester if needed.
        await this.notificationsService.create({
          recipientId: ticket.assigneeId,
          type: 'ticket_collab_reply',
          title: 'Collaborator Note',
          message: `New internal note on ticket ${ticket.referenceNumber}`,
          link: `/dashboard/support/agent/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      }
    } catch {
      // Non-blocking (P-07)
    }

    // Send email notifications
    try {
      if (isSupportOrAdmin && !isInternal) {
        // Agent replied → email the customer. For guest tickets, the
        // customer is identified by ticket.guestEmail + ticket.guestName
        // (studentId is the sentinel), so look there first before
        // falling back to a real user row. The tracking URL is the
        // guest's only path back to the conversation.
        let recipientEmail: string | null = null;
        let recipientName = 'Student';
        let trackingUrl: string | undefined;

        if (ticket.guestEmail && ticket.studentId === GUEST_USER_ID) {
          recipientEmail = ticket.guestEmail;
          recipientName = ticket.guestName || 'there';
          trackingUrl = ticket.guestTrackingToken
            ? this.buildGuestTrackingUrl(ticket.guestTrackingToken)
            : undefined;
        } else {
          const [studentInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, ticket.studentId));
          if (studentInfo?.email) {
            recipientEmail = studentInfo.email;
            recipientName = studentInfo.firstName || 'Student';
          }
        }

        if (recipientEmail) {
          await this.emailService.sendTicketReplyNotification(
            recipientEmail,
            recipientName,
            user.firstName || 'Support Agent',
            ticket.referenceNumber,
            dto.message.substring(0, 200),
            trackingUrl,
          );
        }
      } else if (
        isRequester &&
        ticket.assigneeId &&
        (await this.shouldNotifySupport(ticket.assigneeId, 'email'))
      ) {
        // Student replied → email agent (gated by their email master)
        const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.assigneeId));
        if (agentInfo?.email) {
          await this.emailService.sendTicketReplyNotification(
            agentInfo.email,
            agentInfo.firstName || 'Agent',
            user.firstName || 'Student',
            ticket.referenceNumber,
            dto.message.substring(0, 200),
          );
        }
      }
      // Phase 2: collaborator internal replies do not send any email
      // (in-app notification is enough — see notification block above).
    } catch { /* non-blocking */ }

    // Audit log — distinguishes public replies from internal notes so
    // the trail can show them with different icons.
    await this.auditLogService.log({
      entityType: 'ticket',
      entityId: ticketId,
      action: isInternal
        ? SupportService.SUPPORT_AUDIT_ACTIONS.INTERNAL_NOTE_ADDED
        : SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_REPLIED,
      performedBy: user.id,
      metadata: {
        referenceNumber: ticket.referenceNumber,
        isStaffReply: isSupportOrAdmin || isCollab,
        isCollaboratorReply: isCollab,
        replyId: comment.id,
        attachmentCount: safeReplyAttachmentUrls.length,
      },
    });

    // Separate row when the same reply also reopened the ticket — the
    // FE shows this as its own line on the trail.
    if (reopenedFrom) {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_REOPENED,
        performedBy: user.id,
        metadata: {
          referenceNumber: ticket.referenceNumber,
          previousStatus: reopenedFrom,
        },
      });
    }

    return comment;
  }

  // ─── Resolve Ticket ──────────────────────────────────────

  async resolveTicket(ticketId: string, userId: string, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only resolve their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        subject: tickets.subject,
        status: tickets.status,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        source: tickets.source,
        aboutUserId: tickets.aboutUserId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // H1: Prevent double-resolve and invalid transitions
    if (
      ticket.status === TICKET_STATUS.RESOLVED ||
      ticket.status === TICKET_STATUS.CLOSED
    ) {
      throw new BadRequestException(
        `Ticket is already ${ticket.status}. Cannot resolve again.`,
      );
    }

    // M2: If resolving from on_hold, accumulate hold time first
    const updateData: Record<string, any> = {
      status: TICKET_STATUS.RESOLVED,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    if (ticket.status === TICKET_STATUS.ON_HOLD && ticket.onHoldAt) {
      const holdDuration = calculateBusinessMinutesElapsed(
        ticket.onHoldAt,
        new Date(),
      );
      updateData.onHoldTotalMinutes =
        (ticket.onHoldTotalMinutes || 0) + holdDuration;
      updateData.onHoldResumedAt = new Date();
      updateData.onHoldAt = null;
      updateData.onHoldReason = null;
    }

    // Phase 2 — skip CSAT survey creation when the requester is a
    // staff member (instructor / manager / finance / TA / support /
    // admin). CSAT only meaningfully measures learner satisfaction;
    // an internal ops ticket between staff teams shouldn't fire a
    // satisfaction survey at the requester.
    const requesterRoleNames = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, ticket.studentId));
    const requesterIsStaff = requesterRoleNames.some(
      (r) => r.name !== ROLE_NAMES.STUDENT,
    );
    const isGuestRequester = ticket.studentId === GUEST_USER_ID;
    const skipCsat = requesterIsStaff && !isGuestRequester;

    // Resolving the ticket and creating the CSAT survey placeholder must
    // succeed together. Without this transaction, a crash between the
    // two writes leaves a "resolved" ticket the student never gets
    // surveyed about — silently dropping the CSAT response rate.
    // The SLA event log stays as best-effort outside the tx (it's an
    // analytics signal, not a correctness guarantee).
    const { updated, surveyId } = await db.transaction(async (tx) => {
      const [updatedTicket] = await tx
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId))
        .returning();

      if (skipCsat) {
        return { updated: updatedTicket, surveyId: null };
      }

      // Capture the survey id so the resolution email can carry a
      // one-click CTA. onConflictDoNothing means the returning row
      // is empty when a survey already exists — fall back to a
      // lookup in that case so a re-resolved ticket still emails
      // the recipient the same survey link.
      const [insertedSurvey] = await tx
        .insert(csatSurveys)
        .values({
          ticketId,
          userId: ticket.studentId,
          courseId: ticket.courseId || null,
          channel: 'email',
        })
        .onConflictDoNothing()
        .returning({ id: csatSurveys.id });

      let resolvedSurveyId: string | null = insertedSurvey?.id ?? null;
      if (!resolvedSurveyId) {
        const [existing] = await tx
          .select({ id: csatSurveys.id })
          .from(csatSurveys)
          .where(
            and(
              eq(csatSurveys.ticketId, ticketId),
              eq(csatSurveys.userId, ticket.studentId),
            ),
          );
        resolvedSurveyId = existing?.id ?? null;
      }

      return { updated: updatedTicket, surveyId: resolvedSurveyId };
    });

    // Log resolved_within_sla event (SB-13) — best-effort, outside the
    // transaction because a failed analytics insert shouldn't roll back
    // a legitimately-resolved ticket.
    const resolvedWithinSla =
      !ticket.slaBreachedFrt && !ticket.slaBreachedTtr;
    try {
      await db.insert(slaEvents).values({
        ticketId,
        eventType: SLA_EVENT_TYPES.RESOLVED_WITHIN_SLA,
        resolvedWithinSla,
      });
    } catch {
      // Non-blocking
    }

    // Notify student: ticket resolved (RS-01)
    try {
      await this.notificationsService.create({
        recipientId: ticket.studentId,
        type: 'ticket_resolved',
        title: 'Ticket Resolved',
        message: `Your ticket "${ticket.subject}" has been resolved. You can reopen it within 48 hours if the issue persists.`,
        link: `/dashboard/student/support`,
        entityType: 'ticket',
        entityId: ticketId,
      });
    } catch {
      // Non-blocking
    }

    // Send resolution email. Guest tickets get the same email at
    // the stored guestEmail so the public CSAT link is their entry
    // point (no dashboard to surface the popup in).
    try {
      if (ticket.studentId === GUEST_USER_ID) {
        const [guest] = await db
          .select({
            guestEmail: tickets.guestEmail,
            guestName: tickets.guestName,
          })
          .from(tickets)
          .where(eq(tickets.id, ticketId));
        if (guest?.guestEmail) {
          await this.emailService.sendTicketResolved(
            guest.guestEmail,
            guest.guestName || 'Guest',
            ticket.referenceNumber,
            surveyId,
          );
        }
      } else {
        const [studentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.studentId));
        if (studentInfo?.email) {
          await this.emailService.sendTicketResolved(
            studentInfo.email,
            studentInfo.firstName || 'Student',
            ticket.referenceNumber,
            surveyId,
          );
        }
      }
    } catch { /* non-blocking */ }

    // Audit log
    if (user) {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_RESOLVED,
        performedBy: user.id,
        metadata: { referenceNumber: ticket.referenceNumber },
      });
    }

    // Reverse-sync — if this is an intervention-sourced ticket, append
    // the resolution outcome to the originating intervention's metadata
    // so the instructor sees "Support resolved: <agent>" in their
    // student timeline without chasing the ticket. Non-blocking.
    if (ticket.source === 'intervention' && ticket.aboutUserId) {
      try {
        const agentName = user
          ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() ||
            (user as any).email ||
            'Support agent'
          : 'Support agent';
        const resolvedAtIso = new Date().toISOString();
        await db.execute(sql`
          UPDATE interventions
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'resolutionStatus', 'resolved',
            'resolutionNote', ${`Resolved by ${agentName}`},
            'resolvedAt', ${resolvedAtIso}
          )
          WHERE metadata->>'ticketId' = ${ticketId}
        `);
      } catch (err) {
        this.logger.warn(
          `Reverse-sync to intervention failed for ticket ${ticketId}: ${err}`,
        );
      }
    }

    return updated;
  }

  // ─── Close Ticket ──────────────────────────────────────

  // Manual escalation. Sets escalated_at/by/reason, optionally bumps
  // the priority, logs an sla_events row + audit entry, and fans out
  // notifications to assignee + supervisor + every admin. Idempotent
  // on escalated_at — re-escalating only updates the reason +
  // optionally bumps priority, and skips the notification fan-out
  // to avoid noise.
  async escalateTicket(
    user: AuthenticatedUser,
    ticketId: string,
    dto: { reason: string; bumpPriority?: 'medium' | 'high' },
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors and admins can escalate tickets',
      );
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        assigneeId: tickets.assigneeId,
        escalatedAt: tickets.escalatedAt,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const wasAlreadyEscalated = ticket.escalatedAt != null;
    const now = new Date();

    // Honour the bump only when it's an actual upgrade.
    const priorityRank: Record<string, number> = { low: 1, medium: 2, high: 3 };
    let newPriority: string | null = null;
    if (
      dto.bumpPriority &&
      (priorityRank[dto.bumpPriority] || 0) >
        (priorityRank[ticket.priority] || 0)
    ) {
      newPriority = dto.bumpPriority;
    }

    const update: Record<string, unknown> = {
      escalatedBy: user.id,
      escalationReason: dto.reason,
      updatedAt: now,
    };
    // Don't overwrite the first-escalated timestamp — escalation is
    // sticky, so the chip's "since" stamp stays meaningful.
    if (!wasAlreadyEscalated) update.escalatedAt = now;
    if (newPriority) update.priority = newPriority;

    await db.update(tickets).set(update).where(eq(tickets.id, ticketId));

    await db.insert(slaEvents).values({
      ticketId,
      eventType: SLA_EVENT_TYPES.MANUAL_ESCALATION,
      notifiedUserIds: ticket.assigneeId ? [ticket.assigneeId] : [],
    });

    await this.auditLogService.log({
      entityType: 'ticket',
      entityId: ticketId,
      action: SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_ESCALATED,
      performedBy: user.id,
      metadata: {
        referenceNumber: ticket.referenceNumber,
        reason: dto.reason,
        priorityBefore: ticket.priority,
        priorityAfter: newPriority || ticket.priority,
        reEscalation: wasAlreadyEscalated,
      },
    });

    // Skip the noisy fan-out on re-escalation — the audit row +
    // updated reason are enough for the second pass.
    if (wasAlreadyEscalated) {
      return {
        success: true as const,
        escalatedAt: ticket.escalatedAt,
        priority: newPriority || ticket.priority,
      };
    }

    // Fan out: assignee + supervisor + all admins (deduped).
    const supervisorId = await this.findSupervisorId();
    const adminIds = await this.findAdminUserIds();
    const recipientIds = new Set<string>();
    if (ticket.assigneeId) recipientIds.add(ticket.assigneeId);
    if (supervisorId) recipientIds.add(supervisorId);
    for (const a of adminIds) recipientIds.add(a);
    recipientIds.delete(user.id); // never notify the actor

    const recipients = Array.from(recipientIds);
    if (recipients.length > 0) {
      const userRows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users)
        .where(inArray(users.id, recipients));

      await Promise.all(
        userRows.map(async (r) => {
          // In-app notification (gated per-recipient).
          try {
            await this.notificationsService.create({
              recipientId: r.id,
              type: 'ticket_escalated',
              title: 'Ticket escalated',
              message: `${ticket.referenceNumber} — ${ticket.subject}: ${dto.reason}`,
              link: `/dashboard/support/agent/tickets/${ticketId}`,
              entityType: 'ticket',
              entityId: ticketId,
            });
          } catch {
            /* non-blocking */
          }
          // Email (gated by the recipient's preferences).
          try {
            if (
              r.email &&
              (await this.shouldNotifySupport(r.id, 'email'))
            ) {
              await this.emailService.sendTicketEscalation(
                r.email,
                r.firstName || 'Team',
                ticket.referenceNumber,
                '',
                `Manually escalated by supervisor: ${dto.reason}`,
              );
            }
          } catch {
            /* non-blocking */
          }
        }),
      );
    }

    // Phase 2 — auto-add admin team as collaborators on first
    // escalation so they show up on the ticket alongside the
    // supervisor/dev-team notification. Idempotent: addCollaborator
    // skips users already active. Best-effort; failures here don't
    // void the escalation.
    try {
      for (const adminId of adminIds) {
        if (adminId === user.id) continue; // skip the escalator
        await this.addCollaborator(user, ticketId, {
          userId: adminId,
          department: TICKET_COLLAB_DEPARTMENTS.ADMIN,
        }).catch(() => undefined);
      }
    } catch (e) {
      this.logger.warn(
        `Escalation collab auto-add failed: ${(e as Error).message}`,
      );
    }

    return {
      success: true as const,
      escalatedAt: now,
      priority: newPriority || ticket.priority,
    };
  }

  async closeTicket(ticketId: string, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only close their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Fetch student info for close notification
    const [ticketFull] = await db
      .select({
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        subject: tickets.subject,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    const [updated] = await db
      .update(tickets)
      .set({
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    // M2: Send ticket-closed notification email to the student/guest
    try {
      if (ticketFull) {
        let recipientEmail: string | null = null;
        let recipientName = 'Student';

        if (ticketFull.guestEmail) {
          recipientEmail = ticketFull.guestEmail;
          recipientName = ticketFull.guestName || 'Guest';
        } else if (ticketFull.studentId !== GUEST_USER_ID) {
          const [studentInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, ticketFull.studentId));
          if (studentInfo?.email) {
            recipientEmail = studentInfo.email;
            recipientName = studentInfo.firstName || 'Student';
          }
        }

        if (recipientEmail) {
          await this.emailService.sendTicketClosed(
            recipientEmail,
            recipientName,
            ticketFull.referenceNumber,
          );
        }
      }
    } catch {
      // Non-blocking
    }

    // Audit log
    if (user) {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: SupportService.SUPPORT_AUDIT_ACTIONS.TICKET_CLOSED,
        performedBy: user.id,
        metadata: { referenceNumber: ticketFull?.referenceNumber || null },
      });
    }

    return updated;
  }

  // ─── Get KPIs ──────────────────────────────────────

  async getKPIs() {
    const [openCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        inArray(tickets.status, [
          TICKET_STATUS.NEW,
          TICKET_STATUS.IN_PROGRESS,
          TICKET_STATUS.ON_HOLD,
        ]),
      );

    const [highCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.priority, TICKET_PRIORITY.HIGH),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      );

    const [breachCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        or(eq(tickets.slaBreachedFrt, true), eq(tickets.slaBreachedTtr, true)),
      );

    // Resolved-this-week (rolling 7 days). Drives the AllTickets
    // "Resolved this week" card. Counts both resolved and closed states
    // since both end states are "we sent the customer the answer".
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const oneWeekAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const [resolvedThisWeekRow] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          inArray(tickets.status, [
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED,
          ]),
          gte(tickets.resolvedAt, oneWeekAgo),
        ),
      );

    // Batch 4: business-hours-aware avg FRT / TTR.
    //
    // Pull the last-30-day tickets (cap 500) and reduce in JS using the
    // business-hours util, so AST weekends + off-hours don't inflate the
    // averages. TTR also subtracts onHoldTotalMinutes.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    const recentTickets = await db
      .select({
        createdAt: tickets.createdAt,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(gte(tickets.createdAt, since))
      .limit(500);

    const frtMinutesSamples: number[] = [];
    const ttrMinutesSamples: number[] = [];
    for (const row of recentTickets) {
      if (row.firstResponseAt) {
        const m = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.firstResponseAt,
        );
        if (Number.isFinite(m) && m >= 0) frtMinutesSamples.push(m);
      }
      if (row.resolvedAt) {
        const raw = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.resolvedAt,
        );
        const effective = Math.max(0, raw - (row.onHoldTotalMinutes || 0));
        if (Number.isFinite(effective)) ttrMinutesSamples.push(effective);
      }
    }
    const avgFrtMinutes = frtMinutesSamples.length
      ? frtMinutesSamples.reduce((a, b) => a + b, 0) / frtMinutesSamples.length
      : null;
    const avgTtrMinutes = ttrMinutesSamples.length
      ? ttrMinutesSamples.reduce((a, b) => a + b, 0) / ttrMinutesSamples.length
      : null;

    // Status breakdown
    const statusBreakdown = await db
      .select({ status: tickets.status, count: count() })
      .from(tickets)
      .groupBy(tickets.status);

    const statusMap = statusBreakdown.reduce(
      (acc, row) => ({ ...acc, [row.status]: row.count }),
      {} as Record<string, number>,
    );

    // CSAT + NPS summaries — reuse existing methods so we only compute
    // these numbers in one place. Used to populate the main KPI cards
    // and the right-rail CSAT widget.
    const csatSummary = await this.getCsatSummary();
    const npsSummary = await this.getNpsSummary();

    // SLA compliance % = (resolved_or_closed - breached) / resolved_or_closed
    // The breachCount query above counts tickets with either FRT or TTR
    // breached. We divide against resolved+closed because that is the
    // denominator of "what had a chance to meet SLA".
    const totalResolved = Number(statusMap['resolved'] ?? 0);
    const totalClosed = Number(statusMap['closed'] ?? 0);
    const totalResolvedOrClosed = totalResolved + totalClosed;
    const totalBreaches = Number(breachCount?.count ?? 0);
    const slaCompliance =
      totalResolvedOrClosed > 0
        ? Math.max(
            0,
            Math.round(
              ((totalResolvedOrClosed - totalBreaches) /
                totalResolvedOrClosed) *
                100,
            ),
          )
        : 100;

    // Real alert ticket details — backs the right-rail Alerts widget so
    // each chip can show the actual count and link to specific tickets
    // instead of static i18n strings like "2 SLA Breaches".

    const OPEN_STATUSES = [
      TICKET_STATUS.NEW,
      TICKET_STATUS.IN_PROGRESS,
      TICKET_STATUS.ON_HOLD,
    ];

    const breachedRows = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
      })
      .from(tickets)
      .where(
        and(
          inArray(tickets.status, OPEN_STATUSES),
          or(
            eq(tickets.slaBreachedFrt, true),
            eq(tickets.slaBreachedTtr, true),
          ),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(20);

    const unassignedRows = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
      })
      .from(tickets)
      .where(
        and(
          inArray(tickets.status, OPEN_STATUSES),
          isNull(tickets.assigneeId),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(20);

    const highPriorityRows = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
      })
      .from(tickets)
      .where(
        and(
          inArray(tickets.status, OPEN_STATUSES),
          eq(tickets.priority, 'high'),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(20);

    return {
      openTickets: openCount?.count ?? 0,
      highPriorityOpen: highCount?.count ?? 0,
      slaBreaches: totalBreaches,
      slaCompliance,
      avgFrtMinutes:
        avgFrtMinutes == null ? null : Math.round(avgFrtMinutes),
      avgTtrMinutes:
        avgTtrMinutes == null ? null : Math.round(avgTtrMinutes),
      // Pre-rounded hours for UI display (10ths). Frontend can use the
      // raw avgTtrMinutes if it needs more precision.
      avgResolutionHours:
        avgTtrMinutes == null
          ? null
          : Math.round((avgTtrMinutes / 60) * 10) / 10,
      resolvedThisWeek: Number(resolvedThisWeekRow?.count ?? 0),
      csatAvgScore: csatSummary.avgScore,
      csatResponses: csatSummary.totalResponded,
      csatResponseRate: csatSummary.responseRate,
      npsScore: npsSummary.npsScore,
      npsResponses: npsSummary.totalResponded,
      statusBreakdown: statusMap,
      unassignedCount: unassignedRows.length,
      alerts: {
        breached: breachedRows,
        unassigned: unassignedRows,
        highPriority: highPriorityRows,
      },
    };
  }

  // ─── Recent Activity ─────────────────────────────────
  // Real activity feed for the right-rail "Recent Activity" widget.
  // Surfaces what actually changed (created / replied / resolved /
  // closed / reopened) instead of just "tickets sorted by creation".
  //
  // Scope:
  //   - supervisor / admin: across the whole support queue
  //   - agent: limited to tickets they're assigned to
  //
  // Pulls from two sources and merges by time:
  //   1. ticket_replies — fresh replies (staff or student)
  //   2. tickets        — recent creations + status changes via
  //                       resolvedAt / closedAt / updatedAt
  //
  // We don't try to perfectly distinguish "reopened" vs "resumed" here
  // because that signal lives in slaEvents — keep this query cheap and
  // useful, not exhaustive.

  async getActivity(user: AuthenticatedUser, limit = 20) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const scopeFilter = isSupervisorOrAdmin
      ? undefined
      : eq(tickets.assigneeId, user.id);

    // Recent ticket activity (created / resolved / closed)
    const recentTickets = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        status: tickets.status,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(scopeFilter)
      .orderBy(desc(tickets.updatedAt))
      .limit(limit * 2);

    // Recent replies — joined with their ticket for subject + assignee scope
    const recentReplies = await db
      .select({
        id: ticketReplies.id,
        ticketId: ticketReplies.ticketId,
        ticketReferenceNumber: tickets.referenceNumber,
        isStaffReply: ticketReplies.isStaffReply,
        createdAt: ticketReplies.createdAt,
        subject: tickets.subject,
        assigneeId: tickets.assigneeId,
      })
      .from(ticketReplies)
      .innerJoin(tickets, eq(ticketReplies.ticketId, tickets.id))
      .where(scopeFilter)
      .orderBy(desc(ticketReplies.createdAt))
      .limit(limit * 2);

    type ActivityItem = {
      id: string;
      ticketId: string;
      ticketReferenceNumber: string;
      type:
        | 'created'
        | 'resolved'
        | 'closed'
        | 'staff_reply'
        | 'student_reply';
      subject: string;
      at: Date;
    };

    const items: ActivityItem[] = [];

    for (const t of recentTickets) {
      // Pick the most meaningful event per ticket: closed > resolved > created.
      // The .updatedAt sort surfaces tickets that changed recently regardless.
      if (t.closedAt) {
        items.push({
          id: `${t.id}:closed`,
          ticketId: t.id,
          ticketReferenceNumber: t.referenceNumber,
          type: 'closed',
          subject: t.subject,
          at: t.closedAt,
        });
      } else if (t.resolvedAt) {
        items.push({
          id: `${t.id}:resolved`,
          ticketId: t.id,
          ticketReferenceNumber: t.referenceNumber,
          type: 'resolved',
          subject: t.subject,
          at: t.resolvedAt,
        });
      } else {
        items.push({
          id: `${t.id}:created`,
          ticketId: t.id,
          ticketReferenceNumber: t.referenceNumber,
          type: 'created',
          subject: t.subject,
          at: t.createdAt,
        });
      }
    }

    for (const r of recentReplies) {
      items.push({
        id: `${r.id}:reply`,
        ticketId: r.ticketId,
        ticketReferenceNumber: r.ticketReferenceNumber,
        type: r.isStaffReply ? 'staff_reply' : 'student_reply',
        subject: r.subject,
        at: r.createdAt,
      });
    }

    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    return items.slice(0, limit);
  }

  // ─── Get Agents ──────────────────────────────────────

  async getAgents() {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return [];

    const agents = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.roleId, supportRole[0].id));

    return agents;
  }

  // ─── Round Robin (True Rotation with DB Pointer) ──────────

  /**
   * Get all support agents in stable deterministic order.
   * Sorted by assignment date then user ID for consistent rotation.
   */
  private async getAgentRoster(): Promise<
    { userId: string; firstName: string | null }[]
  > {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return [];

    return db
      .select({
        userId: userRoles.userId,
        firstName: users.firstName,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole[0].id),
          or(
            eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.AGENT),
            sql`${userRoles.supportSubRole} IS NULL`,
          ),
        ),
      )
      .orderBy(asc(userRoles.assignedAt), asc(users.id));
  }

  /**
   * Pick the next agent for a new ticket, honouring the admin-controlled
   * auto-assignment config:
   *   - enabled=false        → return null (manual queue handover)
   *   - strategy='manual'    → return null (same; supervisor picks up)
   *   - respectBusinessHours → return null outside hours (queue waits)
   *   - maxConcurrentPerAgent → exclude agents already at/above cap
   *   - strategy='least_loaded' → pick the eligible agent with the fewest
   *                               open tickets (tiebreak by round-robin
   *                               pointer for fairness)
   *   - strategy='round_robin'  → existing rotation logic over eligibles
   *
   * Fallbacks asked-about explicitly (avoid orphaned tickets):
   *   - No agents in roster        → fall back to supervisor (if any)
   *   - All agents at/above cap    → fall back to supervisor (if any)
   *   - No supervisor either       → return null (admin sees in queue)
   *
   * Original guarantees preserved: pointer txn with FOR UPDATE prevents
   * two concurrent creates from landing on the same agent; FRT-breached
   * agents are deprioritised (now applied as a soft skip, not a hard
   * filter, so heavy days don't starve the queue).
   */
  async findNextAgent(category?: string): Promise<string | null> {
    const cfg = await this.getAutoAssignment();

    // Master OFF or manual mode → supervisor handles assignment.
    if (!cfg.enabled || cfg.strategy === 'manual') {
      return null;
    }

    // Outside business hours? Don't ping anyone — let it wait in queue
    // for the next opening. Supervisor still sees it in unassigned.
    if (cfg.respectBusinessHours) {
      await refreshBusinessHoursConfigIfStale(() => this.getBusinessHours());
      if (!isWithinBusinessHours(new Date())) {
        return null;
      }
    }

    const agents = await this.getAgentRoster();

    // No agents at all → supervisor is the only option (Q1 you asked).
    if (agents.length === 0) {
      return this.findSupervisorId();
    }

    // Filter by maxConcurrentPerAgent if set (0 = unlimited).
    let eligible = agents;
    if (cfg.maxConcurrentPerAgent > 0) {
      const loads = await this.getAgentOpenTicketCounts(
        agents.map((a) => a.userId),
      );
      eligible = agents.filter(
        (a) => (loads.get(a.userId) || 0) < cfg.maxConcurrentPerAgent,
      );
    }

    // Every agent at/above cap → supervisor takes overflow (Q2 you asked).
    if (eligible.length === 0) {
      return this.findSupervisorId();
    }

    // Category-aware preference (used by transfer). Prefer agents who
    // are already working at least one open ticket in this category —
    // a lightweight specialty signal that works without admin-defined
    // specializations. Falls back to the full pool when no agent has
    // prior tickets in this category.
    if (category && eligible.length > 1) {
      const specialists = await this.getAgentsActiveInCategory(
        eligible.map((a) => a.userId),
        category,
      );
      if (specialists.size > 0) {
        const narrowed = eligible.filter((a) => specialists.has(a.userId));
        if (narrowed.length > 0) eligible = narrowed;
      }
    }

    if (eligible.length === 1) return eligible[0].userId;

    // Least-loaded: pick lowest open-ticket count among eligibles.
    // Tiebreak via the round-robin pointer so two equally loaded agents
    // still rotate fairly. No pointer advance — pointer is owned by the
    // round_robin strategy below.
    if (cfg.strategy === 'least_loaded') {
      const loads = await this.getAgentOpenTicketCounts(
        eligible.map((a) => a.userId),
      );
      let bestLoad = Number.POSITIVE_INFINITY;
      const candidates: typeof eligible = [];
      for (const a of eligible) {
        const n = loads.get(a.userId) || 0;
        if (n < bestLoad) {
          bestLoad = n;
          candidates.length = 0;
          candidates.push(a);
        } else if (n === bestLoad) {
          candidates.push(a);
        }
      }
      const [{ value: pointerRow }] = await db
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'round_robin_pointer'))
        .limit(1)
        .then((rows) => (rows.length ? rows : [{ value: 0 as any }]));
      const pointer = Number.isFinite(Number(pointerRow))
        ? Number(pointerRow)
        : 0;
      return candidates[pointer % candidates.length].userId;
    }

    // Default: round-robin with persistent pointer + soft FRT-breach skip.
    // The whole pointer-advance block stays atomic via SELECT ... FOR UPDATE.
    return db.transaction(async (tx) => {
      const [config] = await tx
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'round_robin_pointer'))
        .for('update');

      let pointer = config ? Number(config.value) : 0;
      if (isNaN(pointer)) pointer = 0;

      for (let i = 0; i < eligible.length; i++) {
        const index = (pointer + i) % eligible.length;
        const agent = eligible[index];

        const [breachedTicket] = await tx
          .select({ id: tickets.id })
          .from(tickets)
          .where(
            and(
              eq(tickets.assigneeId, agent.userId),
              eq(tickets.slaBreachedFrt, true),
              sql`${tickets.firstResponseAt} IS NULL`,
              inArray(tickets.status, [
                TICKET_STATUS.NEW,
                TICKET_STATUS.IN_PROGRESS,
              ]),
            ),
          )
          .limit(1);

        if (!breachedTicket) {
          const newPointer = (pointer + i + 1) % eligible.length;
          await tx
            .insert(supportConfig)
            .values({
              key: 'round_robin_pointer',
              value: newPointer,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: supportConfig.key,
              set: { value: newPointer, updatedAt: new Date() },
            });

          return agent.userId;
        }
      }

      // All eligibles have FRT breaches — fall back to pointer agent.
      const fallbackIndex = pointer % eligible.length;
      const newPointer = (pointer + 1) % eligible.length;
      await tx
        .insert(supportConfig)
        .values({
          key: 'round_robin_pointer',
          value: newPointer,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: supportConfig.key,
          set: { value: newPointer, updatedAt: new Date() },
        });

      return eligible[fallbackIndex].userId;
    });
  }

  /**
   * Count open tickets per agent. Used by least_loaded strategy and the
   * maxConcurrentPerAgent cap. "Open" = NEW or IN_PROGRESS (ON_HOLD is
   * paused-waiting-on-student and shouldn't count against capacity since
   * the agent isn't actively working it).
   */
  // Lightweight category-specialty lookup used by `findNextAgent`.
  // Returns the subset of agents who currently own at least one open
  // ticket (NEW / IN_PROGRESS / ON_HOLD) in the given category. Used
  // by transfer routing so the new assignee is likelier to already
  // have context for that category. No admin config required.
  private async getAgentsActiveInCategory(
    agentIds: string[],
    category: string,
  ): Promise<Set<string>> {
    const result = new Set<string>();
    if (agentIds.length === 0 || !category) return result;
    const rows = await db
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(
        and(
          inArray(tickets.assigneeId, agentIds),
          eq(tickets.category, category),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      );
    for (const r of rows) {
      if (r.assigneeId) result.add(r.assigneeId);
    }
    return result;
  }

  private async getAgentOpenTicketCounts(
    agentIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (agentIds.length === 0) return result;
    const rows = await db
      .select({ assigneeId: tickets.assigneeId, n: count() })
      .from(tickets)
      .where(
        and(
          inArray(tickets.assigneeId, agentIds),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
          ]),
        ),
      )
      .groupBy(tickets.assigneeId);
    for (const r of rows) {
      if (r.assigneeId) result.set(r.assigneeId, Number(r.n));
    }
    return result;
  }

  /**
   * Find next agent for FRT breach reassignment, excluding specific agents.
   * RR-11: Follows rotation but skips excluded agents
   * RR-12: Returns null if all agents excluded (caller escalates to supervisor)
   */
  async findNextAgentForReassignment(
    excludeAgentIds: string[],
  ): Promise<string | null> {
    const agents = await this.getAgentRoster();
    let eligible = agents.filter(
      (a) => !excludeAgentIds.includes(a.userId),
    );

    if (eligible.length === 0) return null; // RR-12: all agents exhausted

    // Honour maxConcurrentPerAgent so SLA breach reassignment doesn't
    // dump on someone already at capacity. If the cap squeezes us down
    // to zero candidates, return null and let the caller escalate to
    // the supervisor (same fallback path as "no agents at all").
    const cfg = await this.getAutoAssignment();
    if (cfg.maxConcurrentPerAgent > 0) {
      const loads = await this.getAgentOpenTicketCounts(
        eligible.map((a) => a.userId),
      );
      eligible = eligible.filter(
        (a) => (loads.get(a.userId) || 0) < cfg.maxConcurrentPerAgent,
      );
      if (eligible.length === 0) return null;
    }

    // Read pointer
    const [config] = await db
      .select()
      .from(supportConfig)
      .where(eq(supportConfig.key, 'round_robin_pointer'));

    const pointer = config ? Number(config.value) : 0;

    // Pick next eligible agent from rotation
    for (let i = 0; i < agents.length; i++) {
      const index = (pointer + i) % agents.length;
      const agent = agents[index];
      if (eligible.some((e) => e.userId === agent.userId)) {
        return agent.userId;
      }
    }

    return eligible[0].userId; // fallback
  }

  /**
   * Find the first supervisor user ID (for escalation when all agents fail).
   * RR-12: Ticket escalates to supervisor as last resort
   */
  async findSupervisorId(): Promise<string | null> {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return null;

    const [supervisor] = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.roleId, supportRole[0].id),
          eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.SUPERVISOR),
        ),
      )
      .limit(1);

    return supervisor?.userId || null;
  }

  /**
   * Find all ADMIN / SUPER_ADMIN user IDs. Used to fan out escalation
   * notifications alongside the supervisor — admins should know when
   * an SLA breaches even though they're not in the day-to-day support
   * rotation. Returns an empty array if no admins exist (safe no-op
   * for senders).
   */
  async findAdminUserIds(): Promise<string[]> {
    const adminRoleRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        inArray(roles.name, [
          ROLE_NAMES.ADMIN,
          ROLE_NAMES.SUPER_ADMIN,
        ] as string[]),
      );
    if (!adminRoleRows.length) return [];

    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        inArray(
          userRoles.roleId,
          adminRoleRows.map((r) => r.id),
        ),
      );

    // Dedupe — a single user can hold both ADMIN and SUPER_ADMIN rows.
    return Array.from(new Set(rows.map((r) => r.userId)));
  }

  // ─── In-app CSAT rate (any requester) ──────────────────
  // Role-agnostic equivalent of student.rateTicket. Mirrors the legacy
  // student endpoint's logic but allows any platform role (instructor,
  // course-manager, finance, TA, etc.) to rate their own resolved ticket
  // from the in-app sidebar. Writes to both tickets.satisfactionRating
  // and csat_surveys (upsert) so the rating button display and dashboard
  // analytics never disagree.
  async rateOwnTicket(userId: string, ticketId: string, rating: number) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        courseId: tickets.courseId,
        requesterId: tickets.studentId,
      })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.studentId, userId)));

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      throw new BadRequestException(
        'Can only rate resolved or closed tickets',
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({ satisfactionRating: rating })
        .where(eq(tickets.id, ticketId));

      await tx
        .insert(csatSurveys)
        .values({
          ticketId,
          userId,
          courseId: ticket.courseId || null,
          score: rating,
          channel: 'email',
          submittedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [csatSurveys.ticketId, csatSurveys.userId],
          set: {
            score: rating,
            submittedAt: new Date(),
          },
        });
    });

    return { success: true };
  }

  // ─── CSAT Survey Submission (RS-02 to RS-07) ──────────

  /**
   * Submit CSAT score via survey ID (no login required).
   * RS-04: Expired after 72h from sentAt.
   * RS-05: Token (surveyId) one-time use — cannot resubmit.
   * RS-07: One CSAT per ticket per student (unique constraint).
   */
  async submitCsatScore(
    surveyId: string,
    score: number,
    comment?: string,
  ) {
    const [survey] = await db
      .select()
      .from(csatSurveys)
      .where(eq(csatSurveys.id, surveyId));

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    // RS-05: Already submitted
    if (survey.submittedAt) {
      throw new BadRequestException(
        'You have already submitted your rating for this ticket.',
      );
    }

    // RS-04: Expired after 72h
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    if (
      Date.now() - new Date(survey.sentAt).getTime() >
      SEVENTY_TWO_HOURS_MS
    ) {
      throw new BadRequestException('This survey has expired.');
    }

    // RS-06: Check if ticket was reopened (status not resolved/closed)
    const [ticket] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, survey.ticketId));

    // Save the score regardless of current ticket status
    const [updated] = await db
      .update(csatSurveys)
      .set({
        score,
        comment: comment || null,
        submittedAt: new Date(),
      })
      .where(eq(csatSurveys.id, surveyId))
      .returning();

    // Detractor follow-up: score 1 or 2 → send follow-up email.
    // For guest tickets the survey userId is the sentinel GUEST_USER_ID —
    // use the ticket's stored guestEmail/guestName instead of the sentinel
    // user's row so the follow-up actually reaches the real guest.
    if (score <= 2) {
      try {
        let recipientEmail: string | null = null;
        let recipientName: string = 'Student';

        // Load the ticket reference up front so both branches can pass it
        // to the email service — we no longer slice the UUID for display.
        const [ticketRef] = await db
          .select({ referenceNumber: tickets.referenceNumber })
          .from(tickets)
          .where(eq(tickets.id, survey.ticketId));

        if (survey.userId === GUEST_USER_ID) {
          const [guestTicket] = await db
            .select({
              guestEmail: tickets.guestEmail,
              guestName: tickets.guestName,
            })
            .from(tickets)
            .where(eq(tickets.id, survey.ticketId));
          if (guestTicket?.guestEmail) {
            recipientEmail = guestTicket.guestEmail;
            recipientName = guestTicket.guestName || 'Guest';
          }
        } else {
          const [userInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, survey.userId));
          if (userInfo?.email) {
            recipientEmail = userInfo.email;
            recipientName = userInfo.firstName || 'Student';
          }
        }

        if (recipientEmail && ticketRef) {
          await this.emailService.sendCsatFollowup(
            recipientEmail,
            recipientName,
            ticketRef.referenceNumber,
            score,
          );
        }
      } catch {
        // Non-blocking
      }
    }

    return updated;
  }

  /**
   * Get CSAT survey details by ID (for the public rating page).
   */
  async getCsatSurvey(surveyId: string) {
    const [survey] = await db
      .select({
        id: csatSurveys.id,
        ticketId: csatSurveys.ticketId,
        score: csatSurveys.score,
        sentAt: csatSurveys.sentAt,
        submittedAt: csatSurveys.submittedAt,
      })
      .from(csatSurveys)
      .where(eq(csatSurveys.id, surveyId));

    if (!survey) throw new NotFoundException('Survey not found');

    // Check expiry
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    const expired =
      Date.now() - new Date(survey.sentAt).getTime() > SEVENTY_TWO_HOURS_MS;

    return {
      ...survey,
      expired,
      alreadySubmitted: !!survey.submittedAt,
    };
  }

  // Pending CSAT prompts surfaced in a global dashboard popup so the
  // user doesn't have to open the resolved ticket to give feedback.
  // Returns at most 5 surveys (most recent first) where:
  //   - the survey belongs to the current user
  //   - it hasn't been submitted yet
  //   - sentAt is within the 72h response window
  //   - the underlying ticket is still resolved/closed (not reopened)
  // Guest tickets are never returned — they have no dashboard; their
  // entry point is the email CTA.
  async getPendingCsatForUser(user: AuthenticatedUser) {
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - SEVENTY_TWO_HOURS_MS);

    const rows = await db
      .select({
        surveyId: csatSurveys.id,
        ticketId: csatSurveys.ticketId,
        sentAt: csatSurveys.sentAt,
        ticketReferenceNumber: tickets.referenceNumber,
        ticketSubject: tickets.subject,
        ticketStatus: tickets.status,
        resolvedAt: tickets.resolvedAt,
        agentFirstName: users.firstName,
        agentLastName: users.lastName,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(
        and(
          eq(csatSurveys.userId, user.id),
          isNull(csatSurveys.submittedAt),
          gte(csatSurveys.sentAt, cutoff),
          inArray(tickets.status, [
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED,
          ]),
        ),
      )
      .orderBy(desc(csatSurveys.sentAt))
      .limit(5);

    return rows.map((r) => ({
      surveyId: r.surveyId,
      ticketId: r.ticketId,
      ticketReferenceNumber: r.ticketReferenceNumber,
      ticketSubject: r.ticketSubject,
      resolvedAt: r.resolvedAt,
      agentName: [r.agentFirstName, r.agentLastName]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
    }));
  }

  // ─── Summary / Analytics ──────────────────────────────

  async getCsatSummary(opts?: { dateFrom?: Date | null; dateTo?: Date | null }) {
    // Date range applies to sentAt — "how the cohort sent in this
    // window performed". Using submittedAt would exclude pending
    // surveys and skew response rate.
    const conditions: any[] = [];
    if (opts?.dateFrom) conditions.push(gte(csatSurveys.sentAt, opts.dateFrom));
    if (opts?.dateTo) conditions.push(lte(csatSurveys.sentAt, opts.dateTo));

    const allSurveys = await db
      .select({
        score: csatSurveys.score,
        submittedAt: csatSurveys.submittedAt,
      })
      .from(csatSurveys)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = allSurveys.length;
    const responded = allSurveys.filter((s) => s.submittedAt).length;
    const scores = allSurveys
      .filter((s) => s.score !== null)
      .map((s) => s.score!);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of scores) {
      if (s >= 1 && s <= 5) distribution[s as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
      totalSent: total,
      totalResponded: responded,
      responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      avgScore: Math.round(avgScore * 10) / 10,
      distribution,
    };
  }

  // ─── CSAT breakdown reports ─────────────────────────────
  //
  // Four read-only aggregations powering the extended CSAT reports
  // panel: by-category, by-agent, monthly trend, and detractor
  // (low-rating) follow-up list. All four respect the page-level
  // date range and the same submittedAt + non-null score filter so
  // the headline avg matches the breakdowns.

  async getCsatByCategory(opts?: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }) {
    const conditions: any[] = [isNotNull(csatSurveys.score)];
    if (opts?.dateFrom) conditions.push(gte(csatSurveys.submittedAt, opts.dateFrom));
    if (opts?.dateTo) conditions.push(lte(csatSurveys.submittedAt, opts.dateTo));

    const rows = await db
      .select({
        category: tickets.category,
        responses: sql<number>`COUNT(${csatSurveys.id})`.as('responses'),
        avgScore: sql<number>`AVG(${csatSurveys.score})`.as('avg_score'),
        detractors: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} <= 2)`.as('detractors'),
        promoters: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} >= 4)`.as('promoters'),
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(and(...conditions))
      .groupBy(tickets.category)
      .orderBy(desc(sql`avg_score`));

    return rows.map((r) => ({
      category: r.category,
      responses: Number(r.responses ?? 0),
      avgScore: r.avgScore != null ? Math.round(Number(r.avgScore) * 10) / 10 : 0,
      detractors: Number(r.detractors ?? 0),
      promoters: Number(r.promoters ?? 0),
    }));
  }

  async getCsatByAgent(opts?: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }) {
    const conditions: any[] = [isNotNull(csatSurveys.score)];
    if (opts?.dateFrom) conditions.push(gte(csatSurveys.submittedAt, opts.dateFrom));
    if (opts?.dateTo) conditions.push(lte(csatSurveys.submittedAt, opts.dateTo));

    // The agent being rated is the ticket's assignee at the time of
    // resolution. tickets.assigneeId can be NULL for tickets that
    // were never assigned (escalation path closed via auto-rule);
    // those land in a single "Unassigned" bucket so they don't get
    // dropped from totals.
    const rows = await db
      .select({
        agentId: tickets.assigneeId,
        firstName: users.firstName,
        lastName: users.lastName,
        responses: sql<number>`COUNT(${csatSurveys.id})`.as('responses'),
        avgScore: sql<number>`AVG(${csatSurveys.score})`.as('avg_score'),
        detractors: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} <= 2)`.as('detractors'),
        promoters: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} >= 4)`.as('promoters'),
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(and(...conditions))
      .groupBy(tickets.assigneeId, users.firstName, users.lastName)
      .orderBy(desc(sql`avg_score`));

    return rows.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentId
        ? [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Agent'
        : null,
      responses: Number(r.responses ?? 0),
      avgScore: r.avgScore != null ? Math.round(Number(r.avgScore) * 10) / 10 : 0,
      detractors: Number(r.detractors ?? 0),
      promoters: Number(r.promoters ?? 0),
    }));
  }

  async getCsatMonthlyTrend(opts?: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }) {
    // Default to the trailing 6 months when no range is provided —
    // a single empty month at the end of a sparse dataset is more
    // informative than an open-ended scan.
    const dateTo = opts?.dateTo ?? new Date();
    const defaultFrom = new Date(dateTo.getTime());
    defaultFrom.setMonth(defaultFrom.getMonth() - 6);
    const dateFrom = opts?.dateFrom ?? defaultFrom;

    const rows = await db
      .select({
        bucket: sql<string>`to_char(${csatSurveys.submittedAt}, 'YYYY-MM')`.as('bucket'),
        responses: sql<number>`COUNT(${csatSurveys.id})`.as('responses'),
        avgScore: sql<number>`AVG(${csatSurveys.score})`.as('avg_score'),
        detractors: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} <= 2)`.as('detractors'),
        promoters: sql<number>`COUNT(*) FILTER (WHERE ${csatSurveys.score} >= 4)`.as('promoters'),
      })
      .from(csatSurveys)
      .where(
        and(
          isNotNull(csatSurveys.score),
          gte(csatSurveys.submittedAt, dateFrom),
          lte(csatSurveys.submittedAt, dateTo),
        ),
      )
      .groupBy(sql`bucket`)
      .orderBy(sql`bucket ASC`);

    return rows.map((r) => ({
      bucket: r.bucket,
      responses: Number(r.responses ?? 0),
      avgScore: r.avgScore != null ? Math.round(Number(r.avgScore) * 10) / 10 : 0,
      detractors: Number(r.detractors ?? 0),
      promoters: Number(r.promoters ?? 0),
    }));
  }

  async getLowRatingSurveys(opts?: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
    status?: 'pending' | 'completed' | 'all';
  }) {
    const status = opts?.status ?? 'all';
    const conditions: any[] = [
      isNotNull(csatSurveys.score),
      lte(csatSurveys.score, 2),
    ];
    if (opts?.dateFrom) conditions.push(gte(csatSurveys.submittedAt, opts.dateFrom));
    if (opts?.dateTo) conditions.push(lte(csatSurveys.submittedAt, opts.dateTo));
    if (status === 'pending') {
      conditions.push(isNull(csatSurveys.followUpCompletedAt));
    } else if (status === 'completed') {
      conditions.push(isNotNull(csatSurveys.followUpCompletedAt));
    }

    // Single query joins ticket → agent (assignee) and a separate
    // join to users for the follow-up resolver name. Both join
    // aliases avoid column ambiguity from a multi-join on users.
    const assigneeUsers = alias(users, 'assignee_users');
    const followupUsers = alias(users, 'followup_users');

    const rows = await db
      .select({
        surveyId: csatSurveys.id,
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        followUpCompletedAt: csatSurveys.followUpCompletedAt,
        ticketId: tickets.id,
        ticketReference: tickets.referenceNumber,
        ticketSubject: tickets.subject,
        ticketCategory: tickets.category,
        agentId: tickets.assigneeId,
        agentFirstName: assigneeUsers.firstName,
        agentLastName: assigneeUsers.lastName,
        followUpByFirstName: followupUsers.firstName,
        followUpByLastName: followupUsers.lastName,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
      .leftJoin(followupUsers, eq(csatSurveys.followUpCompletedBy, followupUsers.id))
      .where(and(...conditions))
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(100);

    return rows.map((r) => ({
      surveyId: r.surveyId,
      score: r.score,
      comment: r.comment,
      submittedAt: r.submittedAt,
      followUpCompletedAt: r.followUpCompletedAt,
      ticketId: r.ticketId,
      ticketReference: r.ticketReference,
      ticketSubject: r.ticketSubject,
      ticketCategory: r.ticketCategory,
      agentId: r.agentId,
      agentName: r.agentId
        ? [r.agentFirstName, r.agentLastName].filter(Boolean).join(' ') || 'Agent'
        : null,
      followUpBy: r.followUpCompletedAt
        ? [r.followUpByFirstName, r.followUpByLastName].filter(Boolean).join(' ') || 'Supervisor'
        : null,
    }));
  }

  async markCsatFollowedUp(surveyId: string, userId: string) {
    const [existing] = await db
      .select({
        id: csatSurveys.id,
        score: csatSurveys.score,
        followUpCompletedAt: csatSurveys.followUpCompletedAt,
      })
      .from(csatSurveys)
      .where(eq(csatSurveys.id, surveyId));
    if (!existing) throw new NotFoundException('CSAT survey not found');
    if (existing.score == null || existing.score > 2) {
      throw new BadRequestException(
        'Only low-rating surveys (1-2) can be marked as followed up',
      );
    }
    if (existing.followUpCompletedAt) {
      // Idempotent — caller already marked it; just return current state.
      return { surveyId, followUpCompletedAt: existing.followUpCompletedAt };
    }
    const now = new Date();
    await db
      .update(csatSurveys)
      .set({
        followUpCompletedAt: now,
        followUpCompletedBy: userId,
      })
      .where(eq(csatSurveys.id, surveyId));
    return { surveyId, followUpCompletedAt: now };
  }

  /**
   * NPS-equivalent score derived from the existing student course ratings
   * (1–5 stars). The dedicated nps_surveys flow was removed because it
   * duplicated the in-app review modal — see docs/support-dashboard/work-plan.md.
   *
   * Mapping (1–5 star → standard NPS buckets):
   *   1–2 stars → detractor
   *   3 stars   → passive
   *   4–5 stars → promoter
   *
   * NPS = ((promoters - detractors) / totalScored) × 100, range -100..+100.
   */
  async getNpsSummary() {
    const allRatings = await db
      .select({ rating: courseRatings.rating })
      .from(courseRatings);

    const total = allRatings.length;
    const scores = allRatings.map((r) => r.rating);

    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    for (const s of scores) {
      if (s >= 4) promoters++;
      else if (s === 3) passives++;
      else detractors++;
    }

    const totalScored = scores.length;
    const npsScore =
      totalScored > 0
        ? Math.round(((promoters - detractors) / totalScored) * 100)
        : 0;

    return {
      // Derived from course_ratings — `totalSent` and `responseRate`
      // no longer have an equivalent (ratings are voluntary in-app, not
      // emailed). Kept as 0/100 for response-shape compatibility with
      // the old NPS surveys endpoint.
      totalSent: total,
      totalResponded: total,
      responseRate: total > 0 ? 100 : 0,
      promoters,
      passives,
      detractors,
      npsScore,
    };
  }



  // Bulk attachment fetch for a single ticket. The legacy
  // `attachmentUrl` column is folded in too so old tickets created
  // before migration 0054 still surface as one chip in the UI.
  //
  // Each attachment is enriched with the malware-scan verdict read
  // straight from GCS object metadata. Verdict source of truth lives
  // on the object itself, written by the Eventarc-triggered scanner
  // ([infra/malware-scanner/main.js](infra/malware-scanner/main.js)).
  // We do one metadata fetch per attachment — usually 0–3 per ticket,
  // each <10ms — which is cheap enough to do inline on the detail load.
  // ─── Soft-delete an attachment (Amna R4 — Jun 2026) ─────────
  //
  // Removes an attachment from the active list without destroying
  // the row, so the attachment-history view can still show what was
  // there. Gated to assignee + supervisor + admin — learners can't
  // remove their own attachments once they've been submitted (we
  // treat them as evidence).
  async softDeleteAttachment(
    user: AuthenticatedUser,
    ticketId: string,
    attachmentId: string,
  ) {
    const [ticket] = await db
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAdmin =
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    const isSupport = user.roles.includes(ROLE_NAMES.SUPPORT);
    const isSupervisor = user.supportSubRole === 'supervisor';

    if (!isAdmin && !isSupport) {
      throw new ForbiddenException(
        'Only support staff can remove attachments',
      );
    }
    if (!isAdmin && !isSupervisor && ticket.assigneeId !== user.id) {
      throw new ForbiddenException(
        'You are not assigned to this ticket',
      );
    }

    const [target] = await db
      .select({
        id: ticketAttachments.id,
        ticketId: ticketAttachments.ticketId,
        url: ticketAttachments.url,
        removedAt: ticketAttachments.removedAt,
      })
      .from(ticketAttachments)
      .where(eq(ticketAttachments.id, attachmentId))
      .limit(1);

    if (!target || target.ticketId !== ticketId) {
      throw new NotFoundException('Attachment not found on this ticket');
    }
    if (target.removedAt) {
      throw new BadRequestException('Attachment is already removed');
    }

    await db
      .update(ticketAttachments)
      .set({ removedAt: new Date(), removedBy: user.id })
      .where(eq(ticketAttachments.id, attachmentId));

    // Mirror to audit_logs so the attachment removal shows up in the
    // ticket's general audit trail alongside status changes etc.
    await this.auditLogService.log({
      entityType: 'support_ticket',
      entityId: ticketId,
      action: 'attachment_removed',
      performedBy: user.id,
      metadata: {
        attachmentId: target.id,
        attachmentUrl: target.url,
      },
    });

    return { success: true as const, attachmentId: target.id };
  }

  // ─── Attachment version history (Amna R4 — Jun 2026) ────────
  //
  // Returns EVERY attachment ever uploaded to this ticket, both
  // active and soft-deleted, in chronological order. Each row carries
  // the uploader, the remover (when removed), and the soft-delete
  // timestamps so the FE can render a "Uploaded → Removed" timeline.
  //
  // Gated to support + admin — learners don't see other people's
  // removed files. (They don't see other people's tickets at all,
  // but defensive: this endpoint is on the staff side only.)
  async getAttachmentHistory(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const isStaff =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isStaff) {
      throw new ForbiddenException(
        'Only support staff can view attachment history',
      );
    }

    const [ticket] = await db
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
      throw new ForbiddenException('You are not assigned to this ticket');
    }

    const uploaderAlias = alias(users, 'attachment_uploader');
    const removerAlias = alias(users, 'attachment_remover');

    return db
      .select({
        id: ticketAttachments.id,
        replyId: ticketAttachments.replyId,
        url: ticketAttachments.url,
        filename: ticketAttachments.filename,
        sizeBytes: ticketAttachments.sizeBytes,
        mimeType: ticketAttachments.mimeType,
        uploadedAt: ticketAttachments.uploadedAt,
        removedAt: ticketAttachments.removedAt,
        sha256: ticketAttachments.sha256,
        uploaderId: ticketAttachments.uploadedBy,
        uploaderFirstName: uploaderAlias.firstName,
        uploaderLastName: uploaderAlias.lastName,
        uploaderEmail: uploaderAlias.email,
        removerId: ticketAttachments.removedBy,
        removerFirstName: removerAlias.firstName,
        removerLastName: removerAlias.lastName,
        removerEmail: removerAlias.email,
      })
      .from(ticketAttachments)
      .leftJoin(
        uploaderAlias,
        eq(uploaderAlias.id, ticketAttachments.uploadedBy),
      )
      .leftJoin(
        removerAlias,
        eq(removerAlias.id, ticketAttachments.removedBy),
      )
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(asc(ticketAttachments.uploadedAt));
  }

  async getTicketAttachments(ticketId: string) {
    const rows = await db
      .select({
        id: ticketAttachments.id,
        url: ticketAttachments.url,
        filename: ticketAttachments.filename,
        sizeBytes: ticketAttachments.sizeBytes,
        mimeType: ticketAttachments.mimeType,
        uploadedAt: ticketAttachments.uploadedAt,
      })
      .from(ticketAttachments)
      .where(
        and(
          eq(ticketAttachments.ticketId, ticketId),
          // Active attachments only. The history endpoint returns
          // removed ones separately.
          isNull(ticketAttachments.removedAt),
        ),
      )
      .orderBy(asc(ticketAttachments.uploadedAt));

    return Promise.all(
      rows.map(async (row) => {
        const scan = await this.lookupScanStatusForUrl(row.url);
        return {
          ...row,
          scanStatus: scan.status,
          scannedAt: scan.scannedAt,
        };
      }),
    );
  }

  /**
   * Resolve a stored attachment URL → scan verdict. Handles both URL
   * shapes we ever persist:
   *   - `/api/storage/files/<bucket>/<path>`  (our proxy URL — most cases)
   *   - `https://storage.googleapis.com/<bucket>/<path>` (legacy / direct)
   * Anything else gets `unknown` so the UI doesn't pretend it knows.
   */
  private async lookupScanStatusForUrl(url: string): Promise<{
    status: 'clean' | 'pending' | 'quarantined' | 'unknown';
    scannedAt: string | null;
  }> {
    if (!url) return { status: 'unknown', scannedAt: null };

    let bucket: 'public' | 'private' | 'trainers' | null = null;
    let filename: string | null = null;

    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const proxyMatch = path.match(
        /\/storage\/files\/(public|private|trainers)\/(.+)$/,
      );
      if (proxyMatch) {
        bucket = proxyMatch[1] as 'public' | 'private' | 'trainers';
        filename = decodeURIComponent(proxyMatch[2]);
      } else if (parsed.host.endsWith('storage.googleapis.com')) {
        // path is /<bucket>/<file...>
        const stripped = path.replace(/^\/+/, '');
        const slash = stripped.indexOf('/');
        if (slash > 0) {
          const bucketName = stripped.slice(0, slash);
          filename = decodeURIComponent(stripped.slice(slash + 1));
          if (bucketName.includes('private')) bucket = 'private';
          else if (bucketName.includes('trainers')) bucket = 'trainers';
          else bucket = 'public';
        }
      }
    } catch {
      // malformed URL — fall through
    }

    if (!bucket || !filename) {
      return { status: 'unknown', scannedAt: null };
    }
    return this.storageService.getScanStatus(bucket, filename);
  }


  // ─── Create Ticket on Behalf (Instructor → Learner) ────

  /**
   * Instructor opens a ticket on behalf of a student (IN-01 to IN-08)
   * Validates instructor teaches a course the student is enrolled in (IN-03)
   */
  async createTicketOnBehalf(
    openedByUserId: string,
    dto: CreateTicketOnBehalfDto,
  ) {
    // Validate student exists
    const [student] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.studentId))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate instructor teaches a course the student is enrolled in (IN-03)
    if (dto.courseId) {
      const [enrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, dto.studentId),
            eq(enrollments.courseId, dto.courseId),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException(
          'Student is not enrolled in this course',
        );
      }
    }

    const { priority: autoPriority, isValidSlug: validCat } =
      await this.resolveCategoryPriority(dto.category);
    if (!validCat) {
      throw new BadRequestException(
        `Unknown category "${dto.category}". Ask an admin to add it under Settings → Categories.`,
      );
    }
    const assigneeId = await this.findNextAgent();

    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId: dto.studentId,
        category: dto.category,
        priority: autoPriority,
        subject: dto.subject,
        description: dto.description,
        courseId: dto.courseId || null,
        status: TICKET_STATUS.NEW,
        assigneeId,
        openedBy: openedByUserId,
      })
      .returning();

    return ticket;
  }

  // ─── Tickets Opened By Me (Instructor View) ──────────

  async getTicketsOpenedByMe(userId: string) {
    return db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.openedBy, userId))
      .orderBy(desc(tickets.createdAt));
  }

  // ─── Course Ticket Count (CM-01) ─────────────────────

  async getCourseTicketCount(courseId: string) {
    const [result] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.courseId, courseId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      );

    return { courseId, openCount: result?.count ?? 0 };
  }

  // ─── SLA Breaches + Backlog ────────────────────────────

  async getSlaBreaches() {
    return db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        createdAt: tickets.createdAt,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(
        and(
          or(
            eq(tickets.slaBreachedFrt, true),
            eq(tickets.slaBreachedTtr, true),
          ),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .orderBy(desc(tickets.createdAt));
  }

  async getSlaBacklog() {
    const openTickets = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        createdAt: tickets.createdAt,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(
        inArray(tickets.status, [
          TICKET_STATUS.NEW,
          TICKET_STATUS.IN_PROGRESS,
          TICKET_STATUS.ON_HOLD,
        ]),
      );

    const now = new Date();
    const buckets = [
      { label: '0-1h', min: 0, max: 60, count: 0 },
      { label: '1-4h', min: 60, max: 240, count: 0 },
      { label: '4-24h', min: 240, max: 1440, count: 0 },
      { label: '24h+', min: 1440, max: Infinity, count: 0 },
    ];

    for (const ticket of openTickets) {
      const effective = effectiveBusinessMinutesElapsed(ticket, now);
      for (const bucket of buckets) {
        if (effective >= bucket.min && effective < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return {
      buckets: buckets.map((b) => ({ label: b.label, count: b.count })),
      total: openTickets.length,
    };
  }

  // ─── Reports API ──────────────────────────────────────

  async getVolumeReport(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [];
    if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        category: tickets.category,
        status: tickets.status,
        priority: tickets.priority,
        count: count(),
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.category, tickets.status, tickets.priority);

    return result;
  }

  async getTopIssues(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [];
    if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        category: tickets.category,
        count: count(),
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.category)
      .orderBy(desc(count()));

    return result;
  }

  /**
   * Daily ticket trend within the given window — used to render the
   * volume-over-time bar chart on the supervisor Reports page.
   *
   * Returns one row per UTC day where any of the following happened:
   *   - a ticket was created
   *   - a ticket was resolved (only counts created ≤ resolved bucket)
   *
   * Empty days inside the window are emitted with zero counts so the
   * client doesn't have to backfill gaps.
   */
  async getTicketTrend(
    dateFrom?: string,
    dateTo?: string,
    interval: 'day' | 'week' = 'day',
  ) {
    // Default window: last 30 days when no range is supplied.
    const end = dateTo ? new Date(dateTo) : new Date();
    const start = dateFrom
      ? new Date(dateFrom)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trunc = interval === 'week' ? 'week' : 'day';

    const created = await db
      .select({
        bucket: sql<string>`to_char(date_trunc(${trunc}, ${tickets.createdAt}), 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.createdAt} >= ${start}`,
          sql`${tickets.createdAt} <= ${end}`,
        ),
      )
      .groupBy(sql`date_trunc(${trunc}, ${tickets.createdAt})`)
      .orderBy(sql`date_trunc(${trunc}, ${tickets.createdAt})`);

    const resolved = await db
      .select({
        bucket: sql<string>`to_char(date_trunc(${trunc}, ${tickets.resolvedAt}), 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.resolvedAt} IS NOT NULL`,
          sql`${tickets.resolvedAt} >= ${start}`,
          sql`${tickets.resolvedAt} <= ${end}`,
        ),
      )
      .groupBy(sql`date_trunc(${trunc}, ${tickets.resolvedAt})`)
      .orderBy(sql`date_trunc(${trunc}, ${tickets.resolvedAt})`);

    // Merge into a single keyed map then backfill empty buckets so the
    // chart shows a continuous timeline.
    const createdMap = new Map(created.map((r) => [r.bucket, Number(r.count)]));
    const resolvedMap = new Map(resolved.map((r) => [r.bucket, Number(r.count)]));

    const out: { bucket: string; created: number; resolved: number }[] = [];
    const step = interval === 'week' ? 7 * 86400_000 : 86400_000;
    // Anchor to UTC midnight so the bucket labels match Postgres' truncation.
    const cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    if (interval === 'week') {
      // Postgres' date_trunc('week') anchors to Monday — match it client-side.
      const dow = (cursor.getUTCDay() + 6) % 7;
      cursor.setUTCDate(cursor.getUTCDate() - dow);
    }
    const endTs = end.getTime();
    while (cursor.getTime() <= endTs) {
      const key = cursor.toISOString().slice(0, 10);
      out.push({
        bucket: key,
        created: createdMap.get(key) ?? 0,
        resolved: resolvedMap.get(key) ?? 0,
      });
      cursor.setTime(cursor.getTime() + step);
    }
    return out;
  }

  /**
   * Recent CSAT survey comments — feeds the "Latest feedback" strip on
   * the Reports → CSAT/NPS view. Skips submissions without a comment.
   */
  async getRecentCsatComments(limit: number = 10) {
    const rows = await db
      .select({
        id: csatSurveys.id,
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        ticketId: csatSurveys.ticketId,
        ticketSubject: tickets.subject,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(
        and(
          sql`${csatSurveys.comment} IS NOT NULL`,
          sql`length(${csatSurveys.comment}) > 0`,
        ),
      )
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(Math.min(Math.max(limit, 1), 50));
    return rows;
  }

  async getSlaComplianceReport(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [
      sql`${tickets.resolvedAt} IS NOT NULL`,
    ];
    if (dateFrom) conditions.push(sql`${tickets.resolvedAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.resolvedAt} <= ${new Date(dateTo)}`);

    const resolved = await db
      .select({
        id: tickets.id,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(and(...conditions));

    const total = resolved.length;
    const frtMet = resolved.filter((t) => !t.slaBreachedFrt).length;
    const ttrMet = resolved.filter((t) => !t.slaBreachedTtr).length;
    const bothMet = resolved.filter(
      (t) => !t.slaBreachedFrt && !t.slaBreachedTtr,
    ).length;

    return {
      totalResolved: total,
      resolvedWithinSla: bothMet,
      complianceRate: total > 0 ? Math.round((bothMet / total) * 100) : 0,
      frtCompliance: total > 0 ? Math.round((frtMet / total) * 100) : 0,
      ttrCompliance: total > 0 ? Math.round((ttrMet / total) * 100) : 0,
    };
  }

  // ─── Per-User Performance ──────────────────────────────
  // Used by the support dashboard sidebar profile card to show the
  // logged-in agent or supervisor their own resolved count, CSAT average,
  // and average FRT. Cheaper than getAgentPerformance (which loops all
  // agents) and also includes CSAT, which getAgentPerformance does not.

  async getMyPerformance(userId: string) {
    // 1. All tickets where this user is the assignee
    const userTickets = await db
      .select({
        id: tickets.id,
        firstResponseAt: tickets.firstResponseAt,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(eq(tickets.assigneeId, userId));

    const totalTickets = userTickets.length;
    const resolvedCount = userTickets.filter((t) => t.resolvedAt).length;

    // Avg FRT in business minutes
    const frtSamples = userTickets
      .filter((t) => t.firstResponseAt)
      .map((t) =>
        calculateBusinessMinutesElapsed(t.createdAt, t.firstResponseAt!),
      )
      .filter((m) => Number.isFinite(m) && m >= 0);
    const avgFrtMinutes =
      frtSamples.length > 0
        ? Math.round(
            frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length,
          )
        : null;

    // 2. Per-user CSAT — join csat_surveys via ticket.assigneeId so we
    // only count ratings on tickets this user actually resolved.
    const userCsat = await db
      .select({ score: csatSurveys.score })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.assigneeId, userId),
          sql`${csatSurveys.score} IS NOT NULL`,
        ),
      );

    const csatScores = userCsat
      .map((r) => r.score)
      .filter((s): s is number => s != null);
    const csatAvgScore =
      csatScores.length > 0
        ? Math.round(
            (csatScores.reduce((a, b) => a + b, 0) / csatScores.length) *
              10,
          ) / 10
        : null;

    return {
      totalTickets,
      resolvedCount,
      avgFrtMinutes,
      csatAvgScore,
      csatResponses: csatScores.length,
      frtBreaches: userTickets.filter((t) => t.slaBreachedFrt).length,
      ttrBreaches: userTickets.filter((t) => t.slaBreachedTtr).length,
    };
  }

  async getAgentPerformance(dateFrom?: string, dateTo?: string) {
    const agents = await this.getAgents();

    const results = [];
    for (const agent of agents) {
      const conditions: any[] = [eq(tickets.assigneeId, agent.userId)];
      if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
      if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

      const agentTickets = await db
        .select({
          id: tickets.id,
          status: tickets.status,
          firstResponseAt: tickets.firstResponseAt,
          createdAt: tickets.createdAt,
          resolvedAt: tickets.resolvedAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
        })
        .from(tickets)
        .where(and(...conditions));

      const resolved = agentTickets.filter((t) => t.resolvedAt);
      const frtBreaches = agentTickets.filter((t) => t.slaBreachedFrt).length;
      const ttrBreaches = agentTickets.filter((t) => t.slaBreachedTtr).length;

      // Open tickets count (currently NEW / IN_PROGRESS / ON_HOLD)
      const openTickets = agentTickets.filter(
        (t) =>
          t.status === TICKET_STATUS.NEW ||
          t.status === TICKET_STATUS.IN_PROGRESS ||
          t.status === TICKET_STATUS.ON_HOLD,
      ).length;

      // Avg FRT (minutes)
      const frtTimes = agentTickets
        .filter((t) => t.firstResponseAt)
        .map((t) => {
          const elapsed =
            (new Date(t.firstResponseAt!).getTime() -
              new Date(t.createdAt).getTime()) /
            60000;
          return elapsed;
        });
      const avgFrt =
        frtTimes.length > 0
          ? Math.round(
              frtTimes.reduce((a, b) => a + b, 0) / frtTimes.length,
            )
          : null;

      // Avg TTR (minutes) — resolution-time across this agent's
      // resolved tickets. Powers the TTR column on the admin
      // supervisor detail page and the team-aggregate avgTtrMinutes
      // surface. Skipped when the agent has no resolved tickets yet.
      const ttrTimes = resolved
        .filter((t) => t.resolvedAt)
        .map((t) => {
          return (
            (new Date(t.resolvedAt!).getTime() -
              new Date(t.createdAt).getTime()) /
            60000
          );
        });
      const avgTtr =
        ttrTimes.length > 0
          ? Math.round(
              ttrTimes.reduce((a, b) => a + b, 0) / ttrTimes.length,
            )
          : null;

      // Per-agent CSAT avg — only count ratings on tickets this agent
      // was assigned to
      const agentCsat = await db
        .select({ score: csatSurveys.score })
        .from(csatSurveys)
        .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.assigneeId, agent.userId),
            sql`${csatSurveys.score} IS NOT NULL`,
          ),
        );
      const csatScores = agentCsat
        .map((r) => r.score)
        .filter((s): s is number => s != null);
      const csatAvgScore =
        csatScores.length > 0
          ? Math.round(
              (csatScores.reduce((a, b) => a + b, 0) / csatScores.length) *
                10,
            ) / 10
          : null;

      results.push({
        userId: agent.userId,
        name: [agent.firstName, agent.lastName].filter(Boolean).join(' '),
        totalTickets: agentTickets.length,
        openTickets,
        resolvedTickets: resolved.length,
        avgFrtMinutes: avgFrt,
        avgTtrMinutes: avgTtr,
        csatAvgScore,
        csatResponses: csatScores.length,
        frtBreaches,
        ttrBreaches,
      });
    }

    return results;
  }

  // ─── Per-ticket history export (CSV) ──────────────────
  //
  // Returns a single-ticket transcript safe to share offline (legal,
  // audit, learner support reviews). Reuses the same access-check path
  // as getTicketDetail so a student can export their own history but
  // not someone else's, and an unassigned agent can't pull a ticket
  // they couldn't otherwise read.
  async exportTicketHistory(user: AuthenticatedUser, ticketId: string) {
    const detail = await this.getTicketDetail(user, ticketId);

    const now = new Date();
    const csvEscape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      // Wrap in quotes when the value contains a comma, quote, or
      // newline — and double-quote any embedded quotes per RFC 4180.
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const customerName = [
      (detail as any).studentFirstName,
      (detail as any).studentLastName,
    ]
      .filter(Boolean)
      .join(' ');

    // Metadata + ticket header — comment lines (#) so spreadsheet
    // tools can still parse the comma-separated body further down.
    const lines: string[] = [
      `# exported_at: ${now.toISOString()}`,
      `# exported_by: ${user.id}`,
      `# ticket_reference: ${detail.referenceNumber || ''}`,
      `# ticket_id: ${detail.id}`,
      '',
      // Ticket-level fields
      'field,value',
      `reference,${csvEscape(detail.referenceNumber || '')}`,
      `subject,${csvEscape(detail.subject)}`,
      `customer_name,${csvEscape(customerName)}`,
      `customer_email,${csvEscape((detail as any).studentEmail || '')}`,
      `category,${csvEscape(detail.category)}`,
      `priority,${csvEscape(detail.priority)}`,
      `status,${csvEscape(detail.status)}`,
      `created_at,${csvEscape(new Date(detail.createdAt as any).toISOString())}`,
      `first_response_at,${csvEscape(detail.firstResponseAt ? new Date(detail.firstResponseAt as any).toISOString() : '')}`,
      `resolved_at,${csvEscape(detail.resolvedAt ? new Date(detail.resolvedAt as any).toISOString() : '')}`,
      `closed_at,${csvEscape(detail.closedAt ? new Date(detail.closedAt as any).toISOString() : '')}`,
      `tags,${csvEscape(((detail as any).tags || []).map((t: any) => t.name).join('; '))}`,
      '',
      // Reply transcript
      'reply_index,timestamp,author,role,is_internal,message',
    ];

    const comments = (detail.comments || []) as any[];
    comments.forEach((c, idx) => {
      const authorName = [c.userFirstName, c.userLastName]
        .filter(Boolean)
        .join(' ');
      lines.push(
        [
          idx + 1,
          csvEscape(new Date(c.createdAt).toISOString()),
          csvEscape(authorName),
          c.isStaffReply ? 'staff' : 'customer',
          c.isInternal ? 'yes' : 'no',
          csvEscape(c.message),
        ].join(','),
      );
    });

    const baseName = (detail.referenceNumber || detail.id).replace(/[^a-zA-Z0-9-]/g, '_');
    return {
      csv: lines.join('\n'),
      filename: `ticket_${baseName}_${now.toISOString().split('T')[0]}.csv`,
    };
  }

  // ─── Per-ticket compliance archive (ZIP) ───────────────
  //
  // Bundles the full ticket record into a single ZIP suitable for
  // legal/audit handover:
  //   • conversation.csv  — ticket fields + reply transcript +
  //                         attachment manifest rows
  //   • audit_trail.csv   — every audit_logs entry for this ticket
  //                         (status changes, assignments, tag edits,
  //                         merges, etc.) with actor + timestamp
  //   • sla_events.csv    — FRT/TTR breaches, escalations, warnings
  //   • attachments/      — actual file bytes pulled from storage
  //   • manifest.json     — export metadata + SHA-256 of every
  //                         attached file (tamper evidence)
  //
  // Reuses the same access check as exportTicketHistory by calling
  // getTicketDetail() first — a student can pull their own archive,
  // an unassigned agent cannot read someone else's.
  async exportTicketArchive(user: AuthenticatedUser, ticketId: string) {
    const archiver = (await import('archiver')).default;
    const { createHash } = await import('crypto');

    const detail = await this.getTicketDetail(user, ticketId);
    const now = new Date();
    const baseName = (detail.referenceNumber || detail.id).replace(
      /[^a-zA-Z0-9-]/g,
      '_',
    );

    const [auditRows, slaRows, attachmentRows] = await Promise.all([
      this.getTicketAuditLog(ticketId, 500),
      db
        .select({
          eventType: slaEvents.eventType,
          triggeredAt: slaEvents.triggeredAt,
          notifiedUserIds: slaEvents.notifiedUserIds,
          resolvedWithinSla: slaEvents.resolvedWithinSla,
        })
        .from(slaEvents)
        .where(eq(slaEvents.ticketId, ticketId))
        .orderBy(asc(slaEvents.triggeredAt)),
      db
        .select({
          id: ticketAttachments.id,
          replyId: ticketAttachments.replyId,
          url: ticketAttachments.url,
          filename: ticketAttachments.filename,
          sizeBytes: ticketAttachments.sizeBytes,
          mimeType: ticketAttachments.mimeType,
          uploadedAt: ticketAttachments.uploadedAt,
        })
        .from(ticketAttachments)
        // Export archive includes only active attachments — removed
        // files aren't part of the canonical record handed to legal /
        // compliance teams. The audit-trail timeline is the place to
        // see deletions.
        .where(
          and(
            eq(ticketAttachments.ticketId, ticketId),
            isNull(ticketAttachments.removedAt),
          ),
        )
        .orderBy(asc(ticketAttachments.uploadedAt)),
    ]);

    // ─── Generate the three CSVs ───────────────────────────
    const conversationCsv = this.buildConversationCsv(
      detail,
      user,
      attachmentRows,
      now,
    );
    const auditCsv = this.buildAuditTrailCsv(auditRows);
    const slaCsv = this.buildSlaEventsCsv(slaRows);

    // ─── Download attachments + build manifest ─────────────
    //
    // We collect every file, even ones that fail to download, so
    // the manifest tells the auditor exactly which artifacts were
    // unavailable (rather than silently dropping them).
    type AttachmentRecord = {
      filename: string;
      replyId: string | null;
      sizeBytes: number;
      mimeType: string | null;
      uploadedAt: string;
      sha256: string | null;
      downloadStatus: 'ok' | 'failed';
      failureReason?: string;
    };

    const attachmentRecords: AttachmentRecord[] = [];
    const fileEntries: { name: string; buffer: Buffer }[] = [];
    const usedNames = new Set<string>();

    for (const att of attachmentRows) {
      const safeName = this.uniqueZipFilename(
        att.filename || `attachment-${att.id}`,
        usedNames,
      );
      try {
        const buf = await this.storageService.downloadBuffer(att.url);
        const sha = createHash('sha256').update(buf).digest('hex');
        attachmentRecords.push({
          filename: safeName,
          replyId: att.replyId,
          sizeBytes: buf.length,
          mimeType: att.mimeType,
          uploadedAt: new Date(att.uploadedAt).toISOString(),
          sha256: sha,
          downloadStatus: 'ok',
        });
        fileEntries.push({ name: `attachments/${safeName}`, buffer: buf });
      } catch (err) {
        attachmentRecords.push({
          filename: safeName,
          replyId: att.replyId,
          sizeBytes: Number(att.sizeBytes ?? 0),
          mimeType: att.mimeType,
          uploadedAt: new Date(att.uploadedAt).toISOString(),
          sha256: null,
          downloadStatus: 'failed',
          failureReason: (err as Error).message,
        });
      }
    }

    const manifest = {
      exportedAt: now.toISOString(),
      exportedBy: user.id,
      ticket: {
        id: detail.id,
        referenceNumber: detail.referenceNumber || null,
        subject: detail.subject,
      },
      counts: {
        comments: (detail.comments || []).length,
        auditEntries: auditRows.length,
        slaEvents: slaRows.length,
        attachments: attachmentRecords.length,
        attachmentsFailed: attachmentRecords.filter(
          (a) => a.downloadStatus === 'failed',
        ).length,
      },
      attachments: attachmentRecords,
    };

    // ─── Stream everything into a ZIP buffer ───────────────
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: Error) => reject(err));
    });

    archive.append(conversationCsv, { name: 'conversation.csv' });
    archive.append(auditCsv, { name: 'audit_trail.csv' });
    archive.append(slaCsv, { name: 'sla_events.csv' });
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    for (const entry of fileEntries) {
      archive.append(entry.buffer, { name: entry.name });
    }
    await archive.finalize();
    const zipBuffer = await finished;

    return {
      buffer: zipBuffer,
      filename: `ticket_${baseName}_${now.toISOString().split('T')[0]}.zip`,
    };
  }

  // ─── Archive helpers ──────────────────────────────────

  private buildConversationCsv(
    detail: any,
    user: AuthenticatedUser,
    attachments: {
      id: string;
      replyId: string | null;
      filename: string | null;
      sizeBytes: number | null;
      mimeType: string | null;
      uploadedAt: Date;
    }[],
    now: Date,
  ): string {
    const csvEscape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const customerName = [detail.studentFirstName, detail.studentLastName]
      .filter(Boolean)
      .join(' ');

    const lines: string[] = [
      `# exported_at: ${now.toISOString()}`,
      `# exported_by: ${user.id}`,
      `# ticket_reference: ${detail.referenceNumber || ''}`,
      `# ticket_id: ${detail.id}`,
      '',
      'field,value',
      `reference,${csvEscape(detail.referenceNumber || '')}`,
      `subject,${csvEscape(detail.subject)}`,
      `customer_name,${csvEscape(customerName)}`,
      `customer_email,${csvEscape(detail.studentEmail || '')}`,
      `category,${csvEscape(detail.category)}`,
      `priority,${csvEscape(detail.priority)}`,
      `status,${csvEscape(detail.status)}`,
      `created_at,${csvEscape(new Date(detail.createdAt).toISOString())}`,
      `first_response_at,${csvEscape(detail.firstResponseAt ? new Date(detail.firstResponseAt).toISOString() : '')}`,
      `resolved_at,${csvEscape(detail.resolvedAt ? new Date(detail.resolvedAt).toISOString() : '')}`,
      `closed_at,${csvEscape(detail.closedAt ? new Date(detail.closedAt).toISOString() : '')}`,
      `tags,${csvEscape(((detail.tags || []) as any[]).map((t) => t.name).join('; '))}`,
      '',
      'reply_index,timestamp,author,role,is_internal,message',
    ];

    const comments = (detail.comments || []) as any[];
    comments.forEach((c, idx) => {
      const authorName = [c.userFirstName, c.userLastName]
        .filter(Boolean)
        .join(' ');
      lines.push(
        [
          idx + 1,
          csvEscape(new Date(c.createdAt).toISOString()),
          csvEscape(authorName),
          c.isStaffReply ? 'staff' : 'customer',
          c.isInternal ? 'yes' : 'no',
          csvEscape(c.message),
        ].join(','),
      );
    });

    // Attachment manifest section — points back to attachments/
    // folder in the ZIP and matches by filename + replyId.
    lines.push('', 'attachment_filename,reply_index,size_bytes,mime_type,uploaded_at');
    attachments.forEach((att) => {
      const replyIdx = att.replyId
        ? comments.findIndex((c) => c.id === att.replyId)
        : -1;
      lines.push(
        [
          csvEscape(att.filename || `attachment-${att.id}`),
          replyIdx >= 0 ? replyIdx + 1 : 'ticket',
          att.sizeBytes ?? '',
          csvEscape(att.mimeType || ''),
          csvEscape(new Date(att.uploadedAt).toISOString()),
        ].join(','),
      );
    });

    return lines.join('\n');
  }

  private buildAuditTrailCsv(
    auditRows: Awaited<ReturnType<SupportService['getTicketAuditLog']>>,
  ): string {
    const csvEscape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines: string[] = [
      'timestamp,action,performed_by_id,performed_by_name,performed_by_email,metadata_json',
    ];

    // Reverse to chronological order — getTicketAuditLog returns
    // newest-first for the UI, but a compliance trail reads better
    // oldest-first.
    [...auditRows]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .forEach((row) => {
        const performerName = [row.performerFirstName, row.performerLastName]
          .filter(Boolean)
          .join(' ');
        lines.push(
          [
            csvEscape(new Date(row.createdAt).toISOString()),
            csvEscape(row.action),
            csvEscape(row.performedBy || ''),
            csvEscape(performerName),
            csvEscape(row.performerEmail || ''),
            csvEscape(JSON.stringify(row.metadata || {})),
          ].join(','),
        );
      });

    return lines.join('\n');
  }

  private buildSlaEventsCsv(
    slaRows: {
      eventType: string;
      triggeredAt: Date;
      notifiedUserIds: unknown;
      resolvedWithinSla: boolean | null;
    }[],
  ): string {
    const csvEscape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines: string[] = [
      'triggered_at,event_type,notified_user_count,resolved_within_sla',
    ];

    slaRows.forEach((row) => {
      const notified = Array.isArray(row.notifiedUserIds)
        ? row.notifiedUserIds.length
        : 0;
      const resolvedWithin =
        row.resolvedWithinSla === null || row.resolvedWithinSla === undefined
          ? ''
          : row.resolvedWithinSla
            ? 'yes'
            : 'no';
      lines.push(
        [
          csvEscape(new Date(row.triggeredAt).toISOString()),
          csvEscape(row.eventType),
          notified,
          csvEscape(resolvedWithin),
        ].join(','),
      );
    });

    return lines.join('\n');
  }

  // Avoid two attachments overwriting each other in the zip when
  // they share a filename. Adds `(1)`, `(2)`, etc. before the
  // extension. Tracked via the `seen` set passed by the caller.
  private uniqueZipFilename(original: string, seen: Set<string>): string {
    const sanitised = original.replace(/[\\/:*?"<>|]/g, '_');
    if (!seen.has(sanitised)) {
      seen.add(sanitised);
      return sanitised;
    }
    const dot = sanitised.lastIndexOf('.');
    const stem = dot > 0 ? sanitised.slice(0, dot) : sanitised;
    const ext = dot > 0 ? sanitised.slice(dot) : '';
    let n = 1;
    while (seen.has(`${stem}(${n})${ext}`)) {
      n += 1;
    }
    const candidate = `${stem}(${n})${ext}`;
    seen.add(candidate);
    return candidate;
  }

  async exportReport(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    // Each column is [displayLabel, rowKey] — display label is the human
    // text shown in the CSV header; rowKey is the actual property on the
    // result row. The previous "derive key from label by lowercasing"
    // hack turned "Avg FRT (min)" → "avg_frt_min" but the real key is
    // `avgFrtMinutes`, so those cells silently came out empty.
    const columns = this.getReportColumns(type, 'csv');
    const data = await this.fetchReportData(type, dateFrom, dateTo);

    // Generate CSV with NELC audit evidence metadata
    // The first 3 rows contain: report_generated_at, filters_applied,
    // generated_by context so NELC auditors can trace provenance.
    const now = new Date();
    const filtersApplied = [
      dateFrom ? `dateFrom=${dateFrom}` : null,
      dateTo ? `dateTo=${dateTo}` : null,
      `type=${type}`,
    ]
      .filter(Boolean)
      .join('; ');

    const metaRows = [
      `# report_generated_at: ${now.toISOString()}`,
      `# filters_applied: ${filtersApplied}`,
      `# report_type: ${type}`,
    ];

    const headerRow = columns.map(([label]) => label).join(',');
    const csvRows = [...metaRows, '', headerRow];
    for (const row of data) {
      const values = columns.map(([, key]) =>
        JSON.stringify(row[key] ?? ''),
      );
      csvRows.push(values.join(','));
    }

    return {
      csv: csvRows.join('\n'),
      filename: `support_report_${type}_${now.toISOString().split('T')[0]}.csv`,
    };
  }

  // Single source of truth for the columns of each support report.
  // Reused by CSV and PDF exporters so they stay in sync. Adding a
  // column means editing exactly one place.
  private getReportColumns(
    type: string,
    _format: 'csv' | 'pdf',
  ): Array<[string, string]> {
    switch (type) {
      case 'volume':
        return [
          ['Category', 'category'],
          ['Status', 'status'],
          ['Priority', 'priority'],
          ['Count', 'count'],
        ];
      case 'issues':
        return [
          ['Category', 'category'],
          ['Count', 'count'],
        ];
      case 'sla':
        return [
          ['Total Resolved', 'totalResolved'],
          ['Within SLA', 'resolvedWithinSla'],
          ['Compliance %', 'complianceRate'],
          ['FRT Compliance %', 'frtCompliance'],
          ['TTR Compliance %', 'ttrCompliance'],
        ];
      case 'agents':
      case 'agent-performance':
        return [
          ['Agent', 'name'],
          ['Total Tickets', 'totalTickets'],
          ['Open', 'openTickets'],
          ['Resolved', 'resolvedTickets'],
          ['Avg FRT (min)', 'avgFrtMinutes'],
          ['CSAT', 'csatAvgScore'],
          ['FRT Breaches', 'frtBreaches'],
          ['TTR Breaches', 'ttrBreaches'],
        ];
      case 'frt':
        return [
          ['Reference', 'referenceNumber'],
          ['Subject', 'subject'],
          ['Priority', 'priority'],
          ['Category', 'category'],
          ['Assignee', 'assignee'],
          ['Created', 'createdAt'],
          ['First Response', 'firstResponseAt'],
          ['FRT Minutes', 'frtMinutes'],
          ['Target (min)', 'targetMinutes'],
          ['Within SLA', 'withinSla'],
        ];
      case 'ttr':
        return [
          ['Reference', 'referenceNumber'],
          ['Subject', 'subject'],
          ['Priority', 'priority'],
          ['Category', 'category'],
          ['Assignee', 'assignee'],
          ['Created', 'createdAt'],
          ['Resolved', 'resolvedAt'],
          ['TTR Minutes', 'ttrMinutes'],
          ['Target (min)', 'targetMinutes'],
          ['Within SLA', 'withinSla'],
        ];
      case 'escalation':
        return [
          ['Reference', 'referenceNumber'],
          ['Subject', 'subject'],
          ['Event', 'eventType'],
          ['Triggered At', 'triggeredAt'],
          ['Assignee', 'assignee'],
          ['Notified', 'notifiedCount'],
        ];
      case 'overdue':
        return [
          ['Reference', 'referenceNumber'],
          ['Subject', 'subject'],
          ['Priority', 'priority'],
          ['Category', 'category'],
          ['Status', 'status'],
          ['Assignee', 'assignee'],
          ['Age (min)', 'ageMinutes'],
          ['Breach', 'breachKind'],
        ];
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async fetchReportData(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    switch (type) {
      case 'volume':
        return this.getVolumeReport(dateFrom, dateTo);
      case 'issues':
        return this.getTopIssues(dateFrom, dateTo);
      case 'sla': {
        const sla = await this.getSlaComplianceReport(dateFrom, dateTo);
        return [sla];
      }
      case 'agents':
      case 'agent-performance':
        return this.getAgentPerformance(dateFrom, dateTo);
      case 'frt':
        return this.getFrtReport(dateFrom, dateTo);
      case 'ttr':
        return this.getResolutionTimeReport(dateFrom, dateTo);
      case 'escalation':
        return this.getEscalationReport(dateFrom, dateTo);
      case 'overdue':
        return this.getOverdueReport();
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  // ─── Standalone reports ─────────────────────────────────
  //
  // Each of these is the row-per-event/row-per-ticket version Amna
  // asked for. The existing `getKPIs` covers the *summary* numbers
  // (avgFrtMinutes, slaCompliance, etc.); these surface the underlying
  // tickets one row at a time so supervisors can drill in.

  // First Response Time per ticket: one row per ticket that received a
  // first staff reply (firstResponseAt set). Filtered to the requested
  // window by firstResponseAt so the report is "what was responded to
  // in this period", not "what was created in it".
  async getFrtReport(dateFrom?: string, dateTo?: string) {
    const assigneeUsers = alias(users, 'assignee_users');
    const conditions: any[] = [sql`${tickets.firstResponseAt} IS NOT NULL`];
    if (dateFrom)
      conditions.push(
        sql`${tickets.firstResponseAt} >= ${new Date(dateFrom)}`,
      );
    if (dateTo)
      conditions.push(sql`${tickets.firstResponseAt} <= ${new Date(dateTo)}`);

    const rows = await db
      .select({
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        category: tickets.category,
        createdAt: tickets.createdAt,
        firstResponseAt: tickets.firstResponseAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
      })
      .from(tickets)
      .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
      .where(and(...conditions))
      .orderBy(desc(tickets.firstResponseAt));

    const policies = await db.select().from(slaPolicies);
    const policyMap = new Map(policies.map((p) => [p.priority, p]));

    return rows.map((r) => {
      const frtMinutes = r.firstResponseAt
        ? calculateBusinessMinutesElapsed(r.createdAt, r.firstResponseAt)
        : null;
      const target = policyMap.get(r.priority)?.frtMinutes ?? null;
      return {
        referenceNumber: r.referenceNumber,
        subject: r.subject,
        priority: r.priority,
        category: r.category,
        assignee: [r.assigneeFirstName, r.assigneeLastName]
          .filter(Boolean)
          .join(' ') || '—',
        createdAt: new Date(r.createdAt).toISOString(),
        firstResponseAt: r.firstResponseAt
          ? new Date(r.firstResponseAt).toISOString()
          : '',
        frtMinutes,
        targetMinutes: target,
        withinSla: r.slaBreachedFrt ? 'No' : 'Yes',
      };
    });
  }

  // Resolution Time per ticket. Same shape as FRT but window-filters
  // on resolvedAt and counts business-minutes from created → resolved
  // minus accumulated on-hold time (matches the SLA counter).
  async getResolutionTimeReport(dateFrom?: string, dateTo?: string) {
    const assigneeUsers = alias(users, 'assignee_users');
    const conditions: any[] = [sql`${tickets.resolvedAt} IS NOT NULL`];
    if (dateFrom)
      conditions.push(sql`${tickets.resolvedAt} >= ${new Date(dateFrom)}`);
    if (dateTo)
      conditions.push(sql`${tickets.resolvedAt} <= ${new Date(dateTo)}`);

    const rows = await db
      .select({
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        category: tickets.category,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        slaBreachedTtr: tickets.slaBreachedTtr,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
      })
      .from(tickets)
      .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
      .where(and(...conditions))
      .orderBy(desc(tickets.resolvedAt));

    const policies = await db.select().from(slaPolicies);
    const policyMap = new Map(policies.map((p) => [p.priority, p]));

    return rows.map((r) => {
      const elapsed = r.resolvedAt
        ? calculateBusinessMinutesElapsed(r.createdAt, r.resolvedAt)
        : 0;
      const ttrMinutes = Math.max(
        0,
        elapsed - (r.onHoldTotalMinutes || 0),
      );
      const target = policyMap.get(r.priority)?.ttrMinutes ?? null;
      return {
        referenceNumber: r.referenceNumber,
        subject: r.subject,
        priority: r.priority,
        category: r.category,
        assignee: [r.assigneeFirstName, r.assigneeLastName]
          .filter(Boolean)
          .join(' ') || '—',
        createdAt: new Date(r.createdAt).toISOString(),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : '',
        ttrMinutes,
        targetMinutes: target,
        withinSla: r.slaBreachedTtr ? 'No' : 'Yes',
      };
    });
  }

  // Escalation report: one row per sla_events entry of an escalation
  // shape (breach, escalation triggered, priority bumped, reassigned).
  // Joins the ticket so we get the reference + subject in the row.
  async getEscalationReport(dateFrom?: string, dateTo?: string) {
    const assigneeUsers = alias(users, 'assignee_users');
    const conditions: any[] = [
      inArray(slaEvents.eventType, [
        SLA_EVENT_TYPES.FRT_BREACH,
        SLA_EVENT_TYPES.TTR_BREACH,
        SLA_EVENT_TYPES.ESCALATION_TRIGGERED,
        SLA_EVENT_TYPES.PRIORITY_ESCALATED,
        SLA_EVENT_TYPES.TTR_BREACH_REASSIGNED,
      ]),
    ];
    if (dateFrom)
      conditions.push(sql`${slaEvents.triggeredAt} >= ${new Date(dateFrom)}`);
    if (dateTo)
      conditions.push(sql`${slaEvents.triggeredAt} <= ${new Date(dateTo)}`);

    const rows = await db
      .select({
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        eventType: slaEvents.eventType,
        triggeredAt: slaEvents.triggeredAt,
        notifiedUserIds: slaEvents.notifiedUserIds,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
      })
      .from(slaEvents)
      .innerJoin(tickets, eq(slaEvents.ticketId, tickets.id))
      .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
      .where(and(...conditions))
      .orderBy(desc(slaEvents.triggeredAt));

    return rows.map((r) => ({
      referenceNumber: r.referenceNumber,
      subject: r.subject,
      eventType: r.eventType,
      triggeredAt: new Date(r.triggeredAt).toISOString(),
      assignee: [r.assigneeFirstName, r.assigneeLastName]
        .filter(Boolean)
        .join(' ') || '—',
      notifiedCount: Array.isArray(r.notifiedUserIds)
        ? (r.notifiedUserIds as unknown[]).length
        : 0,
    }));
  }

  // Overdue report: open tickets that are past their FRT or TTR
  // target. Computed live (not stored) so it reflects the current
  // policy without a backfill.
  async getOverdueReport() {
    const assigneeUsers = alias(users, 'assignee_users');
    const rows = await db
      .select({
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        category: tickets.category,
        status: tickets.status,
        createdAt: tickets.createdAt,
        firstResponseAt: tickets.firstResponseAt,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
      })
      .from(tickets)
      .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
      .where(
        inArray(tickets.status, [
          TICKET_STATUS.NEW,
          TICKET_STATUS.IN_PROGRESS,
          TICKET_STATUS.ON_HOLD,
        ]),
      );

    const policies = await db.select().from(slaPolicies);
    const policyMap = new Map(policies.map((p) => [p.priority, p]));

    const now = new Date();
    const overdue: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const policy = policyMap.get(r.priority);
      if (!policy) continue;

      const effective = effectiveBusinessMinutesElapsed(r, now);

      const frtOverdue =
        !r.firstResponseAt && effective > policy.frtMinutes;
      const ttrOverdue = effective > policy.ttrMinutes;

      if (!frtOverdue && !ttrOverdue) continue;

      overdue.push({
        referenceNumber: r.referenceNumber,
        subject: r.subject,
        priority: r.priority,
        category: r.category,
        status: r.status,
        assignee: [r.assigneeFirstName, r.assigneeLastName]
          .filter(Boolean)
          .join(' ') || '—',
        ageMinutes: Math.round(effective),
        breachKind: ttrOverdue
          ? frtOverdue
            ? 'FRT + TTR'
            : 'TTR'
          : 'FRT',
      });
    }

    overdue.sort(
      (a, b) => (b.ageMinutes as number) - (a.ageMinutes as number),
    );
    return overdue;
  }

  async exportReportPdf(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Buffer> {
    const columns = this.getReportColumns(type, 'pdf');
    const data = await this.fetchReportData(type, dateFrom, dateTo);
    const headers = columns.map(([label]) => label);
    const title = (() => {
      switch (type) {
        case 'volume':
          return 'Ticket Volume Report';
        case 'issues':
          return 'Top Issues Report';
        case 'sla':
          return 'SLA Compliance Report';
        case 'agents':
        case 'agent-performance':
          return 'Agent Performance Report';
        case 'frt':
          return 'First Response Time Report';
        case 'ttr':
          return 'Resolution Time Report';
        case 'escalation':
          return 'Escalation Report';
        case 'overdue':
          return 'Overdue Tickets Report';
        default:
          throw new BadRequestException('Invalid report type');
      }
    })();

    const now = new Date();
    const filtersApplied = [
      dateFrom ? `From: ${dateFrom}` : null,
      dateTo ? `To: ${dateTo}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: title,
            Author: 'PhysioGuidance Support System',
            Subject: `${title} — Generated ${now.toISOString()}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ─── Header ───────────────────────────────
        doc
          .fontSize(8)
          .fillColor('#6B7280')
          .text(
            'PhysioGuidance eLearning Platform  |  Support Dashboard  |  Gamma Developers',
            40,
            25,
          );

        doc
          .moveTo(40, 40)
          .lineTo(555, 40)
          .strokeColor('#E5E7EB')
          .stroke();

        // Title
        doc.fontSize(18).fillColor('#111827').text(title, 40, 55);

        // Meta
        doc
          .fontSize(9)
          .fillColor('#6B7280')
          .text(`Generated: ${now.toLocaleString()}`, 40, 80)
          .text(
            filtersApplied ? `Filters: ${filtersApplied}` : 'Filters: All time',
            40,
            93,
          )
          .text(`Report type: ${type}`, 40, 106);

        doc
          .moveTo(40, 122)
          .lineTo(555, 122)
          .strokeColor('#E5E7EB')
          .stroke();

        // ─── Table ────────────────────────────────
        const tableTop = 135;
        const colWidth = Math.floor(515 / headers.length);
        const rowHeight = 22;

        // Table header
        doc.rect(40, tableTop, 515, rowHeight).fill('#111827');
        headers.forEach((h, i) => {
          doc
            .fontSize(8)
            .fillColor('#FFFFFF')
            .text(h, 44 + i * colWidth, tableTop + 6, {
              width: colWidth - 8,
              align: 'left',
            });
        });

        // Table rows
        data.forEach((row, rowIdx) => {
          const y = tableTop + rowHeight + rowIdx * rowHeight;

          if (y > 760) return; // page overflow guard (simple single-page)

          if (rowIdx % 2 === 0) {
            doc.rect(40, y, 515, rowHeight).fill('#F9FAFB');
          }

          columns.forEach(([, key], colIdx) => {
            const value = String(row[key] ?? '');
            doc
              .fontSize(8)
              .fillColor('#374151')
              .text(value, 44 + colIdx * colWidth, y + 6, {
                width: colWidth - 8,
                align: 'left',
              });
          });
        });

        // ─── Footer ───────────────────────────────
        const footerY = 780;
        doc
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .fontSize(7)
          .fillColor('#9CA3AF')
          .text(
            `Confidential — Gamma Developers © ${now.getFullYear()}  |  report_generated_at: ${now.toISOString()}`,
            40,
            footerY + 5,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Admin Support KPIs ────────────────────────────────
  // Kept as a thin alias over getKPIs() since getKPIs now includes
  // CSAT + NPS + SLA compliance fields. Preserved for any existing
  // admin widget that hits /api/tickets/admin/support-kpis.

  async getAdminSupportKpis() {
    const kpis = await this.getKPIs();
    return {
      avgFrtMinutes: kpis.avgFrtMinutes,
      avgTtrMinutes: kpis.avgTtrMinutes,
      openTickets: kpis.openTickets,
      slaBreaches: kpis.slaBreaches,
      csatAvgScore: kpis.csatAvgScore,
      npsScore: kpis.npsScore,
      csatResponseRate: kpis.csatResponseRate,
      statusBreakdown: kpis.statusBreakdown,
    };
  }

  /**
   * Admin Support Overview — single payload for the new admin
   * dashboard tab. Folds the 7 client-requested metrics together with
   * an at-risk list, an activity feed, 7-day trend deltas, cron
   * health, and the pending team-request count.
   *
   * Accepts an optional date range (`dateFrom`/`dateTo`) for the
   * window-scoped health metrics (avg FRT/TTR, SLA %, escalations,
   * created trend). "Current open" numbers stay as a live snapshot
   * regardless of the range. Defaults to the last 7 days when
   * neither bound is provided.
   *
   * Queries run in parallel via Promise.all where dependencies allow.
   * Heavy aggregates (by-category, agent workload) are capped/sliced
   * so a busy queue still returns in <300ms.
   */
  async getSupportOverview(dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
    const fourteenDaysAgo = new Date(now.getTime() - 2 * SEVEN_DAYS_MS);

    // Parse the window for health metrics. Invalid input falls back
    // to the default 7-day window — never throws, since this endpoint
    // is read-only and called by polling code.
    const parsedFrom = dateFrom ? new Date(dateFrom) : null;
    const parsedTo = dateTo ? new Date(dateTo) : null;
    const windowFrom =
      parsedFrom && !Number.isNaN(parsedFrom.getTime())
        ? parsedFrom
        : sevenDaysAgo;
    const windowTo =
      parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : now;

    const openStatuses = [
      TICKET_STATUS.NEW,
      TICKET_STATUS.IN_PROGRESS,
      TICKET_STATUS.ON_HOLD,
    ];

    // Group the cheap counts into a single Promise.all so we eat one
    // RTT for all of them.
    const [
      openCountRow,
      awaitingResponseRow,
      overdueCountRow,
      priorityRows,
      categoryRows,
      agentWorkloadRows,
      csatSummary,
      pendingTeamRequestsCount,
      createdLast7Row,
      createdPrev7Row,
      escalationCountRow,
      windowTicketsRows,
      supportAgentRows,
    ] = await Promise.all([
      // Open tickets
      db
        .select({ count: count() })
        .from(tickets)
        .where(inArray(tickets.status, openStatuses)),

      // Awaiting response = open AND no first response yet. The
      // "customer replied last" case isn't easily counted in SQL
      // without a window function; for an overview number this
      // approximation tracks the operationally interesting bucket
      // (work the team owes a first reply to).
      db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            inArray(tickets.status, openStatuses),
            sql`${tickets.firstResponseAt} IS NULL`,
          ),
        ),

      // Overdue = SLA-breached AND still open
      db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            inArray(tickets.status, openStatuses),
            or(
              eq(tickets.slaBreachedFrt, true),
              eq(tickets.slaBreachedTtr, true),
            ),
          ),
        ),

      // By priority (only open tickets)
      db
        .select({ priority: tickets.priority, count: count() })
        .from(tickets)
        .where(inArray(tickets.status, openStatuses))
        .groupBy(tickets.priority),

      // By category (only open tickets) — top by count
      db
        .select({ category: tickets.category, count: count() })
        .from(tickets)
        .where(inArray(tickets.status, openStatuses))
        .groupBy(tickets.category)
        .orderBy(desc(count()))
        .limit(10),

      // Agent workload — top 10 by active assigned count.
      // Joins users so we can return display names without a second
      // round-trip on the FE.
      db
        .select({
          agentId: tickets.assigneeId,
          firstName: users.firstName,
          lastName: users.lastName,
          activeCount: count(),
        })
        .from(tickets)
        .leftJoin(users, eq(tickets.assigneeId, users.id))
        .where(
          and(
            inArray(tickets.status, openStatuses),
            sql`${tickets.assigneeId} IS NOT NULL`,
          ),
        )
        .groupBy(tickets.assigneeId, users.firstName, users.lastName)
        .orderBy(desc(count()))
        .limit(10),

      this.getCsatSummary(),
      this.countPendingTeamRequests(),

      // Trend deltas: tickets created in the last 7 days vs. the 7
      // days before that. Powers the small "↗ +4" indicators on the
      // overview cards.
      db
        .select({ count: count() })
        .from(tickets)
        .where(gte(tickets.createdAt, sevenDaysAgo)),
      db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, fourteenDaysAgo),
            sql`${tickets.createdAt} < ${sevenDaysAgo}`,
          ),
        ),

      // Escalation count for the window: any sla_events row of an
      // escalation shape (auto-escalation fired or priority bumped).
      db
        .select({ count: count() })
        .from(slaEvents)
        .where(
          and(
            inArray(slaEvents.eventType, [
              SLA_EVENT_TYPES.ESCALATION_TRIGGERED,
              SLA_EVENT_TYPES.PRIORITY_ESCALATED,
            ]),
            gte(slaEvents.triggeredAt, windowFrom),
            lte(slaEvents.triggeredAt, windowTo),
          ),
        ),

      // Tickets created inside the window — the JS reducer below
      // turns these into avg FRT, avg TTR and SLA compliance % for
      // the same window. Capped at 1000 to keep one outlier query
      // from dragging the dashboard. SLA compliance falls back to
      // 100% when the sample is empty.
      db
        .select({
          createdAt: tickets.createdAt,
          firstResponseAt: tickets.firstResponseAt,
          resolvedAt: tickets.resolvedAt,
          onHoldTotalMinutes: tickets.onHoldTotalMinutes,
          status: tickets.status,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
        })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, windowFrom),
            lte(tickets.createdAt, windowTo),
          ),
        )
        .limit(1000),

      // Full support-agent roster so the workload card can render
      // *distribution* (over- vs under-loaded), not just the top-10.
      // Only active users with a SUPPORT role. Joined with userRoles
      // for the supervisor/agent label.
      db
        .select({
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          supportSubRole: userRoles.supportSubRole,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(roles.name, ROLE_NAMES.SUPPORT),
            eq(users.isActive, true),
          ),
        )
        .limit(200),
    ]);

    // At-risk in the next 30 business minutes. Computed in JS using
    // the business-hours util — cheaper than fighting SQL for it. We
    // page over the open set (already capped above) and compute
    // remaining minutes per ticket; top 5 are returned.
    const atRiskCandidates = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        status: tickets.status,
        firstResponseAt: tickets.firstResponseAt,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        createdAt: tickets.createdAt,
        assigneeId: tickets.assigneeId,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(inArray(tickets.status, openStatuses))
      .limit(500);

    const policies = await db.select().from(slaPolicies);
    const policyMap = new Map(policies.map((p) => [p.priority, p]));

    type AtRiskRow = {
      id: string;
      referenceNumber: string;
      subject: string;
      priority: string;
      minutesRemaining: number;
      target: 'frt' | 'ttr';
      assigneeId: string | null;
      assigneeName: string | null;
    };

    const assigneeIds = Array.from(
      new Set(
        atRiskCandidates
          .map((t) => t.assigneeId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const assigneeNames = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(inArray(users.id, assigneeIds));
      for (const r of rows) {
        assigneeNames.set(
          r.id,
          [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Agent',
        );
      }
    }

    const atRisk: AtRiskRow[] = [];
    for (const t of atRiskCandidates) {
      const policy = policyMap.get(t.priority);
      if (!policy) continue;
      // Skip already-breached — those go on the overdue counter
      if (t.slaBreachedFrt || t.slaBreachedTtr) continue;
      // Skip currently on-hold — the timer is paused so they aren't
      // "at risk in 30 minutes" by any meaningful measure.
      if (t.status === TICKET_STATUS.ON_HOLD) continue;

      const effectiveElapsed = effectiveBusinessMinutesElapsed(t, now);

      // FRT check (only if no first response yet)
      if (!t.firstResponseAt) {
        const remaining = policy.frtMinutes - effectiveElapsed;
        if (remaining > 0 && remaining <= 30) {
          atRisk.push({
            id: t.id,
            referenceNumber: t.referenceNumber,
            subject: t.subject,
            priority: t.priority,
            minutesRemaining: remaining,
            target: 'frt',
            assigneeId: t.assigneeId,
            assigneeName: t.assigneeId
              ? assigneeNames.get(t.assigneeId) || null
              : null,
          });
          continue;
        }
      }
      // TTR check (skip on-hold)
      if (t.status !== TICKET_STATUS.ON_HOLD) {
        const remaining = policy.ttrMinutes - effectiveElapsed;
        if (remaining > 0 && remaining <= 30) {
          atRisk.push({
            id: t.id,
            referenceNumber: t.referenceNumber,
            subject: t.subject,
            priority: t.priority,
            minutesRemaining: remaining,
            target: 'ttr',
            assigneeId: t.assigneeId,
            assigneeName: t.assigneeId
              ? assigneeNames.get(t.assigneeId) || null
              : null,
          });
        }
      }
    }
    atRisk.sort((a, b) => a.minutesRemaining - b.minutesRemaining);
    const atRiskTop = atRisk.slice(0, 5);

    // Recent activity feed — last 20 ticket events. Reuse the
    // existing helper but force the supervisor scope (queue-wide).
    const fakeSupervisorUser = {
      id: 'overview',
      roles: [ROLE_NAMES.SUPER_ADMIN],
      supportSubRole: SUPPORT_SUB_ROLES.SUPERVISOR,
    } as unknown as AuthenticatedUser;
    let recentActivity: Awaited<ReturnType<typeof this.getActivity>> = [];
    try {
      recentActivity = await this.getActivity(fakeSupervisorUser, 20);
    } catch {
      /* best-effort — overview shouldn't fail if activity feed errs */
    }

    // Cron health: the most-recent row per cron_name. PostgreSQL's
    // DISTINCT ON is the natural fit; the (cron_name, started_at DESC)
    // index makes it index-only.
    type CronHealthRow = {
      name: string;
      lastStartedAt: Date | null;
      lastFinishedAt: Date | null;
      status: string;
      durationMs: number | null;
      errorMessage: string | null;
    };
    let cronHealth: CronHealthRow[] = [];
    try {
      const rows = await db.execute<{
        cron_name: string;
        started_at: Date;
        finished_at: Date | null;
        status: string;
        duration_ms: number | null;
        error_message: string | null;
      }>(sql`
        SELECT DISTINCT ON (cron_name)
          cron_name, started_at, finished_at, status, duration_ms, error_message
        FROM cron_runs
        ORDER BY cron_name, started_at DESC
      `);
      const list = Array.isArray(rows) ? rows : (rows as any).rows || [];
      cronHealth = list.map((r: any) => ({
        name: r.cron_name,
        lastStartedAt: r.started_at,
        lastFinishedAt: r.finished_at,
        status: r.status,
        durationMs: r.duration_ms,
        errorMessage: r.error_message,
      }));
    } catch {
      /* best-effort — overview still renders without cron strip */
    }

    const openTickets = openCountRow[0]?.count ?? 0;
    const awaitingResponse = awaitingResponseRow[0]?.count ?? 0;
    const overdueTickets = overdueCountRow[0]?.count ?? 0;
    const createdLast7 = createdLast7Row[0]?.count ?? 0;
    const createdPrev7 = createdPrev7Row[0]?.count ?? 0;

    const byPriority: Record<string, number> = {
      [TICKET_PRIORITY.HIGH]: 0,
      [TICKET_PRIORITY.MEDIUM]: 0,
      [TICKET_PRIORITY.LOW]: 0,
    };
    for (const row of priorityRows) byPriority[row.priority] = row.count;

    const byCategory = categoryRows.map((r) => ({
      category: r.category,
      count: r.count,
    }));

    const agentWorkload = agentWorkloadRows
      .filter((r) => r.agentId)
      .map((r) => ({
        agentId: r.agentId as string,
        agentName:
          [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Agent',
        activeCount: r.activeCount,
      }));

    // Merge the active-count map with the full SUPPORT roster so the
    // distribution card can show idle agents too. Idle agents get a
    // 0 count; the supportSubRole tag lets the FE separate supervisors
    // from regular agents in the distribution.
    const workloadByAgent = new Map(
      agentWorkload.map((w) => [w.agentId, w.activeCount]),
    );
    const agentDistribution = supportAgentRows.map((r) => ({
      agentId: r.userId,
      agentName:
        [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Agent',
      supportSubRole: r.supportSubRole as
        | 'supervisor'
        | 'agent'
        | null,
      activeCount: Number(workloadByAgent.get(r.userId) ?? 0),
    }));
    agentDistribution.sort((a, b) => b.activeCount - a.activeCount);

    // Window-scoped health metrics. Same business-hours math as
    // getKPIs(), but scoped to the caller-supplied range.
    const frtSamples: number[] = [];
    const ttrSamples: number[] = [];
    let windowBreaches = 0;
    let windowResolvedOrClosed = 0;
    for (const row of windowTicketsRows) {
      if (row.firstResponseAt) {
        const m = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.firstResponseAt,
        );
        if (Number.isFinite(m) && m >= 0) frtSamples.push(m);
      }
      if (row.resolvedAt) {
        const raw = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.resolvedAt,
        );
        const effective = Math.max(
          0,
          raw - (row.onHoldTotalMinutes || 0),
        );
        if (Number.isFinite(effective)) ttrSamples.push(effective);
      }
      if (
        row.status === TICKET_STATUS.RESOLVED ||
        row.status === TICKET_STATUS.CLOSED
      ) {
        windowResolvedOrClosed += 1;
        if (row.slaBreachedFrt || row.slaBreachedTtr) windowBreaches += 1;
      }
    }
    const windowAvgFrt = frtSamples.length
      ? Math.round(
          frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length,
        )
      : null;
    const windowAvgTtr = ttrSamples.length
      ? Math.round(
          ttrSamples.reduce((a, b) => a + b, 0) / ttrSamples.length,
        )
      : null;
    const windowSlaCompliance =
      windowResolvedOrClosed > 0
        ? Math.max(
            0,
            Math.round(
              ((windowResolvedOrClosed - windowBreaches) /
                windowResolvedOrClosed) *
                100,
            ),
          )
        : 100;
    const escalationCount = Number(escalationCountRow[0]?.count ?? 0);

    return {
      // Client's 7 requested metrics
      openTickets,
      awaitingResponse,
      overdueTickets,
      byPriority,
      byCategory,
      agentWorkload,
      csat: {
        averageScore: csatSummary.avgScore,
        responseCount: csatSummary.totalResponded,
        responseRate: csatSummary.responseRate,
        distribution: csatSummary.distribution,
      },
      // Health dashboard additions — window-scoped to dateFrom/dateTo
      health: {
        avgFrtMinutes: windowAvgFrt,
        avgTtrMinutes: windowAvgTtr,
        slaCompliancePct: windowSlaCompliance,
        escalationCount,
        sampleSize: windowTicketsRows.length,
        windowFrom: windowFrom.toISOString(),
        windowTo: windowTo.toISOString(),
      },
      agentDistribution,
      // Bonus additions
      atRisk: atRiskTop,
      recentActivity,
      trends: {
        createdLast7,
        createdPrev7,
        createdDelta: createdLast7 - createdPrev7,
      },
      cronHealth,
      pendingTeamRequests: pendingTeamRequestsCount,
      // Echo the moment the snapshot was computed so the FE can show
      // "Updated 12 seconds ago" without doing wall-clock guesswork.
      generatedAt: now.toISOString(),
    };
  }

  // ─── SLA Policy CRUD ──────────────────────────────────

  async getSlaPolicies() {
    return db
      .select()
      .from(slaPolicies)
      .orderBy(asc(slaPolicies.frtMinutes));
  }

  async updateSlaPolicy(
    priority: string,
    data: {
      frtMinutes?: number;
      ttrMinutes?: number;
      escalateAfterMinutes?: number;
    },
  ) {
    const [updated] = await db
      .update(slaPolicies)
      .set(data)
      .where(eq(slaPolicies.priority, priority))
      .returning();

    if (!updated) throw new NotFoundException(`SLA policy for ${priority} not found`);
    return updated;
  }

  // ─── Create Support Agent (Supervisor Only) ────────────

  async createAgent(dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Get the SUPPORT role ID
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole) {
      throw new BadRequestException('SUPPORT role not found in system');
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        activeRole: ROLE_NAMES.SUPPORT,
        isVerified: true,
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    // Assign SUPPORT role with 'agent' sub-role
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: supportRole.id,
      supportSubRole: SUPPORT_SUB_ROLES.AGENT,
    });

    return {
      ...newUser,
      role: ROLE_NAMES.SUPPORT,
      supportSubRole: SUPPORT_SUB_ROLES.AGENT,
    };
  }

  // ─── Macros CRUD ──────────────────────────────────────

  async getMacros(opts?: {
    categoryKey?: string | null;
    includeInactive?: boolean;
  }) {
    const conditions: any[] = [];
    if (!opts?.includeInactive) {
      conditions.push(eq(supportMacros.isActive, true));
    }
    if (opts?.categoryKey) {
      // Caller wants a specific category — include both that category
      // AND general-purpose (null categoryKey) macros so the dropdown
      // surfaces both "recommended for this ticket" and universals.
      conditions.push(
        or(
          eq(supportMacros.categoryKey, opts.categoryKey),
          isNull(supportMacros.categoryKey),
        ),
      );
    }

    const rows = await db
      .select({
        id: supportMacros.id,
        title: supportMacros.title,
        bodyTemplate: supportMacros.bodyTemplate,
        bodyAr: supportMacros.bodyAr,
        categoryKey: supportMacros.categoryKey,
        variables: supportMacros.variables,
        kbArticleUrls: supportMacros.kbArticleUrls,
        isActive: supportMacros.isActive,
        createdAt: supportMacros.createdAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        useCount: sql<number>`COALESCE(COUNT(${supportMacroUses.id}), 0)`.as('use_count'),
        lastUsedAt: sql<Date | null>`MAX(${supportMacroUses.appliedAt})`.as('last_used_at'),
      })
      .from(supportMacros)
      .leftJoin(users, eq(supportMacros.createdBy, users.id))
      .leftJoin(supportMacroUses, eq(supportMacroUses.macroId, supportMacros.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        supportMacros.id,
        users.firstName,
        users.lastName,
      )
      .orderBy(desc(supportMacros.createdAt));

    return rows.map((r) => ({
      ...r,
      useCount: Number(r.useCount ?? 0),
    }));
  }

  async getMacro(id: string) {
    const [macro] = await db
      .select()
      .from(supportMacros)
      .where(eq(supportMacros.id, id));
    if (!macro) throw new NotFoundException('Macro not found');
    return macro;
  }

  async createMacro(userId: string, dto: CreateMacroDto) {
    if (dto.categoryKey) {
      await this.assertCategoryKeyExists(dto.categoryKey);
    }
    const [macro] = await db
      .insert(supportMacros)
      .values({
        title: dto.title,
        bodyTemplate: dto.bodyTemplate,
        bodyAr: dto.bodyAr ?? null,
        categoryKey: dto.categoryKey ?? null,
        variables: dto.variables || null,
        kbArticleUrls: dto.kbArticleUrls || null,
        createdBy: userId,
      })
      .returning();
    return macro;
  }

  async updateMacro(id: string, dto: UpdateMacroDto) {
    const [existing] = await db
      .select({ id: supportMacros.id })
      .from(supportMacros)
      .where(eq(supportMacros.id, id));
    if (!existing) throw new NotFoundException('Macro not found');

    if (dto.categoryKey) {
      await this.assertCategoryKeyExists(dto.categoryKey);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.bodyTemplate !== undefined) updateData.bodyTemplate = dto.bodyTemplate;
    if (dto.bodyAr !== undefined) updateData.bodyAr = dto.bodyAr;
    if (dto.categoryKey !== undefined) updateData.categoryKey = dto.categoryKey;
    if (dto.variables !== undefined) updateData.variables = dto.variables;
    if (dto.kbArticleUrls !== undefined) updateData.kbArticleUrls = dto.kbArticleUrls;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(supportMacros)
      .set(updateData)
      .where(eq(supportMacros.id, id))
      .returning();
    return updated;
  }

  async deleteMacro(id: string) {
    const [existing] = await db
      .select({ id: supportMacros.id })
      .from(supportMacros)
      .where(eq(supportMacros.id, id));
    if (!existing) throw new NotFoundException('Macro not found');

    await db
      .update(supportMacros)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(supportMacros.id, id));
    return { success: true };
  }

  // Guard the categoryKey input against arbitrary text — validate
  // against the live category list (builtins + custom) so we don't
  // silently store typos like 'logn' that would never match anything.
  private async assertCategoryKeyExists(slug: string) {
    const all = await this.listTicketCategories();
    if (!all.some((c) => c.slug === slug)) {
      throw new BadRequestException(`Unknown ticket category: ${slug}`);
    }
  }

  // ─── Macro usage analytics ────────────────────────────
  //
  // Returns per-macro use counts, per-category aggregates, and the
  // monthly trend over the last 6 months. Powers the "Usage" panel
  // in the macros management view.
  async getMacroUsageStats() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [perMacro, perCategory, monthly] = await Promise.all([
      // Each macro with its lifetime use count + last-used timestamp.
      // LEFT JOIN keeps unused macros in the result so the "untouched"
      // table can be derived in the FE.
      db
        .select({
          id: supportMacros.id,
          title: supportMacros.title,
          categoryKey: supportMacros.categoryKey,
          isActive: supportMacros.isActive,
          useCount: sql<number>`COALESCE(COUNT(${supportMacroUses.id}), 0)`.as('use_count'),
          lastUsedAt: sql<Date | null>`MAX(${supportMacroUses.appliedAt})`.as('last_used_at'),
        })
        .from(supportMacros)
        .leftJoin(supportMacroUses, eq(supportMacroUses.macroId, supportMacros.id))
        .groupBy(supportMacros.id)
        .orderBy(desc(sql`use_count`)),

      // Sum of uses bucketed by macro.categoryKey. NULL becomes 'general'
      // in the response so the FE doesn't need a special case.
      db
        .select({
          categoryKey: supportMacros.categoryKey,
          uses: sql<number>`COUNT(${supportMacroUses.id})`.as('uses'),
          macroCount: sql<number>`COUNT(DISTINCT ${supportMacros.id})`.as('macro_count'),
        })
        .from(supportMacros)
        .leftJoin(supportMacroUses, eq(supportMacroUses.macroId, supportMacros.id))
        .groupBy(supportMacros.categoryKey)
        .orderBy(desc(sql`uses`)),

      // Last 6 months of activity, bucketed by YYYY-MM (UTC). Empty
      // months are NOT returned — FE fills the gap with zeros.
      db
        .select({
          bucket: sql<string>`to_char(${supportMacroUses.appliedAt}, 'YYYY-MM')`.as('bucket'),
          uses: sql<number>`COUNT(*)`.as('uses'),
        })
        .from(supportMacroUses)
        .where(gte(supportMacroUses.appliedAt, sixMonthsAgo))
        .groupBy(sql`bucket`)
        .orderBy(sql`bucket ASC`),
    ]);

    const totalUses = perMacro.reduce((sum, m) => sum + Number(m.useCount ?? 0), 0);
    return {
      totalUses,
      totalMacros: perMacro.length,
      unusedCount: perMacro.filter((m) => Number(m.useCount ?? 0) === 0).length,
      perMacro: perMacro.map((m) => ({
        ...m,
        useCount: Number(m.useCount ?? 0),
      })),
      perCategory: perCategory.map((c) => ({
        categoryKey: c.categoryKey ?? 'general',
        uses: Number(c.uses ?? 0),
        macroCount: Number(c.macroCount ?? 0),
      })),
      monthly: monthly.map((b) => ({
        bucket: b.bucket,
        uses: Number(b.uses ?? 0),
      })),
    };
  }

  async applyMacro(
    macroId: string,
    ticketId: string,
    opts?: { userId?: string | null; locale?: string | null },
  ) {
    // Fetch macro (404 if deleted/inactive)
    const [macro] = await db
      .select()
      .from(supportMacros)
      .where(and(eq(supportMacros.id, macroId), eq(supportMacros.isActive, true)));
    if (!macro) throw new NotFoundException('Macro not found or deleted');

    // Fetch ticket with student + course + agent info. Pulls the 5
    // extra ticket fields needed for the expanded variable set so the
    // substitution pass below stays single-query.
    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        assigneeId: tickets.assigneeId,
        guestName: tickets.guestName,
        subject: tickets.subject,
        priority: tickets.priority,
        category: tickets.category,
        status: tickets.status,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Get course name if courseId exists
    let courseName = '';
    if (ticket.courseId) {
      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, ticket.courseId));
      courseName = course?.title || '';
    }

    // Get agent name if assigned
    let agentName = '';
    if (ticket.assigneeId) {
      const [agent] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, ticket.assigneeId));
      agentName = [agent?.firstName, agent?.lastName].filter(Boolean).join(' ');
    }

    // Determine learner name (guest vs registered)
    const learnerName = ticket.studentId === GUEST_USER_ID
      ? (ticket.guestName || '')
      : [ticket.studentFirstName, ticket.studentLastName].filter(Boolean).join(' ');

    // For a friendlier greeting we expose just the first token of the
    // learner name. Falls back to the full name if there's no whitespace.
    const learnerFirstName = (learnerName.split(/\s+/)[0] || learnerName).trim();

    // Three richer placeholders — only fetched when the student is
    // registered (guest tickets have no profile to look up).
    let certificateStatus = '';
    let webinarJoinUrl = '';
    let paymentAmountStr = '';

    if (ticket.studentId && ticket.studentId !== GUEST_USER_ID) {
      const [cert, webinarReg, payment] = await Promise.all([
        db
          .select({ status: certificateRequests.status })
          .from(certificateRequests)
          .where(eq(certificateRequests.studentId, ticket.studentId))
          .orderBy(desc(certificateRequests.createdAt))
          .limit(1),

        // Prefer the next upcoming webinar (still useful to the
        // student). If none upcoming, fall back to most recent so
        // recording-related macros still have a sensible link.
        db
          .select({
            joinUrl: webinarRegistrations.joinUrl,
            scheduledAt: sessions.scheduledAt,
          })
          .from(webinarRegistrations)
          .innerJoin(sessions, eq(webinarRegistrations.sessionId, sessions.id))
          .where(eq(webinarRegistrations.userId, ticket.studentId))
          .orderBy(desc(sessions.scheduledAt))
          .limit(5),

        db
          .select({
            amount: payments.amount,
            currency: payments.currency,
          })
          .from(payments)
          .where(eq(payments.userId, ticket.studentId))
          .orderBy(desc(payments.createdAt))
          .limit(1),
      ]);

      certificateStatus = cert[0]?.status ?? '';

      // Pick the next upcoming, else the most recent past.
      const now = new Date();
      const upcoming = webinarReg.find(
        (r) => r.scheduledAt && new Date(r.scheduledAt) > now,
      );
      webinarJoinUrl = (upcoming?.joinUrl || webinarReg[0]?.joinUrl) ?? '';

      if (payment[0]) {
        const amount = Number(payment[0].amount ?? 0);
        const currency = payment[0].currency || 'SAR';
        paymentAmountStr = amount > 0 ? `${amount.toFixed(2)} ${currency}` : '';
      }
    }

    // Pick Arabic body when requested and present; English is the
    // fallback in every other case (no AR body, locale missing, or
    // locale is anything other than 'ar').
    const useArabic = opts?.locale === 'ar' && !!macro.bodyAr;
    let resolvedBody = useArabic ? (macro.bodyAr as string) : macro.bodyTemplate;

    resolvedBody = resolvedBody.replace(/\{\{learner_name\}\}/g, learnerName);
    resolvedBody = resolvedBody.replace(/\{\{learner_first_name\}\}/g, learnerFirstName);
    resolvedBody = resolvedBody.replace(/\{\{course_name\}\}/g, courseName);
    resolvedBody = resolvedBody.replace(/\{\{ticket_id\}\}/g, ticket.referenceNumber);
    resolvedBody = resolvedBody.replace(/\{\{ticket_subject\}\}/g, ticket.subject || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_priority\}\}/g, ticket.priority || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_category\}\}/g, ticket.category || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_status\}\}/g, ticket.status || '');
    resolvedBody = resolvedBody.replace(/\{\{agent_name\}\}/g, agentName);
    resolvedBody = resolvedBody.replace(/\{\{certificate_status\}\}/g, certificateStatus);
    resolvedBody = resolvedBody.replace(/\{\{webinar_join_url\}\}/g, webinarJoinUrl);
    resolvedBody = resolvedBody.replace(/\{\{payment_amount\}\}/g, paymentAmountStr);

    // Replace any remaining unresolved {{...}} with empty string
    resolvedBody = resolvedBody.replace(/\{\{[^}]*\}\}/g, '');

    // Append KB article URLs — validate each still points to a published
    // article before including it. Silently skip unpublished/deleted ones
    // so learners never see dead links. External URLs (no UUID match)
    // pass through without validation.
    const urls = macro.kbArticleUrls as string[] | null;
    if (urls && urls.length > 0) {
      const validUrls: string[] = [];
      for (const url of urls) {
        const idMatch = url.match(
          /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
        );
        if (idMatch) {
          const [article] = await db
            .select({ id: kbArticles.id })
            .from(kbArticles)
            .where(
              and(
                eq(kbArticles.id, idMatch[1]),
                eq(kbArticles.published, true),
              ),
            )
            .limit(1);
          if (article) validUrls.push(url);
          // else: article unpublished/deleted — omit silently
        } else {
          validUrls.push(url); // external URL, no validation needed
        }
      }
      if (validUrls.length > 0) {
        resolvedBody += '\n\n---\nRelated articles:';
        for (const vUrl of validUrls) {
          resolvedBody += `\n- ${vUrl}`;
        }
      }
    }

    // Log the apply for analytics. Best-effort — a logging failure
    // must not break the agent's reply flow, so we catch + drop.
    // Only log when we know who applied it (controller always passes
    // userId; safety net for direct internal callers).
    if (opts?.userId) {
      try {
        await db.insert(supportMacroUses).values({
          macroId,
          ticketId,
          userId: opts.userId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to log macro use (macro=${macroId} ticket=${ticketId}): ${(err as Error).message}`,
        );
      }
    }

    return { resolvedBody, macroTitle: macro.title };
  }

  // ─── Knowledge Base CRUD ──────────────────────────────

  async getKbArticles(filters?: {
    category?: string;
    search?: string;
    publishedOnly?: boolean;
  }) {
    const conditions: any[] = [];

    if (filters?.publishedOnly) {
      conditions.push(eq(kbArticles.published, true));
    }
    if (filters?.category) {
      conditions.push(eq(kbArticles.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(kbArticles.titleEn, `%${filters.search}%`),
          ilike(kbArticles.titleAr, `%${filters.search}%`),
          ilike(kbArticles.bodyEn, `%${filters.search}%`),
          ilike(kbArticles.bodyAr, `%${filters.search}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select({
        id: kbArticles.id,
        titleAr: kbArticles.titleAr,
        titleEn: kbArticles.titleEn,
        bodyAr: kbArticles.bodyAr,
        bodyEn: kbArticles.bodyEn,
        category: kbArticles.category,
        published: kbArticles.published,
        viewCount: kbArticles.viewCount,
        createdAt: kbArticles.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(kbArticles)
      .leftJoin(users, eq(kbArticles.authorId, users.id))
      .where(where)
      .orderBy(desc(kbArticles.createdAt));
  }

  async getKbArticle(id: string, incrementView: boolean = false) {
    if (incrementView) {
      await db
        .update(kbArticles)
        .set({ viewCount: sql`${kbArticles.viewCount} + 1` })
        .where(eq(kbArticles.id, id));
    }

    const [article] = await db
      .select()
      .from(kbArticles)
      .where(eq(kbArticles.id, id));

    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async createKbArticle(userId: string, dto: CreateKbArticleDto) {
    // M9: Require at least one title
    if (!dto.titleEn && !dto.titleAr) {
      throw new BadRequestException(
        'At least one title (English or Arabic) is required',
      );
    }

    const [article] = await db
      .insert(kbArticles)
      .values({
        titleEn: dto.titleEn || null,
        titleAr: dto.titleAr || null,
        bodyEn: dto.bodyEn || null,
        bodyAr: dto.bodyAr || null,
        category: dto.category,
        published: dto.published ?? false,
        authorId: userId,
      })
      .returning();
    return article;
  }

  async updateKbArticle(id: string, dto: UpdateKbArticleDto) {
    const [existing] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(eq(kbArticles.id, id));
    if (!existing) throw new NotFoundException('Article not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.titleEn !== undefined) updateData.titleEn = dto.titleEn;
    if (dto.titleAr !== undefined) updateData.titleAr = dto.titleAr;
    if (dto.bodyEn !== undefined) updateData.bodyEn = dto.bodyEn;
    if (dto.bodyAr !== undefined) updateData.bodyAr = dto.bodyAr;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.published !== undefined) updateData.published = dto.published;

    const [updated] = await db
      .update(kbArticles)
      .set(updateData)
      .where(eq(kbArticles.id, id))
      .returning();
    return updated;
  }

  async deleteKbArticle(id: string) {
    const [existing] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(eq(kbArticles.id, id));
    if (!existing) throw new NotFoundException('Article not found');

    await db.delete(kbArticles).where(eq(kbArticles.id, id));
    return { success: true };
  }

  // ============================================================
  // Support Team Membership + Admin-Mediated Requests
  // ============================================================

  /**
   * Agents on the given supervisor's team, enriched with each agent's
   * live performance metrics. Excludes the supervisor themselves —
   * a supervisor owns a team, they aren't a team member.
   */
  async listMyTeam(supervisorId: string) {
    const rows = await db
      .select({
        membershipId: supportTeamMembers.id,
        agentId: supportTeamMembers.agentId,
        assignedAt: supportTeamMembers.assignedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        phone: users.phone,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        supportSubRole: userRoles.supportSubRole,
      })
      .from(supportTeamMembers)
      .innerJoin(users, eq(supportTeamMembers.agentId, users.id))
      .leftJoin(
        userRoles,
        and(
          eq(userRoles.userId, supportTeamMembers.agentId),
          // SUPPORT role row only — avoids duplicating per-role join hits.
          sql`${userRoles.roleId} IN (SELECT id FROM ${roles} WHERE name = ${ROLE_NAMES.SUPPORT})`,
        ),
      )
      .where(eq(supportTeamMembers.supervisorId, supervisorId))
      .orderBy(asc(users.firstName));

    if (rows.length === 0) return [];

    // Pull performance for these agents only — reuses the existing
    // agent-performance computation per row to keep the math identical
    // to the Reports page.
    const perfRows = await this.getAgentPerformance();
    const perfById = new Map(perfRows.map((p: any) => [p.userId, p]));

    // Map performance to the canonical supervisor-rollup shape so all
    // callers (supervisor dashboard, getSupervisorDetail aggregation,
    // listSupervisorsWithStats) read the same field names. The raw
    // getAgentPerformance shape uses totalTickets / csatAvgScore /
    // frtBreaches+ttrBreaches — without remapping here the consumers
    // read undefined and the FE crashes on perf.csatScore.toFixed().
    return rows.map((r) => {
      // Hydrate per-agent perf in the union shape consumed by every
      // surface that reads `member.performance.*`:
      //   • Supervisor "My Team" KPIs + agent cards
      //   • Admin Supervisor Detail aggregates
      //   • getSupervisorDetail aggregation roll-up
      // We carry both the legacy keys (ticketsHandled / csatScore /
      // slaBreachCount) AND the granular per-ticket counters
      // (openTickets / resolvedTickets / csatAvgScore /
      // frtBreaches / ttrBreaches / avgTtrMinutes) so the FE never
      // reads `undefined` and silently counts as zero.
      const raw = perfById.get(r.agentId) as
        | {
            totalTickets?: number;
            openTickets?: number;
            resolvedTickets?: number;
            avgFrtMinutes?: number | null;
            avgTtrMinutes?: number | null;
            csatAvgScore?: number | null;
            csatResponses?: number;
            frtBreaches?: number;
            ttrBreaches?: number;
          }
        | undefined;
      const performance = raw
        ? {
            ticketsHandled: raw.totalTickets || 0,
            totalTickets: raw.totalTickets || 0,
            openTickets: raw.openTickets || 0,
            resolvedTickets: raw.resolvedTickets || 0,
            avgFrtMinutes: raw.avgFrtMinutes ?? null,
            avgTtrMinutes: raw.avgTtrMinutes ?? null,
            csatScore: raw.csatAvgScore ?? null,
            csatAvgScore: raw.csatAvgScore ?? null,
            csatResponses: raw.csatResponses || 0,
            frtBreaches: raw.frtBreaches || 0,
            ttrBreaches: raw.ttrBreaches || 0,
            slaBreachCount: (raw.frtBreaches || 0) + (raw.ttrBreaches || 0),
          }
        : null;
      return {
        membershipId: r.membershipId,
        userId: r.agentId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        avatar: r.avatar,
        phone: r.phone,
        isActive: r.isActive,
        lastLoginAt: r.lastLoginAt,
        assignedAt: r.assignedAt,
        supportSubRole: r.supportSubRole,
        performance,
      };
    });
  }

  /**
   * Admin-only — paginated support audit trail. Reads from the shared
   * audit_logs table filtered to entityType='ticket' AND action in the
   * support-action set. Each row carries the performer's name, primary
   * role (admin/supervisor/agent/student), and the ticket reference so
   * the FE can render without N+1 calls.
   *
   * The performer role uses the same precedence as the comment-role
   * resolver in getTicketDetail (super_admin > admin > supervisor >
   * agent > student) so labels are consistent across surfaces.
   */
  async getSupportAuditTrail(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const supportActions = Object.values(SupportService.SUPPORT_AUDIT_ACTIONS);

    // Pull both user-action rows AND system-generated SLA events,
    // then merge them in JS. Pagination needs the global ordered list,
    // so we cap each source at (offset + safeLimit) and merge. This
    // keeps the query simple at the cost of fetching a few extra rows.
    // For the page sizes we use (≤100) the overhead is negligible.
    const fetchSize = offset + safeLimit;
    const [userRows, slaRows, [totalAudit], [totalSla]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          action: auditLogs.action,
          performedBy: auditLogs.performedBy,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          performerFirstName: users.firstName,
          performerLastName: users.lastName,
          ticketReferenceNumber: tickets.referenceNumber,
          ticketSubject: tickets.subject,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.performedBy))
        .leftJoin(tickets, eq(tickets.id, auditLogs.entityId))
        .where(
          and(
            eq(auditLogs.entityType, 'ticket'),
            inArray(auditLogs.action, supportActions),
          ),
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(fetchSize),
      db
        .select({
          id: slaEvents.id,
          ticketId: slaEvents.ticketId,
          eventType: slaEvents.eventType,
          triggeredAt: slaEvents.triggeredAt,
          ticketReferenceNumber: tickets.referenceNumber,
          ticketSubject: tickets.subject,
        })
        .from(slaEvents)
        .leftJoin(tickets, eq(tickets.id, slaEvents.ticketId))
        .orderBy(desc(slaEvents.triggeredAt))
        .limit(fetchSize),
      db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, 'ticket'),
            inArray(auditLogs.action, supportActions),
          ),
        ),
      db.select({ count: count() }).from(slaEvents),
    ]);

    // Map sla_events rows into the same shape as user-action rows so
    // the rest of the function processes one unified list. Actions
    // are prefixed `sla_` so the FE can pick distinct icons + tone.
    const slaActionMap: Record<string, string> = {
      frt_breach: 'sla_frt_breach',
      ttr_breach: 'sla_ttr_breach',
      frt_warning_75: 'sla_frt_warning_75',
      priority_escalated: 'sla_priority_escalated',
      escalation_triggered: 'sla_escalation_triggered',
      frt_breach_reassigned: 'sla_frt_breach_reassigned',
      ttr_breach_reassigned: 'sla_ttr_breach_reassigned',
      resolved_within_sla: 'sla_resolved_within_sla',
    };
    type CombinedRow = {
      id: string;
      action: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      performerFirstName: string | null;
      performerLastName: string | null;
      ticketReferenceNumber: string | null;
      ticketSubject: string | null;
    };
    const combined: CombinedRow[] = [];
    for (const r of userRows) {
      combined.push({
        id: r.id,
        action: r.action,
        entityId: r.entityId,
        performedBy: r.performedBy,
        metadata: r.metadata as Record<string, unknown> | null,
        createdAt: r.createdAt,
        performerFirstName: r.performerFirstName,
        performerLastName: r.performerLastName,
        ticketReferenceNumber: r.ticketReferenceNumber,
        ticketSubject: r.ticketSubject,
      });
    }
    for (const r of slaRows) {
      const action = slaActionMap[r.eventType] || `sla_${r.eventType}`;
      combined.push({
        id: `sla:${r.id}`,
        action,
        entityId: r.ticketId,
        performedBy: null,
        metadata: { source: 'sla_monitor', eventType: r.eventType },
        createdAt: r.triggeredAt,
        performerFirstName: null,
        performerLastName: null,
        ticketReferenceNumber: r.ticketReferenceNumber,
        ticketSubject: r.ticketSubject,
      });
    }
    combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const rows = combined.slice(offset, offset + safeLimit);
    const totalRow = {
      count: (totalAudit?.count || 0) + (totalSla?.count || 0),
    };

    // Resolve the primary role for the distinct performers on this
    // page in a single query; per-row joins would explode if a user
    // holds multiple roles.
    const performerIds = Array.from(
      new Set(rows.map((r) => r.performedBy).filter((v): v is string => !!v)),
    );
    const performerRoleMap = new Map<
      string,
      'super_admin' | 'admin' | 'supervisor' | 'agent' | 'student' | null
    >();
    if (performerIds.length > 0) {
      const roleRows = await db
        .select({
          userId: userRoles.userId,
          roleName: roles.name,
          supportSubRole: userRoles.supportSubRole,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, performerIds));
      const grouped = new Map<
        string,
        { roleName: string; supportSubRole: string | null }[]
      >();
      for (const r of roleRows) {
        const list = grouped.get(r.userId) || [];
        list.push({ roleName: r.roleName, supportSubRole: r.supportSubRole });
        grouped.set(r.userId, list);
      }
      for (const id of performerIds) {
        const list = grouped.get(id) || [];
        let chosen:
          | 'super_admin'
          | 'admin'
          | 'supervisor'
          | 'agent'
          | 'student'
          | null = null;
        if (list.some((x) => x.roleName === ROLE_NAMES.SUPER_ADMIN)) {
          chosen = 'super_admin';
        } else if (list.some((x) => x.roleName === ROLE_NAMES.ADMIN)) {
          chosen = 'admin';
        } else {
          const support = list.find((x) => x.roleName === ROLE_NAMES.SUPPORT);
          if (support) {
            chosen =
              support.supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR
                ? 'supervisor'
                : 'agent';
          } else if (list.some((x) => x.roleName === ROLE_NAMES.STUDENT)) {
            chosen = 'student';
          }
        }
        performerRoleMap.set(id, chosen);
      }
    }

    const total = totalRow?.count || 0;
    return {
      data: rows.map((r) => ({
        id: r.id,
        action: r.action,
        ticketId: r.entityId,
        ticketReferenceNumber: r.ticketReferenceNumber,
        ticketSubject: r.ticketSubject,
        performerId: r.performedBy,
        performerName:
          [r.performerFirstName, r.performerLastName]
            .filter(Boolean)
            .join(' ') || null,
        performerRole: r.performedBy
          ? performerRoleMap.get(r.performedBy) ?? null
          : null,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // ─── Hold-approval workflow ──────────────────────────────
  //
  // Agents cannot flip a ticket directly to ON_HOLD. They submit a
  // request via createHoldRequest. A supervisor or admin then resolves
  // it via decideHoldRequest. Notifications + audit logs are written
  // at every step so the activity ends up on the audit trail without
  // additional plumbing.

  async createHoldRequest(
    user: AuthenticatedUser,
    ticketId: string,
    input: { reason: string; description?: string | null },
  ) {
    // Validate reason against the same whitelist the ticket already uses.
    if (!HOLD_REASONS.includes(input.reason as (typeof HOLD_REASONS)[number])) {
      throw new BadRequestException(
        `Invalid hold reason. Allowed: ${HOLD_REASONS.join(', ')}`,
      );
    }
    // "other" requires a description so supervisors aren't deciding blind.
    if (input.reason === 'other' && !input.description?.trim()) {
      throw new BadRequestException(
        'A description is required when the reason is "other".',
      );
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        assigneeId: tickets.assigneeId,
        subject: tickets.subject,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Only the assignee can request. (Admins / supervisors don't go
    // through this flow at all — they use updateTicket directly.)
    if (ticket.assigneeId !== user.id) {
      throw new ForbiddenException(
        'Only the ticket assignee can request a hold',
      );
    }
    if (
      ticket.status === TICKET_STATUS.RESOLVED ||
      ticket.status === TICKET_STATUS.CLOSED
    ) {
      throw new BadRequestException(
        'Cannot put a resolved or closed ticket on hold',
      );
    }
    if (ticket.status === TICKET_STATUS.ON_HOLD) {
      throw new BadRequestException('Ticket is already on hold');
    }

    // Reject if there's already a pending request. The DB unique
    // partial index would catch this anyway; the explicit check gives
    // a friendlier message than a 23505.
    const [existingPending] = await db
      .select({ id: ticketHoldRequests.id })
      .from(ticketHoldRequests)
      .where(
        and(
          eq(ticketHoldRequests.ticketId, ticketId),
          eq(ticketHoldRequests.status, HOLD_REQUEST_STATUS.PENDING),
        ),
      );
    if (existingPending) {
      throw new BadRequestException(
        'A hold request is already pending for this ticket',
      );
    }

    const [row] = await db
      .insert(ticketHoldRequests)
      .values({
        ticketId,
        requestedBy: user.id,
        reason: input.reason,
        description: input.description?.trim() || null,
        status: HOLD_REQUEST_STATUS.PENDING,
      })
      .returning();

    // Audit log entry — "hold_requested". Action lives outside the
    // SUPPORT_AUDIT_ACTIONS set so it doesn't surface inside the
    // generic audit trail filter; the supervisor's pending-decisions
    // view reads `ticket_hold_requests` directly.
    await this.auditLogService.log({
      entityType: 'ticket',
      entityId: ticketId,
      action: 'hold_requested',
      performedBy: user.id,
      metadata: {
        referenceNumber: ticket.referenceNumber,
        reason: input.reason,
        holdRequestId: row.id,
      },
    });

    // Find the right approver: supervisor of the requester's team,
    // falling back to all supervisors. Notify each with an in-app
    // alert + email so they see the request promptly.
    const [membership] = await db
      .select({ supervisorId: supportTeamMembers.supervisorId })
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, user.id))
      .limit(1);

    const approverIds = new Set<string>();
    if (membership?.supervisorId) approverIds.add(membership.supervisorId);

    // Always tap admins so a stranded request without a supervisor
    // still gets eyes on it.
    const adminUsers = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        inArray(roles.name, [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN] as any),
      );
    for (const a of adminUsers) approverIds.add(a.userId);

    const requesterName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'An agent';
    for (const approverId of approverIds) {
      try {
        await this.notificationsService.create({
          recipientId: approverId,
          type: 'hold_requested',
          title: 'Hold approval needed',
          message: `${requesterName} requested a hold on ${ticket.referenceNumber}: ${input.reason}`,
          link: `/dashboard/support/supervisor/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } catch {
        /* non-blocking */
      }
      // Email
      try {
        const [approver] = await db
          .select({ email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, approverId));
        if (approver?.email) {
          await this.emailService.sendHoldRequestEmail(
            approver.email,
            approver.firstName || 'Supervisor',
            ticket.referenceNumber,
            ticket.subject,
            requesterName,
            input.reason,
            input.description || null,
          );
        }
      } catch {
        /* non-blocking */
      }
    }

    return row;
  }

  async decideHoldRequest(
    user: AuthenticatedUser,
    ticketId: string,
    requestId: string,
    input: { decision: 'approved' | 'rejected'; note?: string | null },
  ) {
    const isPrivileged =
      user.supportSubRole === SUPPORT_SUB_ROLES.SUPERVISOR ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isPrivileged) {
      throw new ForbiddenException(
        'Only supervisors and admins can decide hold requests',
      );
    }

    const [req] = await db
      .select()
      .from(ticketHoldRequests)
      .where(
        and(
          eq(ticketHoldRequests.id, requestId),
          eq(ticketHoldRequests.ticketId, ticketId),
        ),
      );
    if (!req) throw new NotFoundException('Hold request not found');
    if (req.status !== HOLD_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(
        `Request is already ${req.status} — no further decision needed.`,
      );
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        subject: tickets.subject,
        referenceNumber: tickets.referenceNumber,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) throw new NotFoundException('Ticket not found');

    const now = new Date();
    await db
      .update(ticketHoldRequests)
      .set({
        status:
          input.decision === 'approved'
            ? HOLD_REQUEST_STATUS.APPROVED
            : HOLD_REQUEST_STATUS.REJECTED,
        decidedBy: user.id,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
      })
      .where(eq(ticketHoldRequests.id, requestId));

    // On approval, actually flip the ticket. On rejection, just leave
    // it alone — the agent gets the notification and the audit row.
    if (input.decision === 'approved') {
      if (
        ticket.status === TICKET_STATUS.RESOLVED ||
        ticket.status === TICKET_STATUS.CLOSED
      ) {
        throw new BadRequestException(
          'Ticket reached a terminal state while the request was pending — cannot approve.',
        );
      }
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.ON_HOLD,
          onHoldReason: req.reason,
          onHoldAt: now,
          onHoldResumedAt: null,
          updatedAt: now,
        })
        .where(eq(tickets.id, ticketId));
    }

    // Audit row + notification + email to the requester.
    await this.auditLogService.log({
      entityType: 'ticket',
      entityId: ticketId,
      action: input.decision === 'approved' ? 'hold_approved' : 'hold_rejected',
      performedBy: user.id,
      metadata: {
        referenceNumber: ticket.referenceNumber,
        reason: req.reason,
        holdRequestId: requestId,
        decisionNote: input.note || null,
      },
    });

    try {
      const [requester] = await db
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, req.requestedBy));
      await this.notificationsService.create({
        recipientId: req.requestedBy,
        type: 'hold_decided',
        title:
          input.decision === 'approved'
            ? 'Hold request approved'
            : 'Hold request rejected',
        message: `${ticket.referenceNumber} — ${input.decision === 'approved' ? 'on hold' : 'rejected'}.${
          input.note ? ` Note: ${input.note}` : ''
        }`,
        link: `/dashboard/support/agent/tickets/${ticketId}`,
        entityType: 'ticket',
        entityId: ticketId,
      });
      if (requester?.email) {
        await this.emailService.sendHoldDecisionEmail(
          requester.email,
          requester.firstName || 'Agent',
          ticket.referenceNumber,
          ticket.subject,
          input.decision,
          input.note || null,
        );
      }
    } catch {
      /* non-blocking */
    }

    return { ok: true, decision: input.decision };
  }

  // Look up the pending hold request for a ticket — if one exists,
  // it surfaces in getTicketDetail so the FE can render the pending
  // banner without an extra round-trip.
  async getPendingHoldRequest(ticketId: string) {
    const [row] = await db
      .select({
        id: ticketHoldRequests.id,
        reason: ticketHoldRequests.reason,
        description: ticketHoldRequests.description,
        createdAt: ticketHoldRequests.createdAt,
        requestedBy: ticketHoldRequests.requestedBy,
        requesterFirstName: users.firstName,
        requesterLastName: users.lastName,
      })
      .from(ticketHoldRequests)
      .leftJoin(users, eq(users.id, ticketHoldRequests.requestedBy))
      .where(
        and(
          eq(ticketHoldRequests.ticketId, ticketId),
          eq(ticketHoldRequests.status, HOLD_REQUEST_STATUS.PENDING),
        ),
      )
      .limit(1);
    return row || null;
  }

  /**
   * Admin-only — list all supervisors with team-aggregate stats.
   * One row per supervisor, sorted by team size desc. Stats are
   * scoped to the optional date range (defaults to last 30 days when
   * neither bound is supplied).
   *
   * Powers the admin "Supervisors" tab list view.
   */
  async listSupervisorsWithStats(dateFrom?: string, dateTo?: string) {
    // 1. Find every SUPPORT user whose sub-role is "supervisor".
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT))
      .limit(1);
    if (!supportRole) return [];

    const supervisors = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        lastLoginAt: users.lastLoginAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(
        and(
          eq(userRoles.roleId, supportRole.id),
          eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.SUPERVISOR),
        ),
      )
      .orderBy(asc(users.firstName));

    if (supervisors.length === 0) return [];

    // 2. Team-size + active-tickets per supervisor, in two GROUP BYs.
    const teamSizes = await db
      .select({
        supervisorId: supportTeamMembers.supervisorId,
        size: count(),
      })
      .from(supportTeamMembers)
      .groupBy(supportTeamMembers.supervisorId);
    const teamSizeMap = new Map(teamSizes.map((r) => [r.supervisorId, r.size]));

    // 3. Per-supervisor active ticket count across their team's agents.
    //    Computed via the supportTeamMembers join — counts tickets where
    //    the assignee belongs to that supervisor's team and the ticket
    //    is still open.
    const teamActive = await db
      .select({
        supervisorId: supportTeamMembers.supervisorId,
        activeCount: count(),
      })
      .from(supportTeamMembers)
      .innerJoin(
        tickets,
        and(
          eq(tickets.assigneeId, supportTeamMembers.agentId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .groupBy(supportTeamMembers.supervisorId);
    const teamActiveMap = new Map(
      teamActive.map((r) => [r.supervisorId, r.activeCount]),
    );

    // 4. Performance aggregates — reuse getAgentPerformance with the
    //    supplied window, then roll up per supervisor by joining via
    //    supportTeamMembers. getAgentPerformance returns totalTickets /
    //    csatAvgScore / frtBreaches + ttrBreaches, so we map into the
    //    supervisor-rollup shape (ticketsHandled / csatScore / slaBreachCount).
    const perfRaw = await this.getAgentPerformance(dateFrom, dateTo);
    const perfByAgent = new Map(
      perfRaw.map((p) => [
        p.userId,
        {
          ticketsHandled: p.totalTickets,
          avgFrtMinutes: p.avgFrtMinutes,
          avgTtrMinutes: p.avgTtrMinutes ?? null,
          csatScore: p.csatAvgScore,
          slaBreachCount: (p.frtBreaches || 0) + (p.ttrBreaches || 0),
        },
      ]),
    );

    const memberships = await db
      .select({
        supervisorId: supportTeamMembers.supervisorId,
        agentId: supportTeamMembers.agentId,
      })
      .from(supportTeamMembers);

    type Agg = {
      ticketsHandled: number;
      frtSum: number;
      frtCount: number;
      ttrSum: number;
      ttrCount: number;
      csatSum: number;
      csatCount: number;
      slaBreachCount: number;
    };
    const aggBySupervisor = new Map<string, Agg>();
    for (const m of memberships) {
      const p = perfByAgent.get(m.agentId);
      if (!p) continue;
      const cur = aggBySupervisor.get(m.supervisorId) || {
        ticketsHandled: 0,
        frtSum: 0,
        frtCount: 0,
        ttrSum: 0,
        ttrCount: 0,
        csatSum: 0,
        csatCount: 0,
        slaBreachCount: 0,
      };
      cur.ticketsHandled += p.ticketsHandled || 0;
      if (p.avgFrtMinutes != null) {
        cur.frtSum += p.avgFrtMinutes;
        cur.frtCount += 1;
      }
      if (p.avgTtrMinutes != null) {
        cur.ttrSum += p.avgTtrMinutes;
        cur.ttrCount += 1;
      }
      if (p.csatScore != null) {
        cur.csatSum += p.csatScore;
        cur.csatCount += 1;
      }
      cur.slaBreachCount += p.slaBreachCount || 0;
      aggBySupervisor.set(m.supervisorId, cur);
    }

    const rows = supervisors.map((s) => {
      const agg = aggBySupervisor.get(s.userId);
      return {
        userId: s.userId,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        avatar: s.avatar,
        lastLoginAt: s.lastLoginAt,
        teamSize: teamSizeMap.get(s.userId) || 0,
        activeTickets: teamActiveMap.get(s.userId) || 0,
        ticketsHandled: agg?.ticketsHandled || 0,
        avgFrtMinutes:
          agg && agg.frtCount > 0 ? Math.round(agg.frtSum / agg.frtCount) : null,
        avgTtrMinutes:
          agg && agg.ttrCount > 0 ? Math.round(agg.ttrSum / agg.ttrCount) : null,
        csatScore:
          agg && agg.csatCount > 0
            ? Math.round((agg.csatSum / agg.csatCount) * 10) / 10
            : null,
        slaBreachCount: agg?.slaBreachCount || 0,
      };
    });

    // Sort by team size desc, then active tickets desc — supervisors
    // with the largest / busiest teams float to the top.
    rows.sort(
      (a, b) => b.teamSize - a.teamSize || b.activeTickets - a.activeTickets,
    );
    return rows;
  }

  /**
   * Admin-only — supervisor detail bundle: profile + team agents
   * (with per-agent perf) + supervisor's own open tickets + team-wide
   * aggregates. Date range is optional; defaults to the same window as
   * getAgentPerformance (last 30 days when not provided).
   */
  async getSupervisorDetail(
    supervisorId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const [supervisor] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        phone: users.phone,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, supervisorId));
    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }

    // Reuse the supervisor's own listMyTeam call so the team-member
    // payload matches the supervisor dashboard exactly (perf included).
    const team = await this.listMyTeam(supervisorId);

    // Supervisor's own active tickets (rare but possible — supervisors
    // can be assigned tickets directly).
    const supervisorTickets = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigneeId, supervisorId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(50);

    // Team-wide aggregates — sum + average across all team members for
    // the requested date window.
    let totalTicketsHandled = 0;
    let frtSum = 0;
    let frtCount = 0;
    let ttrSum = 0;
    let ttrCount = 0;
    let csatSum = 0;
    let csatCount = 0;
    let slaBreachCount = 0;
    for (const member of team) {
      const p = member.performance as any;
      if (!p) continue;
      totalTicketsHandled += p.ticketsHandled || 0;
      if (p.avgFrtMinutes != null) {
        frtSum += p.avgFrtMinutes;
        frtCount += 1;
      }
      if (p.avgTtrMinutes != null) {
        ttrSum += p.avgTtrMinutes;
        ttrCount += 1;
      }
      if (p.csatScore != null) {
        csatSum += p.csatScore;
        csatCount += 1;
      }
      slaBreachCount += p.slaBreachCount || 0;
    }

    return {
      supervisor,
      team,
      supervisorTickets,
      aggregates: {
        teamSize: team.length,
        ticketsHandled: totalTicketsHandled,
        avgFrtMinutes: frtCount > 0 ? Math.round(frtSum / frtCount) : null,
        avgTtrMinutes: ttrCount > 0 ? Math.round(ttrSum / ttrCount) : null,
        csatScore:
          csatCount > 0
            ? Math.round((csatSum / csatCount) * 10) / 10
            : null,
        slaBreachCount,
      },
      dateRange: { dateFrom: dateFrom || null, dateTo: dateTo || null },
    };
  }

  /**
   * Detail view for a single team member — used by the side sheet.
   * Includes their open tickets and last 5 CSAT comments.
   * Guard: only the owning supervisor (or admin) may inspect.
   */
  async getTeamMemberDetail(
    requester: AuthenticatedUser,
    agentId: string,
  ) {
    const isAdmin =
      requester.roles.includes(ROLE_NAMES.ADMIN) ||
      requester.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [membership] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, agentId))
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Agent is not on any team');
    }
    if (!isAdmin && membership.supervisorId !== requester.id) {
      throw new ForbiddenException(
        'You can only view members of your own team',
      );
    }

    const [agent] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);
    if (!agent) throw new NotFoundException('Agent not found');

    // Open tickets assigned to this agent
    const openTickets = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigneeId, agentId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(10);

    // Last 5 CSAT comments on this agent's tickets
    const recentCsat = await db
      .select({
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        ticketId: csatSurveys.ticketId,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(eq(tickets.assigneeId, agentId))
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(5);

    // Cross-link to the existing per-agent performance row
    const perfRows = await this.getAgentPerformance();
    const performance =
      perfRows.find((p: any) => p.userId === agentId) ?? null;

    return {
      agent: {
        ...agent,
        assignedAt: membership.assignedAt,
        supervisorId: membership.supervisorId,
      },
      performance,
      openTickets,
      recentCsat,
    };
  }

  /**
   * Admin-side: list every active Support Supervisor in a lightweight
   * shape suitable for dropdowns (Create User, Reassign Team, bulk-
   * assign orphans). Sorted by first name for predictable UX. Suspended
   * supervisors are excluded — they can't accept new agents.
   */
  async listActiveSupervisors(): Promise<
    {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      teamSize: number;
    }[]
  > {
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supportRole) return [];

    const supervisors = await db
      .select({
        userId: userRoles.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole.id),
          eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.SUPERVISOR),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.firstName), asc(users.lastName));
    if (supervisors.length === 0) return [];

    const teamSizes = await db
      .select({
        supervisorId: supportTeamMembers.supervisorId,
        size: count(),
      })
      .from(supportTeamMembers)
      .groupBy(supportTeamMembers.supervisorId);
    const sizeMap = new Map(teamSizes.map((r) => [r.supervisorId, r.size]));

    return supervisors.map((s) => ({
      ...s,
      teamSize: Number(sizeMap.get(s.userId) ?? 0),
    }));
  }

  /**
   * Admin-side: every Support Agent who currently isn't on any
   * supervisor's team. Surfaces the cleanup queue for the orphan
   * banner on the Team Management page.
   */
  async listOrphanAgents(): Promise<
    {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      avatar: string | null;
      isActive: boolean;
      createdAt: Date;
    }[]
  > {
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supportRole) return [];

    const agents = await db
      .select({
        userId: userRoles.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole.id),
          or(
            eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.AGENT),
            sql`${userRoles.supportSubRole} IS NULL`,
          ),
        ),
      );

    const memberRows = await db
      .select({ agentId: supportTeamMembers.agentId })
      .from(supportTeamMembers);
    const taken = new Set(memberRows.map((m) => m.agentId));

    return agents
      .filter((a) => !taken.has(a.userId))
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }

  /**
   * Admin assigns one or more orphan agents to a supervisor. Skips
   * any agent that's somehow already on a team (race-safe), and
   * silently ignores invalid UUIDs. Returns the count successfully
   * placed.
   */
  async bulkAssignOrphansToSupervisor(
    admin: AuthenticatedUser,
    supervisorId: string,
    agentIds: string[],
    ipAddress: string,
  ): Promise<{ assigned: number; skipped: number }> {
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      throw new BadRequestException('Pick at least one agent to assign');
    }

    const [supRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supRole) throw new BadRequestException('SUPPORT role missing');

    const [supervisor] = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        isActive: users.isActive,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.userId, supervisorId),
          eq(userRoles.roleId, supRole.id),
        ),
      )
      .limit(1);
    if (
      !supervisor ||
      supervisor.supportSubRole !== SUPPORT_SUB_ROLES.SUPERVISOR
    ) {
      throw new BadRequestException(
        'Target supervisor not found or not a Support Supervisor',
      );
    }
    if (!supervisor.isActive) {
      throw new BadRequestException(
        'Cannot assign to a suspended supervisor',
      );
    }

    // Drop anyone already on a team to keep the assignment idempotent.
    const existing = await db
      .select({ agentId: supportTeamMembers.agentId })
      .from(supportTeamMembers)
      .where(inArray(supportTeamMembers.agentId, agentIds));
    const taken = new Set(existing.map((r) => r.agentId));
    const fresh = agentIds.filter((id) => !taken.has(id));

    if (fresh.length === 0) {
      return { assigned: 0, skipped: agentIds.length };
    }

    await db.insert(supportTeamMembers).values(
      fresh.map((agentId) => ({
        supervisorId,
        agentId,
        addedBy: admin.id,
      })),
    );

    await db.insert(auditLogs).values({
      entityType: 'support_team_member',
      entityId: supervisorId,
      action: 'bulk_assigned',
      performedBy: admin.id,
      metadata: {
        supervisorId,
        agentIds: fresh,
        skipped: agentIds.length - fresh.length,
      },
      ipAddress,
    });

    return {
      assigned: fresh.length,
      skipped: agentIds.length - fresh.length,
    };
  }

  /**
   * Admin moves every agent from one supervisor's team to another.
   * Used in the "demote / remove SUPPORT from supervisor" flow — the
   * UI must reassign first or the role removal is blocked server-side.
   */
  async reassignSupervisorTeam(
    admin: AuthenticatedUser,
    fromSupervisorId: string,
    toSupervisorId: string,
    ipAddress: string,
  ): Promise<{ moved: number }> {
    if (fromSupervisorId === toSupervisorId) {
      throw new BadRequestException(
        'Source and target supervisor must be different',
      );
    }

    const [supRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supRole) throw new BadRequestException('SUPPORT role missing');

    const [target] = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        isActive: users.isActive,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.userId, toSupervisorId),
          eq(userRoles.roleId, supRole.id),
        ),
      )
      .limit(1);
    if (
      !target ||
      target.supportSubRole !== SUPPORT_SUB_ROLES.SUPERVISOR ||
      !target.isActive
    ) {
      throw new BadRequestException(
        'Target supervisor must be an active Support Supervisor',
      );
    }

    const result = await db
      .update(supportTeamMembers)
      .set({ supervisorId: toSupervisorId, addedBy: admin.id })
      .where(eq(supportTeamMembers.supervisorId, fromSupervisorId))
      .returning({ id: supportTeamMembers.id });

    await db.insert(auditLogs).values({
      entityType: 'support_team',
      entityId: fromSupervisorId,
      action: 'reassigned',
      performedBy: admin.id,
      metadata: {
        fromSupervisorId,
        toSupervisorId,
        moved: result.length,
      },
      ipAddress,
    });

    return { moved: result.length };
  }

  /**
   * Supervisor removes one of their own agents from the team.
   * Leaves the user account intact — only the membership row is dropped.
   */
  async removeMyTeamMember(
    supervisor: AuthenticatedUser,
    agentId: string,
    ipAddress: string,
  ) {
    const [membership] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, agentId))
      .limit(1);
    if (!membership) {
      throw new NotFoundException('Agent is not on your team');
    }
    if (membership.supervisorId !== supervisor.id) {
      throw new ForbiddenException(
        'You can only remove members of your own team',
      );
    }

    await db
      .delete(supportTeamMembers)
      .where(eq(supportTeamMembers.id, membership.id));

    await db.insert(auditLogs).values({
      entityType: 'support_team_member',
      entityId: membership.id,
      action: 'removed',
      performedBy: supervisor.id,
      metadata: {
        supervisorId: supervisor.id,
        agentId,
      },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Returns SUPPORT users who aren't currently on any team and aren't
   * the requesting supervisor — i.e. candidates the supervisor can
   * request to add. Sub-role 'supervisor' rows are also excluded —
   * a supervisor doesn't belong inside another supervisor's team.
   */
  async listAvailableAgents(supervisorId: string) {
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supportRole) return [];

    const supportUsers = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole.id),
          // Only line agents — supervisors lead, they don't get assigned.
          or(
            eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.AGENT),
            sql`${userRoles.supportSubRole} IS NULL`,
          ),
        ),
      );

    // Exclude anyone already on a team
    const memberRows = await db
      .select({ agentId: supportTeamMembers.agentId })
      .from(supportTeamMembers);
    const taken = new Set(memberRows.map((m) => m.agentId));

    return supportUsers
      .filter((u) => !taken.has(u.userId) && u.userId !== supervisorId)
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }

  /**
   * Supervisor creates a request to add an agent to their team.
   * Goes to admin queue + creates an audit row + dashboard notification.
   * Refuses if a duplicate pending request already exists.
   */
  async createTeamRequest(
    supervisor: AuthenticatedUser,
    dto: {
      kind: 'add_existing' | 'add_new';
      candidateUserId?: string;
      candidateEmail?: string;
      candidateFirstName?: string;
      candidateLastName?: string;
      candidatePhone?: string;
      reason?: string;
    },
    ipAddress: string,
  ) {
    // Validate per kind
    if (dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_EXISTING) {
      if (!dto.candidateUserId) {
        throw new BadRequestException(
          'candidateUserId is required for add_existing requests',
        );
      }
      if (dto.candidateUserId === supervisor.id) {
        throw new BadRequestException(
          'A supervisor cannot request to add themselves',
        );
      }
      // Make sure the candidate is still available
      const [existingMembership] = await db
        .select()
        .from(supportTeamMembers)
        .where(eq(supportTeamMembers.agentId, dto.candidateUserId))
        .limit(1);
      if (existingMembership) {
        throw new BadRequestException(
          'This agent is already on a supervisor team',
        );
      }
    } else if (dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW) {
      if (!dto.candidateEmail || !dto.candidateFirstName || !dto.candidateLastName) {
        throw new BadRequestException(
          'email, first name, and last name are required for new-user requests',
        );
      }
      // Reject if an account with that email already exists
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, dto.candidateEmail.toLowerCase()))
        .limit(1);
      if (existingUser) {
        throw new BadRequestException(
          'An account with this email already exists — submit an add_existing request instead',
        );
      }
    } else {
      throw new BadRequestException('Unknown request kind');
    }

    // Block duplicate-pending for the same candidate
    const dupConds: any[] = [
      eq(supportTeamRequests.supervisorId, supervisor.id),
      eq(supportTeamRequests.status, SUPPORT_TEAM_REQUEST_STATUS.PENDING),
    ];
    if (dto.candidateUserId) {
      dupConds.push(eq(supportTeamRequests.candidateUserId, dto.candidateUserId));
    } else if (dto.candidateEmail) {
      dupConds.push(
        eq(
          supportTeamRequests.candidateEmail,
          dto.candidateEmail.toLowerCase(),
        ),
      );
    }
    const [dup] = await db
      .select()
      .from(supportTeamRequests)
      .where(and(...dupConds))
      .limit(1);
    if (dup) {
      throw new BadRequestException(
        'You already have a pending request for this candidate',
      );
    }

    const [request] = await db
      .insert(supportTeamRequests)
      .values({
        supervisorId: supervisor.id,
        kind: dto.kind,
        candidateUserId: dto.candidateUserId ?? null,
        candidateEmail: dto.candidateEmail?.toLowerCase() ?? null,
        candidateFirstName: dto.candidateFirstName ?? null,
        candidateLastName: dto.candidateLastName ?? null,
        candidatePhone: dto.candidatePhone ?? null,
        reason: dto.reason ?? null,
        status: SUPPORT_TEAM_REQUEST_STATUS.PENDING,
      })
      .returning();

    // Audit log — supervisor submitted
    await db.insert(auditLogs).values({
      entityType: 'support_team_request',
      entityId: request.id,
      action: 'created',
      performedBy: supervisor.id,
      metadata: {
        kind: dto.kind,
        candidateUserId: dto.candidateUserId ?? null,
        candidateEmail: dto.candidateEmail ?? null,
      },
      ipAddress,
    });

    // In-app admin notification
    try {
      const supervisorName =
        [supervisor.firstName, supervisor.lastName].filter(Boolean).join(' ') ||
        supervisor.email;

      // For an "add_existing" request the previous text was the generic
      // "an existing support agent" — admin had to click through to find
      // out who. Look up the candidate now so the notification text is
      // self-contained and decision-ready.
      let candidateLabel: string;
      if (dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW) {
        candidateLabel = `${dto.candidateFirstName} ${dto.candidateLastName} <${dto.candidateEmail}>`;
      } else {
        const candidateId = dto.candidateUserId;
        let candidateName = 'an existing support agent';
        if (candidateId) {
          try {
            const [candidate] = await db
              .select({
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
              })
              .from(users)
              .where(eq(users.id, candidateId));
            if (candidate) {
              const fullName = [candidate.firstName, candidate.lastName]
                .filter(Boolean)
                .join(' ');
              candidateName = fullName
                ? `${fullName} <${candidate.email}>`
                : candidate.email;
            }
          } catch {
            // Fall back to generic label if the lookup fails.
          }
        }
        candidateLabel = candidateName;
      }

      // Stable URL pattern: the admin support page reads ?tab + ?request
      // and auto-opens the decision modal for that request in any state
      // (pending → action buttons; approved/rejected → read-only audit).
      // Avoids the previous /team-requests/:id 404 once a request was
      // actioned (the per-id route was never built; the request lives
      // only inside a tab + modal).
      await this.adminNotifications.create({
        type: 'info',
        title: 'New support team request',
        description: `${supervisorName} requested to add ${candidateLabel} to their team.`,
        link: `/dashboard/admin/support?tab=team-requests&request=${request.id}`,
      });
    } catch {
      // Notification failure must not break the request submission.
    }

    return request;
  }

  /**
   * Supervisor's view of their own requests history.
   */
  async listMyTeamRequests(supervisorId: string) {
    const requests = await db
      .select()
      .from(supportTeamRequests)
      .where(eq(supportTeamRequests.supervisorId, supervisorId))
      .orderBy(desc(supportTeamRequests.createdAt))
      .limit(100);
    return requests;
  }

  /**
   * Admin queue. Optional `status` filter (defaults to 'pending'
   * if you pass it; pass 'all' / undefined for everything).
   */
  async listTeamRequests(filter: { status?: string } = {}) {
    const conds: any[] = [];
    if (filter.status && filter.status !== 'all') {
      conds.push(eq(supportTeamRequests.status, filter.status));
    }

    const supervisorUsers = alias(users, 'supervisor_users');
    const candidateUsers = alias(users, 'candidate_users');
    const reviewerUsers = alias(users, 'reviewer_users');

    const rows = await db
      .select({
        id: supportTeamRequests.id,
        supervisorId: supportTeamRequests.supervisorId,
        kind: supportTeamRequests.kind,
        candidateUserId: supportTeamRequests.candidateUserId,
        candidateEmail: supportTeamRequests.candidateEmail,
        candidateFirstName: supportTeamRequests.candidateFirstName,
        candidateLastName: supportTeamRequests.candidateLastName,
        candidatePhone: supportTeamRequests.candidatePhone,
        reason: supportTeamRequests.reason,
        status: supportTeamRequests.status,
        reviewedBy: supportTeamRequests.reviewedBy,
        reviewedAt: supportTeamRequests.reviewedAt,
        decisionReason: supportTeamRequests.decisionReason,
        createdAt: supportTeamRequests.createdAt,
        supervisorFirstName: supervisorUsers.firstName,
        supervisorLastName: supervisorUsers.lastName,
        supervisorEmail: supervisorUsers.email,
        candidateExistingFirstName: candidateUsers.firstName,
        candidateExistingLastName: candidateUsers.lastName,
        candidateExistingEmail: candidateUsers.email,
        reviewerFirstName: reviewerUsers.firstName,
        reviewerLastName: reviewerUsers.lastName,
      })
      .from(supportTeamRequests)
      .leftJoin(
        supervisorUsers,
        eq(supportTeamRequests.supervisorId, supervisorUsers.id),
      )
      .leftJoin(
        candidateUsers,
        eq(supportTeamRequests.candidateUserId, candidateUsers.id),
      )
      .leftJoin(
        reviewerUsers,
        eq(supportTeamRequests.reviewedBy, reviewerUsers.id),
      )
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(
        // Pending first, then newest
        sql`CASE WHEN ${supportTeamRequests.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(supportTeamRequests.createdAt),
      )
      .limit(200);

    return rows;
  }

  /**
   * Admin approves a team request → creates the team membership (and
   * creates the user account if kind=add_new).
   * On reject → just stamps the decision.
   *
   * @param tempPassword If approving an add_new request, the admin must
   *   pre-set a starter password (≥ 8 chars). The supervisor can then
   *   share it with the new agent out-of-band.
   */
  async decideTeamRequest(
    admin: AuthenticatedUser,
    requestId: string,
    decision: 'approve' | 'reject',
    opts: { reason?: string; tempPassword?: string },
    ipAddress: string,
  ) {
    const [request] = await db
      .select()
      .from(supportTeamRequests)
      .where(eq(supportTeamRequests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== SUPPORT_TEAM_REQUEST_STATUS.PENDING) {
      throw new BadRequestException('Request has already been reviewed');
    }

    if (decision === 'reject') {
      const [updated] = await db
        .update(supportTeamRequests)
        .set({
          status: SUPPORT_TEAM_REQUEST_STATUS.REJECTED,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          decisionReason: opts.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(supportTeamRequests.id, requestId))
        .returning();

      await db.insert(auditLogs).values({
        entityType: 'support_team_request',
        entityId: requestId,
        action: 'rejected',
        performedBy: admin.id,
        metadata: {
          reason: opts.reason ?? null,
          supervisorId: request.supervisorId,
        },
        ipAddress,
      });

      return updated;
    }

    // Approve path
    let resolvedAgentId = request.candidateUserId;

    if (request.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW) {
      if (!opts.tempPassword || opts.tempPassword.length < 8) {
        throw new BadRequestException(
          'A starter password (≥ 8 characters) is required when approving a new-user request',
        );
      }
      if (!request.candidateEmail) {
        throw new BadRequestException(
          'Request is missing a candidate email — cannot create user',
        );
      }

      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, request.candidateEmail))
        .limit(1);

      if (existingUser) {
        // Edge case: the email was registered between request + approval.
        // Treat as a soft failure rather than silently overwriting the
        // account — admin can resubmit as an add_existing request.
        throw new BadRequestException(
          'A user with this email already exists. Reject this request and ask the supervisor to submit an "add existing" request instead.',
        );
      }

      const [supportRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, ROLE_NAMES.SUPPORT));
      if (!supportRole) {
        throw new BadRequestException('SUPPORT role not found in system');
      }

      const passwordHash = await argon2.hash(opts.tempPassword);
      const [newUser] = await db
        .insert(users)
        .values({
          email: request.candidateEmail,
          passwordHash,
          firstName: request.candidateFirstName,
          lastName: request.candidateLastName,
          phone: request.candidatePhone,
          activeRole: ROLE_NAMES.SUPPORT,
          isVerified: true,
          isActive: true,
        })
        .returning({ id: users.id });

      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId: supportRole.id,
        supportSubRole: SUPPORT_SUB_ROLES.AGENT,
      });

      resolvedAgentId = newUser.id;
    }

    if (!resolvedAgentId) {
      throw new BadRequestException('Could not resolve target agent');
    }

    // Re-check membership immediately before insert — someone else
    // could have claimed the agent in the gap between request creation
    // and approval.
    const [conflict] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, resolvedAgentId))
      .limit(1);
    if (conflict) {
      throw new BadRequestException(
        'This agent is already on another supervisor team',
      );
    }

    await db.insert(supportTeamMembers).values({
      supervisorId: request.supervisorId,
      agentId: resolvedAgentId,
      addedBy: admin.id,
    });

    const [updated] = await db
      .update(supportTeamRequests)
      .set({
        status: SUPPORT_TEAM_REQUEST_STATUS.APPROVED,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        decisionReason: opts.reason ?? null,
        candidateUserId: resolvedAgentId,
        updatedAt: new Date(),
      })
      .where(eq(supportTeamRequests.id, requestId))
      .returning();

    await db.insert(auditLogs).values({
      entityType: 'support_team_request',
      entityId: requestId,
      action: 'approved',
      performedBy: admin.id,
      metadata: {
        supervisorId: request.supervisorId,
        agentId: resolvedAgentId,
        kind: request.kind,
        reason: opts.reason ?? null,
      },
      ipAddress,
    });

    return updated;
  }

  /**
   * Pending-request count — used to render a badge on the admin
   * sidebar entry. Cheap COUNT(*) query.
   */
  async countPendingTeamRequests(): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(supportTeamRequests)
      .where(
        eq(supportTeamRequests.status, SUPPORT_TEAM_REQUEST_STATUS.PENDING),
      );
    return row?.count ?? 0;
  }

  // ============================================================
  // Help Center Categories (dynamic — replaces hardcoded slugs)
  // ============================================================

  async listKbCategories() {
    const rows = await db
      .select({
        id: kbCategories.id,
        slug: kbCategories.slug,
        nameEn: kbCategories.nameEn,
        nameAr: kbCategories.nameAr,
        icon: kbCategories.icon,
        sortOrder: kbCategories.sortOrder,
        createdAt: kbCategories.createdAt,
      })
      .from(kbCategories)
      .orderBy(asc(kbCategories.sortOrder), asc(kbCategories.nameEn));

    // Tack on article counts so the management UI can show "5 articles
    // in Billing" without a second roundtrip.
    const countsRaw = await db
      .select({
        category: kbArticles.category,
        total: count(),
      })
      .from(kbArticles)
      .groupBy(kbArticles.category);
    const countsBySlug = new Map(countsRaw.map((r) => [r.category, r.total]));

    return rows.map((r) => ({
      ...r,
      articleCount: countsBySlug.get(r.slug) ?? 0,
    }));
  }

  async createKbCategory(
    userId: string,
    dto: {
      slug?: string;
      nameEn: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    if (!dto.nameEn?.trim()) {
      throw new BadRequestException('English name is required');
    }

    // Derive slug from nameEn if not provided. Lowercase, ascii-only,
    // hyphens for spaces/punctuation. Falls back to a uuid prefix on
    // pathological input (e.g. all-arabic name).
    const slug =
      dto.slug?.trim().toLowerCase() ||
      dto.nameEn
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      `cat-${crypto.randomUUID().slice(0, 8)}`;

    if (slug.length > 60) {
      throw new BadRequestException('Slug must be 60 characters or fewer');
    }

    const [existing] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(eq(kbCategories.slug, slug))
      .limit(1);
    if (existing) {
      throw new BadRequestException('A category with this slug already exists');
    }

    const [created] = await db
      .insert(kbCategories)
      .values({
        slug,
        nameEn: dto.nameEn.trim(),
        nameAr: dto.nameAr?.trim() || null,
        icon: dto.icon?.trim() || 'BookOpen',
        sortOrder: dto.sortOrder ?? 999,
        createdBy: userId,
      })
      .returning();
    return created;
  }

  async updateKbCategory(
    id: string,
    dto: {
      nameEn?: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    const [existing] = await db
      .select()
      .from(kbCategories)
      .where(eq(kbCategories.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Category not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.nameEn !== undefined) {
      if (!dto.nameEn.trim()) {
        throw new BadRequestException('English name cannot be empty');
      }
      updateData.nameEn = dto.nameEn.trim();
    }
    if (dto.nameAr !== undefined) updateData.nameAr = dto.nameAr?.trim() || null;
    if (dto.icon !== undefined) updateData.icon = dto.icon.trim() || 'BookOpen';
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    const [updated] = await db
      .update(kbCategories)
      .set(updateData)
      .where(eq(kbCategories.id, id))
      .returning();
    return updated;
  }

  // ============================================================
  // Settings — Business Hours (admin-only)
  // ============================================================

  /**
   * Load business hours from `support_config.business_hours`.
   * Returns the platform defaults if the row is absent or malformed.
   */
  async getBusinessHours(): Promise<BusinessHoursConfig> {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'business_hours'))
      .limit(1);

    if (!row?.value) return { ...DEFAULT_BUSINESS_HOURS };

    const v = row.value as any;
    return {
      workingDays:
        Array.isArray(v.workingDays) && v.workingDays.length > 0
          ? v.workingDays
              .filter((n: any) => Number.isInteger(n) && n >= 0 && n <= 6)
              .sort((a: number, b: number) => a - b)
          : DEFAULT_BUSINESS_HOURS.workingDays,
      openTime:
        typeof v.openTime === 'string' && /^\d{2}:\d{2}$/.test(v.openTime)
          ? v.openTime
          : DEFAULT_BUSINESS_HOURS.openTime,
      closeTime:
        typeof v.closeTime === 'string' && /^\d{2}:\d{2}$/.test(v.closeTime)
          ? v.closeTime
          : DEFAULT_BUSINESS_HOURS.closeTime,
      timezoneOffsetHours:
        typeof v.timezoneOffsetHours === 'number'
          ? v.timezoneOffsetHours
          : DEFAULT_BUSINESS_HOURS.timezoneOffsetHours,
    };
  }

  /**
   * Persist a new business-hours config and update the in-memory cache
   * so future SLA calculations use the new values immediately.
   */
  async setBusinessHours(input: Partial<BusinessHoursConfig>) {
    const current = await this.getBusinessHours();
    const next: BusinessHoursConfig = {
      workingDays:
        Array.isArray(input.workingDays) && input.workingDays.length > 0
          ? input.workingDays
              .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
              .sort((a, b) => a - b)
          : current.workingDays,
      openTime: input.openTime || current.openTime,
      closeTime: input.closeTime || current.closeTime,
      timezoneOffsetHours:
        typeof input.timezoneOffsetHours === 'number'
          ? input.timezoneOffsetHours
          : current.timezoneOffsetHours,
    };

    if (!/^\d{2}:\d{2}$/.test(next.openTime) || !/^\d{2}:\d{2}$/.test(next.closeTime)) {
      throw new BadRequestException(
        'openTime and closeTime must be "HH:MM" (24-hour format)',
      );
    }
    const open = parseInt(next.openTime.split(':')[0]) * 60 + parseInt(next.openTime.split(':')[1]);
    const close = parseInt(next.closeTime.split(':')[0]) * 60 + parseInt(next.closeTime.split(':')[1]);
    if (close <= open) {
      throw new BadRequestException('closeTime must be after openTime');
    }
    if (next.workingDays.length === 0) {
      throw new BadRequestException('At least one working day is required');
    }

    await db
      .insert(supportConfig)
      .values({ key: 'business_hours', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });

    setBusinessHoursConfig(next);
    return next;
  }

  // ============================================================
  // Settings — Auto-Assignment (supervisor + admin)
  // ============================================================

  async getAutoAssignment(): Promise<{
    enabled: boolean;
    strategy: 'round_robin' | 'least_loaded' | 'manual';
    respectBusinessHours: boolean;
    maxConcurrentPerAgent: number;
  }> {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'auto_assignment'))
      .limit(1);

    const v = (row?.value as any) || {};
    const validStrategies = ['round_robin', 'least_loaded', 'manual'];
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
      strategy: validStrategies.includes(v.strategy) ? v.strategy : 'round_robin',
      respectBusinessHours:
        typeof v.respectBusinessHours === 'boolean' ? v.respectBusinessHours : true,
      maxConcurrentPerAgent:
        Number.isInteger(v.maxConcurrentPerAgent) &&
        v.maxConcurrentPerAgent >= 0
          ? v.maxConcurrentPerAgent
          : 0,
    };
  }

  async setAutoAssignment(input: {
    enabled?: boolean;
    strategy?: 'round_robin' | 'least_loaded' | 'manual';
    respectBusinessHours?: boolean;
    maxConcurrentPerAgent?: number;
  }) {
    const current = await this.getAutoAssignment();
    const next = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
      strategy: input.strategy ?? current.strategy,
      respectBusinessHours:
        typeof input.respectBusinessHours === 'boolean'
          ? input.respectBusinessHours
          : current.respectBusinessHours,
      maxConcurrentPerAgent:
        typeof input.maxConcurrentPerAgent === 'number' &&
        input.maxConcurrentPerAgent >= 0
          ? input.maxConcurrentPerAgent
          : current.maxConcurrentPerAgent,
    };

    await db
      .insert(supportConfig)
      .values({ key: 'auto_assignment', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });
    return next;
  }

  // ============================================================
  // Settings — Ticket Categories (supervisor + admin)
  // Stored as a JSON array in support_config so admins can add custom
  // categories without a schema migration. The 6 platform defaults are
  // returned when no override exists.
  // ============================================================

  /**
   * Resolve auto-priority for a given category slug. Consults the live
   * ticket_categories config first (admin can override built-in
   * priorities or set one for custom slugs), then falls back to the
   * built-in map, finally to MEDIUM if the slug isn't known.
   *
   * Also returns whether the slug is valid at all — callers use this to
   * 422 unknown slugs at ticket-create time without hitting the DB CHECK.
   */
  async resolveCategoryPriority(
    slug: string,
  ): Promise<{ priority: string; isValidSlug: boolean }> {
    const all = await this.listTicketCategories();
    const match = all.find((c) => c.slug === slug);
    if (!match) {
      return { priority: TICKET_PRIORITY.MEDIUM, isValidSlug: false };
    }
    // Admin-set priority wins (works for built-ins too if they edit later)
    if (match.autoPriority) {
      return { priority: match.autoPriority, isValidSlug: true };
    }
    return {
      priority:
        CATEGORY_PRIORITY_MAP[slug] || TICKET_PRIORITY.MEDIUM,
      isValidSlug: true,
    };
  }

  async listTicketCategories(filter?: {
    role?: string;
  }): Promise<
    {
      slug: string;
      nameEn: string;
      nameAr: string | null;
      autoPriority: 'high' | 'medium' | 'low' | null;
      applicableRoles: string[];
      builtin: boolean;
      requiresCourse: boolean;
      suggestedDepartment: string | null;
    }[]
  > {
    // Default role-applicability mapping for built-ins. Each category
    // declares which customer dashboards (student / instructor /
    // course_manager / finance / ta / admin / support) should show it
    // in the create-ticket dropdown. Custom categories carry their own
    // applicableRoles, set by the supervisor when creating them.
    //
    // Phase 2 — two extra flags per category:
    //   * requiresCourse — if true, the FE shows + requires a course
    //     picker. Server enforces via createTicket validation.
    //   * suggestedDepartment — drives the Loop-in modal default and
    //     the Transfer modal default. Hint only; support decides.
    const ALL: string[] = [
      'student',
      'instructor',
      'course_manager',
      'finance',
      'ta',
      'admin',
      'support',
    ];
    const builtins = [
      { slug: 'billing', nameEn: 'Billing', nameAr: 'الفواتير', autoPriority: 'medium' as const, applicableRoles: ['student', 'finance'], requiresCourse: false, suggestedDepartment: 'finance' },
      { slug: 'login', nameEn: 'Login', nameAr: 'تسجيل الدخول', autoPriority: 'high' as const, applicableRoles: ALL, requiresCourse: false, suggestedDepartment: null },
      { slug: 'certificate', nameEn: 'Certificate', nameAr: 'الشهادات', autoPriority: 'medium' as const, applicableRoles: ['student', 'course_manager'], requiresCourse: true, suggestedDepartment: 'course_manager' },
      { slug: 'webinar', nameEn: 'Webinar', nameAr: 'الندوة الإلكترونية', autoPriority: 'high' as const, applicableRoles: ['student', 'instructor', 'course_manager'], requiresCourse: true, suggestedDepartment: 'instructor' },
      { slug: 'cme', nameEn: 'CME / CPD', nameAr: 'الساعات المعتمدة', autoPriority: 'medium' as const, applicableRoles: ['student', 'course_manager'], requiresCourse: true, suggestedDepartment: 'course_manager' },
      { slug: 'content', nameEn: 'Content', nameAr: 'المحتوى', autoPriority: 'low' as const, applicableRoles: ['student', 'instructor', 'course_manager', 'ta'], requiresCourse: true, suggestedDepartment: 'instructor' },
      { slug: 'technical', nameEn: 'Technical', nameAr: 'تقني', autoPriority: 'medium' as const, applicableRoles: ALL, requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'trainer', nameEn: 'Trainer Application', nameAr: 'طلب التدريب', autoPriority: 'medium' as const, applicableRoles: ['student'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'courses', nameEn: 'Courses', nameAr: 'الدورات', autoPriority: 'medium' as const, applicableRoles: ['student', 'instructor', 'course_manager', 'ta'], requiresCourse: true, suggestedDepartment: 'course_manager' },
      { slug: 'sessions', nameEn: 'Sessions & Schedule', nameAr: 'الجلسات والمواعيد', autoPriority: 'medium' as const, applicableRoles: ['student', 'instructor', 'ta'], requiresCourse: true, suggestedDepartment: 'instructor' },
      { slug: 'payments', nameEn: 'Payments', nameAr: 'المدفوعات', autoPriority: 'high' as const, applicableRoles: ['student', 'finance'], requiresCourse: false, suggestedDepartment: 'finance' },
      { slug: 'invoices', nameEn: 'Invoices', nameAr: 'الفواتير الضريبية', autoPriority: 'medium' as const, applicableRoles: ['student', 'finance'], requiresCourse: false, suggestedDepartment: 'finance' },
      { slug: 'refunds', nameEn: 'Refunds', nameAr: 'المبالغ المستردة', autoPriority: 'high' as const, applicableRoles: ['student', 'finance'], requiresCourse: true, suggestedDepartment: 'finance' },
      { slug: 'integrations', nameEn: 'Third-party Integrations', nameAr: 'تكاملات الطرف الثالث', autoPriority: 'high' as const, applicableRoles: ['course_manager', 'finance', 'admin'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'course_approvals', nameEn: 'Course Approvals', nameAr: 'اعتماد الدورات', autoPriority: 'medium' as const, applicableRoles: ['course_manager', 'instructor'], requiresCourse: true, suggestedDepartment: 'course_manager' },
      { slug: 'system_issues', nameEn: 'System Issues', nameAr: 'مشاكل النظام', autoPriority: 'high' as const, applicableRoles: ['instructor', 'course_manager', 'finance', 'ta', 'admin', 'support'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'security_incident', nameEn: 'Security Incident', nameAr: 'حادثة أمنية', autoPriority: 'high' as const, applicableRoles: ['admin', 'support', 'finance'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'compliance', nameEn: 'Compliance / Governance', nameAr: 'الامتثال والحوكمة', autoPriority: 'high' as const, applicableRoles: ['admin', 'support', 'course_manager'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'kb_update_request', nameEn: 'KB / Content Update Request', nameAr: 'طلب تحديث قاعدة المعرفة', autoPriority: 'low' as const, applicableRoles: ['instructor', 'course_manager', 'finance', 'ta', 'admin', 'support'], requiresCourse: false, suggestedDepartment: 'admin' },
      { slug: 'dept_assist', nameEn: 'Inter-department Assistance', nameAr: 'طلب مساعدة بين الأقسام', autoPriority: 'medium' as const, applicableRoles: ['instructor', 'course_manager', 'finance', 'ta', 'admin', 'support'], requiresCourse: false, suggestedDepartment: 'support' },
      { slug: 'other', nameEn: 'Other', nameAr: 'أخرى', autoPriority: 'low' as const, applicableRoles: ALL, requiresCourse: false, suggestedDepartment: null },
    ];

    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'ticket_categories'))
      .limit(1);

    // Phase 2 — built-in overrides. Supervisors can change a built-in's
    // applicableRoles + autoPriority, or "disable" it entirely. Stored
    // alongside the custom catalog. Slug / name / requiresCourse stay
    // frozen on built-ins (existing tickets retain their labels).
    const [overridesRow] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'ticket_category_overrides'))
      .limit(1);
    const overridesArr = Array.isArray(overridesRow?.value)
      ? (overridesRow!.value as any[])
      : [];
    const overridesBySlug = new Map<string, any>();
    for (const o of overridesArr) {
      if (o && typeof o.slug === 'string') overridesBySlug.set(o.slug, o);
    }

    const custom = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    const builtinList = builtins
      .map((b) => {
        const ov = overridesBySlug.get(b.slug);
        if (!ov) return { ...b, builtin: true, disabled: false };
        const applicableRoles = Array.isArray(ov.applicableRoles)
          ? ov.applicableRoles.filter(
              (r: any): r is string => typeof r === 'string' && ALL.includes(r),
            )
          : b.applicableRoles;
        const autoPriority =
          ov.autoPriority && ['high', 'medium', 'low'].includes(ov.autoPriority)
            ? ov.autoPriority
            : ov.autoPriority === null
              ? null
              : b.autoPriority;
        return {
          ...b,
          applicableRoles,
          autoPriority,
          builtin: true,
          disabled: ov.disabled === true,
        };
      })
      // Disabled built-ins drop out entirely.
      .filter((b) => !b.disabled);

    const merged = [
      ...builtinList.map(({ disabled: _disabled, ...b }) => b),
      ...custom.map((c: any) => {
        // Legacy custom rows pre-Fix #2 won't carry applicableRoles.
        // Default them to ALL so they stay visible everywhere — the
        // supervisor can narrow later via the Categories panel.
        const roles = Array.isArray(c.applicableRoles)
          ? c.applicableRoles.filter((r: any): r is string =>
              typeof r === 'string' && ALL.includes(r),
            )
          : ALL;
        return {
          slug: String(c.slug || ''),
          nameEn: String(c.nameEn || c.slug || ''),
          nameAr: c.nameAr ? String(c.nameAr) : null,
          autoPriority:
            c.autoPriority && ['high', 'medium', 'low'].includes(c.autoPriority)
              ? c.autoPriority
              : null,
          applicableRoles: roles,
          builtin: false,
          // Phase 2 — JSON-stored custom categories may not carry the
          // new flags yet. Default to false / null so the FE shows the
          // course field optionally and the loop-in modal has no
          // suggested dept.
          requiresCourse:
            typeof c.requiresCourse === 'boolean' ? c.requiresCourse : false,
          suggestedDepartment:
            typeof c.suggestedDepartment === 'string'
              ? c.suggestedDepartment
              : null,
        };
      }),
    ];

    if (filter?.role) {
      const role = filter.role;
      return merged.filter((c) => c.applicableRoles.includes(role));
    }
    return merged;
  }

  async addTicketCategory(input: {
    slug?: string;
    nameEn: string;
    nameAr?: string;
    autoPriority?: 'high' | 'medium' | 'low';
    applicableRoles?: string[];
  }) {
    if (!input.nameEn?.trim()) {
      throw new BadRequestException('English name is required');
    }
    const slug =
      input.slug?.trim().toLowerCase() ||
      input.nameEn
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Unable to derive a slug');

    const existing = await this.listTicketCategories();
    if (existing.some((c) => c.slug === slug)) {
      throw new BadRequestException(
        'A category with this slug already exists',
      );
    }
    const applicableRoles = this.sanitizeApplicableRoles(input.applicableRoles);
    if (applicableRoles.length === 0) {
      throw new BadRequestException(
        'At least one applicable role is required',
      );
    }

    const custom = existing.filter((c) => !c.builtin);
    custom.push({
      slug,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr?.trim() || null,
      autoPriority: input.autoPriority ?? null,
      applicableRoles,
      builtin: false,
      // Phase 2 — new custom categories default to course-optional
      // and no suggested department until the supervisor edits them.
      requiresCourse: false,
      suggestedDepartment: null,
    });

    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_categories',
        value: custom.map(({ builtin: _builtin, ...c }) => c),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: {
          value: custom.map(({ builtin: _builtin, ...c }) => c),
          updatedAt: new Date(),
        },
      });
    return { slug };
  }

  async updateTicketCategory(
    slug: string,
    input: {
      nameEn?: string;
      nameAr?: string | null;
      autoPriority?: 'high' | 'medium' | 'low' | null;
      applicableRoles?: string[];
    },
  ) {
    const existing = await this.listTicketCategories();
    const target = existing.find((c) => c.slug === slug);
    if (!target) throw new NotFoundException('Category not found');

    // Phase 2 — built-in categories can have their applicableRoles +
    // autoPriority overridden (so a supervisor can hide "Webinar"
    // from the student dropdown without a code deploy). The override
    // lives in support_config under `ticket_category_overrides`. Name
    // and slug stay frozen for built-ins so existing tickets keep
    // their labels.
    if (target.builtin) {
      const applicableRoles =
        input.applicableRoles !== undefined
          ? this.sanitizeApplicableRoles(input.applicableRoles)
          : target.applicableRoles;
      if (applicableRoles.length === 0) {
        throw new BadRequestException(
          'At least one applicable role is required',
        );
      }
      const autoPriority =
        input.autoPriority === undefined ? target.autoPriority : input.autoPriority;

      const [row] = await db
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'ticket_category_overrides'))
        .limit(1);
      const current = Array.isArray(row?.value) ? (row!.value as any[]) : [];
      const others = current.filter(
        (o: any) => typeof o?.slug === 'string' && o.slug !== slug,
      );
      const nextOverrides = [
        ...others,
        {
          slug,
          applicableRoles,
          autoPriority,
          disabled: false,
        },
      ];

      await db
        .insert(supportConfig)
        .values({
          key: 'ticket_category_overrides',
          value: nextOverrides,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: supportConfig.key,
          set: { value: nextOverrides, updatedAt: new Date() },
        });
      return { slug };
    }

    const next = existing
      .filter((c) => !c.builtin)
      .map((c) => {
        if (c.slug !== slug) return c;
        const nameEn = input.nameEn?.trim() ?? c.nameEn;
        if (!nameEn) {
          throw new BadRequestException('English name is required');
        }
        const applicableRoles =
          input.applicableRoles !== undefined
            ? this.sanitizeApplicableRoles(input.applicableRoles)
            : c.applicableRoles;
        if (applicableRoles.length === 0) {
          throw new BadRequestException(
            'At least one applicable role is required',
          );
        }
        return {
          ...c,
          nameEn,
          nameAr:
            input.nameAr === undefined
              ? c.nameAr
              : input.nameAr?.trim() || null,
          autoPriority:
            input.autoPriority === undefined ? c.autoPriority : input.autoPriority,
          applicableRoles,
        };
      })
      .map(({ builtin: _builtin, ...c }) => c);

    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_categories',
        value: next,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });
    return { slug };
  }

  private sanitizeApplicableRoles(roles?: string[]): string[] {
    const ALLOWED = new Set([
      'student',
      'instructor',
      'course_manager',
      'finance',
      'ta',
      'admin',
      'support',
    ]);
    if (!Array.isArray(roles)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of roles) {
      if (typeof r !== 'string') continue;
      if (!ALLOWED.has(r)) continue;
      if (seen.has(r)) continue;
      seen.add(r);
      out.push(r);
    }
    return out;
  }

  async removeTicketCategory(slug: string) {
    const existing = await this.listTicketCategories();
    const target = existing.find((c) => c.slug === slug);
    if (!target) throw new NotFoundException('Category not found');

    // Phase 2 — "deleting" a built-in actually disables it: we mark
    // it as disabled in the overrides config so it stops appearing
    // in any role's create-ticket dropdown. The slug stays in the
    // platform code so existing tickets retain their category label.
    if (target.builtin) {
      const [row] = await db
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'ticket_category_overrides'))
        .limit(1);
      const current = Array.isArray(row?.value) ? (row!.value as any[]) : [];
      const others = current.filter(
        (o: any) => typeof o?.slug === 'string' && o.slug !== slug,
      );
      const nextOverrides = [
        ...others,
        { slug, applicableRoles: [], autoPriority: null, disabled: true },
      ];
      await db
        .insert(supportConfig)
        .values({
          key: 'ticket_category_overrides',
          value: nextOverrides,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: supportConfig.key,
          set: { value: nextOverrides, updatedAt: new Date() },
        });
      return { slug, disabledBuiltin: true };
    }

    const remaining = existing
      .filter((c) => !c.builtin && c.slug !== slug)
      .map(({ builtin: _builtin, ...c }) => c);

    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_categories',
        value: remaining,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: remaining, updatedAt: new Date() },
      });
    return { success: true };
  }

  // ============================================================
  // Settings — Notification Preferences (per-user, support-specific)
  // ============================================================

  async getSupportNotificationPrefs(userId: string) {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, `support_notif_prefs:${userId}`))
      .limit(1);

    const v = (row?.value as any) || {};
    return {
      emailNewTicket: v.emailNewTicket ?? true,
      emailReassigned: v.emailReassigned ?? true,
      emailSlaWarning: v.emailSlaWarning ?? true,
      emailMention: v.emailMention ?? true,
      emailCsatResponse: v.emailCsatResponse ?? false,
      inappNewTicket: v.inappNewTicket ?? true,
      inappReassigned: v.inappReassigned ?? true,
      inappSlaWarning: v.inappSlaWarning ?? true,
      inappMention: v.inappMention ?? true,
      inappCsatResponse: v.inappCsatResponse ?? true,
    };
  }

  /**
   * Channel-master gate for a support recipient. Returns true when the
   * user has at least one event of that channel enabled (master ON),
   * false when all are off (master OFF). Use this to wrap every email
   * or in-app dispatch that targets an agent or supervisor — without
   * it, opting out has no effect.
   *
   * Non-support recipients (students, instructors, etc.) don't have a
   * prefs row, so getSupportNotificationPrefs returns defaults (all on
   * except CSAT-by-email) and this returns true — safe pass-through.
   */
  async shouldNotifySupport(
    userId: string,
    channel: 'email' | 'inApp',
  ): Promise<boolean> {
    try {
      const prefs = await this.getSupportNotificationPrefs(userId);
      const keys =
        channel === 'email'
          ? [
              'emailNewTicket',
              'emailReassigned',
              'emailSlaWarning',
              'emailMention',
              'emailCsatResponse',
            ]
          : [
              'inappNewTicket',
              'inappReassigned',
              'inappSlaWarning',
              'inappMention',
              'inappCsatResponse',
            ];
      return keys.some((k) => (prefs as Record<string, boolean>)[k] === true);
    } catch {
      // Pref read failed — never block notifications on a config glitch.
      return true;
    }
  }

  async setSupportNotificationPrefs(
    userId: string,
    input: Record<string, boolean>,
  ) {
    const current = await this.getSupportNotificationPrefs(userId);
    const next: Record<string, boolean> = { ...current };
    for (const k of Object.keys(current)) {
      if (typeof input[k] === 'boolean') next[k] = input[k];
    }
    await db
      .insert(supportConfig)
      .values({
        key: `support_notif_prefs:${userId}`,
        value: next,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });
    return next;
  }

  /**
   * Delete a category. Refuses if any articles still belong to it —
   * the supervisor must reassign or delete those articles first to
   * avoid orphaning rows that filter UIs would silently hide.
   */
  async deleteKbCategory(id: string) {
    const [existing] = await db
      .select()
      .from(kbCategories)
      .where(eq(kbCategories.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Category not found');

    const [{ total }] = await db
      .select({ total: count() })
      .from(kbArticles)
      .where(eq(kbArticles.category, existing.slug));

    if (total > 0) {
      throw new BadRequestException(
        `Cannot delete — ${total} article(s) still use this category. Move them to another category first.`,
      );
    }

    await db.delete(kbCategories).where(eq(kbCategories.id, id));
    return { success: true };
  }

  // ─── Ticket Tags ───────────────────────────────────────
  //
  // Admin-curated taxonomy. The registry is exposed to all support
  // users (chips need to render) but mutations + the per-ticket
  // setTicketTags are gated in the controller. Naming is
  // case-insensitive: "Refund" and "refund" collide.

  // Returns the tag registry. Active tags (the default) feed the
  // picker and the auto-apply matcher. The manager surface passes
  // `includeArchived` so it can show archived rows in a separate
  // section without a second round-trip.
  async listTicketTags(opts: { includeArchived?: boolean } = {}) {
    const includeArchived = opts.includeArchived === true;
    const baseQuery = db
      .select({
        id: ticketTags.id,
        name: ticketTags.name,
        color: ticketTags.color,
        description: ticketTags.description,
        createdAt: ticketTags.createdAt,
        archivedAt: ticketTags.archivedAt,
        usageCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${ticketTagAssignments}
          WHERE ${ticketTagAssignments.tagId} = ${ticketTags.id}
        )`,
        ruleCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${ticketTagRules}
          WHERE ${ticketTagRules.tagId} = ${ticketTags.id}
            AND ${ticketTagRules.enabled} = TRUE
        )`,
      })
      .from(ticketTags);

    const rows = includeArchived
      ? await baseQuery.orderBy(asc(ticketTags.name))
      : await baseQuery
          .where(sql`${ticketTags.archivedAt} IS NULL`)
          .orderBy(asc(ticketTags.name));
    return rows;
  }

  async createTicketTag(
    userId: string,
    dto: { name: string; color?: string; description?: string },
  ) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Tag name is required');
    if (name.length > 50) {
      throw new BadRequestException('Tag name must be 50 chars or fewer');
    }

    // Validate color upfront so we can return a clean 400 instead of a
    // Postgres CHECK violation. Accepts #RGB, #RRGGBB, or #RRGGBBAA.
    const color = (dto.color || '#E5E7EB').trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
      throw new BadRequestException(
        'Color must be a hex value like #6B7280',
      );
    }

    try {
      const [created] = await db
        .insert(ticketTags)
        .values({
          name,
          color,
          description: dto.description?.trim() || null,
          createdBy: userId,
        })
        .returning();
      return created;
    } catch (err: any) {
      // 23505 = unique violation on ticket_tags_name_lower_idx
      if (err?.code === '23505') {
        throw new BadRequestException(
          `A tag named "${name}" already exists.`,
        );
      }
      throw err;
    }
  }

  async updateTicketTag(
    id: string,
    dto: { name?: string; color?: string; description?: string },
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Tag name cannot be empty');
      if (name.length > 50) {
        throw new BadRequestException('Tag name must be 50 chars or fewer');
      }
      updates.name = name;
    }

    if (dto.color !== undefined) {
      const color = dto.color.trim();
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
        throw new BadRequestException(
          'Color must be a hex value like #6B7280',
        );
      }
      updates.color = color;
    }

    if (dto.description !== undefined) {
      updates.description = dto.description.trim() || null;
    }

    try {
      const [updated] = await db
        .update(ticketTags)
        .set(updates)
        .where(eq(ticketTags.id, id))
        .returning();
      if (!updated) throw new NotFoundException('Tag not found');
      return updated;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('A tag with that name already exists.');
      }
      throw err;
    }
  }

  async deleteTicketTag(id: string) {
    // Cascade via the FK — junction rows go too. No need to count
    // usage and bail out: an admin clicking "delete" wants the tag
    // gone, even if some tickets carry it.
    const [deleted] = await db
      .delete(ticketTags)
      .where(eq(ticketTags.id, id))
      .returning();
    if (!deleted) throw new NotFoundException('Tag not found');
    return { success: true };
  }

  // setTicketTags replaces the ticket's tag set with the provided
  // tagIds in one transaction. We don't bother computing a minimal
  // diff — the (ticket, tag) PK gives us a clean delete-then-insert
  // path, and tickets rarely carry more than a handful of tags.
  async setTicketTags(
    user: AuthenticatedUser,
    ticketId: string,
    tagIds: string[],
  ) {
    // Reuse the same access rule as addComment: agents can only modify
    // their own assigned tickets; supervisors and admins are unrestricted.
    await this.assertAgentOwnership(user, ticketId);

    // Dedupe + validate the requested tag IDs exist AND aren't archived
    // — archived tags can't be applied to new tickets (they're still
    // valid in history). Returning a 400 with the missing IDs is much
    // friendlier than the bare FK violation Postgres would emit.
    const uniqueIds = Array.from(new Set(tagIds.filter(Boolean)));
    let resolvedTags: { id: string; name: string; color: string }[] = [];
    if (uniqueIds.length > 0) {
      resolvedTags = await db
        .select({
          id: ticketTags.id,
          name: ticketTags.name,
          color: ticketTags.color,
        })
        .from(ticketTags)
        .where(
          and(
            inArray(ticketTags.id, uniqueIds),
            sql`${ticketTags.archivedAt} IS NULL`,
          ),
        );
      if (resolvedTags.length !== uniqueIds.length) {
        const foundSet = new Set(resolvedTags.map((r) => r.id));
        const missing = uniqueIds.filter((id) => !foundSet.has(id));
        throw new BadRequestException(
          `Unknown or archived tag id(s): ${missing.join(', ')}`,
        );
      }
    }

    // Compute the add/remove diff BEFORE the txn so we can write audit
    // rows that name the specific tags involved (not just counts).
    const beforeAssignments = await db
      .select({
        tagId: ticketTagAssignments.tagId,
        name: ticketTags.name,
        color: ticketTags.color,
      })
      .from(ticketTagAssignments)
      .innerJoin(ticketTags, eq(ticketTagAssignments.tagId, ticketTags.id))
      .where(eq(ticketTagAssignments.ticketId, ticketId));

    const beforeSet = new Set(beforeAssignments.map((r) => r.tagId));
    const afterSet = new Set(uniqueIds);

    const addedTags = resolvedTags.filter((t) => !beforeSet.has(t.id));
    const removedTags = beforeAssignments.filter((r) => !afterSet.has(r.tagId));

    await db.transaction(async (tx) => {
      await tx
        .delete(ticketTagAssignments)
        .where(eq(ticketTagAssignments.ticketId, ticketId));

      if (uniqueIds.length > 0) {
        await tx.insert(ticketTagAssignments).values(
          uniqueIds.map((tagId) => ({
            ticketId,
            tagId,
            assignedBy: user.id,
          })),
        );
      }
    });

    // Audit — one row per add and one per remove so the supervisor
    // trail and the per-ticket history both surface meaningful events
    // (instead of a single "tags edited" line). Fire-and-forget; the
    // tag change is already committed.
    for (const t of addedTags) {
      await this.logTicketAudit(
        SupportService.SUPPORT_AUDIT_ACTIONS.TAG_ADDED,
        ticketId,
        user.id,
        { tagId: t.id, tagName: t.name, tagColor: t.color },
      );
    }
    for (const t of removedTags) {
      await this.logTicketAudit(
        SupportService.SUPPORT_AUDIT_ACTIONS.TAG_REMOVED,
        ticketId,
        user.id,
        { tagId: t.tagId, tagName: t.name, tagColor: t.color },
      );
    }

    return this.getTicketTags(ticketId);
  }

  // ─── Tag archive lifecycle ────────────────────────────────
  //
  // Archive flips the soft flag so the tag stops appearing in pickers
  // and stops feeding the auto-apply matcher. Existing assignments
  // stay so historical reporting / filtering remains accurate. The
  // tag can be unarchived at any time.

  async archiveTicketTag(id: string) {
    const [updated] = await db
      .update(ticketTags)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(ticketTags.id, id),
          sql`${ticketTags.archivedAt} IS NULL`,
        ),
      )
      .returning();
    if (!updated) {
      // Either the tag doesn't exist or it's already archived. Both
      // collapse to a 404 — caller doesn't care which.
      throw new NotFoundException('Tag not found or already archived');
    }
    return updated;
  }

  async unarchiveTicketTag(id: string) {
    const [updated] = await db
      .update(ticketTags)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(ticketTags.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Tag not found');
    return updated;
  }

  // ─── Tag rule engine ──────────────────────────────────────
  //
  // CRUD for the per-tag auto-apply rules + the matcher invoked when
  // a new ticket is created. Patterns are case-insensitive substring
  // matches — no regex, intentionally, so admins can't author a
  // catastrophically slow expression.

  async listTagRules(tagId: string) {
    const [tag] = await db
      .select({ id: ticketTags.id })
      .from(ticketTags)
      .where(eq(ticketTags.id, tagId));
    if (!tag) throw new NotFoundException('Tag not found');
    return db
      .select({
        id: ticketTagRules.id,
        tagId: ticketTagRules.tagId,
        pattern: ticketTagRules.pattern,
        matchScope: ticketTagRules.matchScope,
        enabled: ticketTagRules.enabled,
        createdAt: ticketTagRules.createdAt,
      })
      .from(ticketTagRules)
      .where(eq(ticketTagRules.tagId, tagId))
      .orderBy(asc(ticketTagRules.createdAt));
  }

  async createTagRule(
    userId: string,
    tagId: string,
    dto: { pattern: string; matchScope?: TagRuleScope; enabled?: boolean },
  ) {
    const pattern = dto.pattern?.trim();
    if (!pattern) throw new BadRequestException('Pattern is required');
    if (pattern.length > 200) {
      throw new BadRequestException('Pattern must be 200 characters or fewer');
    }
    const matchScope = dto.matchScope || 'both';
    if (!['subject', 'description', 'both'].includes(matchScope)) {
      throw new BadRequestException('matchScope must be subject, description, or both');
    }

    const [tag] = await db
      .select({ id: ticketTags.id })
      .from(ticketTags)
      .where(eq(ticketTags.id, tagId));
    if (!tag) throw new NotFoundException('Tag not found');

    const [created] = await db
      .insert(ticketTagRules)
      .values({
        tagId,
        pattern,
        matchScope,
        enabled: dto.enabled !== false,
        createdBy: userId,
      })
      .returning();
    return created;
  }

  async updateTagRule(
    id: string,
    dto: { pattern?: string; matchScope?: TagRuleScope; enabled?: boolean },
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.pattern !== undefined) {
      const pattern = dto.pattern.trim();
      if (!pattern) throw new BadRequestException('Pattern cannot be empty');
      if (pattern.length > 200) {
        throw new BadRequestException('Pattern must be 200 characters or fewer');
      }
      updates.pattern = pattern;
    }
    if (dto.matchScope !== undefined) {
      if (!['subject', 'description', 'both'].includes(dto.matchScope)) {
        throw new BadRequestException('matchScope must be subject, description, or both');
      }
      updates.matchScope = dto.matchScope;
    }
    if (dto.enabled !== undefined) {
      updates.enabled = dto.enabled;
    }

    const [updated] = await db
      .update(ticketTagRules)
      .set(updates)
      .where(eq(ticketTagRules.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Rule not found');
    return updated;
  }

  async deleteTagRule(id: string) {
    const [deleted] = await db
      .delete(ticketTagRules)
      .where(eq(ticketTagRules.id, id))
      .returning();
    if (!deleted) throw new NotFoundException('Rule not found');
    return { success: true };
  }

  // Fired by createTicket. Scans all enabled rules on non-archived
  // tags and returns the set of tag IDs to attach. Failure here must
  // NOT break ticket creation — caller wraps the call in a try/catch
  // and continues with an empty set.
  async matchAutoApplyTags(input: {
    subject: string;
    description: string;
  }): Promise<{ tagId: string; tagName: string; tagColor: string }[]> {
    const subject = (input.subject || '').toLowerCase();
    const description = (input.description || '').toLowerCase();
    if (!subject && !description) return [];

    const rules = await db
      .select({
        ruleId: ticketTagRules.id,
        tagId: ticketTagRules.tagId,
        pattern: ticketTagRules.pattern,
        matchScope: ticketTagRules.matchScope,
        tagName: ticketTags.name,
        tagColor: ticketTags.color,
      })
      .from(ticketTagRules)
      .innerJoin(ticketTags, eq(ticketTagRules.tagId, ticketTags.id))
      .where(
        and(
          eq(ticketTagRules.enabled, true),
          sql`${ticketTags.archivedAt} IS NULL`,
        ),
      );

    const matched = new Map<
      string,
      { tagId: string; tagName: string; tagColor: string }
    >();
    for (const rule of rules) {
      if (matched.has(rule.tagId)) continue;
      const needle = rule.pattern.toLowerCase();
      if (!needle) continue;
      const inSubject = rule.matchScope !== 'description';
      const inDescription = rule.matchScope !== 'subject';
      const hit =
        (inSubject && subject.includes(needle)) ||
        (inDescription && description.includes(needle));
      if (hit) {
        matched.set(rule.tagId, {
          tagId: rule.tagId,
          tagName: rule.tagName,
          tagColor: rule.tagColor,
        });
      }
    }
    return Array.from(matched.values());
  }

  // Applies an auto-match result to a freshly-created ticket. Done
  // outside the create transaction so a bad rule doesn't surface to
  // the user as "ticket creation failed". The opener's userId is the
  // performer on the audit row (with metadata.auto=true) so the
  // supervisor trail still attributes the event consistently — the
  // GUEST sentinel works the same as for ticket_created.
  // Single-tag-by-name helper used by the intervention flow. Creates
  // the tag row if missing so the first instructor follow-up seeds the
  // 'at-risk-follow-up' tag without an admin pre-populating it. Idempotent.
  async applyAutoTag(
    ticketId: string,
    tagName: string,
    openerId: string,
  ): Promise<void> {
    // Look up or create — match on LOWER(name) to mirror the unique
    // index, then apply via the batched helper for audit-log parity.
    const trimmed = tagName.trim();
    if (!trimmed) return;
    const [existing] = await db
      .select({
        id: ticketTags.id,
        name: ticketTags.name,
        color: ticketTags.color,
      })
      .from(ticketTags)
      .where(sql`LOWER(${ticketTags.name}) = LOWER(${trimmed})`)
      .limit(1);

    let tag: { id: string; name: string; color: string };
    if (existing) {
      tag = existing;
    } else {
      const [created] = await db
        .insert(ticketTags)
        .values({
          name: trimmed,
          color: '#FEF3C7',
          description: 'Auto-generated tag for at-risk student follow-ups',
          createdBy: openerId,
        })
        .returning({
          id: ticketTags.id,
          name: ticketTags.name,
          color: ticketTags.color,
        });
      tag = created;
    }

    await this.applyAutoTagsToTicket(ticketId, openerId, [
      { tagId: tag.id, tagName: tag.name, tagColor: tag.color },
    ]);
  }

  async applyAutoTagsToTicket(
    ticketId: string,
    openerId: string,
    matches: { tagId: string; tagName: string; tagColor: string }[],
  ): Promise<void> {
    if (matches.length === 0) return;
    try {
      await db
        .insert(ticketTagAssignments)
        .values(
          matches.map((m) => ({
            ticketId,
            tagId: m.tagId,
            assignedBy: null,
          })),
        )
        .onConflictDoNothing();
      for (const m of matches) {
        await this.logTicketAudit(
          SupportService.SUPPORT_AUDIT_ACTIONS.TAG_AUTO_APPLIED,
          ticketId,
          openerId,
          {
            tagId: m.tagId,
            tagName: m.tagName,
            tagColor: m.tagColor,
            auto: true,
          },
        );
      }
    } catch (err) {
      this.logger.warn(`Auto-tag apply failed for ticket ${ticketId}: ${err}`);
    }
  }

  // ─── Tag analytics ────────────────────────────────────────
  //
  // Powers Settings → Tags → Analytics. Three rolled-up views:
  //   • topTags    — overall usage + last-30-day deltas
  //   • trend      — daily assignment counts for the last 30 days
  //   • byCategory — which tags dominate each ticket category
  // All computed in SQL to avoid trickling thousands of join rows
  // into Node and reaggregating.

  async getTagAnalytics() {
    const now = new Date();
    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);
    const since30Iso = since30.toISOString();

    const [topTags, trendRows, byCategoryRaw, [totals]] = await Promise.all([
      db
        .select({
          tagId: ticketTags.id,
          name: ticketTags.name,
          color: ticketTags.color,
          archivedAt: ticketTags.archivedAt,
          usageCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketTagAssignments}
            WHERE ${ticketTagAssignments.tagId} = ${ticketTags.id}
          )`,
          last30Count: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketTagAssignments}
            WHERE ${ticketTagAssignments.tagId} = ${ticketTags.id}
              AND ${ticketTagAssignments.assignedAt} >= ${since30Iso}
          )`,
          resolvedCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketTagAssignments} a
            INNER JOIN ${tickets} tk ON tk.id = a.ticket_id
            WHERE a.tag_id = ${ticketTags.id}
              AND tk.status IN ('resolved', 'closed')
          )`,
        })
        .from(ticketTags)
        .orderBy(desc(sql`(
          SELECT COUNT(*)::int FROM ${ticketTagAssignments}
          WHERE ${ticketTagAssignments.tagId} = ${ticketTags.id}
        )`))
        .limit(15),
      // Daily trend across all tags.
      db.execute(sql`
        SELECT
          DATE_TRUNC('day', a.assigned_at)::date AS day,
          COUNT(*)::int AS count
        FROM ticket_tag_assignments a
        WHERE a.assigned_at >= ${since30Iso}
        GROUP BY day
        ORDER BY day ASC
      `),
      // Tag × category cross-tab — top 3 tags per category.
      db.execute(sql`
        SELECT
          tk.category AS category,
          tt.id::text AS tag_id,
          tt.name AS tag_name,
          tt.color AS tag_color,
          COUNT(*)::int AS count
        FROM ticket_tag_assignments a
        INNER JOIN ${tickets} tk ON tk.id = a.ticket_id
        INNER JOIN ticket_tags tt ON tt.id = a.tag_id
        GROUP BY tk.category, tt.id, tt.name, tt.color
        ORDER BY tk.category ASC, count DESC
      `),
      db
        .select({
          total: count(),
          archived: sql<number>`COUNT(*) FILTER (WHERE ${ticketTags.archivedAt} IS NOT NULL)::int`,
        })
        .from(ticketTags),
    ]);

    // Reshape byCategory raw rows into { category, tags[] } — keep
    // only the top three tags per category to keep the surface tight.
    const byCategoryMap = new Map<
      string,
      { tagId: string; name: string; color: string; count: number }[]
    >();
    for (const row of byCategoryRaw.rows as any[]) {
      const list = byCategoryMap.get(row.category) || [];
      if (list.length < 3) {
        list.push({
          tagId: String(row.tag_id),
          name: String(row.tag_name),
          color: String(row.tag_color),
          count: Number(row.count),
        });
        byCategoryMap.set(row.category, list);
      }
    }

    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, tags]) => ({ category, tags }))
      .sort((a, b) => a.category.localeCompare(b.category));

    const trend = (trendRows.rows as any[]).map((r) => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      count: Number(r.count),
    }));

    return {
      totalTags: Number(totals?.total || 0),
      archivedTags: Number(totals?.archived || 0),
      topTags: topTags.map((r) => ({
        tagId: r.tagId,
        name: r.name,
        color: r.color,
        archived: r.archivedAt !== null,
        usageCount: Number(r.usageCount),
        last30Count: Number(r.last30Count),
        resolvedCount: Number(r.resolvedCount),
      })),
      trend,
      byCategory,
    };
  }

  async getTicketTags(ticketId: string) {
    return db
      .select({
        id: ticketTags.id,
        name: ticketTags.name,
        color: ticketTags.color,
      })
      .from(ticketTagAssignments)
      .innerJoin(
        ticketTags,
        eq(ticketTagAssignments.tagId, ticketTags.id),
      )
      .where(eq(ticketTagAssignments.ticketId, ticketId))
      .orderBy(asc(ticketTags.name));
  }

  // ─── Audit log helper ──────────────────────────────────
  //
  // Wraps the generic audit_logs table for ticket-scoped events. Used
  // by the merge, transfer, and tag flows so the support audit trail
  // is queryable from a single table regardless of which mutation
  // touched the row.
  async logTicketAudit(
    action: string,
    ticketId: string,
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string | null,
  ) {
    try {
      await db.insert(auditLogs).values({
        entityType: 'ticket',
        entityId: ticketId,
        action,
        performedBy: userId,
        metadata: metadata ?? null,
        ipAddress: ipAddress ?? null,
      });
    } catch (err) {
      // Audit failures should never block a primary action. They get
      // logged so ops can spot a pattern of dropped audit writes.
      this.logger.warn(
        `Audit log failed for ticket ${ticketId}/${action}: ${err}`,
      );
    }
  }

  async getTicketAuditLog(ticketId: string, limit = 100) {
    return db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        performedBy: auditLogs.performedBy,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        performerEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(
        and(
          eq(auditLogs.entityType, 'ticket'),
          eq(auditLogs.entityId, ticketId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 500));
  }

  // ─── Merge ────────────────────────────────────────────
  //
  // Combines two tickets from the same customer into one. The source
  // becomes a closed shell that points to the target; the target
  // inherits replies + tags. We deliberately keep the source row
  // (rather than hard-deleting) so the audit trail covers what was
  // merged and supervisors can refund or revert if needed.
  // List tickets the source could be merged INTO. The supervisor UI
  // calls this to populate the merge dropdown, so there's no need to
  // paste UUIDs anymore. Rules mirror `mergeTicket`'s validation:
  //   • same customer (studentId, or guest email for guests)
  //   • same category (we don't merge cross-category in this product)
  //   • open status (NEW / IN_PROGRESS / ON_HOLD)
  //   • not already merged into something else
  //   • not the source itself
  // Ordered newest-first; capped at 20 entries to keep the dropdown
  // usable.
  async getMergeCandidates(sourceId: string) {
    const [source] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        guestEmail: tickets.guestEmail,
        category: tickets.category,
        status: tickets.status,
        mergedIntoTicketId: tickets.mergedIntoTicketId,
      })
      .from(tickets)
      .where(eq(tickets.id, sourceId));
    if (!source) throw new NotFoundException('Ticket not found');

    if (source.mergedIntoTicketId) {
      return [];
    }
    if (
      source.status === TICKET_STATUS.RESOLVED ||
      source.status === TICKET_STATUS.CLOSED
    ) {
      return [];
    }

    const baseConditions = [
      eq(tickets.category, source.category),
      eq(tickets.studentId, source.studentId),
      inArray(tickets.status, [
        TICKET_STATUS.NEW,
        TICKET_STATUS.IN_PROGRESS,
        TICKET_STATUS.ON_HOLD,
      ]),
      sql`${tickets.mergedIntoTicketId} IS NULL`,
      sql`${tickets.id} <> ${sourceId}`,
    ];

    // Guests share the studentId sentinel — narrow further by email
    // so two unrelated guests don't bleed together.
    if (source.studentId === GUEST_USER_ID) {
      baseConditions.push(
        sql`LOWER(${tickets.guestEmail}) = LOWER(${source.guestEmail || ''})`,
      );
    }

    return db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(and(...baseConditions))
      .orderBy(desc(tickets.createdAt))
      .limit(20);
  }

  // ─── Requester snapshot for a ticket ───────────────────────
  //
  // Resolves the ticket's requester + source role, enforces the
  // same access checks as getTicketDetail, then dispatches to a
  // role-specific composer. The right-rail snapshot card on the
  // support side branches on `role` to render the appropriate
  // KPIs — student stats for student-raised tickets, teaching
  // stats for instructor-raised tickets, etc. Prevents bleed
  // across roles when a user holds more than one (e.g.
  // instructor + manager + TA).
  async getStudentSnapshotForTicket(user: AuthenticatedUser, ticketId: string) {
    const [ticket] = await db
      .select({
        studentId: tickets.studentId,
        assigneeId: tickets.assigneeId,
        source: tickets.source,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    if (!ticket.studentId || ticket.studentId === GUEST_USER_ID) {
      return { isGuest: true as const, role: 'guest' as const, snapshot: null };
    }

    // Map ticket source → requester role. Intervention tickets are
    // filed by instructors about students, so the requester role
    // there is 'instructor'.
    const source = ticket.source || 'student';
    const role: 'student' | 'instructor' | 'manager' | 'ta' | 'finance' =
      source === 'instructor' || source === 'intervention'
        ? 'instructor'
        : source === 'course_manager'
          ? 'manager'
          : source === 'ta'
            ? 'ta'
            : source === 'finance'
              ? 'finance'
              : 'student';

    if (role === 'instructor') {
      const snapshot = await this.getInstructorSnapshot(ticket.studentId);
      return { isGuest: false as const, role, snapshot };
    }
    if (role === 'manager') {
      const snapshot = await this.getManagerSnapshot(ticket.studentId);
      return { isGuest: false as const, role, snapshot };
    }
    if (role === 'ta') {
      const snapshot = await this.getTaSnapshot(ticket.studentId);
      return { isGuest: false as const, role, snapshot };
    }
    if (role === 'finance') {
      const snapshot = await this.getFinanceSnapshot(ticket.studentId);
      return { isGuest: false as const, role, snapshot };
    }

    const snapshot = await this.getStudentSnapshot(ticket.studentId);
    return { isGuest: false as const, role, snapshot };
  }

  // ─── Role-specific snapshot composers ──────────────────────
  //
  // Each composer returns a tight KPI rollup for the requester's
  // role from a single ticket source. Kept narrow and parallel
  // so the right rail loads in one round trip per role.

  async getInstructorSnapshot(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [taughtCourseRows, sessionRows, interventionRows] = await Promise.all([
      db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.instructorId, userId)),

      db
        .select({
          id: sessions.id,
          scheduledAt: sessions.scheduledAt,
          status: sessions.status,
        })
        .from(sessions)
        .where(eq(sessions.instructorId, userId)),

      db
        .select({
          id: interventions.id,
          type: interventions.type,
          createdAt: interventions.createdAt,
        })
        .from(interventions)
        .where(eq(interventions.instructorId, userId)),
    ]);

    const courseIds = taughtCourseRows.map((c) => c.id);
    let studentCount = 0;
    if (courseIds.length > 0) {
      const [{ value }] = await db
        .select({
          value: sql<number>`count(distinct ${enrollments.studentId})::int`,
        })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds));
      studentCount = Number(value) || 0;
    }

    const sessionsThisMonth = sessionRows.filter(
      (s) => s.scheduledAt && new Date(s.scheduledAt) >= monthStart,
    ).length;

    const interventionsFiled = interventionRows.length;
    const interventionsThisMonth = interventionRows.filter(
      (i) => i.createdAt && new Date(i.createdAt) >= monthStart,
    ).length;

    return {
      courses: { teaching: courseIds.length },
      students: { total: studentCount },
      sessions: {
        total: sessionRows.length,
        thisMonth: sessionsThisMonth,
      },
      interventions: {
        total: interventionsFiled,
        thisMonth: interventionsThisMonth,
      },
    };
  }

  async getManagerSnapshot(userId: string) {
    const managedRows = await db
      .select({
        id: courses.id,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.managerId, userId));

    const courseIds = managedRows.map((r) => r.id);
    const instructorIds = new Set(
      managedRows.map((r) => r.instructorId).filter(Boolean) as string[],
    );

    let studentCount = 0;
    if (courseIds.length > 0) {
      const [{ value }] = await db
        .select({
          value: sql<number>`count(distinct ${enrollments.studentId})::int`,
        })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds));
      studentCount = Number(value) || 0;
    }

    return {
      courses: { managed: courseIds.length },
      instructors: { count: instructorIds.size },
      students: { total: studentCount },
    };
  }

  async getTaSnapshot(userId: string) {
    const assistingRows = await db
      .select({ courseId: courseAssistants.courseId })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.userId, userId),
          eq(courseAssistants.status, 'approved'),
        ),
      );

    const courseIds = assistingRows.map((r) => r.courseId);
    let sessionTotal = 0;
    let sessionsThisMonth = 0;
    if (courseIds.length > 0) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const sessionRows = await db
        .select({
          id: sessions.id,
          scheduledAt: sessions.scheduledAt,
        })
        .from(sessions)
        .where(inArray(sessions.courseId, courseIds));
      sessionTotal = sessionRows.length;
      sessionsThisMonth = sessionRows.filter(
        (s) => s.scheduledAt && new Date(s.scheduledAt) >= monthStart,
      ).length;
    }

    return {
      courses: { assisting: courseIds.length },
      sessions: { total: sessionTotal, thisMonth: sessionsThisMonth },
    };
  }

  async getFinanceSnapshot(userId: string) {
    // Finance staff don't accrue per-user academic stats. The card
    // is intentionally lean — identity + ticket activity is enough
    // context for the agent.
    const [{ value: totalTickets }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.studentId, userId));

    return {
      tickets: { raised: Number(totalTickets) || 0 },
    };
  }

  // Reusable primitive — aggregates a profile snapshot for any
  // student id. Six queries in parallel; all touched columns are
  // indexed. ~5–15ms typical on a modest dataset.
  async getStudentSnapshot(studentId: string) {
    if (!studentId || studentId === GUEST_USER_ID) {
      throw new NotFoundException('No student linked to this ticket');
    }

    const [enrollmentRows, webinarRows, attendanceRows, certRows, cmeRows, paymentRows] =
      await Promise.all([
        db
          .select({ status: enrollments.status })
          .from(enrollments)
          .where(eq(enrollments.studentId, studentId)),

        db
          .select({
            attended: webinarRegistrations.attended,
            scheduledAt: sessions.scheduledAt,
            sessionStatus: sessions.status,
          })
          .from(webinarRegistrations)
          .innerJoin(sessions, eq(webinarRegistrations.sessionId, sessions.id))
          .where(eq(webinarRegistrations.userId, studentId)),

        db
          .select({ status: attendance.status })
          .from(attendance)
          .where(eq(attendance.studentId, studentId)),

        db
          .select({ status: certificateRequests.status })
          .from(certificateRequests)
          .where(eq(certificateRequests.studentId, studentId)),

        // Single query covers both "earned" (cert approved) and
        // "pending" (course completed but cert not approved yet).
        db
          .select({
            cmeHours: courses.cmeHours,
            certStatus: certificateRequests.status,
            enrollmentStatus: enrollments.status,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .leftJoin(
            certificateRequests,
            and(
              eq(certificateRequests.courseId, enrollments.courseId),
              eq(certificateRequests.studentId, enrollments.studentId),
            ),
          )
          .where(
            and(
              eq(enrollments.studentId, studentId),
              eq(courses.isCmeAccredited, true),
              sql`${courses.cmeHours} > 0`,
            ),
          ),

        db
          .select({
            status: payments.status,
            amount: payments.amount,
            currency: payments.currency,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(eq(payments.userId, studentId))
          .orderBy(desc(payments.createdAt)),
      ]);

    // Courses — only count "real" enrollments (drop suspended/dropped
    // from the headline; they're not actionable for support).
    const activeCourses = enrollmentRows.filter((r) => r.status === 'active').length;
    const completedCourses = enrollmentRows.filter((r) => r.status === 'completed').length;
    const totalCourses = activeCourses + completedCourses;

    // Webinars — total registered, attended count, upcoming count.
    const now = new Date();
    const totalWebinars = webinarRows.length;
    const attendedWebinars = webinarRows.filter((r) => r.attended).length;
    const upcomingWebinars = webinarRows.filter(
      (r) =>
        r.scheduledAt &&
        new Date(r.scheduledAt) > now &&
        (r.sessionStatus === 'scheduled' || r.sessionStatus === 'live'),
    ).length;

    // Attendance — (present + late) / total. Excused counts neither
    // for nor against (matches the policy used in CME eligibility).
    const totalAttendanceRecords = attendanceRows.length;
    const consideredAttendance = attendanceRows.filter(
      (r) => r.status !== 'excused',
    );
    const presentCount = consideredAttendance.filter(
      (r) => r.status === 'present' || r.status === 'late',
    ).length;
    const attendancePct =
      consideredAttendance.length > 0
        ? Math.round((presentCount / consideredAttendance.length) * 100)
        : null;

    // Certificates
    const certsIssued = certRows.filter((r) => r.status === 'approved').length;
    const certsPending = certRows.filter((r) => r.status === 'pending').length;
    const certsRevoked = certRows.filter((r) => r.status === 'revoked').length;

    // CME — earned = cert approved; pending = course completed but cert
    // not approved. Don't double-count; a row contributes to exactly one
    // bucket based on its certStatus.
    let cmeEarned = 0;
    let cmePending = 0;
    for (const row of cmeRows) {
      const hours = Number(row.cmeHours ?? 0);
      if (row.certStatus === 'approved') {
        cmeEarned += hours;
      } else if (row.enrollmentStatus === 'completed') {
        cmePending += hours;
      }
    }

    // Payments — total spent (completed SAR only), pending/failed counts
    // for amber/red signals, last payment date for context.
    let totalPaidSar = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let refundedCount = 0;
    for (const p of paymentRows) {
      if (p.status === 'completed' && p.currency === 'SAR') {
        totalPaidSar += Number(p.amount ?? 0);
        completedCount += 1;
      } else if (p.status === 'pending') {
        pendingCount += 1;
      } else if (p.status === 'failed') {
        failedCount += 1;
      } else if (p.status === 'refunded') {
        refundedCount += 1;
      }
    }
    const lastPaymentAt = paymentRows[0]?.createdAt ?? null;

    return {
      courses: {
        total: totalCourses,
        active: activeCourses,
        completed: completedCourses,
      },
      webinars: {
        total: totalWebinars,
        attended: attendedWebinars,
        upcoming: upcomingWebinars,
      },
      attendance: {
        percent: attendancePct,
        sessionCount: totalAttendanceRecords,
      },
      certificates: {
        issued: certsIssued,
        pending: certsPending,
        revoked: certsRevoked,
      },
      cme: {
        earned: cmeEarned,
        pending: cmePending,
      },
      payments: {
        totalPaidSar,
        completedCount,
        pendingCount,
        failedCount,
        refundedCount,
        lastPaymentAt,
      },
    };
  }

  // ─── Trainer application for a ticket (Amna R3 — Jun 2026) ─────
  //
  // Surfaces the applicant's role_request + event timeline + missing
  // requirements on the ticket-detail card. The card hides itself
  // when there's no match. RBAC mirrors getStudentSnapshotForTicket:
  // assignee, supervisor, or admin only — same rule for guest
  // tickets (where the match is by guestEmail rather than studentId).
  async getTrainerApplicationForTicket(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const [ticket] = await db
      .select({
        studentId: tickets.studentId,
        assigneeId: tickets.assigneeId,
        guestEmail: tickets.guestEmail,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    // Resolve the applicant email. Logged-in tickets look up the
    // student row; guest tickets carry the applicant email directly.
    let applicantEmail: string | null = null;
    if (ticket.studentId && ticket.studentId !== GUEST_USER_ID) {
      const [studentRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ticket.studentId))
        .limit(1);
      applicantEmail = studentRow?.email ?? null;
    } else if (ticket.guestEmail) {
      applicantEmail = ticket.guestEmail;
    }

    if (!applicantEmail) {
      return { application: null, events: [] };
    }

    const matched = await this.roleRequestsService.findMostRecentByEmail(
      applicantEmail,
    );
    if (!matched) {
      return { application: null, events: [] };
    }

    const events = await this.roleRequestsService.getEvents(matched.id);
    return { application: matched, events };
  }

  // ─── Per-course certificate & CME detail (Amna R2 — Jun 2026) ──
  //
  // The student-wide snapshot answers "how many certs / how much CME?";
  // this method answers "for course X, why isn't the cert issued?". Used
  // by the cert/CME panel on the ticket-detail right rail. One row per
  // course the student is enrolled in, with the cached eligibility
  // fields from certificate_requests when one exists. RBAC mirrors
  // getStudentSnapshotForTicket so the panel is gated to assignees +
  // supervisors + admins.
  async getCertificateDetailsForTicket(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const [ticket] = await db
      .select({
        studentId: tickets.studentId,
        assigneeId: tickets.assigneeId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    if (!ticket.studentId || ticket.studentId === GUEST_USER_ID) {
      return { isGuest: true as const, details: null };
    }

    // One query: every enrollment with its course meta + (optional) cert
    // request. LEFT JOIN keeps enrollments that haven't generated a
    // request yet — those render as "Not yet requested".
    const rows = await db
      .select({
        courseId: enrollments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        deliveryType: courses.deliveryType,
        cmeHours: courses.cmeHours,
        isCmeAccredited: courses.isCmeAccredited,
        enrollmentStatus: enrollments.status,
        certId: certificateRequests.id,
        certStatus: certificateRequests.status,
        certAttendancePercent: certificateRequests.attendancePercent,
        certAssessmentPassed: certificateRequests.assessmentPassed,
        certCourseCompleted: certificateRequests.courseCompleted,
        certApprovedAt: certificateRequests.approvedAt,
        certReviewedAt: certificateRequests.reviewedAt,
        certRevokedAt: certificateRequests.revokedAt,
        certRejectedAt: certificateRequests.rejectedAt,
        certificateUrl: certificateRequests.certificateUrl,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(
        certificateRequests,
        and(
          eq(certificateRequests.courseId, enrollments.courseId),
          eq(certificateRequests.studentId, ticket.studentId),
        ),
      )
      .where(eq(enrollments.studentId, ticket.studentId))
      .orderBy(desc(enrollments.enrolledAt));

    // Eligibility threshold — kept in sync with the certs module
    // (default for non-self-paced courses). When the threshold changes
    // in product, surface a TODO here and update both spots.
    const ATTENDANCE_THRESHOLD = 75;

    const details = rows.map((r) => {
      const attendancePct =
        r.certAttendancePercent == null
          ? null
          : Number(r.certAttendancePercent);

      // Eligibility traffic light — derived, not stored. Logic:
      //   approved      → eligible (cert issued)
      //   rejected      → ineligible
      //   revoked       → revoked (treat as ineligible for the badge)
      //   pending/held  → check the three component fields
      //   no request    → not yet requested
      let eligibility:
        | 'eligible'
        | 'partial'
        | 'ineligible'
        | 'revoked'
        | 'not_requested';
      const isSelfPaced = r.deliveryType === 'self-paced';

      if (r.certStatus === 'approved') {
        eligibility = 'eligible';
      } else if (r.certStatus === 'revoked') {
        eligibility = 'revoked';
      } else if (r.certStatus === 'rejected') {
        eligibility = 'ineligible';
      } else if (r.certStatus === 'pending' || r.certStatus === 'held') {
        // Pending — eligibility = three conditions all true. Self-paced
        // courses get a free pass on attendance.
        const attendanceOk =
          isSelfPaced ||
          (attendancePct != null && attendancePct >= ATTENDANCE_THRESHOLD);
        const assessmentOk = r.certAssessmentPassed === true;
        const completedOk = r.certCourseCompleted === true;
        const passed = attendanceOk && assessmentOk && completedOk;
        eligibility = passed ? 'eligible' : 'partial';
      } else {
        eligibility = 'not_requested';
      }

      // Assessment status — three states agents care about: passed,
      // failed, or not yet attempted. The cert request stores a single
      // bool; null means "no submission graded yet".
      const assessmentStatus: 'passed' | 'failed' | 'not_attempted' =
        r.certAssessmentPassed === true
          ? 'passed'
          : r.certAssessmentPassed === false
            ? 'failed'
            : 'not_attempted';

      // Issued date — prefer approvedAt (per-transition column added
      // May 2026), fall back to reviewedAt for legacy approvals that
      // pre-date the column.
      const issuedAt =
        r.certStatus === 'approved'
          ? (r.certApprovedAt ?? r.certReviewedAt ?? null)
          : null;

      return {
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseTitleAr: r.courseTitleAr,
        deliveryType: r.deliveryType,
        isCmeAccredited: !!r.isCmeAccredited,
        cmeHours: Number(r.cmeHours ?? 0),
        enrollmentStatus: r.enrollmentStatus,
        eligibility,
        attendancePercent: attendancePct,
        attendanceThreshold: ATTENDANCE_THRESHOLD,
        attendanceApplicable: !isSelfPaced,
        assessmentStatus,
        certificate: r.certId
          ? {
              id: r.certId,
              status: r.certStatus,
              issuedAt: issuedAt ? issuedAt.toISOString() : null,
              revokedAt: r.certRevokedAt
                ? r.certRevokedAt.toISOString()
                : null,
              rejectedAt: r.certRejectedAt
                ? r.certRejectedAt.toISOString()
                : null,
              // Verification code = short prefix of UUID (8 chars,
              // displayed uppercase). Matches what users see on the
              // PDF and the public verify page.
              verificationCode: r.certId.split('-')[0].toUpperCase(),
              certificateUrl: r.certificateUrl ?? null,
            }
          : null,
      };
    });

    return { isGuest: false as const, details };
  }

  // ─── Student timeline for a ticket ─────────────────────────
  //
  // Unified chronological feed of every meaningful event for the
  // ticket's student. Powers the "Recent activity" card in the
  // detail-view right rail. Five sources merged + sorted DESC:
  //
  //   1. Previous tickets (this student, excluding the current one)
  //   2. Course enrollments (status moot — the event is the join date)
  //   3. Webinar registrations (with attendance status badge)
  //   4. Payments (any status; chip colour distinguishes)
  //   5. Certificate issuances (only `approved` rows — those are the
  //      meaningful event; pending/held rows are noise)
  //
  // Caller is responsible for the RBAC + guest check; this method
  // is wrapped by getStudentTimelineForTicket below. Limit is hard
  // at 20 — the FE expects a tight feed, not a paginated log.
  async getStudentTimelineForTicket(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const [ticket] = await db
      .select({
        studentId: tickets.studentId,
        assigneeId: tickets.assigneeId,
        source: tickets.source,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
    }

    if (!ticket.studentId || ticket.studentId === GUEST_USER_ID) {
      return { isGuest: true as const, role: 'guest' as const, events: [] };
    }

    // Map source → requester role, mirroring the snapshot dispatcher.
    // Recent-activity events are filtered to what's meaningful for
    // that role so a multi-role user (e.g. instructor + manager)
    // doesn't see their instructor activity mixed into a ticket
    // raised from the manager dashboard.
    const source = ticket.source || 'student';
    const role: 'student' | 'instructor' | 'manager' | 'ta' | 'finance' =
      source === 'instructor' || source === 'intervention'
        ? 'instructor'
        : source === 'course_manager'
          ? 'manager'
          : source === 'ta'
            ? 'ta'
            : source === 'finance'
              ? 'finance'
              : 'student';

    if (role !== 'student') {
      const events = await this.getStaffTimeline(
        ticket.studentId,
        role,
        ticketId,
      );
      return { isGuest: false as const, role, events };
    }

    const studentId = ticket.studentId;

    const [
      ticketRows,
      enrollmentRows,
      webinarRows,
      paymentRows,
      certRows,
    ] = await Promise.all([
      // Previous tickets — exclude the current one so the agent
      // doesn't see a self-reference.
      db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          subject: tickets.subject,
          status: tickets.status,
          category: tickets.category,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.studentId, studentId),
            sql`${tickets.id} <> ${ticketId}`,
          ),
        )
        .orderBy(desc(tickets.createdAt))
        .limit(30),

      db
        .select({
          id: enrollments.id,
          status: enrollments.status,
          enrolledAt: enrollments.enrolledAt,
          courseId: courses.id,
          courseTitle: courses.title,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(enrollments.studentId, studentId))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(30),

      db
        .select({
          id: webinarRegistrations.id,
          createdAt: webinarRegistrations.createdAt,
          attended: webinarRegistrations.attended,
          scheduledAt: sessions.scheduledAt,
          sessionId: sessions.id,
          sessionTitle: sessions.title,
        })
        .from(webinarRegistrations)
        .innerJoin(sessions, eq(webinarRegistrations.sessionId, sessions.id))
        .where(eq(webinarRegistrations.userId, studentId))
        .orderBy(desc(webinarRegistrations.createdAt))
        .limit(30),

      db
        .select({
          id: payments.id,
          createdAt: payments.createdAt,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          courseTitle: courses.title,
        })
        .from(payments)
        .leftJoin(courses, eq(payments.courseId, courses.id))
        .where(eq(payments.userId, studentId))
        .orderBy(desc(payments.createdAt))
        .limit(30),

      // Only emit approved certs — pending / held / revoked are
      // tracked in the snapshot counters but aren't meaningful
      // "events" for the timeline.
      db
        .select({
          id: certificateRequests.id,
          approvedAt: certificateRequests.approvedAt,
          courseTitle: courses.title,
        })
        .from(certificateRequests)
        .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
        .where(
          and(
            eq(certificateRequests.studentId, studentId),
            eq(certificateRequests.status, 'approved'),
            isNotNull(certificateRequests.approvedAt),
          ),
        )
        .orderBy(desc(certificateRequests.approvedAt))
        .limit(30),
    ]);

    type TimelineEvent = {
      type: 'ticket' | 'enrollment' | 'webinar' | 'payment' | 'certificate';
      timestamp: Date;
      title: string;
      subtitle: string | null;
      status: string | null;
      linkTarget: { kind: 'ticket'; ticketId: string } | null;
    };

    const events: TimelineEvent[] = [];

    for (const t of ticketRows) {
      if (!t.createdAt) continue;
      events.push({
        type: 'ticket',
        timestamp: new Date(t.createdAt),
        title: t.subject || '(no subject)',
        subtitle: `${t.referenceNumber} · ${t.category}`,
        status: t.status,
        linkTarget: { kind: 'ticket', ticketId: t.id },
      });
    }

    for (const e of enrollmentRows) {
      if (!e.enrolledAt) continue;
      events.push({
        type: 'enrollment',
        timestamp: new Date(e.enrolledAt),
        title: e.courseTitle,
        subtitle: null,
        status: e.status,
        linkTarget: null,
      });
    }

    for (const w of webinarRows) {
      if (!w.createdAt) continue;
      let status = 'registered';
      if (w.attended) {
        status = 'attended';
      } else if (w.scheduledAt && new Date(w.scheduledAt) > new Date()) {
        status = 'upcoming';
      } else if (w.scheduledAt && new Date(w.scheduledAt) < new Date()) {
        status = 'missed';
      }
      events.push({
        type: 'webinar',
        timestamp: new Date(w.createdAt),
        title: w.sessionTitle,
        subtitle: null,
        status,
        linkTarget: null,
      });
    }

    for (const p of paymentRows) {
      if (!p.createdAt) continue;
      const amount = Number(p.amount ?? 0);
      const currency = p.currency || 'SAR';
      events.push({
        type: 'payment',
        timestamp: new Date(p.createdAt),
        title: amount > 0 ? `${amount.toFixed(2)} ${currency}` : currency,
        subtitle: p.courseTitle ?? null,
        status: p.status,
        linkTarget: null,
      });
    }

    for (const c of certRows) {
      if (!c.approvedAt) continue;
      events.push({
        type: 'certificate',
        timestamp: new Date(c.approvedAt),
        title: c.courseTitle,
        subtitle: null,
        status: 'issued',
        linkTarget: null,
      });
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      isGuest: false as const,
      role: 'student' as const,
      events: events.slice(0, 20),
    };
  }

  // ─── Staff timeline ────────────────────────────────────────
  //
  // Builds the right-rail "recent activity" feed for non-student
  // requesters. Each role surfaces a different mix of events so
  // a multi-role user (e.g. instructor + manager) does not see
  // cross-role activity bleed into a ticket they raised from one
  // dashboard. Scope:
  //
  //   instructor → tickets raised, sessions conducted, interventions filed
  //   manager    → tickets raised, courses they manage (created/updated), instructor changes
  //   ta         → tickets raised, sessions in courses they assist
  //   finance    → tickets raised only (no academic activity)
  //
  // Caller passes the current ticket id so it can be excluded from
  // the "previous tickets" list — same convention as the student
  // timeline.
  private async getStaffTimeline(
    userId: string,
    role: 'instructor' | 'manager' | 'ta' | 'finance',
    currentTicketId: string,
  ) {
    type TimelineEvent = {
      type:
        | 'ticket'
        | 'session'
        | 'intervention'
        | 'course_managed'
        | 'ta_assignment';
      timestamp: Date;
      title: string;
      subtitle: string | null;
      status: string | null;
      linkTarget: { kind: 'ticket'; ticketId: string } | null;
    };

    const events: TimelineEvent[] = [];

    // Every staff role gets their own ticket history first — that
    // is the most relevant context for the agent triaging.
    const ticketRows = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        status: tickets.status,
        category: tickets.category,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.studentId, userId),
          sql`${tickets.id} <> ${currentTicketId}`,
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(30);

    for (const t of ticketRows) {
      if (!t.createdAt) continue;
      events.push({
        type: 'ticket',
        timestamp: new Date(t.createdAt),
        title: t.subject || '(no subject)',
        subtitle: `${t.referenceNumber} · ${t.category}`,
        status: t.status,
        linkTarget: { kind: 'ticket', ticketId: t.id },
      });
    }

    if (role === 'instructor') {
      const [sessionRows, interventionRows] = await Promise.all([
        db
          .select({
            id: sessions.id,
            scheduledAt: sessions.scheduledAt,
            status: sessions.status,
            title: sessions.title,
          })
          .from(sessions)
          .where(eq(sessions.instructorId, userId))
          .orderBy(desc(sessions.scheduledAt))
          .limit(30),

        db
          .select({
            id: interventions.id,
            type: interventions.type,
            createdAt: interventions.createdAt,
          })
          .from(interventions)
          .where(eq(interventions.instructorId, userId))
          .orderBy(desc(interventions.createdAt))
          .limit(30),
      ]);

      for (const s of sessionRows) {
        if (!s.scheduledAt) continue;
        events.push({
          type: 'session',
          timestamp: new Date(s.scheduledAt),
          title: s.title || 'Session',
          subtitle: null,
          status: s.status,
          linkTarget: null,
        });
      }

      for (const i of interventionRows) {
        if (!i.createdAt) continue;
        events.push({
          type: 'intervention',
          timestamp: new Date(i.createdAt),
          title: i.type,
          subtitle: null,
          status: null,
          linkTarget: null,
        });
      }
    } else if (role === 'manager') {
      const managedRows = await db
        .select({
          id: courses.id,
          title: courses.title,
          createdAt: courses.createdAt,
        })
        .from(courses)
        .where(eq(courses.managerId, userId))
        .orderBy(desc(courses.createdAt))
        .limit(20);

      for (const c of managedRows) {
        if (!c.createdAt) continue;
        events.push({
          type: 'course_managed',
          timestamp: new Date(c.createdAt),
          title: c.title,
          subtitle: null,
          status: 'managed',
          linkTarget: null,
        });
      }
    } else if (role === 'ta') {
      const assignmentRows = await db
        .select({
          id: courseAssistants.id,
          assignedAt: courseAssistants.assignedAt,
          status: courseAssistants.status,
          courseTitle: courses.title,
        })
        .from(courseAssistants)
        .innerJoin(courses, eq(courseAssistants.courseId, courses.id))
        .where(eq(courseAssistants.userId, userId))
        .orderBy(desc(courseAssistants.assignedAt))
        .limit(20);

      for (const a of assignmentRows) {
        if (!a.assignedAt) continue;
        events.push({
          type: 'ta_assignment',
          timestamp: new Date(a.assignedAt),
          title: a.courseTitle,
          subtitle: null,
          status: a.status,
          linkTarget: null,
        });
      }
    }
    // finance: tickets only — nothing to append.

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return events.slice(0, 20);
  }

  async mergeTicket(
    user: AuthenticatedUser,
    sourceId: string,
    targetId: string,
    note?: string,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('Source and target must differ');
    }

    const [source] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        guestEmail: tickets.guestEmail,
        subject: tickets.subject,
        status: tickets.status,
        mergedIntoTicketId: tickets.mergedIntoTicketId,
      })
      .from(tickets)
      .where(eq(tickets.id, sourceId));
    if (!source) throw new NotFoundException('Source ticket not found');

    const [target] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        studentId: tickets.studentId,
        guestEmail: tickets.guestEmail,
        status: tickets.status,
      })
      .from(tickets)
      .where(eq(tickets.id, targetId));
    if (!target) throw new NotFoundException('Target ticket not found');

    if (source.mergedIntoTicketId) {
      throw new BadRequestException(
        'Source ticket is already merged into another ticket',
      );
    }

    // Same-customer rule. Guests are matched by email (case-insensitive)
    // because the studentId is the shared sentinel.
    const sameCustomer =
      source.studentId === target.studentId &&
      (source.studentId !== GUEST_USER_ID ||
        (source.guestEmail || '').toLowerCase() ===
          (target.guestEmail || '').toLowerCase());
    if (!sameCustomer) {
      throw new BadRequestException(
        'Cannot merge tickets from different customers',
      );
    }

    await db.transaction(async (tx) => {
      // Move replies. The target gets the full union sorted by
      // createdAt at read time — no need to renumber.
      await tx
        .update(ticketReplies)
        .set({ ticketId: targetId })
        .where(eq(ticketReplies.ticketId, sourceId));

      // Move tag assignments. (target, tag) is the natural key; we
      // delete any duplicates on the source side first so we don't
      // hit the PK on insert.
      const existingOnTarget = await tx
        .select({ tagId: ticketTagAssignments.tagId })
        .from(ticketTagAssignments)
        .where(eq(ticketTagAssignments.ticketId, targetId));
      const targetTagSet = new Set(existingOnTarget.map((r) => r.tagId));

      const sourceTags = await tx
        .select({ tagId: ticketTagAssignments.tagId })
        .from(ticketTagAssignments)
        .where(eq(ticketTagAssignments.ticketId, sourceId));

      await tx
        .delete(ticketTagAssignments)
        .where(eq(ticketTagAssignments.ticketId, sourceId));

      const newTagRows = sourceTags
        .filter((r) => !targetTagSet.has(r.tagId))
        .map((r) => ({
          ticketId: targetId,
          tagId: r.tagId,
          assignedBy: user.id,
        }));
      if (newTagRows.length > 0) {
        await tx.insert(ticketTagAssignments).values(newTagRows);
      }

      // Drop a system-style internal note on the target so future
      // viewers see what was folded in.
      const mergeNote = [
        `Ticket ${source.referenceNumber} ("${source.subject}") was merged into this ticket.`,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      await tx.insert(ticketReplies).values({
        ticketId: targetId,
        userId: user.id,
        message: mergeNote,
        isStaffReply: true,
        isInternal: true,
      });

      // Lock the source.
      await tx
        .update(tickets)
        .set({
          status: TICKET_STATUS.CLOSED,
          closedAt: new Date(),
          updatedAt: new Date(),
          mergedIntoTicketId: targetId,
        })
        .where(eq(tickets.id, sourceId));

      // Touch the target's updatedAt so it floats to the top of the
      // queue and supervisors see the merge land.
      await tx
        .update(tickets)
        .set({ updatedAt: new Date() })
        .where(eq(tickets.id, targetId));
    });

    await this.logTicketAudit('merged', sourceId, user.id, {
      targetTicketId: targetId,
      targetReference: target.referenceNumber,
      note: note || null,
    });
    await this.logTicketAudit('merge_received', targetId, user.id, {
      sourceTicketId: sourceId,
      sourceReference: source.referenceNumber,
    });

    return { success: true, targetTicketId: targetId };
  }

  // ─── Attachment download log ──────────────────────────
  //
  // Recorded by the FE when a staff member clicks the attachment chip.
  // Best-effort — failed inserts don't block the download.
  async recordAttachmentDownload(
    user: AuthenticatedUser,
    ticketId: string,
    attachmentUrl: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ) {
    // Reuse the existing access check so an unassigned agent can't
    // log themselves as downloading a ticket they couldn't read.
    await this.assertAgentOwnership(user, ticketId);
    try {
      await db.insert(attachmentDownloadEvents).values({
        ticketId,
        attachmentUrl: attachmentUrl.slice(0, 500),
        downloadedBy: user.id,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      });
    } catch (err) {
      this.logger.warn(`Attachment download log failed: ${err}`);
    }
    return { success: true };
  }

  async getAttachmentDownloadLog(ticketId: string, limit = 100) {
    return db
      .select({
        id: attachmentDownloadEvents.id,
        attachmentUrl: attachmentDownloadEvents.attachmentUrl,
        downloadedAt: attachmentDownloadEvents.downloadedAt,
        ipAddress: attachmentDownloadEvents.ipAddress,
        downloaderFirstName: users.firstName,
        downloaderLastName: users.lastName,
        downloaderEmail: users.email,
      })
      .from(attachmentDownloadEvents)
      .leftJoin(users, eq(attachmentDownloadEvents.downloadedBy, users.id))
      .where(eq(attachmentDownloadEvents.ticketId, ticketId))
      .orderBy(desc(attachmentDownloadEvents.downloadedAt))
      .limit(Math.min(Math.max(limit, 1), 500));
  }

  // ─── Attachment scan ──────────────────────────────────
  //
  // Pluggable scanner integration. Today we just record a 'pending'
  // row on ticket create; the actual scan is meant to run async via
  // a real scanner (Cloud Storage scanning, ClamAV pod, third-party).
  // Whoever wires that scanner can write back to the same row.
  async recordAttachmentScanPending(
    ticketId: string,
    attachmentUrl: string,
  ) {
    if (!attachmentUrl) return;
    try {
      await db
        .insert(ticketAttachmentScans)
        .values({
          ticketId,
          attachmentUrl: attachmentUrl.slice(0, 500),
          status: 'pending',
          scanner: process.env.ATTACHMENT_SCANNER_NAME || 'none',
        })
        .onConflictDoNothing();
    } catch (err) {
      this.logger.warn(`Attachment scan record failed: ${err}`);
    }
  }

  async getAttachmentScanStatus(ticketId: string, attachmentUrl: string) {
    const [row] = await db
      .select({
        status: ticketAttachmentScans.status,
        details: ticketAttachmentScans.details,
        scanner: ticketAttachmentScans.scanner,
        scannedAt: ticketAttachmentScans.scannedAt,
      })
      .from(ticketAttachmentScans)
      .where(
        and(
          eq(ticketAttachmentScans.ticketId, ticketId),
          eq(ticketAttachmentScans.attachmentUrl, attachmentUrl),
        ),
      );
    return row || null;
  }

  // ─── Retention policy ─────────────────────────────────
  //
  // The actual purge is implemented as a stub today: when retention
  // is enabled (days > 0) we LOG which tickets would be purged but
  // don't delete. Hard-deleting a ticket loses learner history that
  // legal might still need; the deferred enforcement gives Amna a
  // policy hook to flip on after she's confirmed the rules with
  // compliance. Wire enforcement by replacing the log with a delete
  // / archive write inside getRetentionCandidates().

  async getRetentionDays(): Promise<number> {
    try {
      const [row] = await db
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'ticket_retention_days'));
      const n = Number((row?.value as any)?.days);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  async setRetentionDays(days: number) {
    const safeDays = Math.max(0, Math.floor(Number(days) || 0));
    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_retention_days',
        value: { days: safeDays },
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: { days: safeDays }, updatedAt: new Date() },
      });
    return { success: true, retentionDays: safeDays };
  }

  async getRetentionCandidates(): Promise<
    { id: string; referenceNumber: string; closedAt: Date | null }[]
  > {
    const days = await this.getRetentionDays();
    if (days <= 0) return [];
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, TICKET_STATUS.CLOSED),
          sql`${tickets.closedAt} IS NOT NULL`,
          sql`${tickets.closedAt} < ${cutoff}`,
        ),
      )
      .limit(500);
  }

  // ─── KB Search Analytics ───────────────────────────────
  //
  // Public surface logs every search submitted on the help center
  // (debounced on the FE to avoid one row per keystroke). Aggregated
  // analytics surface for admins so they can see (a) most-asked
  // questions, (b) zero-result queries that flag content gaps.

  async logKbSearch(input: {
    query: string;
    locale: string;
    resultsCount: number;
    userId?: string | null;
  }) {
    const cleaned = (input.query || '').trim().toLowerCase().slice(0, 200);
    if (!cleaned) return { success: true };

    // Locale defensive — fall back to 'en' if the client sends garbage.
    const locale = ['en', 'ar'].includes(input.locale) ? input.locale : 'en';

    await db.insert(kbSearchEvents).values({
      query: cleaned,
      locale,
      resultsCount: Math.max(0, Math.min(input.resultsCount || 0, 9999)),
      userId: input.userId ?? null,
    });
    return { success: true };
  }

  async getKbSearchAnalytics(dateFrom?: string, dateTo?: string, limit = 25) {
    const conditions: any[] = [];
    if (dateFrom)
      conditions.push(sql`${kbSearchEvents.searchedAt} >= ${new Date(dateFrom)}`);
    if (dateTo)
      conditions.push(sql`${kbSearchEvents.searchedAt} <= ${new Date(dateTo)}`);

    const where = conditions.length ? and(...conditions) : undefined;

    // Top queries — count occurrences and average results to spot
    // zero-result queries that consistently dead-end.
    const topQueries = await db
      .select({
        query: kbSearchEvents.query,
        locale: kbSearchEvents.locale,
        searches: count(),
        avgResults: sql<number>`avg(${kbSearchEvents.resultsCount})::float`,
        zeroResultCount: sql<number>`sum(case when ${kbSearchEvents.resultsCount} = 0 then 1 else 0 end)::int`,
      })
      .from(kbSearchEvents)
      .where(where)
      .groupBy(kbSearchEvents.query, kbSearchEvents.locale)
      .orderBy(desc(count()))
      .limit(Math.min(Math.max(limit, 1), 100));

    // Totals
    const [totals] = await db
      .select({
        total: count(),
        zeroResults: sql<number>`sum(case when ${kbSearchEvents.resultsCount} = 0 then 1 else 0 end)::int`,
      })
      .from(kbSearchEvents)
      .where(where);

    return {
      totalSearches: totals?.total ?? 0,
      zeroResultSearches: totals?.zeroResults ?? 0,
      zeroResultRate:
        totals?.total && totals.total > 0
          ? Math.round(((totals.zeroResults ?? 0) / totals.total) * 100)
          : 0,
      topQueries: topQueries.map((q) => ({
        query: q.query,
        locale: q.locale,
        searches: Number(q.searches),
        avgResults: q.avgResults ? Number(q.avgResults).toFixed(1) : '0.0',
        zeroResultCount: Number(q.zeroResultCount || 0),
      })),
    };
  }

  // ─── KB article performance ────────────────────────────────
  //
  // viewCount is a single all-time counter on kbArticles (no event
  // table behind it), so both reports below are inherently all-time.
  // The FE labels them as such — date-scoping would require a
  // separate kb_article_views events table, deliberately out of
  // scope for now.

  async getMostViewedKbArticles(opts?: { limit?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 10, 1), 50);
    return db
      .select({
        id: kbArticles.id,
        titleEn: kbArticles.titleEn,
        titleAr: kbArticles.titleAr,
        category: kbArticles.category,
        viewCount: kbArticles.viewCount,
        updatedAt: kbArticles.updatedAt,
      })
      .from(kbArticles)
      .where(eq(kbArticles.published, true))
      .orderBy(desc(kbArticles.viewCount))
      .limit(limit);
  }

  async getLowEngagementKbArticles(opts?: {
    limit?: number;
    minAgeDays?: number;
  }) {
    const limit = Math.min(Math.max(opts?.limit ?? 10, 1), 50);
    const minAgeDays = opts?.minAgeDays ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - minAgeDays);

    // Filter to published articles older than minAgeDays so brand-new
    // articles aren't unfairly flagged as "low engagement". Sort by
    // viewCount ascending so the worst offenders surface first.
    return db
      .select({
        id: kbArticles.id,
        titleEn: kbArticles.titleEn,
        titleAr: kbArticles.titleAr,
        category: kbArticles.category,
        viewCount: kbArticles.viewCount,
        createdAt: kbArticles.createdAt,
      })
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.published, true),
          lte(kbArticles.createdAt, cutoff),
        ),
      )
      .orderBy(asc(kbArticles.viewCount), desc(kbArticles.createdAt))
      .limit(limit);
  }

  // ──────────────────────────────────────────────────────────────────
  //  Phase 2 — Ticket Collaborators (hub-and-spoke internal collab)
  // ──────────────────────────────────────────────────────────────────

  /**
   * True when `userId` is an active collaborator on `ticketId`. Used by
   * getTicketDetail / addComment / replies fetch to admit collaborators
   * to the INTERNAL channel without giving them public-write or
   * status-change powers.
   */
  async isCollaborator(ticketId: string, userId: string): Promise<boolean> {
    if (!ticketId || !userId) return false;
    const [row] = await db
      .select({ id: ticketCollaborators.id })
      .from(ticketCollaborators)
      .where(
        and(
          eq(ticketCollaborators.ticketId, ticketId),
          eq(ticketCollaborators.userId, userId),
          isNull(ticketCollaborators.removedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  /**
   * Return the viewer's role on a specific ticket. Used to drive UI
   * (composer lock, banner, right-panel visibility) and access checks.
   * Precedence: support/admin > collaborator > requester > none.
   */
  async getViewerRoleOnTicket(
    user: AuthenticatedUser,
    ticket: { id: string; studentId: string },
  ): Promise<'support' | 'collaborator' | 'requester' | 'none'> {
    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (isSupportOrAdmin) return 'support';
    if (await this.isCollaborator(ticket.id, user.id)) return 'collaborator';
    if (ticket.studentId === user.id) return 'requester';
    return 'none';
  }

  /**
   * List active collaborators on a ticket for the FE detail panel.
   * Returns user info + department + added-by metadata. NOT filtered
   * here — caller (controller) decides whether to surface this to
   * the viewer (we hide it from requesters).
   */
  async listCollaborators(ticketId: string) {
    const addedByUser = alias(users, 'collab_added_by');
    const rows = await db
      .select({
        id: ticketCollaborators.id,
        userId: ticketCollaborators.userId,
        department: ticketCollaborators.department,
        addedAt: ticketCollaborators.addedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        addedById: ticketCollaborators.addedBy,
        addedByFirstName: addedByUser.firstName,
        addedByLastName: addedByUser.lastName,
      })
      .from(ticketCollaborators)
      .leftJoin(users, eq(ticketCollaborators.userId, users.id))
      .leftJoin(addedByUser, eq(ticketCollaborators.addedBy, addedByUser.id))
      .where(
        and(
          eq(ticketCollaborators.ticketId, ticketId),
          isNull(ticketCollaborators.removedAt),
        ),
      )
      .orderBy(asc(ticketCollaborators.addedAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      department: r.department,
      addedAt: r.addedAt,
      userName: [r.userFirstName, r.userLastName].filter(Boolean).join(' ').trim() || null,
      userEmail: r.userEmail,
      addedBy: r.addedById
        ? {
            id: r.addedById,
            name: [r.addedByFirstName, r.addedByLastName].filter(Boolean).join(' ').trim() || null,
          }
        : null,
    }));
  }

  /**
   * Loop in a department member as a collaborator on a ticket.
   *
   * Permission: only support/supervisor/admin can add collaborators.
   * Plain agents cannot loop in for tickets they aren't assigned to —
   * standard agent isolation applies.
   *
   * Idempotent: if a row already exists for (ticket, user), the
   * existing row is re-activated (removed_at = NULL) and added_by /
   * added_at are refreshed. This keeps the soft-delete audit clean
   * without growing the table on re-adds.
   *
   * Notifies the target user via email + in-app and emits an audit
   * entry. Returns the active row id.
   */
  async addCollaborator(
    actor: AuthenticatedUser,
    ticketId: string,
    dto: { userId: string; department: TicketCollabDepartment | string },
  ) {
    const isSupportOrAdmin =
      actor.roles.includes(ROLE_NAMES.SUPPORT) ||
      actor.roles.includes(ROLE_NAMES.ADMIN) ||
      actor.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupportOrAdmin) {
      throw new ForbiddenException('Only support staff can loop in collaborators');
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        assigneeId: tickets.assigneeId,
        studentId: tickets.studentId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Agent isolation: non-supervisor agents must be assigned to act.
    const isSupervisorOrAdmin =
      actor.supportSubRole === 'supervisor' ||
      actor.roles.includes(ROLE_NAMES.ADMIN) ||
      actor.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupervisorOrAdmin && ticket.assigneeId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this ticket');
    }

    // Validate department.
    const validDepts: string[] = Object.values(TICKET_COLLAB_DEPARTMENTS);
    if (!validDepts.includes(dto.department)) {
      throw new BadRequestException(`Unknown department: ${dto.department}`);
    }

    // Requester cannot be their own collaborator.
    if (dto.userId === ticket.studentId) {
      throw new BadRequestException(
        'The requester cannot be added as a collaborator',
      );
    }

    // Verify target exists and is active.
    const [target] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, dto.userId));
    if (!target) throw new NotFoundException('Target user not found');
    if (!target.isActive) {
      throw new BadRequestException('Target user is not active');
    }

    // Idempotent upsert — preserves the row across remove/re-add.
    const [existing] = await db
      .select({
        id: ticketCollaborators.id,
        removedAt: ticketCollaborators.removedAt,
      })
      .from(ticketCollaborators)
      .where(
        and(
          eq(ticketCollaborators.ticketId, ticketId),
          eq(ticketCollaborators.userId, dto.userId),
        ),
      )
      .limit(1);

    let rowId: string;
    if (existing) {
      // Active row: nothing to do.
      if (existing.removedAt === null) {
        return { id: existing.id, alreadyActive: true };
      }
      // Re-activate previously removed row.
      const [updated] = await db
        .update(ticketCollaborators)
        .set({
          removedAt: null,
          addedBy: actor.id,
          addedAt: new Date(),
          department: dto.department,
        })
        .where(eq(ticketCollaborators.id, existing.id))
        .returning({ id: ticketCollaborators.id });
      rowId = updated!.id;
    } else {
      const [inserted] = await db
        .insert(ticketCollaborators)
        .values({
          ticketId,
          userId: dto.userId,
          department: dto.department,
          addedBy: actor.id,
        })
        .returning({ id: ticketCollaborators.id });
      rowId = inserted!.id;
    }

    // Audit (IP captured via request-context middleware from Fix #10).
    try {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: 'collaborator_added',
        performedBy: actor.id,
        metadata: {
          ticketId,
          userId: dto.userId,
          department: dto.department,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to write collaborator_added audit: ${(e as Error).message}`);
    }

    // Notify the target (email + in-app). Best-effort — don't fail the
    // add if notify fails.
    const targetName =
      [target.firstName, target.lastName].filter(Boolean).join(' ').trim() ||
      target.email;
    try {
      await this.notificationsService.create({
        recipientId: dto.userId,
        type: 'ticket_looped_in',
        title: `You were looped into ticket ${ticket.referenceNumber}`,
        message: ticket.subject,
        link: `/dashboard/support/looped-in/${ticketId}`,
        entityType: 'ticket',
        entityId: ticketId,
      });
    } catch (e) {
      this.logger.warn(`Failed to write looped-in notification: ${(e as Error).message}`);
    }

    try {
      const emailSvc = this.emailService as unknown as {
        sendTicketLoopedIn?: (
          to: string,
          name: string,
          ref: string,
          subject: string,
        ) => Promise<unknown>;
      };
      if (target.email && typeof emailSvc.sendTicketLoopedIn === 'function') {
        await emailSvc.sendTicketLoopedIn(
          target.email,
          targetName,
          ticket.referenceNumber,
          ticket.subject,
        );
      }
    } catch (e) {
      this.logger.warn(`Failed to send looped-in email: ${(e as Error).message}`);
    }

    return { id: rowId, alreadyActive: false };
  }

  /**
   * Remove a collaborator. Plain support agents cannot remove
   * collaborators added by others — only supervisor or admin can.
   * Soft-delete via removed_at preserves the audit trail.
   */
  async removeCollaborator(
    actor: AuthenticatedUser,
    ticketId: string,
    userId: string,
  ) {
    const isSupervisorOrAdmin =
      actor.supportSubRole === 'supervisor' ||
      actor.roles.includes(ROLE_NAMES.ADMIN) ||
      actor.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [row] = await db
      .select({
        id: ticketCollaborators.id,
        addedBy: ticketCollaborators.addedBy,
        removedAt: ticketCollaborators.removedAt,
        department: ticketCollaborators.department,
      })
      .from(ticketCollaborators)
      .where(
        and(
          eq(ticketCollaborators.ticketId, ticketId),
          eq(ticketCollaborators.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Collaborator not found');
    if (row.removedAt !== null) {
      return { ok: true, alreadyRemoved: true };
    }

    // Plain agents can only remove rows they added themselves.
    if (!isSupervisorOrAdmin && row.addedBy !== actor.id) {
      throw new ForbiddenException(
        'Only supervisors / admins can remove collaborators added by others',
      );
    }

    await db
      .update(ticketCollaborators)
      .set({ removedAt: new Date() })
      .where(eq(ticketCollaborators.id, row.id));

    try {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: 'collaborator_removed',
        performedBy: actor.id,
        metadata: { ticketId, userId, department: row.department },
      });
    } catch (e) {
      this.logger.warn(`Failed to write collaborator_removed audit: ${(e as Error).message}`);
    }

    return { ok: true, alreadyRemoved: false };
  }

  /**
   * Return active users in a given collaborator department.
   *
   * Course-bound departments (instructor / ta / course_manager) are
   * filtered to only people tied to the supplied `courseId`. When
   * `courseId` is absent for those departments, the returned list is
   * empty so the FE can hide the option.
   *
   * Non-course-bound departments (finance / admin / supervisor) return
   * all active members of that role.
   *
   * Used by:
   *   - GET /support/departments/:dept/members?courseId=...  (loop-in modal)
   *   - transferTicket() to auto-pick a target user when none specified
   */
  async getDepartmentMembers(
    department: string,
    opts?: { courseId?: string },
  ): Promise<
    { id: string; firstName: string | null; lastName: string | null; email: string; courseRoleLabel?: string }[]
  > {
    const courseId = opts?.courseId || null;

    // Course-bound: filter to people tied to this specific course.
    if (
      department === TICKET_COLLAB_DEPARTMENTS.INSTRUCTOR ||
      department === TICKET_COLLAB_DEPARTMENTS.TA ||
      department === TICKET_COLLAB_DEPARTMENTS.COURSE_MANAGER
    ) {
      if (!courseId) return [];

      const [course] = await db
        .select({
          instructorId: courses.instructorId,
          managerId: courses.managerId,
          title: courses.title,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!course) return [];

      const targets: { userId: string | null; courseRoleLabel: string }[] = [];

      if (department === TICKET_COLLAB_DEPARTMENTS.INSTRUCTOR && course.instructorId) {
        targets.push({
          userId: course.instructorId,
          courseRoleLabel: `Instructor of "${course.title}"`,
        });
      }
      if (department === TICKET_COLLAB_DEPARTMENTS.COURSE_MANAGER && course.managerId) {
        targets.push({
          userId: course.managerId,
          courseRoleLabel: `Manager of "${course.title}"`,
        });
      }
      if (department === TICKET_COLLAB_DEPARTMENTS.TA) {
        const taRows = await db
          .select({ userId: courseAssistants.userId })
          .from(courseAssistants)
          .where(
            and(
              eq(courseAssistants.courseId, courseId),
              eq(courseAssistants.status, 'approved'),
            ),
          );
        for (const t of taRows) {
          targets.push({
            userId: t.userId,
            courseRoleLabel: `TA of "${course.title}"`,
          });
        }
      }

      const userIds = targets
        .map((t) => t.userId)
        .filter((u): u is string => !!u);
      if (userIds.length === 0) return [];

      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(and(inArray(users.id, userIds), eq(users.isActive, true)));

      const byId = new Map(rows.map((r) => [r.id, r]));
      return targets
        .map((t) => {
          const u = t.userId ? byId.get(t.userId) : undefined;
          if (!u) return null;
          return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            courseRoleLabel: t.courseRoleLabel,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }

    // Non-course-bound: look up by role.
    const roleNamesForDept = ((): string[] => {
      switch (department) {
        case TICKET_COLLAB_DEPARTMENTS.ADMIN:
          return [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN];
        case TICKET_COLLAB_DEPARTMENTS.FINANCE:
          return [ROLE_NAMES.FINANCE];
        case TICKET_COLLAB_DEPARTMENTS.SUPERVISOR:
          // Supervisors are SUPPORT-role users with supportSubRole='supervisor'.
          return [ROLE_NAMES.SUPPORT];
        default:
          return [];
      }
    })();
    if (roleNamesForDept.length === 0) return [];

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        supportSubRole: userRoles.supportSubRole,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          inArray(roles.name, roleNamesForDept),
          eq(users.isActive, true),
        ),
      );

    // For supervisor dept, narrow to supportSubRole='supervisor'.
    const filtered =
      department === TICKET_COLLAB_DEPARTMENTS.SUPERVISOR
        ? rows.filter((r) => r.supportSubRole === 'supervisor')
        : rows;

    // Dedup by user id (multi-role users).
    const seen = new Set<string>();
    return filtered
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
      }));
  }

  /**
   * Transfer a ticket to a target department.
   *
   * What it does:
   *   1. Updates the ticket category to the new slug.
   *   2. Adds (or re-activates) the target user(s) as collaborators.
   *      If `userId` is omitted, the first eligible member of the
   *      department is picked.
   *   3. Posts a SYSTEM message in the public thread (greyed-out,
   *      no Support attribution) so the requester knows the routing
   *      changed without seeing the department user's name.
   *   4. Emails the requester (best-effort).
   *   5. Logs `ticket_transferred` audit.
   *
   * Ownership stays with Support — the assignee is NOT changed.
   * Transfer is a re-route + loop-in gesture, not a handoff.
   */
  async transferTicket(
    actor: AuthenticatedUser,
    ticketId: string,
    dto: {
      toCategory: string;
      toDepartment: TicketCollabDepartment | string;
      userId?: string;
      noteToRequester?: string;
    },
  ) {
    const isSupportOrAdmin =
      actor.roles.includes(ROLE_NAMES.SUPPORT) ||
      actor.roles.includes(ROLE_NAMES.ADMIN) ||
      actor.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupportOrAdmin) {
      throw new ForbiddenException(
        'Only support staff can transfer tickets',
      );
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        category: tickets.category,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        assigneeId: tickets.assigneeId,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
        guestTrackingToken: tickets.guestTrackingToken,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Agent isolation.
    const isSupervisorOrAdmin =
      actor.supportSubRole === 'supervisor' ||
      actor.roles.includes(ROLE_NAMES.ADMIN) ||
      actor.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (!isSupervisorOrAdmin && ticket.assigneeId !== actor.id) {
      throw new ForbiddenException('You are not assigned to this ticket');
    }

    // Validate new category against the live catalog.
    const validCats = await this.listTicketCategories();
    const newCategoryRow = validCats.find((c) => c.slug === dto.toCategory);
    if (!newCategoryRow) {
      throw new BadRequestException(
        `Unknown ticket category: ${dto.toCategory}`,
      );
    }

    // Validate department.
    const validDepts: string[] = Object.values(TICKET_COLLAB_DEPARTMENTS);
    if (!validDepts.includes(dto.toDepartment)) {
      throw new BadRequestException(`Unknown department: ${dto.toDepartment}`);
    }

    // Resolve target user(s) — either the explicit `userId` or the
    // first member of the department (course-scoped for course-bound
    // roles).
    let targetUserId: string | null = dto.userId || null;
    if (!targetUserId) {
      const members = await this.getDepartmentMembers(dto.toDepartment, {
        courseId: ticket.courseId || undefined,
      });
      targetUserId = members[0]?.id || null;
    }
    if (!targetUserId) {
      throw new BadRequestException(
        'No eligible member found in the target department',
      );
    }

    // Resolve the system-message template (supervisor-editable in
    // support_config). The supervisor's optional `noteToRequester`
    // override wins.
    const [templateRow] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'transfer_message_template_en'))
      .limit(1);
    const defaultTemplate =
      typeof templateRow?.value === 'string'
        ? templateRow.value
        : 'Your ticket has been routed to our {department} team for the {categoryLabel} matter. Support remains your point of contact.';

    const friendlyDeptLabel = ((d: string) =>
      d
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' '))(dto.toDepartment);

    const systemMessage =
      dto.noteToRequester?.trim() ||
      defaultTemplate
        .replace('{department}', friendlyDeptLabel)
        .replace('{categoryLabel}', newCategoryRow.nameEn);

    // Perform the update + loop-in + system message in a single
    // transaction so a failure midway doesn't leave a half-applied
    // transfer (e.g. category changed but no collaborator added).
    await db.transaction(async (tx) => {
      // 1. Update category.
      await tx
        .update(tickets)
        .set({ category: dto.toCategory, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId));

      // 2. Upsert collaborator row.
      const [existing] = await tx
        .select({
          id: ticketCollaborators.id,
          removedAt: ticketCollaborators.removedAt,
        })
        .from(ticketCollaborators)
        .where(
          and(
            eq(ticketCollaborators.ticketId, ticketId),
            eq(ticketCollaborators.userId, targetUserId!),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.removedAt !== null) {
          await tx
            .update(ticketCollaborators)
            .set({
              removedAt: null,
              addedBy: actor.id,
              addedAt: new Date(),
              department: dto.toDepartment,
            })
            .where(eq(ticketCollaborators.id, existing.id));
        }
      } else {
        await tx.insert(ticketCollaborators).values({
          ticketId,
          userId: targetUserId!,
          department: dto.toDepartment,
          addedBy: actor.id,
        });
      }

      // 3. Post the system message into the public thread.
      await tx.insert(ticketReplies).values({
        ticketId,
        userId: actor.id,
        message: systemMessage,
        isStaffReply: false,
        isInternal: false,
        isSystem: true,
      });
    });

    // 4. Audit.
    try {
      await this.auditLogService.log({
        entityType: 'ticket',
        entityId: ticketId,
        action: 'ticket_transferred',
        performedBy: actor.id,
        metadata: {
          ticketId,
          fromCategory: ticket.category,
          toCategory: dto.toCategory,
          toDepartment: dto.toDepartment,
          toUserId: targetUserId,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write ticket_transferred audit: ${(e as Error).message}`,
      );
    }

    // 5. Notify the target user via the existing collab flow (in-app
    // + email + audit). Skip if they were already an active collab
    // before this transfer.
    try {
      await this.addCollaborator(actor, ticketId, {
        userId: targetUserId,
        department: dto.toDepartment,
      });
    } catch (e) {
      this.logger.warn(
        `Transfer collaborator notify failed: ${(e as Error).message}`,
      );
    }

    // 6. Email the requester with the system message copy.
    try {
      let recipientEmail: string | null = null;
      let recipientName = 'Student';
      let trackingUrl: string | undefined;

      if (ticket.guestEmail && ticket.studentId === GUEST_USER_ID) {
        recipientEmail = ticket.guestEmail;
        recipientName = ticket.guestName || 'there';
        trackingUrl = ticket.guestTrackingToken
          ? this.buildGuestTrackingUrl(ticket.guestTrackingToken)
          : undefined;
      } else {
        const [requesterInfo] = await db
          .select({ email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, ticket.studentId))
          .limit(1);
        if (requesterInfo?.email) {
          recipientEmail = requesterInfo.email;
          recipientName = requesterInfo.firstName || 'Student';
        }
      }

      if (recipientEmail) {
        await this.emailService.sendTicketReplyNotification(
          recipientEmail,
          recipientName,
          'Support',
          ticket.referenceNumber,
          systemMessage,
          trackingUrl,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Failed to email requester on transfer: ${(e as Error).message}`,
      );
    }

    return {
      ok: true,
      toCategory: dto.toCategory,
      toDepartment: dto.toDepartment,
      toUserId: targetUserId,
      systemMessage,
    };
  }

  /**
   * Tickets where the caller is currently a collaborator (active rows
   * only). Powers the "Looped In" sidebar tab on every staff dashboard.
   * Returns a compact summary suitable for list views.
   */
  async listTicketsInvolvedIn(user: AuthenticatedUser, opts?: { limit?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const rows = await db
      .select({
        id: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        loopedInAt: ticketCollaborators.addedAt,
        loopedInAs: ticketCollaborators.department,
        requesterFirstName: users.firstName,
        requesterLastName: users.lastName,
      })
      .from(ticketCollaborators)
      .innerJoin(tickets, eq(ticketCollaborators.ticketId, tickets.id))
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(
        and(
          eq(ticketCollaborators.userId, user.id),
          isNull(ticketCollaborators.removedAt),
        ),
      )
      .orderBy(desc(tickets.updatedAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      subject: r.subject,
      category: r.category,
      priority: r.priority,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      loopedInAt: r.loopedInAt,
      loopedInAs: r.loopedInAs,
      requesterName:
        [r.requesterFirstName, r.requesterLastName]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
    }));
  }
}
