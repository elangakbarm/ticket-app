import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

// Real HTTP routing, JWT strategy, and global guards; database calls are mocked.
describe('AuthController global authentication', () => {
  let app: INestApplication;
  let token: string;
  const secret = 'authentication-regression-test-secret';
  const user = {
    id: 1,
    publicId: 'existing-user',
    email: 'user@example.com',
    role: 'CUSTOMER',
    fullName: 'Test User',
    isActive: true,
    deletedAt: null,
  };
  const findUnique = jest.fn().mockResolvedValue(user);
  const auth = {
    getMe: jest.fn().mockResolvedValue({ data: { publicId: user.publicId } }),
    logout: jest.fn().mockResolvedValue({ message: 'Logged out' }),
    login: jest.fn().mockResolvedValue({ data: { accessToken: 'test' } }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 10000 }])],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    token = new JwtService({ secret }).sign({ sub: user.publicId });
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  it('rejects profile and logout without a token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
    expect(auth.getMe).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    expect(auth.getMe).not.toHaveBeenCalled();
  });

  it('authenticates profile exactly once and preserves the response', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(auth.getMe).toHaveBeenCalledWith(user.publicId);
    expect(response.body).toEqual({ data: { publicId: user.publicId } });
  });

  it('authenticates logout exactly once', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(auth.logout).toHaveBeenCalledWith(user.id);
  });

  it('preserves the stricter public login limit despite a higher default', async () => {
    for (let index = 0; index < 5; index++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'test' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'test' })
      .expect(429);
    expect(findUnique).not.toHaveBeenCalled();
    expect(auth.login).toHaveBeenCalledTimes(5);
  });
});
