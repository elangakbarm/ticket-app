import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { BookingStatus, ScheduleStatus } from '../../common/enums';

@Injectable()
export class JourneyCompletionService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.completeJourneys();
  }

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async completeJourneys() {
    const now = new Date();
    // Conditional updates make retries and multiple replicas safe. Include already
    // arrived schedules when reconciling bookings to recover older missed updates.
    await this.prisma.$transaction(async (tx) => {
      await tx.schedule.updateMany({
        where: {
          deletedAt: null,
          arrivalTime: { lte: now },
          status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.BOARDING,
            ScheduleStatus.DEPARTED, ScheduleStatus.DELAYED] },
        },
        data: { status: ScheduleStatus.ARRIVED },
      });
      await tx.booking.updateMany({
        where: {
          status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] },
          schedule: { deletedAt: null, status: ScheduleStatus.ARRIVED },
        },
        data: { status: BookingStatus.COMPLETED },
      });
    });
  }
}
