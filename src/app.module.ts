import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { appConfig, authConfig, databaseConfig, validateEnv } from './config/app.config';
import { createThrottlerOptions } from './config/throttler.config';
import { PrismaModule } from './database/prisma.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StationsModule } from './modules/stations/stations.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TrainsModule } from './modules/trains/trains.module';
import { SeatsModule } from './modules/seats/seats.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ServiceGatewayModule } from './modules/service-gateway/service-gateway.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createThrottlerOptions,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StationsModule,
    RoutesModule,
    TrainsModule,
    SeatsModule,
    SchedulesModule,
    ServiceGatewayModule,
    TicketsModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
