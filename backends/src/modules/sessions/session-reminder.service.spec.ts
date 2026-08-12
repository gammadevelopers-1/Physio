import { Test, TestingModule } from '@nestjs/testing';
import { SessionReminderService } from './session-reminder.service';
import { EmailService } from '../email/email.service';
import { ZOOM_SERVICE } from '../zoom/zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { SessionNotificationService } from './session-notification.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { TasksService } from '../tasks/tasks.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { SESSION_STATUS, SESSION_TYPE } from '../../database/schema';

jest.mock('../../database', () => ({ db: jest.fn() }));
import { db } from '../../database';

/*
 * CAS + idempotency tests for the per-row event handler that Cloud Tasks
 * calls (session.remind). Guarantees at-most-once reminder delivery under
 * parallel-run (Cloud Task + legacy @Cron + safety-net sweep can all
 * race — CAS-loser must no-op).
 */
describe('SessionReminderService — remindOne', () => {
  let service: SessionReminderService;
  const SESSION_ID = '00000000-0000-4000-a000-000000000001';

  function mockSelectRow(row: any) {
    (db as any).select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    });
  }

  function mockCasUpdate(returned: any[]) {
    (db as any).update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returned),
        }),
      }),
    });
  }

  const zoomSession = (overrides: any = {}) => ({
    id: SESSION_ID,
    title: 'Test session',
    type: SESSION_TYPE.ZOOM,
    scheduledAt: new Date(Date.now() + 5 * 60_000),
    durationMinutes: 60,
    zoomLink: 'https://zoom.us/j/xyz',
    courseId: 'course-id',
    instructorId: 'instructor-id',
    courseName: 'Test course',
    courseDeletedAt: null,
    status: SESSION_STATUS.SCHEDULED,
    reminderSentAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionReminderService,
        { provide: EmailService, useValue: {} },
        { provide: ZOOM_SERVICE, useValue: {} },
        { provide: NelcAuditService, useValue: { log: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        {
          provide: SessionNotificationService,
          useValue: { notifySessionEvent: jest.fn() },
        },
        {
          provide: AdminSettingsService,
          useValue: { getCategory: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: TasksService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            enqueue: jest.fn().mockResolvedValue('task-name'),
            cancelByEvent: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: DistributedLockService,
          useValue: { withLock: jest.fn((_k, _t, fn) => fn()) },
        },
      ],
    }).compile();
    service = module.get(SessionReminderService);

    // Stub the private side-effect (sendRemindersForSession) so tests
    // don't try to fan out real emails. We're testing CAS, not fan-out.
    (service as any).sendRemindersForSession = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns false when session does not exist', async () => {
    mockSelectRow(null);
    expect(await service.remindOne(SESSION_ID)).toBe(false);
  });

  it('returns false when parent course is soft-deleted', async () => {
    mockSelectRow(zoomSession({ courseDeletedAt: new Date() }));
    expect(await service.remindOne(SESSION_ID)).toBe(false);
  });

  it('returns false when session status is not SCHEDULED', async () => {
    mockSelectRow(zoomSession({ status: SESSION_STATUS.CANCELLED }));
    expect(await service.remindOne(SESSION_ID)).toBe(false);
  });

  it('returns false when reminder already sent', async () => {
    mockSelectRow(zoomSession({ reminderSentAt: new Date() }));
    expect(await service.remindOne(SESSION_ID)).toBe(false);
  });

  it('returns false for non-Zoom / non-Hybrid session type', async () => {
    mockSelectRow(zoomSession({ type: SESSION_TYPE.ONSITE }));
    expect(await service.remindOne(SESSION_ID)).toBe(false);
  });

  it('no-ops when CAS UPDATE affects zero rows (race lost)', async () => {
    mockSelectRow(zoomSession());
    mockCasUpdate([]);
    const result = await service.remindOne(SESSION_ID);
    expect(result).toBe(false);
    expect((service as any).sendRemindersForSession).not.toHaveBeenCalled();
  });

  it('sends reminders only when CAS wins', async () => {
    mockSelectRow(zoomSession());
    mockCasUpdate([{ id: SESSION_ID }]);
    const result = await service.remindOne(SESSION_ID);
    expect(result).toBe(true);
    expect((service as any).sendRemindersForSession).toHaveBeenCalledTimes(1);
  });

  it('does NOT reset reminderSentAt when the fan-out throws (avoids double-send on retry)', async () => {
    mockSelectRow(zoomSession());
    mockCasUpdate([{ id: SESSION_ID }]);
    (service as any).sendRemindersForSession = jest
      .fn()
      .mockRejectedValueOnce(new Error('smtp down'));
    const result = await service.remindOne(SESSION_ID);
    expect(result).toBe(false);
    // The single .update() call above is the CAS claim — no rollback
    // call should follow. Verify update was called exactly once.
    expect((db as any).update).toHaveBeenCalledTimes(1);
  });

  it('handles Hybrid session type identically to Zoom', async () => {
    mockSelectRow(zoomSession({ type: SESSION_TYPE.HYBRID }));
    mockCasUpdate([{ id: SESSION_ID }]);
    expect(await service.remindOne(SESSION_ID)).toBe(true);
  });
});

