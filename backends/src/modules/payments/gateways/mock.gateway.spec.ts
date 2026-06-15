import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MockGateway } from './mock.gateway';
import { PaymentGatewayError } from './payment-gateway.error';
import { CreateChargeParams, RefundParams } from './payment-gateway.interface';

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:8080/api/payments/callback'),
};

const baseChargeParams: CreateChargeParams = {
  amount: 500,
  currency: 'SAR',
  description: 'Test course enrollment',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  redirectUrl: 'http://localhost:3000/payment/callback',
  webhookUrl: 'http://localhost:8080/api/webhooks/mock',
  metadata: {
    paymentId: 'payment-uuid-123',
    enrollmentId: 'enrollment-uuid-123',
    courseId: 'course-uuid-123',
    userId: 'user-uuid-123',
  },
};

const refundParams: RefundParams = {
  gatewayChargeId: 'mock_chg_abc123',
  amount: 100,
  reason: 'Test refund',
};

describe('MockGateway', () => {
  let gateway: MockGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockGateway,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<MockGateway>(MockGateway);
  });

  // ── Identity ─────────────────────────────────────────────────────────────────
  describe('identity', () => {
    it('has name "mock"', () => {
      expect(gateway.name).toBe('mock');
    });
  });

  // ── Configuration ─────────────────────────────────────────────────────────────
  describe('configure() / getConfig()', () => {
    it('defaults to success outcome with no errorCode and success refundOutcome', () => {
      const cfg = gateway.getConfig();
      expect(cfg.outcome).toBe('success');
      expect(cfg.errorCode).toBeUndefined();
      expect(cfg.refundOutcome).toBe('success');
    });

    it('configure() updates all config fields', () => {
      gateway.configure({ outcome: 'failure', errorCode: 'card_declined', refundOutcome: 'failure' });
      const cfg = gateway.getConfig();
      expect(cfg.outcome).toBe('failure');
      expect(cfg.errorCode).toBe('card_declined');
      expect(cfg.refundOutcome).toBe('failure');
    });

    it('configure() defaults refundOutcome to success when not provided', () => {
      gateway.configure({ outcome: 'pending' });
      expect(gateway.getConfig().refundOutcome).toBe('success');
    });

    it('setOutcome() resets errorCode and refundOutcome to defaults', () => {
      gateway.configure({ outcome: 'failure', errorCode: 'card_expired', refundOutcome: 'failure' });
      gateway.setOutcome('success');
      const cfg = gateway.getConfig();
      expect(cfg.outcome).toBe('success');
      expect(cfg.errorCode).toBeUndefined();
      expect(cfg.refundOutcome).toBe('success');
    });

    it('getConfig() returns a copy (not a reference)', () => {
      const cfg1 = gateway.getConfig();
      cfg1.outcome = 'failure';
      expect(gateway.getConfig().outcome).toBe('success');
    });
  });

  // ── createCharge ─────────────────────────────────────────────────────────────
  describe('createCharge()', () => {
    it('success — redirectUrl has status=paid', async () => {
      gateway.setOutcome('success');
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('status=paid');
      expect(result.chargeId).toMatch(/^mock_chg_/);
      expect(result.status).toBe('pending');
    });

    it('failure — redirectUrl has status=failed', async () => {
      gateway.setOutcome('failure');
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('status=failed');
    });

    it('failure with errorCode — redirectUrl includes error_code param', async () => {
      gateway.configure({ outcome: 'failure', errorCode: 'card_declined' });
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('status=failed');
      expect(result.redirectUrl).toContain('error_code=card_declined');
    });

    it('failure with insufficient_funds — redirectUrl includes error_code', async () => {
      gateway.configure({ outcome: 'failure', errorCode: 'insufficient_funds' });
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('error_code=insufficient_funds');
    });

    it('failure with 3ds_failed — redirectUrl includes error_code', async () => {
      gateway.configure({ outcome: 'failure', errorCode: '3ds_failed' });
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('error_code=3ds_failed');
    });

    it('failure without errorCode — no error_code param in redirectUrl', async () => {
      gateway.setOutcome('failure');
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).not.toContain('error_code=');
    });

    it('pending — redirectUrl has status=pending', async () => {
      gateway.setOutcome('pending');
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('status=pending');
    });

    it('refunded — redirectUrl has status=paid (payment processed first, then refunded separately)', async () => {
      gateway.setOutcome('refunded');
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain('status=paid');
    });

    it('always sets chargeResult.status to "pending" regardless of outcome', async () => {
      for (const outcome of ['success', 'failure', 'pending', 'refunded'] as const) {
        gateway.setOutcome(outcome);
        const result = await gateway.createCharge(baseChargeParams);
        expect(result.status).toBe('pending');
      }
    });

    it('includes payment_id in redirectUrl', async () => {
      const result = await gateway.createCharge(baseChargeParams);
      expect(result.redirectUrl).toContain(`payment_id=${baseChargeParams.metadata.paymentId}`);
    });
  });

  // ── verifyWebhook ─────────────────────────────────────────────────────────────
  describe('verifyWebhook()', () => {
    it('always returns true regardless of headers or body', () => {
      expect(gateway.verifyWebhook({}, {})).toBe(true);
      expect(gateway.verifyWebhook({ 'x-sig': 'invalid' }, { evil: true })).toBe(true);
    });
  });

  // ── processWebhook ────────────────────────────────────────────────────────────
  describe('processWebhook()', () => {
    it('reads chargeId from charge_id field', () => {
      const result = gateway.processWebhook({ charge_id: 'mock_chg_1', status: 'paid' });
      expect(result.chargeId).toBe('mock_chg_1');
      expect(result.status).toBe('paid');
    });

    it('reads chargeId from chargeId field (fallback)', () => {
      const result = gateway.processWebhook({ chargeId: 'mock_chg_2', status: 'failed' });
      expect(result.chargeId).toBe('mock_chg_2');
    });

    it('defaults status to "paid" if missing', () => {
      const result = gateway.processWebhook({ charge_id: 'mock_chg_3' });
      expect(result.status).toBe('paid');
    });

    it('passes through "failed" and "refunded" statuses', () => {
      expect(gateway.processWebhook({ charge_id: 'x', status: 'failed' }).status).toBe('failed');
      expect(gateway.processWebhook({ charge_id: 'x', status: 'refunded' }).status).toBe('refunded');
    });
  });

  // ── refund ────────────────────────────────────────────────────────────────────
  describe('refund()', () => {
    it('success refundOutcome — returns refundId and status=completed', async () => {
      gateway.configure({ outcome: 'success', refundOutcome: 'success' });
      const result = await gateway.refund(refundParams);
      expect(result.refundId).toMatch(/^mock_ref_/);
      expect(result.status).toBe('completed');
    });

    it('failure refundOutcome — throws PaymentGatewayError', async () => {
      gateway.configure({ outcome: 'success', refundOutcome: 'failure' });
      await expect(gateway.refund(refundParams)).rejects.toThrow(PaymentGatewayError);
    });

    it('failure refundOutcome — error has gateway="mock" and normalizedCode="gateway_error"', async () => {
      gateway.configure({ outcome: 'success', refundOutcome: 'failure' });
      try {
        await gateway.refund(refundParams);
        throw new Error('Expected PaymentGatewayError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentGatewayError);
        expect((err as PaymentGatewayError).gateway).toBe('mock');
        expect((err as PaymentGatewayError).normalizedCode).toBe('gateway_error');
      }
    });

    it('success by default (no refundOutcome set)', async () => {
      gateway.setOutcome('success'); // resets to defaults
      const result = await gateway.refund(refundParams);
      expect(result.status).toBe('completed');
    });
  });

  // ── getCharge ─────────────────────────────────────────────────────────────────
  describe('getCharge()', () => {
    const cases = [
      ['success',  'paid'],
      ['failure',  'failed'],
      ['pending',  'pending'],
      ['refunded', 'refunded'],
    ] as const;

    test.each(cases)('outcome=%s → charge.status=%s', async (outcome, expectedStatus) => {
      gateway.setOutcome(outcome);
      const charge = await gateway.getCharge('mock_chg_test');
      expect(charge.status).toBe(expectedStatus);
      expect(charge.id).toBe('mock_chg_test');
      expect(charge.currency).toBe('SAR');
    });
  });

  // ── getPaymentStatus ──────────────────────────────────────────────────────────
  describe('getPaymentStatus()', () => {
    const cases = [
      ['success',  'paid'],
      ['failure',  'failed'],
      ['pending',  'pending'],
      ['refunded', 'refunded'],
    ] as const;

    test.each(cases)('outcome=%s → NormalizedPaymentStatus=%s', async (outcome, expected) => {
      gateway.setOutcome(outcome);
      expect(await gateway.getPaymentStatus('mock_chg_test')).toBe(expected);
    });
  });

  // ── healthCheck ───────────────────────────────────────────────────────────────
  describe('healthCheck()', () => {
    it('always returns status=healthy with 0ms latency', async () => {
      const result = await gateway.healthCheck();
      expect(result.gateway).toBe('mock');
      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBe(0);
      expect(result.checkedAt).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });
  });

  // ── getSupportedPaymentMethods ────────────────────────────────────────────────
  describe('getSupportedPaymentMethods()', () => {
    it('returns one "card" method', () => {
      const methods = gateway.getSupportedPaymentMethods();
      expect(methods).toHaveLength(1);
      expect(methods[0].type).toBe('card');
      expect(methods[0].currencies).toContain('SAR');
    });
  });
});
