import { ConfigService } from '@nestjs/config';
import { createThrottlerOptions } from './throttler.config';

describe('throttler configuration', () => {
  const config = (values: Record<string, unknown>) =>
    ({ get: (key: string) => values[key] }) as ConfigService;

  it('retains the existing defaults', () => {
    expect(createThrottlerOptions(config({}))).toEqual([{ ttl: 60000, limit: 100 }]);
  });

  it('accepts environment overrides as numbers', () => {
    expect(
      createThrottlerOptions(config({ THROTTLE_LIMIT: '10000', THROTTLE_TTL_MS: '30000' })),
    ).toEqual([{ ttl: 30000, limit: 10000 }]);
  });

  it.each(['0', '-1', '1.5', '', 'NaN', 'Infinity', '100x', '9007199254740992'])(
    'rejects invalid configuration %s',
    (value) => {
      for (const key of ['THROTTLE_LIMIT', 'THROTTLE_TTL_MS']) {
        expect(() => createThrottlerOptions(config({ [key]: value }))).toThrow(key);
      }
    },
  );
});
