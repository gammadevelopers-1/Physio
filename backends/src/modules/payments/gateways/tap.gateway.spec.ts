import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TapGateway } from './tap.gateway';
import { PaymentGatewayError } from './payment-gateway.error';
import { createHmac } from 'crypto';
import { CreateChargeParams, RefundParams } from './payment-gateway.interface';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SECRET_KEY     = 'sk_test_abc123';
const WEBHOOK_SECRET = 'wh_secret_xyz';
const API_URL        = 'https://api.tap.company/v2';

const mockConfigService = {
  get: jest.fn((key: string, fallback?: any) => {
    const cfg: Record<string, string> = {
      'payments.tap.secretKey':     SECRET_KEY,
      'payments.tap.webhookSecret': WEBHOOK_SECRET,
      'payments.tap.apiUrl':        API_URL,
    };
    return cfg[key] ?? fallback ?? '';
  }),
};

const baseChargeParams: CreateChargeParams = {
  amount: 500,
  currency: 'SAR',
  description: 'Course enrollment',
  customerName: 'Ahmed Al-Saud',
  customerEmail: 'ahmed@example.sa',
  redirectUrl: 'http://localhost:3000/payment/callback',
  webhookUrl: 'http://localhost:8080/api/webhooks/tap',
  paymentMethod: 'card',
  metadata: {
    paymentId: 'pay-uuid-123',
    enrollmentId: 'enr-uuid-123',
    courseId: 'crs-uuid-123',
    userId: 'usr-uuid-123',
  },
  locale: 'en',
};

