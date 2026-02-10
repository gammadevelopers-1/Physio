import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'debug',
}));
