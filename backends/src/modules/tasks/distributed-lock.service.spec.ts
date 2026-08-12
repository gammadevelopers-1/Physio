import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DistributedLockService } from './distributed-lock.service';

// Mock ioredis so we test the lock protocol without a Redis instance.
// The mock captures the SET / EVAL calls so we can assert order + args.
const mockRedis = {
  set: jest.fn(),
  eval: jest.fn(),
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('ioredis', () => {
  const MockCtor = jest.fn().mockImplementation(() => mockRedis);
  return { __esModule: true, default: MockCtor };
});

/*
 * Tests documented against the SET NX EX / CAS-release lock protocol:
 *   acquire  = SET key <token> PX <ttl> NX  (atomic set-if-not-exists)
 *   release  = EVAL "if get(k)==t then del(k) end" — only owner deletes
 */
describe('DistributedLockService', () => {
  let service: DistributedLockService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Force the "REDIS_HOST is set" branch so the client actually
    // instantiates. Config values feed through the ConfigService mock.
    process.env.REDIS_HOST = 'redis-test-host';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def: any) => {
              const map: Record<string, any> = {
                'processing.redis.host': 'redis-test-host',
                'processing.redis.port': 6379,
                'processing.redis.tls': false,
              };
              return map[key] ?? def;
            },
          },
        },
      ],
    }).compile();
    service = module.get<DistributedLockService>(DistributedLockService);
  });

  afterEach(() => {
    delete process.env.REDIS_HOST;
  });

  it('runs the body when lock is acquired (SET returns OK)', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    mockRedis.eval.mockResolvedValueOnce(1);

    const body = jest.fn().mockResolvedValue('result-value');
    const result = await service.withLock('k', 30_000, body);

    expect(result).toBe('result-value');
    expect(body).toHaveBeenCalledTimes(1);

    // SET was called with NX + PX + our TTL
    const setArgs = mockRedis.set.mock.calls[0];
    expect(setArgs[0]).toBe('k');
    expect(setArgs[2]).toBe('PX');
    expect(setArgs[3]).toBe(30_000);
    expect(setArgs[4]).toBe('NX');
    const token = setArgs[1];
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    // Release was called with the same token
    const evalArgs = mockRedis.eval.mock.calls[0];
    expect(evalArgs[1]).toBe(1); // numkeys
    expect(evalArgs[2]).toBe('k');
    expect(evalArgs[3]).toBe(token);
  });

  it('skips the body and returns null when SET NX fails (lock held)', async () => {
    mockRedis.set.mockResolvedValueOnce(null);

    const body = jest.fn();
    const result = await service.withLock('k', 30_000, body);

    expect(result).toBeNull();
    expect(body).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('runs body without a lock (and does not eval-release) when SET throws', async () => {
    mockRedis.set.mockRejectedValueOnce(new Error('redis down'));

    const body = jest.fn().mockResolvedValue(42);
    const result = await service.withLock('k', 30_000, body);

    expect(result).toBe(42);
    expect(body).toHaveBeenCalledTimes(1);
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('releases the lock even when body throws', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    mockRedis.eval.mockResolvedValueOnce(1);

    const body = jest.fn().mockRejectedValueOnce(new Error('body kaboom'));
    await expect(service.withLock('k', 30_000, body)).rejects.toThrow(
      'body kaboom',
    );
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
  });

  it('uses a unique token per invocation (no token reuse across calls)', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.eval.mockResolvedValue(1);

    await service.withLock('k', 30_000, async () => 1);
    await service.withLock('k', 30_000, async () => 2);

    const token1 = mockRedis.set.mock.calls[0][1];
    const token2 = mockRedis.set.mock.calls[1][1];
    expect(token1).not.toBe(token2);
  });
});
