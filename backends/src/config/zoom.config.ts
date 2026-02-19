import { registerAs } from '@nestjs/config';

export default registerAs('zoom', () => ({
  accountId: process.env.ZOOM_ACCOUNT_ID || '',
  clientId: process.env.ZOOM_CLIENT_ID || '',
  clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  webhookSecretToken: process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '',
}));