const refundParams: RefundParams = {
  gatewayChargeId: 'chg_tap_abc123',
  amount: 100,
  reason: 'Student requested refund',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWebhookBody(status: string, extra: any = {}) {
  return {
    id: 'chg_tap_test123',
    object: 'charge',
    status,
    created: Date.now(),
    response: { code: '000', message: 'Approved' },
    ...extra,
  };
}

function signWebhook(body: any, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TapGateway', () => {
  let gateway: TapGateway;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TapGateway,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<TapGateway>(TapGateway);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => jest.restoreAllMocks());

  // ── Identity ─────────────────────────────────────────────────────────────────
  describe('identity', () => {
    it('has name "tap"', () => {
      expect(gateway.name).toBe('tap');
    });
  });

  // ── createCharge ─────────────────────────────────────────────────────────────
  describe('createCharge()', () => {
    const tapResp = {
      id: 'chg_tap_001',
      status: 'INITIATED',
      transaction: { url: 'https://checkout.tap.company/v2/chg_tap_001' },
    };

    function mockOk(data: any = tapResp) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(data),
      } as any);
    }

    function mockErr(data: any, status = 400) {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status,
        json: jest.fn().mockResolvedValue(data),
      } as any);
    }

    it('returns chargeId and redirectUrl on success', async () => {
      mockOk();
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.chargeId).toBe('chg_tap_001');
      expect(result.redirectUrl).toBe('https://checkout.tap.company/v2/chg_tap_001');
    });

    it('uses src_card for card payment method', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, paymentMethod: 'card' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.source.id).toBe('src_card');
    });

    it('uses src_sa.mada for mada payment method', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, paymentMethod: 'mada' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.source.id).toBe('src_sa.mada');
    });

    it('uses src_apple_pay for apple_pay payment method', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, paymentMethod: 'apple_pay' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.source.id).toBe('src_apple_pay');
    });

    it('defaults to src_card for undefined payment method', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, paymentMethod: undefined });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.source.id).toBe('src_card');
    });

    it('sends language=ar for Arabic locale', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, locale: 'ar' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.language).toBe('ar');
    });

    it('sends language=en for English locale', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, locale: 'en' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.language).toBe('en');
    });

    it('defaults to language=en when locale is undefined', async () => {
      mockOk();
      await gateway.createCharge({ ...baseChargeParams, locale: undefined });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.language).toBe('en');
    });

    it('includes Authorization Bearer header', async () => {
      mockOk();
      await gateway.createCharge(baseChargeParams);
      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((opts.headers as any)['Authorization']).toBe(`Bearer ${SECRET_KEY}`);
    });

    it('throws PaymentGatewayError on 4xx response', async () => {
      mockErr({ errors: [{ code: 'invalid_amount', description: 'Amount too low' }] });
      await expect(gateway.createCharge(baseChargeParams)).rejects.toThrow(PaymentGatewayError);
    });

    it('throws PaymentGatewayError with gateway="tap" on 4xx', async () => {
      mockErr({ errors: [{ code: 'invalid_amount', description: 'Amount too low' }] });
      try {
        await gateway.createCharge(baseChargeParams);
        throw new Error('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentGatewayError);
        expect((err as PaymentGatewayError).gateway).toBe('tap');
      }
    });

    it('falls back to redirect.url if transaction.url is missing', async () => {
      mockOk({
        id: 'chg_tap_002',
        status: 'INITIATED',
        redirect: { url: 'https://checkout.tap.company/v2/chg_tap_002' },
      });
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toBe('https://checkout.tap.company/v2/chg_tap_002');
    });

    it('sets rawResponse on the result', async () => {
      mockOk();
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse.id).toBe('chg_tap_001');
    });
  });

  // ── verifyWebhook ─────────────────────────────────────────────────────────────
  describe('verifyWebhook()', () => {
    const body = makeWebhookBody('CAPTURED');

    it('returns true for valid HMAC signature (hashstring header)', () => {
      expect(gateway.verifyWebhook({ hashstring: signWebhook(body) }, body)).toBe(true);
    });

    it('returns true for Hashstring (capital H) header', () => {
      expect(gateway.verifyWebhook({ Hashstring: signWebhook(body) }, body)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(gateway.verifyWebhook({ hashstring: 'invalid_hash' }, body)).toBe(false);
    });

    it('returns false when hashstring header is missing', () => {
      expect(gateway.verifyWebhook({}, body)).toBe(false);
    });

    it('returns false when TAP_WEBHOOK_SECRET is empty', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          TapGateway,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        ],
      }).compile();
      const gw = mod.get<TapGateway>(TapGateway);
      const hash = signWebhook(body);
      expect(gw.verifyWebhook({ hashstring: hash }, body)).toBe(false);
    });
  });

  // ── processWebhook ────────────────────────────────────────────────────────────
  describe('processWebhook()', () => {
    // Terminal → payment statuses
    const terminalCases: [string, 'paid' | 'failed' | 'refunded' | 'pending'][] = [
      ['CAPTURED',    'paid'],
      ['captured',    'paid'],      // lowercase
      ['REFUNDED',    'refunded'],
      ['FAILED',      'failed'],
      ['DECLINED',    'failed'],
      ['VOID',        'failed'],
      ['CANCELLED',   'failed'],
    ];

    test.each(terminalCases)('Tap status %s → %s', (tapStatus, expected) => {
      expect(gateway.processWebhook(makeWebhookBody(tapStatus)).status).toBe(expected);
    });

    // Non-terminal → pending (skip)
    const pendingCases = ['INITIATED', 'IN_PROGRESS', 'SAVED', 'UNKNOWN_XYZ'];

    test.each(pendingCases)('Tap status %s → pending (non-terminal)', (tapStatus) => {
      expect(gateway.processWebhook(makeWebhookBody(tapStatus)).status).toBe('pending');
    });

    it('extracts chargeId from body.id', () => {
      const result = gateway.processWebhook(makeWebhookBody('CAPTURED'));
      expect(result.chargeId).toBe('chg_tap_test123');
    });

    it('extracts chargeId from body.object.id as fallback', () => {
      const body = { object: { id: 'chg_from_object' }, status: 'CAPTURED' };
      expect(gateway.processWebhook(body).chargeId).toBe('chg_from_object');
    });

    // Error code extraction — only for failed statuses
    it('FAILED with code 51 → errorCode=insufficient_funds', () => {
      const body = makeWebhookBody('FAILED', { response: { code: '51', message: 'Insufficient Funds' } });
      expect(gateway.processWebhook(body).errorCode).toBe('insufficient_funds');
    });

    it('FAILED with code 54 → errorCode=card_expired', () => {
      const body = makeWebhookBody('FAILED', { response: { code: '54', message: 'Expired Card' } });
      expect(gateway.processWebhook(body).errorCode).toBe('card_expired');
    });

    it('FAILED with code 05 → errorCode=do_not_honor', () => {
      const body = makeWebhookBody('FAILED', { response: { code: '05', message: 'Do Not Honor' } });
      expect(gateway.processWebhook(body).errorCode).toBe('do_not_honor');
    });

    it('DECLINED with code 12 → errorCode=card_declined', () => {
      const body = makeWebhookBody('DECLINED', { response: { code: '12', message: 'Invalid Transaction' } });
      expect(gateway.processWebhook(body).errorCode).toBe('card_declined');
    });

    it('FAILED with acquirer code fallback when primary code is undefined', () => {
      const body = makeWebhookBody('FAILED', {
        response: { code: undefined },
        acquirer: { response: { code: '51' } },
      });
      expect(gateway.processWebhook(body).errorCode).toBe('insufficient_funds');
    });

    it('FAILED with no response code → errorCode=undefined', () => {
      const body = makeWebhookBody('FAILED', { response: {} });
      expect(gateway.processWebhook(body).errorCode).toBeUndefined();
    });

    it('CAPTURED → errorCode is undefined (no error on success)', () => {
      expect(gateway.processWebhook(makeWebhookBody('CAPTURED')).errorCode).toBeUndefined();
    });

    it('REFUNDED → errorCode is undefined', () => {
      expect(gateway.processWebhook(makeWebhookBody('REFUNDED')).errorCode).toBeUndefined();
    });

    it('includes rawData in result', () => {
      const body = makeWebhookBody('CAPTURED');
      expect(gateway.processWebhook(body).rawData).toBe(body);
    });
  });

  // ── getCharge ─────────────────────────────────────────────────────────────────
  describe('getCharge()', () => {
    it('returns charge data on 200', async () => {
      const chargeData = { id: 'chg_tap_001', status: 'CAPTURED' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(chargeData),
      } as any);
      const result = await gateway.getCharge('chg_tap_001');
      expect(result.id).toBe('chg_tap_001');
      expect(result.status).toBe('CAPTURED');
    });

    it('throws PaymentGatewayError on 404', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ errors: [{ code: 'not_found', description: 'Charge not found' }] }),
      } as any);
      await expect(gateway.getCharge('chg_nonexistent')).rejects.toThrow(PaymentGatewayError);
    });

    it('throws PaymentGatewayError with gateway="tap" on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ errors: [{ code: 'server_error', description: 'Internal error' }] }),
      } as any);
      try {
        await gateway.getCharge('chg_x');
        throw new Error('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentGatewayError);
        expect((err as PaymentGatewayError).gateway).toBe('tap');
      }
    });

    it('sends Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'chg_x', status: 'CAPTURED' }),
      } as any);
      await gateway.getCharge('chg_x');
      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((opts.headers as any)['Authorization']).toBe(`Bearer ${SECRET_KEY}`);
    });
  });

  // ── getPaymentStatus ──────────────────────────────────────────────────────────
  describe('getPaymentStatus()', () => {
    const cases = [
      ['CAPTURED',    'paid'],
      ['INITIATED',   'processing'],
      ['IN_PROGRESS', 'processing'],
      ['FAILED',      'failed'],
      ['DECLINED',    'failed'],
      ['REFUNDED',    'refunded'],
      ['VOID',        'cancelled'],
      ['CANCELLED',   'cancelled'],
      ['UNKNOWN',     'unknown'],
    ] as const;

    test.each(cases)('Tap status %s → NormalizedPaymentStatus=%s', async (tapStatus, expected) => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'chg_x', status: tapStatus }),
      } as any);
      expect(await gateway.getPaymentStatus('chg_x')).toBe(expected);
    });
  });

  // ── refund ────────────────────────────────────────────────────────────────────
  describe('refund()', () => {
    it('returns refundId and status on success', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'ref_tap_001', status: 'REFUNDED' }),
      } as any);
      const result = await gateway.refund(refundParams);
      expect(result.refundId).toBe('ref_tap_001');
      expect(result.status).toBe('refunded');
    });

    it('throws PaymentGatewayError on 4xx', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          errors: [{ code: 'invalid_refund', description: 'Refund not allowed' }],
        }),
      } as any);
      await expect(gateway.refund(refundParams)).rejects.toThrow(PaymentGatewayError);
    });

    it('sends charge_id and amount in payload', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'ref_tap_002', status: 'REFUNDED' }),
      } as any);
      await gateway.refund(refundParams);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.charge_id).toBe('chg_tap_abc123');
      expect(body.amount).toBe(100);
    });

    it('sends Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: 'ref_tap_003', status: 'REFUNDED' }),
      } as any);
      await gateway.refund(refundParams);
      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((opts.headers as any)['Authorization']).toBe(`Bearer ${SECRET_KEY}`);
    });

    it('includes rawResponse in result', async () => {
      const raw = { id: 'ref_tap_004', status: 'REFUNDED' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(raw),
      } as any);
      const result = await gateway.refund(refundParams);
      expect(result.rawResponse).toEqual(raw);
    });
  });

  // ── healthCheck ───────────────────────────────────────────────────────────────
  describe('healthCheck()', () => {
    it('returns healthy for 200', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      const result = await gateway.healthCheck();
      expect(result.gateway).toBe('tap');
      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('returns healthy for 401 (key issues in test env but API reachable)', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 } as any);
      expect((await gateway.healthCheck()).status).toBe('healthy');
    });

    it('returns degraded for 503', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 } as any);
      const result = await gateway.healthCheck();
      expect(result.status).toBe('degraded');
      expect(result.error).toContain('503');
    });

    it('returns down when fetch throws a network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await gateway.healthCheck();
      expect(result.status).toBe('down');
      expect(result.error).toBeDefined();
    });
  });

  // ── getSupportedPaymentMethods ────────────────────────────────────────────────
  describe('getSupportedPaymentMethods()', () => {
    it('includes Card via Tap, Mada, and Apple Pay', () => {
      const labels = gateway.getSupportedPaymentMethods().map(m => m.label);
      expect(labels).toContain('Card via Tap');
      expect(labels).toContain('Mada');
      expect(labels).toContain('Apple Pay');
    });

    it('Card via Tap covers SAR', () => {
      const card = gateway.getSupportedPaymentMethods().find(m => m.label === 'Card via Tap');
      expect(card?.currencies).toContain('SAR');
    });

    it('Mada only covers SAR', () => {
      const mada = gateway.getSupportedPaymentMethods().find(m => m.label === 'Mada');
      expect(mada?.currencies).toEqual(['SAR']);
    });

    it('Apple Pay type is wallet', () => {
      const ap = gateway.getSupportedPaymentMethods().find(m => m.label === 'Apple Pay');
      expect(ap?.type).toBe('wallet');
    });

    it('Apple Pay covers SAR', () => {
      const ap = gateway.getSupportedPaymentMethods().find(m => m.label === 'Apple Pay');
      expect(ap?.currencies).toContain('SAR');
    });
  });
});