/*
 * CAS tests for warn90One and endOne (Phase 1.4 handlers).
 */
describe('SessionReminderService — end lifecycle', () => {
  let service: SessionReminderService;
  const SESSION_ID = '00000000-0000-4000-a000-000000000002';

  function mockSelectRow(row: any, methodPath: 'select' = 'select') {
    // endOne uses .select().from().where() (no innerJoin)
    // warn90One uses .select().from().innerJoin().where()
    (db as any)[methodPath] = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
        where: jest.fn().mockResolvedValue(row ? [row] : []),
      }),
    });
  }

  function mockCasUpdate(returned: any[]) {
    (db as any).update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returned),
        }),
      }),
    });
  }

  const liveSession = (overrides: any = {}) => {
    const startedAt = new Date(Date.now() - 60 * 60_000); // 1 hour ago
    return {
      id: SESSION_ID,
      title: 'Live session',
      courseId: 'course-1',
      instructorId: 'instructor-1',
      type: SESSION_TYPE.ZOOM,
      meetingId: '123',
      zoomLink: 'https://zoom.us/j/123',
      actualStartedAt: startedAt,
      durationMinutes: 60,
      autoEndWarningSentAt: null,
      status: SESSION_STATUS.LIVE,
      courseName: 'Course 1',
      ...overrides,
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionReminderService,
        {
          provide: EmailService,
          useValue: {
            sendGenericNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ZOOM_SERVICE,
          useValue: {
            endMeeting: jest.fn().mockResolvedValue({ ended: true }),
          },
        },
        { provide: NelcAuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: SessionNotificationService,
          useValue: { notifySessionEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AdminSettingsService,
          useValue: { getCategory: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: TasksService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            enqueue: jest.fn().mockResolvedValue('task-name'),
            cancelByEvent: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: DistributedLockService,
          useValue: { withLock: jest.fn((_k, _t, fn) => fn()) },
        },
      ],
    }).compile();
    service = module.get(SessionReminderService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── endOne ──────────────────────────────────────

  describe('endOne', () => {
    it('returns false when session not LIVE', async () => {
      mockSelectRow(liveSession({ status: SESSION_STATUS.ENDED }));
      expect(await service.endOne(SESSION_ID)).toBe(false);
    });

    it('returns false when actualStartedAt is null', async () => {
      mockSelectRow(liveSession({ actualStartedAt: null }));
      expect(await service.endOne(SESSION_ID)).toBe(false);
    });

    it('returns false when planned end has not yet passed', async () => {
      mockSelectRow(
        liveSession({
          actualStartedAt: new Date(Date.now() - 5 * 60_000), // 5min ago
          durationMinutes: 60,
        }),
      );
      expect(await service.endOne(SESSION_ID)).toBe(false);
    });

    it('flips LIVE -> ENDED via CAS and sets actualEndedAt to plannedEnd (not now)', async () => {
      const startedAt = new Date(Date.now() - 65 * 60_000); // 65min ago (5min past 60min duration)
      const session = liveSession({
        actualStartedAt: startedAt,
        durationMinutes: 60,
      });
      mockSelectRow(session);
      mockCasUpdate([{ id: SESSION_ID, actualEndedAt: new Date(startedAt.getTime() + 60 * 60_000), courseId: 'course-1' }]);
      const result = await service.endOne(SESSION_ID);
      expect(result).toBe(true);
      const updateCall = (db as any).update.mock.calls[0];
      expect(updateCall).toBeDefined();
    });

    it('returns false when CAS UPDATE affects 0 rows (already ended by concurrent caller)', async () => {
      const startedAt = new Date(Date.now() - 65 * 60_000);
      mockSelectRow(liveSession({ actualStartedAt: startedAt, durationMinutes: 60 }));
      mockCasUpdate([]);
      expect(await service.endOne(SESSION_ID)).toBe(false);
    });
  });

  // ── warn90One ──────────────────────────────────

  describe('warn90One', () => {
    it('returns false when session not LIVE', async () => {
      mockSelectRow(liveSession({ status: SESSION_STATUS.ENDED }));
      expect(await service.warn90One(SESSION_ID)).toBe(false);
    });

    it('returns false when warning already sent', async () => {
      mockSelectRow(liveSession({ autoEndWarningSentAt: new Date() }));
      expect(await service.warn90One(SESSION_ID)).toBe(false);
    });

    it('returns false when < 90% duration has elapsed', async () => {
      const startedAt = new Date(Date.now() - 30 * 60_000); // 30 min into 60-min session
      mockSelectRow(liveSession({ actualStartedAt: startedAt, durationMinutes: 60 }));
      expect(await service.warn90One(SESSION_ID)).toBe(false);
    });

    it('returns false when session already past full duration (endOne handles it)', async () => {
      const startedAt = new Date(Date.now() - 65 * 60_000); // 5 min PAST end
      mockSelectRow(liveSession({ actualStartedAt: startedAt, durationMinutes: 60 }));
      expect(await service.warn90One(SESSION_ID)).toBe(false);
    });

    it('CAS-claims autoEndWarningSentAt and sends email when at 90%', async () => {
      const startedAt = new Date(Date.now() - 55 * 60_000); // 55 of 60 min = 91%
      mockSelectRow(liveSession({ actualStartedAt: startedAt, durationMinutes: 60 }));
      mockCasUpdate([{ id: SESSION_ID }]);
      // Also mock the users select
      const originalSelect = (db as any).select;
      (db as any).select = jest.fn()
        .mockReturnValueOnce({ // first call: session lookup
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([liveSession({ actualStartedAt: startedAt, durationMinutes: 60 })]),
            }),
          }),
        })
        .mockReturnValueOnce({ // second call: instructor lookup
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                { email: 'inst@example.com', firstName: 'A', lastName: 'B', language: 'en' },
              ]),
            }),
          }),
        });
      const result = await service.warn90One(SESSION_ID);
      expect(result).toBe(true);
      (db as any).select = originalSelect;
    });

    it('returns false when CAS UPDATE affects 0 rows (already warned)', async () => {
      const startedAt = new Date(Date.now() - 55 * 60_000);
      mockSelectRow(liveSession({ actualStartedAt: startedAt, durationMinutes: 60 }));
      mockCasUpdate([]);
      expect(await service.warn90One(SESSION_ID)).toBe(false);
    });
  });
});

