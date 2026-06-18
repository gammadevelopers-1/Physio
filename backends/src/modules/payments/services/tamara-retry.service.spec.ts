import { Test, TestingModule } from '@nestjs/testing';
import { TamaraRetryService } from './tamara-retry.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { PaymentsService } from '../payments.service';
import { InvoiceService } from './invoice.service';
import { EmailService } from '../../email/email.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock the db module — db.select() / db.update() are chainable thenables
// so we return jest.fn().mockReturnValue(...) chains per test.
jest.mock('../../../database', () => ({ db: jest.fn() }));
import { db } from '../../../database';

describe('TamaraRetryService — retryOne', () => {
  let service: TamaraRetryService;
  let gatewayFactory: { getGateway: jest.Mock };
  let tamaraGateway: {
    getPaymentStatus: jest.Mock;
    authoriseOrder: jest.Mock;
    captureOrder: jest.Mock;
  };
  let paymentsService: {
    processPaymentSuccess: jest.Mock;
    processPaymentFailure: jest.Mock;
  };
  let invoiceService: {
    generateInvoice: jest.Mock;
    getInvoicePdfBuffer: jest.Mock;
  };
  let emailService: {
    sendPaymentConfirmation: jest.Mock;
    sendTamaraStuckAlert: jest.Mock;
  };
  let auditLogService: { log: jest.Mock };

  function setupDbSelect(row: any) {
    (db as any).select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    });
    (db as any).update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });
  }

  beforeEach(async () => {
    tamaraGateway = {
      getPaymentStatus: jest.fn(),
      authoriseOrder: jest.fn(),
      captureOrder: jest.fn(),
    };
    gatewayFactory = { getGateway: jest.fn().mockReturnValue(tamaraGateway) };
    paymentsService = {
      processPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      processPaymentFailure: jest.fn().mockResolvedValue(undefined),
    };
    invoiceService = {
      generateInvoice: jest.fn().mockResolvedValue(undefined),
      getInvoicePdfBuffer: jest.fn().mockResolvedValue(null),
    };
    emailService = {
      sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
      sendTamaraStuckAlert: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TamaraRetryService,
        { provide: GatewayFactory, useValue: gatewayFactory },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<TamaraRetryService>(TamaraRetryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── error paths ─────────────────────────────────────────────────────────────
  it('throws NotFoundException for unknown payment id', async () => {
    setupDbSelect(null);
    await expect(service.retryOne('missing', 'system-cron')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException for non-Tamara payment', async () => {
    setupDbSelect({ id: 'p1', gateway: 'moyasar' });
    await expect(service.retryOne('p1', 'system-cron')).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── no-op paths ─────────────────────────────────────────────────────────────
  it('no-op for payment already in PAID state', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'paid',
      gatewayChargeId: 'order-x',
    });
    const result = await service.retryOne('p1', 'system-cron');
    expect(result.action).toBe('no_op');
    expect(result.detail).toBe('Already paid');
    expect(tamaraGateway.getPaymentStatus).not.toHaveBeenCalled();
  });

  it('no-op for payment in terminal FAILED state', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'failed',
      gatewayChargeId: 'order-x',
    });
    const result = await service.retryOne('p1', 'system-cron');
    expect(result.action).toBe('no_op');
  });

  it('no-op when buyer never reached Tamara (no gatewayChargeId)', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: null,
    });
    const result = await service.retryOne('p1', 'system-cron');
    expect(result.action).toBe('no_op');
    expect(result.detail).toContain('never reached Tamara');
  });

  // ── happy path: Tamara already captured ─────────────────────────────────────
  it('flips payment to paid + generates invoice + emails when Tamara reports captured', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: 'order-x',
      userId: 'u1',
      amount: '500.00',
      currency: 'SAR',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: {},
    });
    tamaraGateway.getPaymentStatus.mockResolvedValue('paid');

    const result = await service.retryOne('p1', 'system-cron');

    expect(result.action).toBe('paid');
    expect(paymentsService.processPaymentSuccess).toHaveBeenCalledWith('p1');
    expect(invoiceService.generateInvoice).toHaveBeenCalledWith('p1');
    expect(emailService.sendPaymentConfirmation).toHaveBeenCalled();
    expect(tamaraGateway.authoriseOrder).not.toHaveBeenCalled();
    expect(tamaraGateway.captureOrder).not.toHaveBeenCalled();
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tamara_retry_resolved_paid' }),
    );
  });

  // ── retry path: Tamara still approved/authorised, we call authorise+capture ─
  it('calls authorise + capture when Tamara reports pending, flips to paid on success', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: 'order-x',
      userId: 'u1',
      amount: '500.00',
      currency: 'SAR',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: {},
    });
    tamaraGateway.getPaymentStatus.mockResolvedValue('pending');
    tamaraGateway.authoriseOrder.mockResolvedValue(undefined);
    tamaraGateway.captureOrder.mockResolvedValue(undefined);

    const result = await service.retryOne('p1', 'system-cron');

    expect(result.action).toBe('paid');
    expect(tamaraGateway.authoriseOrder).toHaveBeenCalledWith('order-x');
    expect(tamaraGateway.captureOrder).toHaveBeenCalledWith('order-x', 500, 'SAR');
    expect(paymentsService.processPaymentSuccess).toHaveBeenCalled();
  });

  // ── failure paths ───────────────────────────────────────────────────────────
  it('marks payment failed when Tamara reports terminal failed state', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: 'order-x',
      userId: 'u1',
      amount: '500.00',
      currency: 'SAR',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: {},
    });
    tamaraGateway.getPaymentStatus.mockResolvedValue('failed');

    const result = await service.retryOne('p1', 'system-cron');

    expect(result.action).toBe('failed');
    expect(paymentsService.processPaymentFailure).toHaveBeenCalledWith(
      'p1',
      expect.stringContaining('failed'),
      'tamara_terminal_failure',
    );
    expect(tamaraGateway.authoriseOrder).not.toHaveBeenCalled();
  });

  it('records attempt + returns "retried" when authorise/capture both fail', async () => {
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: 'order-x',
      userId: 'u1',
      amount: '500.00',
      currency: 'SAR',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: {},
    });
    tamaraGateway.getPaymentStatus.mockResolvedValue('pending');
    tamaraGateway.authoriseOrder.mockRejectedValue(new Error('Tamara 503'));

    const result = await service.retryOne('p1', 'system-cron');

    expect(result.action).toBe('retried');
    expect(result.detail).toContain('Tamara 503');
    expect(paymentsService.processPaymentSuccess).not.toHaveBeenCalled();
    expect(paymentsService.processPaymentFailure).not.toHaveBeenCalled();
  });

  // ── escalation guardrails ───────────────────────────────────────────────────
  it('gives up + marks failed once stuck past GIVE_UP_HOURS', async () => {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    setupDbSelect({
      id: 'p1',
      gateway: 'tamara',
      status: 'pending',
      gatewayChargeId: 'order-x',
      userId: 'u1',
      amount: '500.00',
      currency: 'SAR',
      createdAt: seventyTwoHoursAgo,
      metadata: {},
    });
    tamaraGateway.getPaymentStatus.mockResolvedValue('pending');
    tamaraGateway.authoriseOrder.mockRejectedValue(new Error('Still failing'));

    const result = await service.retryOne('p1', 'system-cron');

    expect(result.action).toBe('failed');
    expect(result.detail).toContain('Gave up');
    expect(paymentsService.processPaymentFailure).toHaveBeenCalledWith(
      'p1',
      expect.stringContaining('Tamara retry exhausted'),
      'tamara_retry_exhausted',
    );
  });
});
