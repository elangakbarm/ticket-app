import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditLogModule } from '../../common/services/audit-log.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const accessSecret =
          configService.get<string>('auth.jwtAccessSecret') || 'change-me-access-secret';
        const accessExpiresIn =
          configService.get<string>('auth.jwtAccessExpiresIn') || '15m';

        return {
          secret: accessSecret,
          signOptions: {
            expiresIn: accessExpiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuditLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
