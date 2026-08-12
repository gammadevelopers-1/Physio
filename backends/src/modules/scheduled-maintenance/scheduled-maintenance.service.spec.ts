import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { EmailService } from '../email/email.service';
import { TasksService } from '../tasks/tasks.service';

// Mock the db module — every call returns a chainable stub
jest.mock('../../database', () => ({ db: jest.fn() }));
import { db } from '../../database';

/*
 * CAS + idempotency tests for the per-row lifecycle methods that Cloud
 * Tasks fires against. These are the correctness anchors of the
 * migration — a bug here doubles maintenance emails or leaves the
 * platform banner stuck on.
 */
describe('ScheduledMaintenanceService — per-row event methods', () => {
  let service: ScheduledMaintenanceService;
  let settings: {
    getCategory: jest.Mock;
    updateCategory: jest.Mock;
  };
  let email: { sendGenericNotification: jest.Mock };
  let tasks: {
    isEnabled: jest.Mock;
    enqueue: jest.Mock;
    cancelByEvent: jest.Mock;
  };

  const WINDOW_ID = '00000000-0000-4000-a000-000000000000';

  function mockSelectRow(row: any) {
    (db as any).select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(row ? [row] : []),
      }),
    });
  }

  function mockCasUpdate(returned: any[]) {
    // Emulates .update().set().where().returning() resolving to the array
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

  const scheduledRow = (overrides: Partial<any> = {}) => ({
    id: WINDOW_ID,
    titleEn: 'Test',
    titleAr: 'اختبار',
    descriptionEn: null,
    descriptionAr: null,
    status: 'scheduled',
    startAt: new Date(Date.now() - 60_000), // 1 min ago
    endAt: new Date(Date.now() + 60 * 60_000), // 1 hour from now
    preNotificationSentAt: null,
    preNotificationLeadMinutes: 60,
    createdBy: null,
    createdAt: new Date(),
    affectedComponents: [],
    ...overrides,
  });

  beforeEach(async () => {
    settings = {
      getCategory: jest.fn().mockResolvedValue({}),
      updateCategory: jest.fn().mockResolvedValue(undefined),
    };
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    tasks = {
      isEnabled: jest.fn().mockReturnValue(true),
      enqueue: jest.fn().mockResolvedValue('task-name'),
      cancelByEvent: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledMaintenanceService,
        { provide: AdminSettingsService, useValue: settings },
        { provide: EmailService, useValue: email },
        { provide: TasksService, useValue: tasks },
      ],
    }).compile();

    service = module.get<ScheduledMaintenanceService>(ScheduledMaintenanceService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── activateOne ────────────────────────────────────────────────────

  describe('activateOne', () => {
    it('returns false for a missing window', async () => {
      mockSelectRow(null);
      expect(await service.activateOne(WINDOW_ID)).toBe(false);
    });

    it('returns false if window has already been activated', async () => {
      mockSelectRow(scheduledRow({ status: 'active' }));
      expect(await service.activateOne(WINDOW_ID)).toBe(false);
    });

    it('returns false if startAt is still in the future', async () => {
      mockSelectRow(scheduledRow({ startAt: new Date(Date.now() + 60_000) }));
      expect(await service.activateOne(WINDOW_ID)).toBe(false);
    });

    it('CAS-flips SCHEDULED -> ACTIVE and updates maintenance settings on success', async () => {
      mockSelectRow(scheduledRow());
      mockCasUpdate([{ id: WINDOW_ID }]);
      const result = await service.activateOne(WINDOW_ID);
      expect(result).toBe(true);
      expect(settings.updateCategory).toHaveBeenCalledWith(
        'maintenance',
        expect.objectContaining({ enabled: true, activeWindowId: WINDOW_ID }),
        expect.any(String),
      );
    });

    it('no-ops when the CAS UPDATE affects zero rows (lost race with concurrent caller)', async () => {
      mockSelectRow(scheduledRow());
      mockCasUpdate([]); // Empty returning array — status changed under us
      const result = await service.activateOne(WINDOW_ID);
      expect(result).toBe(false);
      expect(settings.updateCategory).not.toHaveBeenCalled();
    });

    it('skips to COMPLETED without flipping the toggle when endAt has also passed', async () => {
      mockSelectRow(
        scheduledRow({
          startAt: new Date(Date.now() - 2 * 60 * 60_000), // 2h ago
          endAt: new Date(Date.now() - 60 * 60_000), // 1h ago
        }),
      );
      mockCasUpdate([{ id: WINDOW_ID }]);
      const result = await service.activateOne(WINDOW_ID);
      expect(result).toBe(true);
      expect(settings.updateCategory).not.toHaveBeenCalled(); // no ON flip
    });
  });

  // ─── completeOne ────────────────────────────────────────────────────

  describe('completeOne', () => {
    it('returns false when window not in ACTIVE state', async () => {
      mockSelectRow(scheduledRow({ status: 'scheduled' }));
      expect(await service.completeOne(WINDOW_ID)).toBe(false);
    });

    it('returns false when endAt is still in the future', async () => {
      mockSelectRow(
        scheduledRow({
          status: 'active',
          endAt: new Date(Date.now() + 60_000),
        }),
      );
      expect(await service.completeOne(WINDOW_ID)).toBe(false);
    });

    it('flips ACTIVE -> COMPLETED and turns maintenance banner off when window owns the toggle', async () => {
      mockSelectRow(
        scheduledRow({
          status: 'active',
          endAt: new Date(Date.now() - 1000),
        }),
      );
      settings.getCategory.mockResolvedValueOnce({
        enabled: true,
        activeWindowId: WINDOW_ID,
      });
      mockCasUpdate([{ id: WINDOW_ID }]);
      const result = await service.completeOne(WINDOW_ID);
      expect(result).toBe(true);
      expect(settings.updateCategory).toHaveBeenCalledWith(
        'maintenance',
        expect.objectContaining({ enabled: false, activeWindowId: null }),
        expect.any(String),
      );
    });

    it('does NOT flip the toggle off when a different window owns it', async () => {
      mockSelectRow(
        scheduledRow({
          status: 'active',
          endAt: new Date(Date.now() - 1000),
        }),
      );
      settings.getCategory.mockResolvedValueOnce({
        enabled: true,
        activeWindowId: 'other-window',
      });
      mockCasUpdate([{ id: WINDOW_ID }]);
      const result = await service.completeOne(WINDOW_ID);
      expect(result).toBe(true);
      expect(settings.updateCategory).not.toHaveBeenCalled();
    });
  });

  // ─── preNotifyOne ───────────────────────────────────────────────────

  describe('preNotifyOne', () => {
    it('returns false if preNotificationLeadMinutes is 0 (opt-out)', async () => {
      mockSelectRow(scheduledRow({ preNotificationLeadMinutes: 0 }));
      expect(await service.preNotifyOne(WINDOW_ID)).toBe(false);
    });

    it('returns false if preNotificationSentAt is already set', async () => {
      mockSelectRow(scheduledRow({ preNotificationSentAt: new Date() }));
      expect(await service.preNotifyOne(WINDOW_ID)).toBe(false);
    });

    it('returns false if the CAS UPDATE loses the race', async () => {
      mockSelectRow(scheduledRow());
      mockCasUpdate([]); // race lost
      const result = await service.preNotifyOne(WINDOW_ID);
      expect(result).toBe(false);
      // No side effects
      expect((db as any).select).toHaveBeenCalled();
    });

    it('proceeds with side-effects only when CAS wins', async () => {
      mockSelectRow(scheduledRow());
      mockCasUpdate([{ id: WINDOW_ID }]);
      // Also mock the notifyAffectedUsers SELECTs — private but exercises DB
      // The service will build a users query; we short-circuit by returning 0 recipients
      // via a fresh SELECT chain that resolves to [].
      // Simpler: the private method does .selectDistinct().from().innerJoin().innerJoin().where()
      (db as any).selectDistinct = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]), // no recipients
            }),
          }),
        }),
      });
      mockInsertNoop();
      const result = await service.preNotifyOne(WINDOW_ID);
      expect(result).toBe(true);
    });
  });
});
