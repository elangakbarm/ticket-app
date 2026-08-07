import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  CreateBookingDto,
  AddPassengerDto,
  CancelBookingDto,
} from './dto/booking.dto';
import {
  PaginationQueryDto,
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessException,
  ForbiddenException,
} from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import {
  generateBookingCode,
  toDecimal,
  decimalToNumber,
} from '../../common/utils';
import {
  BookingStatus,
  BookingItemStatus,
  ScheduleStatus,
  UserRole,
} from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateBookingDto, user: AuthenticatedUser) {
    const holdMinutes =
      this.configService.get<number>('app.bookingHoldMinutes') || 10;
    const holdExpiresAt = new Date();
    holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + holdMinutes);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const schedule = await tx.schedule.findFirst({
            where: {
              publicId: dto.schedulePublicId,
              deletedAt: null,
              status: { not: ScheduleStatus.CANCELLED },
            },
            include: { train: true },
          });

          if (!schedule) {
            throw new NotFoundException('Schedule not found or cancelled');
          }

          if (schedule.departureTime <= new Date()) {
            throw new BusinessException(
              'Cannot book a schedule that has already departed',
              'SCHEDULE_DEPARTED',
              HttpStatus.BAD_REQUEST,
            );
          }

          await this.expirePendingBookingsInTx(tx, schedule.id);

          const seatPublicIds = dto.seats.map((s) => s.seatPublicId);
          const seats = await tx.seat.findMany({
            where: {
              publicId: { in: seatPublicIds },
              trainId: schedule.trainId,
              isActive: true,
            },
          });

          if (seats.length !== dto.seats.length) {
            throw new BusinessException(
              'One or more seats are invalid for this schedule',
              'INVALID_SEATS',
              HttpStatus.BAD_REQUEST,
            );
          }

          const seatMap = new Map(seats.map((s) => [s.publicId, s]));
          const now = new Date();

          for (const seatDto of dto.seats) {
            const seat = seatMap.get(seatDto.seatPublicId)!;

            const activeItem = await tx.bookingItem.findFirst({
              where: {
                scheduleId: schedule.id,
                seatId: seat.id,
                status: { in: [BookingItemStatus.HELD, BookingItemStatus.BOOKED] },
                booking: {
                  status: {
                    in: [
                      BookingStatus.PENDING_PAYMENT,
                      BookingStatus.CONFIRMED,
                      BookingStatus.PAID,
                    ],
                  },
                },
              },
              include: { booking: true },
            });

            if (activeItem) {
              const isExpiredHold =
                activeItem.status === BookingItemStatus.HELD &&
                activeItem.booking.holdExpiresAt < now;

              if (!isExpiredHold) {
                throw new ConflictException(
                  `Seat ${seat.seatNumber} in carriage ${seat.carriageNumber} is no longer available`,
                  'SEAT_NOT_AVAILABLE',
                );
              }
            }
          }

          const totalAmount = toDecimal(
            decimalToNumber(schedule.basePrice) * dto.seats.length,
          );

          let bookingCode = generateBookingCode();
          let codeExists = await tx.booking.findUnique({
            where: { bookingCode },
          });
          while (codeExists) {
            bookingCode = generateBookingCode();
            codeExists = await tx.booking.findUnique({ where: { bookingCode } });
          }

          const booking = await tx.booking.create({
            data: {
              bookingCode,
              userId: user.id,
              scheduleId: schedule.id,
              status: BookingStatus.PENDING_PAYMENT,
              totalAmount,
              holdExpiresAt,
              createdBy: user.publicId,
            },
          });

          const bookingItems = [];
          for (const seatDto of dto.seats) {
            const seat = seatMap.get(seatDto.seatPublicId)!;

            const passenger = await tx.passenger.create({
              data: {
                bookingId: booking.id,
                fullName: seatDto.passenger.fullName,
                identityType: seatDto.passenger.identityType,
                identityNumber: seatDto.passenger.identityNumber,
                dateOfBirth: new Date(seatDto.passenger.dateOfBirth),
                passengerType: seatDto.passenger.passengerType,
              },
            });

            const item = await tx.bookingItem.create({
              data: {
                bookingId: booking.id,
                scheduleId: schedule.id,
                seatId: seat.id,
                passengerId: passenger.id,
                price: schedule.basePrice,
                status: BookingItemStatus.HELD,
              },
            });

            bookingItems.push(item);
          }

          return {
            bookingCode: booking.bookingCode,
            status: booking.status,
            totalAmount: decimalToNumber(booking.totalAmount),
            holdExpiresAt: booking.holdExpiresAt.toISOString(),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );

      await this.auditLogService.log({
        userId: user.id,
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityPublicId: result.bookingCode,
        newData: result,
      });

      return {
        message: 'Booking created successfully',
        data: result,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Seat is no longer available due to concurrent booking',
          'SEAT_NOT_AVAILABLE',
        );
      }
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser) {
    const { page, limit, skip } = getPaginationParams(query);

    const where: Prisma.BookingWhereInput = {};
    if (user.role === UserRole.CUSTOMER) {
      where.userId = user.id;
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          schedule: {
            include: {
              train: true,
              route: {
                include: {
                  originStation: true,
                  destinationStation: true,
                },
              },
            },
          },
          items: {
            include: { seat: true, passenger: true },
          },
        },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      message: 'Bookings retrieved successfully',
      data: bookings,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(bookingCode: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingCode },
      include: {
        schedule: {
          include: {
            train: true,
            route: {
              include: {
                originStation: true,
                destinationStation: true,
              },
            },
          },
        },
        items: {
          include: { seat: true, passenger: true },
        },
        payments: true,
        tickets: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (user.role === UserRole.CUSTOMER && booking.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return {
      message: 'Booking retrieved successfully',
      data: booking,
    };
  }

  async cancel(
    bookingCode: string,
    dto: CancelBookingDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { bookingCode },
        include: {
          schedule: true,
          items: true,
          tickets: true,
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (user.role === UserRole.CUSTOMER && booking.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }

      if (
        booking.status === BookingStatus.EXPIRED ||
        booking.status === BookingStatus.COMPLETED ||
        booking.status === BookingStatus.CANCELLED
      ) {
        throw new BusinessException(
          `Cannot cancel booking with status ${booking.status}`,
          'INVALID_BOOKING_STATUS',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        user.role === UserRole.CUSTOMER &&
        booking.schedule.departureTime <= new Date()
      ) {
        throw new BusinessException(
          'Cannot cancel booking after departure',
          'SCHEDULE_DEPARTED',
          HttpStatus.BAD_REQUEST,
        );
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          updatedBy: user.publicId,
        },
      });

      await tx.bookingItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingItemStatus.CANCELLED },
      });

      await tx.ticket.updateMany({
        where: { bookingId: booking.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });

      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      await this.auditLogService.log({
        userId: user.id,
        action: 'BOOKING_CANCELLED',
        entityType: 'Booking',
        entityPublicId: bookingCode,
        newData: { reason: dto.reason },
      });

      return {
        message: 'Booking cancelled successfully',
        data: { bookingCode, status: BookingStatus.CANCELLED },
      };
    });
  }

  async addPassenger(
    bookingCode: string,
    dto: AddPassengerDto,
    user: AuthenticatedUser,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingCode },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (user.role === UserRole.CUSTOMER && booking.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const passenger = await this.prisma.passenger.create({
      data: {
        bookingId: booking.id,
        fullName: dto.passenger.fullName,
        identityType: dto.passenger.identityType,
        identityNumber: dto.passenger.identityNumber,
        dateOfBirth: new Date(dto.passenger.dateOfBirth),
        passengerType: dto.passenger.passengerType,
      },
    });

    return {
      message: 'Passenger added successfully',
      data: passenger,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingBookings() {
    this.logger.log('Running booking expiration job');

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: new Date() },
      },
    });

    for (const booking of expiredBookings) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: booking.id },
        });

        if (!current || current.status !== BookingStatus.PENDING_PAYMENT) {
          return;
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.EXPIRED,
            expiredAt: new Date(),
          },
        });

        await tx.bookingItem.updateMany({
          where: { bookingId: booking.id },
          data: { status: BookingItemStatus.RELEASED },
        });

        await tx.payment.updateMany({
          where: { bookingId: booking.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });

        await this.auditLogService.log({
          action: 'BOOKING_EXPIRED',
          entityType: 'Booking',
          entityPublicId: booking.bookingCode,
        });
      });
    }

    if (expiredBookings.length > 0) {
      this.logger.log(`Expired ${expiredBookings.length} pending bookings`);
    }
  }

  private async expirePendingBookingsInTx(
    tx: Prisma.TransactionClient,
    scheduleId: number,
  ) {
    const now = new Date();
    const expired = await tx.booking.findMany({
      where: {
        scheduleId,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: now },
      },
    });

    for (const booking of expired) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED, expiredAt: now },
      });
      await tx.bookingItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingItemStatus.RELEASED },
      });
    }
  }
}
