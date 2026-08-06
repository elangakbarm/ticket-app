import { databaseConfig } from './app.config';

describe('databaseConfig', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('uses a local PostgreSQL default when DATABASE_URL is not provided', () => {
    delete process.env.DATABASE_URL;

    const config = databaseConfig();

    expect(config.url).toBe(
      'postgresql://postgres:postgres@localhost:5432/ticket_app?schema=public',
    );
  });
});
