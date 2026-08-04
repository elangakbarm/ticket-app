import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.resolve('prisma/schema.prisma'),
  migrations: {
    path: path.resolve('prisma/migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
