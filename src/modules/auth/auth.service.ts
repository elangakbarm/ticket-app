import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import {
  ConflictException,
  UnauthorizedException,
} from '../../common/exceptions/business.exception';
import { sanitizeUser } from '../../common/utils';
import { UserRole } from '../../common/enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        phoneNumber: dto.phoneNumber,
        role: UserRole.CUSTOMER,
      },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityPublicId: user.publicId,
      newData: { email: user.email, role: user.role },
      ipAddress,
      userAgent,
    });

    const tokens = await this.generateTokens(user.publicId, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Registration successful',
      data: {
        user: sanitizeUser(user),
        ...tokens,
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityPublicId: user.publicId,
      ipAddress,
      userAgent,
    });

    const tokens = await this.generateTokens(user.publicId, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        ...tokens,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });

      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      const user = await this.prisma.user.findFirst({
        where: { publicId: payload.sub, isActive: true, deletedAt: null },
      });

      if (!user) {
        throw new UnauthorizedException('User not found', 'USER_NOT_FOUND');
      }

      const tokens = await this.generateTokens(user.publicId, user.email, user.role);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return {
        message: 'Token refreshed successfully',
        data: tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  async logout(userId: number) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logout successful', data: null };
  }

  async getMe(publicId: string) {
    const user = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found', 'USER_NOT_FOUND');
    }

    return {
      message: 'Profile retrieved successfully',
      data: sanitizeUser(user),
    };
  }

  private async generateTokens(publicId: string, email: string, role: string) {
    const payload = { sub: publicId, email, role };
    const accessSecret = this.configService.get<string>('auth.jwtAccessSecret') || 'change-me-access-secret';
    const refreshSecret = this.configService.get<string>('auth.jwtRefreshSecret') || 'change-me-refresh-secret';
    const accessExpiresIn = this.configService.get<string>('auth.jwtAccessExpiresIn') || '15m';
    const refreshExpiresIn = this.configService.get<string>('auth.jwtRefreshExpiresIn') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      } as any),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: number, refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresIn = this.configService.get<string>('auth.jwtRefreshExpiresIn') || '7d';
    const days = parseInt(expiresIn.replace('d', ''), 10) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }
}
