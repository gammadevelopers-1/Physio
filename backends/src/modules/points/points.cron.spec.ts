import { Test, TestingModule } from '@nestjs/testing';
import { PointsCronService } from './points.cron';
import { TasksService } from '../tasks/tasks.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';

jest.mock('../../database', () => ({ db: jest.fn() }));
import { db } from '../../database';

/*
 * releaseHoldOne — CAS-first correctness anchor.
 *
 * Race we're defending against:
 *   Cloud Task fires at expiresAt → releaseHoldOne selects redemption
 *   pending. Meanwhile the checkout flow commits it to 'applied'. If we
 *   inserted the compensating credit BEFORE the CAS UPDATE, we'd have
 *   already double-credited the user before finding out the CAS fails.
 *   Solution: CAS UPDATE first; credit only if we won.
 */
describe('PointsCronService — releaseHoldOne', () => {
  let service: PointsCronService;
  const REDEMPTION_ID = '00000000-0000-4000-a000-000000000004';

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

  function mockInsertNoop() {
    (db as any).insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      }),
    });
  }

  const pendingRedemption = (overrides: any = {}) => ({
    id: REDEMPTION_ID,
    userId: 'user-1',
    pointsUsed: 100,
    status: 'pending',
    expiresAt: new Date(Date.now() - 60_000), // 1 min ago
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsCronService,
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
    service = module.get(PointsCronService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns false when redemption not found', async () => {
    mockSelectRow(null);
    expect(await service.releaseHoldOne(REDEMPTION_ID)).toBe(false);
  });

  it('returns false when status is not pending (already applied/released)', async () => {
    mockSelectRow(pendingRedemption({ status: 'applied' }));
    expect(await service.releaseHoldOne(REDEMPTION_ID)).toBe(false);
  });

  it('returns false when expiresAt is still in the future', async () => {
    mockSelectRow(pendingRedemption({ expiresAt: new Date(Date.now() + 60_000) }));
    expect(await service.releaseHoldOne(REDEMPTION_ID)).toBe(false);
  });

  it('flips pending -> released and inserts compensating credit when CAS wins', async () => {
    mockSelectRow(pendingRedemption());
    mockCasUpdate([{ id: REDEMPTION_ID }]);
    mockInsertNoop();

    const result = await service.releaseHoldOne(REDEMPTION_ID);
    expect(result).toBe(true);
    // Verify credit insert was attempted with correct idempotency key.
    const insertCall = (db as any).insert.mock.calls[0];
    expect(insertCall).toBeDefined();
    const valuesCall = (db as any).insert.mock.results[0].value.values.mock.calls[0][0];
    expect(valuesCall.userId).toBe('user-1');
    expect(valuesCall.delta).toBe(100);
    expect(valuesCall.idempotencyKey).toBe(`redeem_released:${REDEMPTION_ID}`);
  });

  it('CRITICAL: does NOT insert compensating credit when CAS loses race with concurrent commit', async () => {
    mockSelectRow(pendingRedemption());
    mockCasUpdate([]); // race lost — someone else flipped status
    mockInsertNoop();

    const result = await service.releaseHoldOne(REDEMPTION_ID);
    expect(result).toBe(false);
    // Confirm no INSERT was called — if this fails, we're double-crediting users
    expect((db as any).insert).not.toHaveBeenCalled();
  });

  it('is idempotent on retry (credit uses onConflictDoNothing)', async () => {
    mockSelectRow(pendingRedemption());
    mockCasUpdate([{ id: REDEMPTION_ID }]);
    mockInsertNoop();

    // Simulate two back-to-back task deliveries. Second one would see
    // status='released' from first and return false at the status
    // check. Verified below.
    await service.releaseHoldOne(REDEMPTION_ID);

    // Reset for second delivery — this time the row is 'released'
    mockSelectRow(pendingRedemption({ status: 'released' }));
    const secondResult = await service.releaseHoldOne(REDEMPTION_ID);
    expect(secondResult).toBe(false);
  });
});
