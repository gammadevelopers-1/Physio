import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { TabbyGateway } from './tabby.gateway';
import { CreateChargeParams } from './payment-gateway.interface';
import { PaymentGatewayError } from './payment-gateway.error';

const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;

const WEBHOOK_SECRET = 'tabby-test-webhook-secret';

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'payments.tabby.secretKey') return 'sk_test_xxx';
    if (key === 'payments.tabby.publicKey') return 'pk_test_xxx';
    if (key === 'payments.tabby.webhookSecret') return WEBHOOK_SECRET;
    if (key === 'payments.tabby.apiUrl') return 'https://api.tabby.ai/api/v2';
    if (key === 'payments.tabby.merchantCode') return 'PHYS';
    return fallback;
  }),
};

function okJson(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errJson(body: any, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeChargeParams(
  overrides: Partial<CreateChargeParams> = {},
): CreateChargeParams {
  return {
    amount: 500,
    currency: 'SAR',
    description: 'Test course',
    customerName: 'Test Buyer',
    customerEmail: 'buyer@example.com',
    customerPhone: '+966500000000',
    customerRegisteredSince: '2024-01-15T00:00:00.000Z',
    redirectUrl: 'https://app.test/payment/callback?gateway=tabby&payment_id=p1',
    cancelUrl: 'https://app.test/en/checkout?expressCourseId=c1',
    webhookUrl: 'https://app.test/api/webhooks/tabby',
    metadata: {
      paymentId: 'p1',
      enrollmentId: 'e1',
      courseId: 'c1',
      courseIds: ['c1'],
      userId: 'u1',
    },
    locale: 'en',
    ...overrides,
  };
}

describe('TabbyGateway', () => {
  let gateway: TabbyGateway;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TabbyGateway,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    gateway = module.get<TabbyGateway>(TabbyGateway);

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  // ── createCharge ──────────────────────────────────────────────────────────
  describe('createCharge()', () => {
    it('posts merchant_code from config (not the old hardcoded value)', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson({
          payment: { id: 'tabby-payment-123' },
          configuration: {
            available_products: {
              installments: [{ web_url: 'https://checkout.tabby.ai/abc' }],
            },
          },
        }),
      );

      await gateway.createCharge(makeChargeParams());

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.merchant_code).toBe('PHYS');
      expect(body.merchant_code).not.toBe('physioguidance');
    });

    it('uses the passed customerRegisteredSince, not "now"', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson({
          payment: { id: 'tabby-payment-123' },
          configuration: {
            available_products: { installments: [{ web_url: 'https://x' }] },
          },
        }),
      );

      await gateway.createCharge(makeChargeParams());

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.payment.buyer_history.registered_since).toBe(
        '2024-01-15T00:00:00.000Z',
      );
    });

    it('falls back to "now" when no customerRegisteredSince provided', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson({
          payment: { id: 'tabby-payment-123' },
          configuration: {
            available_products: { installments: [{ web_url: 'https://x' }] },
          },
        }),
      );

      await gateway.createCharge(
        makeChargeParams({ customerRegisteredSince: undefined }),
      );

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.payment.buyer_history.registered_since).toBeDefined();
      expect(new Date(body.payment.buyer_history.registered_since).getTime())
        .toBeGreaterThan(Date.now() - 5000);
    });

    it('sends cancel + failure URLs that route back to checkout (not success)', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson({
          payment: { id: 'tabby-payment-123' },
          configuration: {
            available_products: { installments: [{ web_url: 'https://x' }] },
          },
        }),
      );

      await gateway.createCharge(makeChargeParams());

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.merchant_urls.success).toContain('payment/callback');
      expect(body.merchant_urls.cancel).toContain('/checkout');
      expect(body.merchant_urls.failure).toContain('/checkout');
      expect(body.merchant_urls.cancel).not.toBe(body.merchant_urls.success);
    });

    it('throws gateway_error when merchantCode is missing', async () => {
      const noMerchantConfig = {
        get: jest.fn((key: string) => {
          if (key === 'payments.tabby.merchantCode') return '';
          return mockConfigService.get(key);
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          TabbyGateway,
          { provide: ConfigService, useValue: noMerchantConfig },
        ],
      }).compile();
      const g = mod.get<TabbyGateway>(TabbyGateway);

      await expect(g.createCharge(makeChargeParams())).rejects.toThrow(
        PaymentGatewayError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws PaymentGatewayError on non-200 response', async () => {
      fetchMock.mockResolvedValueOnce(
        errJson({ error: 'invalid_buyer' }, 400),
      );

      await expect(gateway.createCharge(makeChargeParams())).rejects.toThrow(
        PaymentGatewayError,
      );
    });
  });

  // ── verifyWebhook ─────────────────────────────────────────────────────────
  describe('verifyWebhook()', () => {
    function sign(body: any): string {
      const bodyStr = JSON.stringify(body);
      return createHmac('sha256', WEBHOOK_SECRET).update(bodyStr).digest('hex');
    }

    it('accepts request with valid X-Tabby-Signature (per Tabby docs)', () => {
      const body = { id: 'pay-1', status: 'AUTHORIZED' };
      const sig = sign(body);

      expect(
        gateway.verifyWebhook({ 'x-tabby-signature': sig }, body),
      ).toBe(true);
    });

    it('still accepts legacy X-Tabby-Hmac-SHA256 header', () => {
      const body = { id: 'pay-1', status: 'AUTHORIZED' };
      const sig = sign(body);

      expect(
        gateway.verifyWebhook({ 'x-tabby-hmac-sha256': sig }, body),
      ).toBe(true);
    });

    it('rejects a tampered body', () => {
      const body = { id: 'pay-1', status: 'AUTHORIZED' };
      const sig = sign(body);
      const tampered = { id: 'pay-1', status: 'CLOSED' };

      expect(
        gateway.verifyWebhook({ 'x-tabby-signature': sig }, tampered),
      ).toBe(false);
    });

    it('rejects request with no signature header', () => {
      expect(
        gateway.verifyWebhook({}, { id: 'pay-1', status: 'AUTHORIZED' }),
      ).toBe(false);
    });

    it('in production with missing webhook secret returns false', async () => {
      const noSecretConfig = {
        get: jest.fn((key: string) => {
          if (key === 'payments.tabby.webhookSecret') return '';
          return mockConfigService.get(key);
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          TabbyGateway,
          { provide: ConfigService, useValue: noSecretConfig },
        ],
      }).compile();
      const g = mod.get<TabbyGateway>(TabbyGateway);
      process.env.NODE_ENV = 'production';

      expect(g.verifyWebhook({ 'x-tabby-signature': 'whatever' }, {})).toBe(
        false,
      );
    });

    it('in non-prod with missing webhook secret accepts (sandbox affordance)', async () => {
      const noSecretConfig = {
        get: jest.fn((key: string) => {
          if (key === 'payments.tabby.webhookSecret') return '';
          return mockConfigService.get(key);
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          TabbyGateway,
          { provide: ConfigService, useValue: noSecretConfig },
        ],
      }).compile();
      const g = mod.get<TabbyGateway>(TabbyGateway);
      process.env.NODE_ENV = 'development';

      expect(g.verifyWebhook({}, {})).toBe(true);
    });
  });

  // ── processWebhook ────────────────────────────────────────────────────────
  describe('processWebhook()', () => {
    it('maps AUTHORIZED → paid', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'AUTHORIZED',
      });
      expect(result.status).toBe('paid');
      expect(result.chargeId).toBe('pay-1');
    });

    it('maps CLOSED → paid', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'CLOSED',
      });
      expect(result.status).toBe('paid');
    });

    it('maps REFUNDED → refunded', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'REFUNDED',
      });
      expect(result.status).toBe('refunded');
    });

    it('maps REJECTED → failed with rejection_reason as errorCode', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'REJECTED',
        rejection_reason: 'not_available',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('not_available');
    });

    it('maps REJECTED with no rejection_reason → failed errorCode "rejected"', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'REJECTED',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('rejected');
    });

    it('maps EXPIRED → failed errorCode "session_expired"', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'EXPIRED',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('session_expired');
    });

    it('maps CANCELLED → failed errorCode "cancelled" (UK + US spellings)', async () => {
      const r1 = await gateway.processWebhook({
        id: 'pay-1',
        status: 'CANCELLED',
      });
      const r2 = await gateway.processWebhook({
        id: 'pay-1',
        status: 'CANCELED',
      });
      expect(r1.status).toBe('failed');
      expect(r1.errorCode).toBe('cancelled');
      expect(r2.status).toBe('failed');
      expect(r2.errorCode).toBe('cancelled');
    });

    it('maps CREATED → pending (controller silently drops this)', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'CREATED',
      });
      expect(result.status).toBe('pending');
    });

    it('maps unknown status → failed with descriptive errorCode', async () => {
      const result = await gateway.processWebhook({
        id: 'pay-1',
        status: 'WAT',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('unknown_status_wat');
    });

    it('handles malformed body (missing id) without crashing', async () => {
      const result = await gateway.processWebhook({ status: 'AUTHORIZED' });
      expect(result.status).toBe('paid');
      expect(result.chargeId).toBeUndefined();
    });
  });

  // ── getPaymentStatus ──────────────────────────────────────────────────────
  describe('getPaymentStatus()', () => {
    it('maps AUTHORIZED → paid', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'AUTHORIZED' }));
      await expect(gateway.getPaymentStatus('p1')).resolves.toBe('paid');
    });

    it('maps CLOSED → paid', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'CLOSED' }));
      await expect(gateway.getPaymentStatus('p1')).resolves.toBe('paid');
    });

    it('maps CREATED → pending', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'CREATED' }));
      await expect(gateway.getPaymentStatus('p1')).resolves.toBe('pending');
    });

    it('maps REJECTED → failed', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'REJECTED' }));
      await expect(gateway.getPaymentStatus('p1')).resolves.toBe('failed');
    });

    it('maps EXPIRED → failed', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'EXPIRED' }));
      await expect(gateway.getPaymentStatus('p1')).resolves.toBe('failed');
    });
  });
});
