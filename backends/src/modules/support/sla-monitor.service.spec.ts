import { Test, TestingModule } from '@nestjs/testing';
import { SlaMonitorService } from './sla-monitor.service';
import { SupportService } from './support.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { TasksService } from '../tasks/tasks.service';
import { TICKET_STATUS } from '../../database/schema';

jest.mock('../../database', () => ({ db: jest.fn() }));
import { db } from '../../database';

/*
 * sendCsatEmailOne — CAS-on-marker correctness anchor.
 *
 * The "not yet emailed" marker is sentAt ≈ resolvedAt (within 2 sec —
 * both timestamps were inserted in the same transaction, so the delta
 * is DB clock jitter). The CAS flip advances sentAt off this window;
 * concurrent callers (legacy @Cron + Cloud Task delivery) race safely.
 */
describe('SlaMonitorService — sendCsatEmailOne', () => {
  let service: SlaMonitorService;
  let email: { sendCsatSurvey: jest.Mock };
  const SURVEY_ID = '00000000-0000-4000-a000-000000000005';

  function mockSelectRow(row: any) {
    (db as any).select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(row ? [row] : []),
          }),
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

  function mockInsertNoop() {
    (db as any).insert = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
  }

  const pendingSurvey = (overrides: any = {}) => {
    const resolvedAt = new Date(Date.now() - 30 * 60_000); // 30 min ago
    return {
      surveyId: SURVEY_ID,
      ticketId: 'ticket-1',
      ticketReferenceNumber: 'T-0001',
      // sentAt is created within the same transaction as resolvedAt
      // → delta is jitter (near-zero).
      sentAt: new Date(resolvedAt.getTime() + 100),
      userId: 'user-1',
      score: null,
      submittedAt: null,
      ticketStatus: TICKET_STATUS.RESOLVED,
      ticketResolvedAt: resolvedAt,
      userEmail: 'user@example.com',
      userFirstName: 'Alice',
      guestEmail: null,
      guestName: null,
      ...overrides,
    };
  };

  beforeEach(async () => {
    email = { sendCsatSurvey: jest.fn().mockResolvedValue(undefined) };
    mockInsertNoop(); // trackCronRun may INSERT into cronRuns — mock harmlessly

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaMonitorService,
        {
          provide: SupportService,
          useValue: {
            getBusinessHours: jest.fn().mockResolvedValue({}),
            findNextAgent: jest.fn().mockResolvedValue(null),
            findSupervisorId: jest.fn().mockResolvedValue(null),
            shouldNotifySupport: jest.fn().mockResolvedValue(false),
          },
        },
        { provide: EmailService, useValue: email },
        { provide: UserNotificationsService, useValue: { create: jest.fn() } },
        {
          provide: DistributedLockService,
          useValue: { withLock: jest.fn((_k, _t, fn) => fn()) },
        },
        {
          provide: TasksService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            enqueue: jest.fn().mockResolvedValue('task-name'),
            cancelByEvent: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();
    service = module.get(SlaMonitorService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns false when survey not found', async () => {
    mockSelectRow(null);
    expect(await service.sendCsatEmailOne(SURVEY_ID)).toBe(false);
  });

  it('returns false when score already submitted', async () => {
    mockSelectRow(pendingSurvey({ score: 5, submittedAt: new Date() }));
    expect(await service.sendCsatEmailOne(SURVEY_ID)).toBe(false);
  });

  it('returns false when ticket reopened (status != RESOLVED/CLOSED)', async () => {
    mockSelectRow(pendingSurvey({ ticketStatus: TICKET_STATUS.IN_PROGRESS }));
    expect(await service.sendCsatEmailOne(SURVEY_ID)).toBe(false);
  });

  it('returns false when sentAt is far from resolvedAt (already emailed)', async () => {
    // If sentAt is more than 2 sec from resolvedAt, the email already went out
    mockSelectRow(
      pendingSurvey({
        sentAt: new Date(Date.now()),
        ticketResolvedAt: new Date(Date.now() - 60 * 60_000),
      }),
    );
    expect(await service.sendCsatEmailOne(SURVEY_ID)).toBe(false);
  });

  it('returns false when no recipient email (guest ticket with no guestEmail)', async () => {
    mockSelectRow(pendingSurvey({ userEmail: null, guestEmail: null }));
    expect(await service.sendCsatEmailOne(SURVEY_ID)).toBe(false);
    expect(email.sendCsatSurvey).not.toHaveBeenCalled();
  });

  it('CAS-claims and sends email when marker matches + recipient present', async () => {
    mockSelectRow(pendingSurvey());
    mockCasUpdate([{ id: SURVEY_ID }]);
    const result = await service.sendCsatEmailOne(SURVEY_ID);
    expect(result).toBe(true);
    expect(email.sendCsatSurvey).toHaveBeenCalledWith(
      'user@example.com',
      'Alice',
      'T-0001',
      SURVEY_ID,
    );
  });

  it('returns false when CAS UPDATE affects 0 rows (concurrent instance won)', async () => {
    mockSelectRow(pendingSurvey());
    mockCasUpdate([]); // race lost
    const result = await service.sendCsatEmailOne(SURVEY_ID);
    expect(result).toBe(false);
    expect(email.sendCsatSurvey).not.toHaveBeenCalled();
  });

  it('prefers guest email over user email for guest tickets', async () => {
    mockSelectRow(
      pendingSurvey({
        guestEmail: 'guest@example.com',
        guestName: 'Guest User',
        userEmail: 'user@example.com',
      }),
    );
    mockCasUpdate([{ id: SURVEY_ID }]);
    await service.sendCsatEmailOne(SURVEY_ID);
    expect(email.sendCsatSurvey).toHaveBeenCalledWith(
      'guest@example.com',
      'Guest User',
      expect.anything(),
      expect.anything(),
    );
  });
});
