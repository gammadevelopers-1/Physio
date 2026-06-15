import { registerAs } from '@nestjs/config';

export default registerAs('payments', () => ({
  callbackUrl:
    process.env.PAYMENT_CALLBACK_URL || 'http://localhost:3000/payment/callback',
  webhookBaseUrl:
    process.env.PAYMENT_WEBHOOK_BASE_URL || 'http://localhost:8080/api/webhooks',

  // Tap Payments
  tap: {
    secretKey: process.env.TAP_SECRET_KEY || '',
    publicKey: process.env.TAP_PUBLIC_KEY || '',
    webhookSecret: process.env.TAP_WEBHOOK_SECRET || '',
    apiUrl: process.env.TAP_API_URL || 'https://api.tap.company/v2',
  },

  // Moyasar
  moyasar: {
    secretKey: process.env.MOYASAR_SECRET_KEY || '',
    publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.MOYASAR_WEBHOOK_SECRET || '',
    apiUrl: process.env.MOYASAR_API_URL || 'https://api.moyasar.com/v1',
  },

  // Tamara (BNPL)
  tamara: {
    apiToken: process.env.TAMARA_API_TOKEN || '',
    notificationToken: process.env.TAMARA_NOTIFICATION_TOKEN || '',
    apiUrl:
      process.env.TAMARA_API_URL || 'https://api-sandbox.tamara.co',
  },

  // Tabby (BNPL)
  tabby: {
    secretKey: process.env.TABBY_SECRET_KEY || '',
    publicKey: process.env.TABBY_PUBLIC_KEY || '',
    webhookSecret: process.env.TABBY_WEBHOOK_SECRET || '',
    apiUrl: process.env.TABBY_API_URL || 'https://api.tabby.ai/api/v2',
  },

  // Refund deduction rates (per merchant agreement — override via env)
  tabbyRefundDeductionRate: parseFloat(process.env.TABBY_REFUND_DEDUCTION_RATE || '0.1'),
}));
