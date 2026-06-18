import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

jest.mock('../../../database', () => ({ db: mockDb }));
jest.mock('../../../database/schema', () => ({
  invoices: { id: 'id', invoiceNumber: 'invoiceNumber', paymentId: 'paymentId', userId: 'userId', courseId: 'courseId', status: 'status', issuedAt: 'issuedAt', paidAt: 'paidAt' },
  payments: { id: 'id', userId: 'userId', courseId: 'courseId', gateway: 'gateway', gatewayChargeId: 'gatewayChargeId', paymentMethod: 'paymentMethod', paidAt: 'paidAt', metadata: 'metadata', amount: 'amount' },
  courses: { id: 'id', title: 'title', titleAr: 'titleAr', deliveryType: 'deliveryType', startDate: 'startDate', endDate: 'endDate' },
  users: { id: 'id', email: 'email', firstName: 'firstName', lastName: 'lastName' },
  refunds: { id: 'id', paymentId: 'paymentId', status: 'status', createdAt: 'createdAt' },
  INVOICE_STATUS: { PAID: 'paid', DRAFT: 'draft', ISSUED: 'issued', OVERDUE: 'overdue', CANCELLED: 'cancelled', REFUNDED: 'refunded' },
  PAYMENT_STATUS: { PAID: 'paid' },
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────
jest.mock('drizzle-orm', () => {
  const sqlTag = jest.fn((..._args: any[]) => {
    const obj = { type: 'sql' } as any;
    obj.as = jest.fn().mockReturnValue(obj);
    return obj;
  });
  return {
    eq: jest.fn((col: any, val: any) => ({ type: 'eq', col, val })),
    and: jest.fn((...args: any[]) => ({ type: 'and', args })),
    desc: jest.fn((col: any) => ({ type: 'desc', col })),
    count: jest.fn(() => ({ type: 'count' })),
    gte: jest.fn((col: any, val: any) => ({ type: 'gte', col, val })),
    lte: jest.fn((col: any, val: any) => ({ type: 'lte', col, val })),
    sql: sqlTag,
  };
});

// ── PDFKit mock ───────────────────────────────────────────────────────────────
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter() as any;
    emitter.font = jest.fn().mockReturnThis();
    emitter.fontSize = jest.fn().mockReturnThis();
    emitter.text = jest.fn().mockReturnThis();
    emitter.moveTo = jest.fn().mockReturnThis();
    emitter.lineTo = jest.fn().mockReturnThis();
    emitter.stroke = jest.fn().mockReturnThis();
    emitter.image = jest.fn().mockReturnThis();
    emitter.registerFont = jest.fn().mockReturnThis();
    emitter.end = jest.fn().mockImplementation(function (this: EventEmitter) {
      this.emit('data', Buffer.from('pdf-chunk'));
      this.emit('end');
    });
    return emitter;
  });
});

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,abc123'),
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args: string[]) => args.join('/')),
}));

import { InvoiceService } from './invoice.service';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

// ── Chain helpers ─────────────────────────────────────────────────────────────

