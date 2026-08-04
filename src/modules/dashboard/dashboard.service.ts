import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BookingStatus,
  ScheduleStatus,
  PaymentStatus,
} from '../../common/enums';
import { decimalToNumber } from '../../common/utils';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalUsers,
      activeSchedules,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      expiredBookings,
      paidPayments,
      totalTickets,
      bookingsByStatus,
      popularRoutes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.schedule.count({
        where: { deletedAt: null, status: ScheduleStatus.SCHEDULED },
      }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING_PAYMENT },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.EXPIRED },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        select: { amount: true },
      }),
      this.prisma.ticket.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.schedule.groupBy({
        by: ['routeId'],
        _count: { routeId: true },
        orderBy: { _count: { routeId: 'desc' } },
        take: 5,
      }),
    ]);

    const totalRevenue = paidPayments.reduce(
      (sum, p) => sum + decimalToNumber(p.amount),
      0,
    );

    const routeIds = popularRoutes.map((r) => r.routeId);
    const routes = await this.prisma.route.findMany({
      where: { id: { in: routeIds } },
      include: { originStation: true, destinationStation: true },
    });

    const routeMap = new Map(routes.map((r) => [r.id, r]));
    const mostPopularRoutes = popularRoutes.map((r) => ({
      route: routeMap.get(r.routeId),
      bookingCount: r._count.routeId,
    }));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByDate = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM bookings
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    return {
      message: 'Dashboard summary retrieved successfully',
      data: {
        totalUsers,
        totalActiveSchedules: activeSchedules,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        expiredBookings,
        totalPaidRevenue: totalRevenue,
        totalTicketsIssued: totalTickets,
        mostPopularRoutes,
        bookingsByStatus: bookingsByStatus.map((b) => ({
          status: b.status,
          count: b._count.status,
        })),
        bookingsByDate: bookingsByDate.map((b) => ({
          date: b.date,
          count: Number(b.count),
        })),
      },
    };
  }
}
