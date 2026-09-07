import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ServiceGatewayModule } from './service-gateway.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../../database/prisma.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';

describe('HTTP service gateway', () => {
  let app: INestApplication;
  let upstream: Server;
  let token: string;
  let received: { url?: string; method?: string; headers: any; body: string }[];
  let mode = 'ok';
  const passenger = {
    fullName: 'Test User',
    identityType: 'KTP',
    identityNumber: '12345678',
    dateOfBirth: '1998-01-01',
    passengerType: 'ADULT',
  };

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        received.push({ url: req.url, method: req.method, headers: req.headers, body });
        if (mode === 'timeout') return;
        if (mode === 'invalid') {
          res.end('not json');
          return;
        }
        if (mode === 'redirect') {
          res.writeHead(302, { location: '/other' }).end();
          return;
        }
        res.setHeader('content-type', 'application/json');
        if (mode === 'error') {
          res.writeHead(409, { 'retry-after': '2' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'Seat unavailable',
              error: { code: 'SEAT_NOT_AVAILABLE' },
            }),
          );
          return;
        }
        res.statusCode = req.method === 'POST' ? 201 : 200;
        res.end(
          JSON.stringify({ success: true, message: 'Remote result', data: { remote: true } }),
        );
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    const secret = 'test-only-access-secret';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              BOOKINGS_SERVICE_URL: `${base}/bookings-api`,
              PAYMENTS_SERVICE_URL: `${base}/payments-api`,
              SERVICE_HTTP_TIMEOUT_MS: 250,
              auth: { jwtAccessSecret: secret },
            }),
          ],
        }),
        ServiceGatewayModule,
      ],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: async () => ({
                id: 1,
                publicId: 'u1',
                role: 'CUSTOMER',
                isActive: true,
                deletedAt: null,
              }),
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    token = new JwtService({ secret }).sign({ sub: 'u1' });
  });
  beforeEach(() => {
    received = [];
    mode = 'ok';
  });
  afterAll(async () => {
    await app?.close();
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it.each([
    [
      'post',
      '/bookings',
      '/bookings-api/bookings',
      { schedulePublicId: 'sch1', seats: [{ seatPublicId: 'seat1', passenger }] },
    ],
    [
      'get',
      '/bookings?page=2&limit=5',
      '/bookings-api/bookings?page=2&limit=5&sortOrder=desc',
      undefined,
    ],
    ['get', '/bookings/BK-1', '/bookings-api/bookings/BK-1', undefined],
    [
      'patch',
      '/bookings/BK-1/cancel',
      '/bookings-api/bookings/BK-1/cancel',
      { reason: 'Changed plans' },
    ],
    ['post', '/bookings/BK-1/passengers', '/bookings-api/bookings/BK-1/passengers', { passenger }],
    [
      'post',
      '/bookings/BK-1/payments',
      '/payments-api/bookings/BK-1/payments',
      { paymentMethod: 'BANK_TRANSFER', amount: 100 },
    ],
    ['get', '/payments/PAY-1', '/payments-api/payments/PAY-1', undefined],
    ['post', '/payments/PAY-1/confirm', '/payments-api/payments/PAY-1/confirm', undefined],
    ['post', '/payments/PAY-1/fail', '/payments-api/payments/PAY-1/fail', undefined],
  ])('forwards %s %s to the owning service', async (method, path, expected, body) => {
    const response = await (request(app.getHttpServer()) as any)
      [method as string](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('idempotency-key', 'key-1')
      .set('x-correlation-id', 'trace-1')
      .send(body);
    expect(response.status).toBe(method === 'post' ? 201 : 200);
    expect(response.body).toEqual({
      success: true,
      message: 'Remote result',
      data: { remote: true },
    });
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe(expected);
    expect(received[0].headers.authorization).toBe(`Bearer ${token}`);
    expect(received[0].headers['idempotency-key']).toBe('key-1');
    expect(received[0].headers['x-correlation-id']).toBe('trace-1');
    if (body) expect(JSON.parse(received[0].body)).toEqual(body);
  });
  it('rejects unauthenticated calls without contacting a service', async () => {
    await request(app.getHttpServer()).get('/api/v1/bookings').expect(401);
    expect(received).toHaveLength(0);
  });
  it('rejects invalid request bodies before forwarding', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ unexpected: true })
      .expect(400);
    expect(received).toHaveLength(0);
  });
  it('preserves upstream errors, status and retry-after', async () => {
    mode = 'error';
    const result = await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(result.body.error.code).toBe('SEAT_NOT_AVAILABLE');
    expect(result.headers['retry-after']).toBe('2');
  });
  it.each([
    ['invalid', 502],
    ['redirect', 502],
    ['timeout', 504],
  ])('handles %s responses without retry', async (value, status) => {
    mode = value as string;
    await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .expect(status as number);
    expect(received).toHaveLength(1);
  });
});