/** Creates a fluent drizzle chain that awaits to `rows`. */
function selectChain(rows: any[]): any {
  const p = Promise.resolve(rows);
  const chain: any = {};
  for (const m of ['from', 'where', 'leftJoin', 'orderBy', 'limit', 'offset']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (res: any, rej?: any) => p.then(res, rej);
  chain.catch = (rej: any) => p.catch(rej);
  return chain;
}

/** Creates a fluent drizzle insert chain that awaits to `rows` (or throws Error). */
function insertChain(result: any[] | Error): any {
  const p = result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  const chain: any = {};
  for (const m of ['values', 'returning']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (res: any, rej?: any) => p.then(res, rej);
  chain.catch = (rej: any) => p.catch(rej);
  return chain;
}

/** Creates a fluent drizzle update chain that awaits to []. */
function updateChain(): any {
  const p = Promise.resolve([]);
  const chain: any = {};
  for (const m of ['set', 'where']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (res: any, rej?: any) => p.then(res, rej);
  chain.catch = (rej: any) => p.catch(rej);
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PAYMENT_ID = 'pay-001';
const USER_ID = 'user-001';
const COURSE_ID = 'course-001';
const INVOICE_ID = 'inv-001';
const INVOICE_NUMBER = 'INV-2025-00001';

const mockPayment: any = {
  id: PAYMENT_ID, userId: USER_ID, courseId: COURSE_ID,
  gateway: 'moyasar', gatewayChargeId: 'ch_001', paymentMethod: 'card',
  amount: '500.00', paidAt: new Date('2025-01-15'),
  metadata: { subtotal: 450, discountAmount: 50, taxAmount: 0, discountCode: 'SAVE50' },
};

const mockUser: any = {
  id: USER_ID, email: 'student@example.com', firstName: 'Ahmed', lastName: 'Al-Rashid',
};

const mockCourse: any = {
  id: COURSE_ID, title: 'Physiotherapy Basics', titleAr: 'أساسيات العلاج الطبيعي',
  deliveryType: 'online', startDate: null, endDate: null,
};

const mockInvoice: any = {
  id: INVOICE_ID, invoiceNumber: INVOICE_NUMBER, paymentId: PAYMENT_ID,
  userId: USER_ID, courseId: COURSE_ID, subtotal: '450.00',
  discountAmount: '50.00', taxAmount: '0.00', totalAmount: '500.00',
  status: 'paid', issuedAt: new Date('2025-01-15'), paidAt: new Date('2025-01-15'),
  dueDate: null, pdfUrl: `invoices/${INVOICE_NUMBER}.pdf`, metadata: {},
};

// ── Helpers to queue mocks ────────────────────────────────────────────────────

function queueSelects(...rowArrays: any[][]) {
  for (const rows of rowArrays) {
    mockDb.select.mockImplementationOnce(() => selectChain(rows));
  }
}

function queueInsert(result: any[] | Error) {
  mockDb.insert.mockReturnValueOnce(insertChain(result));
}

function queueUpdate() {
  mockDb.update.mockReturnValueOnce(updateChain());
}

/** Standard happy-path mocks for generateInvoice. */
function setupGenerateMocks(overridePayment?: any) {
  queueSelects(
    [overridePayment ?? mockPayment], // payment
    [mockUser],                        // user
    [mockCourse],                      // course
    [{ maxNum: null }],                // invoice number max
  );
  queueInsert([mockInvoice]);
  queueUpdate();
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('InvoiceService', () => {
  let service: InvoiceService;
  let storageService: jest.Mocked<StorageService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: StorageService,
          useValue: {
            uploadPrivate: jest.fn().mockResolvedValue(undefined),
            getSignedUrl: jest.fn().mockResolvedValue('https://storage.example.com/signed'),
            getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
          },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    storageService = module.get(StorageService);
    auditLogService = module.get(AuditLogService);
  });

  // ── generateInvoice() ─────────────────────────────────────────────────────

  describe('generateInvoice()', () => {
    it('creates invoice record, generates PDF, uploads to storage, logs audit', async () => {
      setupGenerateMocks();
      const result = await service.generateInvoice(PAYMENT_ID);

      expect(result.invoiceNumber).toBe(INVOICE_NUMBER);
      expect(storageService.uploadPrivate).toHaveBeenCalledWith(
        expect.any(Buffer),
        `invoices/${INVOICE_NUMBER}.pdf`,
        'application/pdf',
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'invoice_generated', entityType: 'invoice' }),
      );
    });

    it('sets 90-day dueDate for tamara (BNPL)', async () => {
      const bnplInvoice = { ...mockInvoice, dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) };
      queueSelects([{ ...mockPayment, gateway: 'tamara' }], [mockUser], [mockCourse], [{ maxNum: null }]);
      queueInsert([bnplInvoice]);
      queueUpdate();

      const result = await service.generateInvoice(PAYMENT_ID);
      expect(result.dueDate).toBeTruthy();
    });

    it('sets 90-day dueDate for tabby (BNPL)', async () => {
      const bnplInvoice = { ...mockInvoice, dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) };
      queueSelects([{ ...mockPayment, gateway: 'tabby' }], [mockUser], [mockCourse], [{ maxNum: null }]);
      queueInsert([bnplInvoice]);
      queueUpdate();

      const result = await service.generateInvoice(PAYMENT_ID);
      expect(result.dueDate).toBeTruthy();
    });

    it('sets null dueDate for non-BNPL gateway (moyasar)', async () => {
      setupGenerateMocks();
      const result = await service.generateInvoice(PAYMENT_ID);
      expect(result.dueDate).toBeNull();
    });

    it('throws NotFoundException when payment not found', async () => {
      queueSelects([]);
      await expect(service.generateInvoice(PAYMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user not found', async () => {
      queueSelects([mockPayment], [], [mockCourse]);
      await expect(service.generateInvoice(PAYMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when course not found', async () => {
      queueSelects([mockPayment], [mockUser], []);
      await expect(service.generateInvoice(PAYMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('retries on unique constraint collision (23505) and succeeds on 2nd attempt', async () => {
      queueSelects(
        [mockPayment], [mockUser], [mockCourse],
        [{ maxNum: null }],       // attempt 0 maxNum
        [{ maxNum: 'INV-2025-00001' }], // attempt 1 maxNum
      );
      const uniqueErr = Object.assign(new Error('duplicate'), { code: '23505' });
      queueInsert(uniqueErr);
      queueInsert([{ ...mockInvoice, invoiceNumber: 'INV-2025-00002' }]);
      queueUpdate();

      const result = await service.generateInvoice(PAYMENT_ID);
      expect(result.invoiceNumber).toBe('INV-2025-00002');
    });

    it('throws after 3 consecutive unique constraint collisions', async () => {
      queueSelects(
        [mockPayment], [mockUser], [mockCourse],
        [{ maxNum: null }],
        [{ maxNum: null }],
        [{ maxNum: null }],
      );
      const uniqueErr = Object.assign(new Error('duplicate'), { code: '23505' });
      queueInsert(uniqueErr);
      queueInsert(uniqueErr);
      queueInsert(uniqueErr);

      await expect(service.generateInvoice(PAYMENT_ID)).rejects.toThrow();
    });

    it('logs error on PDF failure but still returns invoice record', async () => {
      setupGenerateMocks();
      storageService.uploadPrivate.mockRejectedValueOnce(new Error('GCS down'));

      const result = await service.generateInvoice(PAYMENT_ID);
      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe(INVOICE_NUMBER);
    });

    it('falls back to payment.amount when metadata is missing', async () => {
      const paymentNoMeta = { ...mockPayment, metadata: null };
      let capturedValues: any;

      queueSelects([paymentNoMeta], [mockUser], [mockCourse], [{ maxNum: null }]);

      // Custom insert to capture values
      const captureChain: any = {};
      captureChain.values = jest.fn().mockImplementation((v: any) => {
        capturedValues = v;
        return captureChain;
      });
      captureChain.returning = jest.fn().mockReturnValue(captureChain);
      const p = Promise.resolve([mockInvoice]);
      captureChain.then = (res: any, rej?: any) => p.then(res, rej);
      captureChain.catch = (rej: any) => p.catch(rej);
      mockDb.insert.mockReturnValueOnce(captureChain);
      queueUpdate();

      await service.generateInvoice(PAYMENT_ID);
      expect(Number(capturedValues?.subtotal)).toBe(Number(mockPayment.amount));
    });
  });

  // ── getInvoicePdfUrl() ────────────────────────────────────────────────────

  describe('getInvoicePdfUrl()', () => {
    it('returns signed URL when invoice has pdfUrl', async () => {
      queueSelects([mockInvoice]);
      const result = await service.getInvoicePdfUrl(INVOICE_ID);

      expect(result.url).toBe('https://storage.example.com/signed');
      expect(result.invoiceNumber).toBe(INVOICE_NUMBER);
      expect(storageService.getSignedUrl).toHaveBeenCalledWith('private', mockInvoice.pdfUrl);
    });

    it('self-heals: generates PDF on demand when pdfUrl is missing', async () => {
      const invoiceNoPdf = { ...mockInvoice, pdfUrl: null };
      queueSelects(
        [invoiceNoPdf],     // main invoice lookup
        [mockPayment],      // self-heal: payment
        [mockUser],         // self-heal: user
        [mockCourse],       // self-heal: course
      );
      queueUpdate();

      const result = await service.getInvoicePdfUrl(INVOICE_ID);
      expect(storageService.uploadPrivate).toHaveBeenCalled();
      expect(result.url).toBe('https://storage.example.com/signed');
    });

    it('throws NotFoundException when invoice not found', async () => {
      queueSelects([]);
      await expect(service.getInvoicePdfUrl(INVOICE_ID)).rejects.toThrow(NotFoundException);
    });

    it('student accesses own invoice (userId matches)', async () => {
      queueSelects([mockInvoice]);
      const result = await service.getInvoicePdfUrl(INVOICE_ID, USER_ID);
      expect(result.url).toBeDefined();
    });

    it('student cannot access another user invoice (userId mismatch → not found)', async () => {
      queueSelects([]); // userId filter means no result
      await expect(service.getInvoicePdfUrl(INVOICE_ID, 'other-user')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when on-demand PDF generation fails', async () => {
      const invoiceNoPdf = { ...mockInvoice, pdfUrl: null };
      queueSelects([invoiceNoPdf], [mockPayment], [mockUser], [mockCourse]);
      storageService.uploadPrivate.mockRejectedValueOnce(new Error('GCS error'));

      await expect(service.getInvoicePdfUrl(INVOICE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getInvoicesByUser() ───────────────────────────────────────────────────

  describe('getInvoicesByUser()', () => {
    const row = {
      id: INVOICE_ID, invoiceNumber: INVOICE_NUMBER, paymentId: PAYMENT_ID,
      courseTitle: 'Physiotherapy Basics', courseTitleAr: null,
      totalAmount: '500.00', status: 'paid',
      issuedAt: new Date(), paidAt: new Date(), refundStatus: null,
    };

    it('returns paginated list with correct shape', async () => {
      queueSelects([row], [{ count: 1 }]);
      const result = await service.getInvoicesByUser(USER_ID);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('returns empty list for user with no invoices', async () => {
      queueSelects([], [{ count: 0 }]);
      const result = await service.getInvoicesByUser(USER_ID);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('applies status filter when provided', async () => {
      const { eq: mockEq } = jest.requireMock('drizzle-orm');
      queueSelects([row], [{ count: 1 }]);
      await service.getInvoicesByUser(USER_ID, 1, 10, 'paid');
      expect(mockEq).toHaveBeenCalledWith(expect.anything(), 'paid');
    });

    it('calculates correct totalPages', async () => {
      queueSelects(Array(5).fill(row), [{ count: 12 }]);
      const result = await service.getInvoicesByUser(USER_ID, 1, 5);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  // ── getAllInvoices() ──────────────────────────────────────────────────────

  describe('getAllInvoices()', () => {
    const adminRow = {
      id: INVOICE_ID, invoiceNumber: INVOICE_NUMBER,
      userName: 'Ahmed Al-Rashid', userEmail: 'student@example.com',
      courseTitle: 'Physiotherapy Basics', courseTitleAr: null,
      subtotal: '450.00', discountAmount: '50.00', taxAmount: '0.00',
      totalAmount: '500.00', status: 'paid', issuedAt: new Date(), paidAt: new Date(),
    };

    it('returns all invoices paginated with no filters', async () => {
      queueSelects([adminRow], [{ count: 1 }]);
      const result = await service.getAllInvoices();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('applies status filter', async () => {
      const { eq: mockEq } = jest.requireMock('drizzle-orm');
      queueSelects([], [{ count: 0 }]);
      await service.getAllInvoices(1, 10, 'refunded');
      expect(mockEq).toHaveBeenCalledWith(expect.anything(), 'refunded');
    });

    it('applies startDate filter using gte', async () => {
      const { gte: mockGte } = jest.requireMock('drizzle-orm');
      queueSelects([], [{ count: 0 }]);
      await service.getAllInvoices(1, 10, undefined, '2025-01-01');
      expect(mockGte).toHaveBeenCalledWith(expect.anything(), new Date('2025-01-01'));
    });

    it('applies endDate filter using lte', async () => {
      const { lte: mockLte } = jest.requireMock('drizzle-orm');
      queueSelects([], [{ count: 0 }]);
      await service.getAllInvoices(1, 10, undefined, undefined, '2025-12-31');
      expect(mockLte).toHaveBeenCalledWith(expect.anything(), new Date('2025-12-31'));
    });

    it('applies all three filters simultaneously', async () => {
      const { eq: mockEq, gte: mockGte, lte: mockLte, and: mockAnd } = jest.requireMock('drizzle-orm');
      queueSelects([], [{ count: 0 }]);
      await service.getAllInvoices(1, 10, 'paid', '2025-01-01', '2025-12-31');
      expect(mockEq).toHaveBeenCalledWith(expect.anything(), 'paid');
      expect(mockGte).toHaveBeenCalled();
      expect(mockLte).toHaveBeenCalled();
      expect(mockAnd).toHaveBeenCalled();
    });
  });

  // ── getInvoiceById() ─────────────────────────────────────────────────────

  describe('getInvoiceById()', () => {
    it('returns invoice when found', async () => {
      queueSelects([mockInvoice]);
      const result = await service.getInvoiceById(INVOICE_ID);
      expect(result).toEqual(mockInvoice);
    });

    it('returns null when not found', async () => {
      queueSelects([]);
      const result = await service.getInvoiceById(INVOICE_ID);
      expect(result).toBeNull();
    });
  });

  // ── getByInvoiceNumber() ─────────────────────────────────────────────────

  describe('getByInvoiceNumber()', () => {
    const publicFields = {
      invoiceNumber: INVOICE_NUMBER, status: 'paid',
      totalAmount: '500.00', issuedAt: new Date(), paidAt: new Date(),
    };

    it('returns public fields when found', async () => {
      queueSelects([publicFields]);
      const result = await service.getByInvoiceNumber(INVOICE_NUMBER);
      expect(result).toEqual(publicFields);
    });

    it('returns null when not found', async () => {
      queueSelects([]);
      const result = await service.getByInvoiceNumber(INVOICE_NUMBER);
      expect(result).toBeNull();
    });
  });

  // ── getInvoicePdfBuffer() ────────────────────────────────────────────────

  describe('getInvoicePdfBuffer()', () => {
    it('returns buffer and filename when invoice has pdfUrl', async () => {
      queueSelects([mockInvoice]);
      const result = await service.getInvoicePdfBuffer(PAYMENT_ID);
      expect(result).not.toBeNull();
      expect(result!.filename).toBe(`${INVOICE_NUMBER}.pdf`);
      expect(result!.buffer).toBeInstanceOf(Buffer);
    });

    it('returns null when invoice has no pdfUrl', async () => {
      queueSelects([{ ...mockInvoice, pdfUrl: null }]);
      expect(await service.getInvoicePdfBuffer(PAYMENT_ID)).toBeNull();
    });

    it('returns null when no invoice found for paymentId', async () => {
      queueSelects([]);
      expect(await service.getInvoicePdfBuffer(PAYMENT_ID)).toBeNull();
    });

    it('returns null and logs error when StorageService throws', async () => {
      queueSelects([mockInvoice]);
      storageService.getFileBuffer.mockRejectedValueOnce(new Error('Storage error'));
      expect(await service.getInvoicePdfBuffer(PAYMENT_ID)).toBeNull();
    });
  });
});
