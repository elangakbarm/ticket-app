import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtPayload, AuthenticatedUser } from '../../../common/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.jwtAccessSecret') ||
        'change-me-access-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // 1. Guard clause jika payload atau sub tidak ada
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // 2. Gunakan findUnique jika publicId adalah field @unique di Prisma Schema
    const user = await this.prisma.user.findUnique({
      where: { publicId: payload.sub },
    });

    // 3. Pengecekan eksplisit status user
    if (!user || !user.isActive || user.deletedAt !== null) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
  }
}