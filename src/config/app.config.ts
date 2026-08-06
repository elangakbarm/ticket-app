import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { registerAs } from '@nestjs/config';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ticket_app?schema=public';

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  bookingHoldMinutes: parseInt(process.env.BOOKING_HOLD_MINUTES || '10', 10),
}));

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
}));

export const databaseConfig = registerAs('database', () => ({
  url: getDatabaseUrl(),
}));

export async function validateEnv(config: Record<string, unknown>) {
  const databaseUrl = (config['DATABASE_URL'] as string | undefined) ?? process.env.DATABASE_URL ?? getDatabaseUrl();
  if (databaseUrl) {
    config['DATABASE_URL'] = databaseUrl;
  }

  const requiredVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

  const missing = requiredVars.filter((key) => !config[key] && !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}
