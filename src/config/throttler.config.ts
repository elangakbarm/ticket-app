import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export function createThrottlerOptions(config: ConfigService): ThrottlerModuleOptions {
  function positiveInteger(key: string, fallback: number): number {
    const raw = config.get<string | number>(key) ?? fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive safe integer`);
    }
    return value;
  }

  return [
    {
      ttl: positiveInteger('THROTTLE_TTL_MS', 60000),
      limit: positiveInteger('THROTTLE_LIMIT', 100),
    },
  ];
}