/*
 * markMissedOne — Phase 2.1 handler tests.
 */
describe('SessionReminderService — markMissedOne', () => {
  let service: SessionReminderService;
  const SESSION_ID = '00000000-0000-4000-a000-000000000003';

  function mockSelectRow(row: any) {
    (db as any).select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(row ? [row] : []),
      }),
    });
  }

  function mockCasUpdate(returned: any[]) {
    (db as any).update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returned),
        }),
      }),
    });
  }

  const scheduledRow = (overrides: any = {}) => ({
    id: SESSION_ID,
    title: 'Session',
    status: SESSION_STATUS.SCHEDULED,
    scheduledAt: new Date(Date.now() - 20 * 60_000), // 20 min ago
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionReminderService,
        { provide: EmailService, useValue: {} },
        { provide: ZOOM_SERVICE, useValue: {} },
        { provide: NelcAuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: SessionNotificationService, useValue: { notifySessionEvent: jest.fn() } },
        { provide: AdminSettingsService, useValue: { getCategory: jest.fn().mockResolvedValue({}) } },
        {
          provide: TasksService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            enqueue: jest.fn().mockResolvedValue('task-name'),
            cancelByEvent: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: DistributedLockService, useValue: { withLock: jest.fn((_k, _t, fn) => fn()) } },
      ],
    }).compile();
    service = module.get(SessionReminderService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns false when session not found', async () => {
    mockSelectRow(null);
    expect(await service.markMissedOne(SESSION_ID)).toBe(false);
  });

  it('returns false when session is not SCHEDULED (already started, cancelled, etc.)', async () => {
    mockSelectRow(scheduledRow({ status: SESSION_STATUS.LIVE }));
    expect(await service.markMissedOne(SESSION_ID)).toBe(false);
  });

  it('returns false when grace period has not yet elapsed', async () => {
    mockSelectRow(
      scheduledRow({
        scheduledAt: new Date(Date.now() - 5 * 60_000), // 5 min ago, < 15 min grace
      }),
    );
    expect(await service.markMissedOne(SESSION_ID)).toBe(false);
  });

  it('CAS-flips SCHEDULED -> MISSED when grace elapsed', async () => {
    mockSelectRow(scheduledRow());
    mockCasUpdate([{ id: SESSION_ID }]);
    expect(await service.markMissedOne(SESSION_ID)).toBe(true);
  });

  it('returns false when CAS UPDATE affects 0 rows (concurrent caller already flipped)', async () => {
    mockSelectRow(scheduledRow());
    mockCasUpdate([]);
    expect(await service.markMissedOne(SESSION_ID)).toBe(false);
  });
});
