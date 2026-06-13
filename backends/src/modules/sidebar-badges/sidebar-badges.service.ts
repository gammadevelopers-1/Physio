/**
 * SidebarBadgesService — composes the unread-counter badges shown
 * on each dashboard's sidebar nav items.
 *
 * Counts are scoped to the caller's role: only tab keys the caller's
 * dashboards expose are returned. Each count is "things created
 * since I last viewed this tab" — viewing the tab calls
 * markViewed(tabKey) which bumps the timestamp and clears the badge
 * on the next poll.
 *
 * For users who have never visited a tab, sidebar_views has no row
 * for that (user, tab) pair. We treat the absent row as "epoch" so
 * the badge shows the full unread count on first visit, then clears
 * on first markViewed.
 *
 * All counts run in parallel — the endpoint should be a single
 * round-trip on each dashboard mount and once per polling interval.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, gt, sql, inArray, isNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  sidebarViews,
  tickets,
  ticketReplies,
  roleRequests,
  ticketHoldRequests,
  supportTeamRequests,
  ticketCollaborators,
  ROLE_NAMES,
  GUEST_USER_ID,
  HOLD_REQUEST_STATUS,
  SUPPORT_TEAM_REQUEST_STATUS,
} from '../../database/schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Stable tab identifiers shared with the FE. Keep in sync with the
// FE useSidebarBadges hook.
export const SIDEBAR_TAB_KEYS = {
  // Support dashboard
  SUPPORT_MY_TICKETS: 'support:my-tickets',
  SUPPORT_ALL_TICKETS: 'support:all-tickets',
  SUPPORT_ALERTS: 'support:alerts',
  SUPPORT_TEAM: 'support:team',
  SUPPORT_TRAINER_APPS: 'support:trainer-applications',

  // Admin dashboard
  ADMIN_USERS: 'admin:users',
  ADMIN_TRAINER_APPS: 'admin:trainer-applications',

  // Student / instructor / manager / TA / finance dashboards
  USER_SUPPORT: 'user:support',

  // Phase 2 — tickets where the caller is an active collaborator
  // and a new internal reply has landed since they last viewed
  // the "Looped In" tab.
  USER_LOOPED_IN: 'user:looped-in',
} as const;

export type SidebarTabKey =
  (typeof SIDEBAR_TAB_KEYS)[keyof typeof SIDEBAR_TAB_KEYS];

const VALID_TAB_KEYS = new Set<string>(Object.values(SIDEBAR_TAB_KEYS));

// Epoch sentinel — first-visit users get counted against this so the
// badge surfaces all unseen items on initial dashboard load.
const EPOCH = new Date(0);

@Injectable()
export class SidebarBadgesService {
  /**
   * Compose all badge counts the caller's role exposes. Unknown roles
   * get an empty object — never throws — so an admin viewing a partial
   * dashboard during a deploy doesn't 500.
   */
  async getBadges(user: AuthenticatedUser): Promise<Record<string, number>> {
    const isSupport = user.roles.includes(ROLE_NAMES.SUPPORT);
    const isAdmin =
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    const isSupervisor =
      isSupport && user.supportSubRole === 'supervisor';
    const isAgent = isSupport && user.supportSubRole === 'agent';

    // Load all view timestamps in one query — we don't know which
    // tabs apply until we know the role, but the table is tiny and
    // the lookup is cheap.
    const viewRows = await db
      .select({
        tabKey: sidebarViews.tabKey,
        viewedAt: sidebarViews.viewedAt,
      })
      .from(sidebarViews)
      .where(eq(sidebarViews.userId, user.id));

    const lastViewed = new Map<string, Date>();
    for (const row of viewRows) {
      lastViewed.set(row.tabKey, row.viewedAt);
    }
    const since = (key: string): Date => lastViewed.get(key) ?? EPOCH;

    // Run every applicable count in parallel. Each branch resolves to
    // a [tabKey, count] tuple or null when not applicable.
    const tasks: Promise<[string, number] | null>[] = [];

    if (isSupport) {
      // Trainer applications — read-only lookup for any support user.
      tasks.push(
        this.countPendingRoleRequests(
          since(SIDEBAR_TAB_KEYS.SUPPORT_TRAINER_APPS),
        ).then((n) => [SIDEBAR_TAB_KEYS.SUPPORT_TRAINER_APPS, n]),
      );

      if (isAgent) {
        // Agent: tickets assigned to me with new customer activity.
        tasks.push(
          this.countMyTicketsWithNewActivity(
            user.id,
            since(SIDEBAR_TAB_KEYS.SUPPORT_MY_TICKETS),
          ).then((n) => [SIDEBAR_TAB_KEYS.SUPPORT_MY_TICKETS, n]),
        );
      }

      if (isSupervisor) {
        // Supervisor: unassigned new tickets in the queue.
        tasks.push(
          this.countUnassignedNewTickets(
            since(SIDEBAR_TAB_KEYS.SUPPORT_ALL_TICKETS),
          ).then((n) => [SIDEBAR_TAB_KEYS.SUPPORT_ALL_TICKETS, n]),
        );
        // Supervisor: open hold requests awaiting decision.
        tasks.push(
          this.countPendingHoldRequests(
            since(SIDEBAR_TAB_KEYS.SUPPORT_ALERTS),
          ).then((n) => [SIDEBAR_TAB_KEYS.SUPPORT_ALERTS, n]),
        );
        // Supervisor: pending support-team change requests.
        tasks.push(
          this.countPendingTeamRequests(
            since(SIDEBAR_TAB_KEYS.SUPPORT_TEAM),
          ).then((n) => [SIDEBAR_TAB_KEYS.SUPPORT_TEAM, n]),
        );
      }
    }

    if (isAdmin) {
      tasks.push(
        this.countPendingRoleRequests(since(SIDEBAR_TAB_KEYS.ADMIN_USERS)).then(
          (n) => [SIDEBAR_TAB_KEYS.ADMIN_USERS, n],
        ),
      );
      tasks.push(
        this.countPendingRoleRequests(
          since(SIDEBAR_TAB_KEYS.ADMIN_TRAINER_APPS),
        ).then((n) => [SIDEBAR_TAB_KEYS.ADMIN_TRAINER_APPS, n]),
      );
    }

    // Non-staff dashboards (student/instructor/manager/ta/finance):
    // one badge for tickets where the requester (the caller) has
    // unread staff activity. Suppressed for users who are also
    // staff — they have their own support dashboard.
    if (!isSupport && !isAdmin) {
      tasks.push(
        this.countUserTicketsWithStaffActivity(
          user.id,
          since(SIDEBAR_TAB_KEYS.USER_SUPPORT),
        ).then((n) => [SIDEBAR_TAB_KEYS.USER_SUPPORT, n]),
      );
    }

    // Phase 2 — Looped-In badge for ANY staff user (non-student).
    // Counts tickets where the user is an active collaborator and a
    // new internal reply has landed since they last viewed the tab.
    const isStudentOnly =
      !isSupport &&
      !isAdmin &&
      user.roles.length === 1 &&
      user.roles[0] === ROLE_NAMES.STUDENT;
    if (!isStudentOnly) {
      tasks.push(
        this.countLoopedInUnreadReplies(
          user.id,
          since(SIDEBAR_TAB_KEYS.USER_LOOPED_IN),
        ).then((n) => [SIDEBAR_TAB_KEYS.USER_LOOPED_IN, n]),
      );
    }

    const results = await Promise.all(tasks);
    const out: Record<string, number> = {};
    for (const r of results) {
      if (r) out[r[0]] = r[1];
    }
    return out;
  }

  /**
   * Bump viewed_at = NOW() for (user, tabKey). Upsert because new
   * users won't have a row yet; existing rows get the timestamp
   * advanced so the next count starts from "now".
   */
  async markViewed(user: AuthenticatedUser, tabKey: string): Promise<void> {
    if (!VALID_TAB_KEYS.has(tabKey)) {
      throw new BadRequestException('Unknown tab key');
    }
    const now = new Date();
    await db
      .insert(sidebarViews)
      .values({
        userId: user.id,
        tabKey,
        viewedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [sidebarViews.userId, sidebarViews.tabKey],
        set: { viewedAt: now, updatedAt: now },
      });
  }

  // ─── Count primitives ───────────────────────────────────────

  private async countMyTicketsWithNewActivity(
    userId: string,
    since: Date,
  ): Promise<number> {
    // Distinct tickets assigned to me where a non-staff reply landed
    // after I last viewed "My Tickets". isStaffReply=false is the
    // canonical marker — covers authed customer replies and guest
    // replies in one filter.
    const [row] = await db
      .select({
        value: sql<number>`count(distinct ${tickets.id})::int`,
      })
      .from(tickets)
      .innerJoin(ticketReplies, eq(ticketReplies.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.assigneeId, userId),
          eq(ticketReplies.isStaffReply, false),
          gt(ticketReplies.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }

  private async countUnassignedNewTickets(since: Date): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(tickets)
      .where(and(isNull(tickets.assigneeId), gt(tickets.createdAt, since)));
    return Number(row?.value) || 0;
  }

  private async countPendingHoldRequests(since: Date): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(ticketHoldRequests)
      .where(
        and(
          eq(ticketHoldRequests.status, HOLD_REQUEST_STATUS.PENDING),
          gt(ticketHoldRequests.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }

  private async countPendingTeamRequests(since: Date): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(supportTeamRequests)
      .where(
        and(
          eq(
            supportTeamRequests.status,
            SUPPORT_TEAM_REQUEST_STATUS.PENDING,
          ),
          gt(supportTeamRequests.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }

  private async countPendingRoleRequests(since: Date): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(roleRequests)
      .where(
        and(
          inArray(roleRequests.status, ['PENDING', 'MORE_INFO']),
          gt(roleRequests.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }

  private async countLoopedInUnreadReplies(
    userId: string,
    since: Date,
  ): Promise<number> {
    // Phase 2 — distinct tickets where I'm an active collaborator
    // AND an internal reply (mine OR another collaborator's) landed
    // after I last viewed the Looped In tab. We don't filter out my
    // own internal replies because the user-facing meaning of the
    // badge is "something happened here you haven't seen since you
    // last looked" — even if it was your own reply, you should be
    // able to click through and see the current state.
    const [row] = await db
      .select({
        value: sql<number>`count(distinct ${ticketCollaborators.ticketId})::int`,
      })
      .from(ticketCollaborators)
      .innerJoin(
        ticketReplies,
        eq(ticketReplies.ticketId, ticketCollaborators.ticketId),
      )
      .where(
        and(
          eq(ticketCollaborators.userId, userId),
          isNull(ticketCollaborators.removedAt),
          eq(ticketReplies.isInternal, true),
          gt(ticketReplies.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }

  private async countUserTicketsWithStaffActivity(
    userId: string,
    since: Date,
  ): Promise<number> {
    if (userId === GUEST_USER_ID) return 0;
    // Distinct tickets I raised where a public staff reply landed
    // after I last viewed the Support tab. isInternal=false keeps
    // internal notes out of the customer's badge — they're not
    // meant to be customer-visible.
    const [row] = await db
      .select({
        value: sql<number>`count(distinct ${tickets.id})::int`,
      })
      .from(tickets)
      .innerJoin(ticketReplies, eq(ticketReplies.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.studentId, userId),
          eq(ticketReplies.isStaffReply, true),
          eq(ticketReplies.isInternal, false),
          gt(ticketReplies.createdAt, since),
        ),
      );
    return Number(row?.value) || 0;
  }
}
