import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TamaraGateway } from './tamara.gateway';

// Mocks the global fetch so we can drive different Tamara API responses
// per-test without hitting the network.
const originalFetch = global.fetch;

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'payments.tamara.apiToken') return 'test-api-token';
    if (key === 'payments.tamara.notificationToken') return 'notif-secret';
    if (key === 'payments.tamara.apiUrl') return 'https://api-sandbox.tamara.co';
    return fallback;
  }),
};

const APPROVED_WEBHOOK_BODY = {
  event_type: 'order_approved',
  order_id: 'tamara-order-xyz',
  total_amount: { amount: 500, currency: 'SAR' },
};

// Build an OK fetch response that returns a given JSON body.
function okJson(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Build an error fetch response.
function errJson(body: any, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TamaraGateway', () => {
  let gateway: TamaraGateway;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TamaraGateway,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    gateway = module.get<TamaraGateway>(TamaraGateway);

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // ── verifyWebhook ────────────────────────────────────────────────────────────
  describe('verifyWebhook()', () => {
    it('accepts request with correct notification-token header', () => {
      expect(
        gateway.verifyWebhook({ 'notification-token': 'notif-secret' }, {}),
      ).toBe(true);
    });

    it('rejects request with wrong notification-token header', () => {
      expect(
        gateway.verifyWebhook({ 'notification-token': 'wrong-token' }, {}),
      ).toBe(false);
    });

    it('rejects request with no header', () => {
      expect(gateway.verifyWebhook({}, {})).toBe(false);
    });
  });

  // ── processWebhook: the critical authorise + capture flow ────────────────────
  describe('processWebhook() — order_approved', () => {
    it('CRITICAL: calls authorise then capture, returns paid on success', async () => {
      fetchMock
        .mockResolvedValueOnce(okJson({ status: 'authorised' })) // authorise
        .mockResolvedValueOnce(okJson({ status: 'captured' })); // capture

      const result = await gateway.processWebhook(APPROVED_WEBHOOK_BODY);

      expect(result.status).toBe('paid');
      expect(result.chargeId).toBe('tamara-order-xyz');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const authoriseCall = fetchMock.mock.calls[0];
      expect(authoriseCall[0]).toBe(
        'https://api-sandbox.tamara.co/orders/tamara-order-xyz/authorise',
      );
      expect(authoriseCall[1]?.method).toBe('POST');

      const captureCall = fetchMock.mock.calls[1];
      expect(captureCall[0]).toBe('https://api-sandbox.tamara.co/payments/capture');
      expect(captureCall[1]?.method).toBe('POST');
      expect(JSON.parse(captureCall[1]?.body as string)).toEqual({
        order_id: 'tamara-order-xyz',
        total_amount: { amount: 500, currency: 'SAR' },
      });
    });

    it('CRITICAL: returns pending (not paid) if Authorise fails — webhook will be retried by Tamara', async () => {
      // fetchWithRetry retries 5xx 3 times before giving up.
      fetchMock.mockResolvedValue(errJson({ message: 'Service unavailable' }, 503));

      const result = await gateway.processWebhook(APPROVED_WEBHOOK_BODY);

      expect(result.status).toBe('pending');
      expect(result.errorCode).toBe('authorise_failed');
      expect(result.chargeId).toBe('tamara-order-xyz');
    });

    it('CRITICAL: returns pending if Authorise succeeds but Capture fails', async () => {
      fetchMock
        .mockResolvedValueOnce(okJson({ status: 'authorised' })) // authorise OK
        .mockResolvedValue(errJson({ message: 'Capture down' }, 503)); // capture 5xx (3 retries)

      const result = await gateway.processWebhook(APPROVED_WEBHOOK_BODY);

      expect(result.status).toBe('pending');
      expect(result.errorCode).toBe('capture_failed');
    });

    it('treats Authorise 409 (already authorised) as success — Tamara is idempotent', async () => {
      fetchMock
        .mockResolvedValueOnce(errJson({ message: 'Already authorised' }, 409)) // authorise 409
        .mockResolvedValueOnce(okJson({ status: 'captured' })); // capture OK

      const result = await gateway.processWebhook(APPROVED_WEBHOOK_BODY);

      expect(result.status).toBe('paid');
    });

    it('skips Authorise for order_authorised event but still captures', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'captured' })); // capture only

      const result = await gateway.processWebhook({
        ...APPROVED_WEBHOOK_BODY,
        event_type: 'order_authorised',
      });

      expect(result.status).toBe('paid');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/payments/capture');
    });

    it('rejects malformed webhook missing total_amount', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_approved',
        order_id: 'tamara-order-xyz',
      });

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('malformed_webhook');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook() — terminal events', () => {
    it('order_captured → paid (already captured by us via authorise webhook)', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_captured',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('paid');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('order_declined → failed with order_declined errorCode', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_declined',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('order_declined');
    });

    it('order_expired → failed with authorise_window_expired errorCode (72h missed)', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_expired',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('authorise_window_expired');
    });

    it('order_canceled → failed with order_cancelled errorCode', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_canceled',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('order_cancelled');
    });

    it('order_refunded → refunded', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_refunded',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('refunded');
    });

    it('unknown event_type → failed with unknown_event errorCode (defensive)', async () => {
      const result = await gateway.processWebhook({
        event_type: 'order_chargeback_received',
        order_id: 'tamara-order-xyz',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('unknown_event');
    });
  });

  // ── getPaymentStatus ─────────────────────────────────────────────────────────
  describe('getPaymentStatus()', () => {
    it('CRITICAL: "approved" maps to pending — NOT paid (funds not yet captured)', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'approved' }));
      const status = await gateway.getPaymentStatus('order-id');
      expect(status).toBe('pending');
    });

    it('"authorised" maps to pending — we still need to capture', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'authorised' }));
      const status = await gateway.getPaymentStatus('order-id');
      expect(status).toBe('pending');
    });

    it('"fully_captured" maps to paid', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'fully_captured' }));
      const status = await gateway.getPaymentStatus('order-id');
      expect(status).toBe('paid');
    });

    it('"expired" maps to failed', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'expired' }));
      const status = await gateway.getPaymentStatus('order-id');
      expect(status).toBe('failed');
    });

    it('"fully_refunded" maps to refunded', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ status: 'fully_refunded' }));
      const status = await gateway.getPaymentStatus('order-id');
      expect(status).toBe('refunded');
    });
  });

  // ── createCharge URLs ────────────────────────────────────────────────────────
  describe('createCharge()', () => {
    it('passes cancelUrl through as both cancel and failure (not no-op string-replace)', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson({ order_id: 'created-order', checkout_url: 'https://checkout' }),
      );

      await gateway.createCharge({
        amount: 500,
        currency: 'SAR',
        description: 'Test',
        customerName: 'Ahmed Test',
        customerEmail: 'a@b.com',
        redirectUrl: 'https://example.com/payment/callback?gateway=tamara&payment_id=X',
        cancelUrl: 'https://example.com/en/checkout?expressCourseId=X',
        webhookUrl: 'https://example.com/api/webhooks/tamara',
        metadata: { paymentId: 'pid', enrollmentId: 'eid', courseId: 'cid', userId: 'uid' },
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(body.merchant_url.success).toBe(
        'https://example.com/payment/callback?gateway=tamara&payment_id=X',
      );
      expect(body.merchant_url.cancel).toBe(
        'https://example.com/en/checkout?expressCourseId=X',
      );
      expect(body.merchant_url.failure).toBe(
        'https://example.com/en/checkout?expressCourseId=X',
      );
    });
  });
});
