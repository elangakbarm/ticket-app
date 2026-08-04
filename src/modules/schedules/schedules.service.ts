import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  UpdateScheduleStatusDto,
  SearchSchedulesDto,
} from './dto/schedule.dto';
import {
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { toDecimal, decimalToNumber } from '../../common/utils';
import {
  BookingItemStatus,
  BookingStatus,
  SeatAvailabilityStatus,
  ScheduleStatus,
} from '../../common/enums';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: SearchSchedulesDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const where = this.buildSearchWhere(query);

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        include: {
          train: true,
          route: {
            include: {
              originStation: true,
              destinationStation: true,
            },
          },
        },
        orderBy: { [query.sortBy || 'departureTime']: query.sortOrder || 'asc' },
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      message: 'Schedules retrieved successfully',
      data: schedules,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(publicId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { publicId, deletedAt: null },
      include: {
        train: true,
        route: {
          include: {
            originStation: true,
            destinationStation: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return {
      message: 'Schedule retrieved successfully',
      data: schedule,
    };
  }

  async create(dto: CreateScheduleDto, userId: number) {
    const departureTime = new Date(dto.departureTime);
    const arrivalTime = new Date(dto.arrivalTime);

    if (arrivalTime <= departureTime) {
      throw new BusinessException(
        'Arrival time must be after departure time',
        'INVALID_SCHEDULE_TIME',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.schedule.findUnique({
      where: { scheduleCode: dto.scheduleCode },
    });

    if (existing) {
      throw new ConflictException(
        'Schedule code already exists',
        'SCHEDULE_CODE_EXISTS',
      );
    }

    const [train, route] = await Promise.all([
      this.prisma.train.findFirst({
        where: { publicId: dto.trainPublicId, deletedAt: null, isActive: true },
      }),
      this.prisma.route.findFirst({
        where: { publicId: dto.routePublicId, deletedAt: null, isActive: true },
      }),
    ]);

    if (!train) {
      throw new NotFoundException('Train not found or inactive');
    }
    if (!route) {
      throw new NotFoundException('Route not found or inactive');
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        scheduleCode: dto.scheduleCode,
        trainId: train.id,
        routeId: route.id,
        departureTime,
        arrivalTime,
        basePrice: toDecimal(dto.basePrice),
      },
      include: {
        train: true,
        route: {
          include: {
            originStation: true,
            destinationStation: true,
          },
        },
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'SCHEDULE_CREATED',
      entityType: 'Schedule',
      entityPublicId: schedule.publicId,
      newData: schedule,
    });

    return {
      message: 'Schedule created successfully',
      data: schedule,
    };
  }

  async update(publicId: string, dto: UpdateScheduleDto, userId: number) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const departureTime = dto.departureTime
      ? new Date(dto.departureTime)
      : schedule.departureTime;
    const arrivalTime = dto.arrivalTime
      ? new Date(dto.arrivalTime)
      : schedule.arrivalTime;

    if (arrivalTime <= departureTime) {
      throw new BusinessException(
        'Arrival time must be after departure time',
        'INVALID_SCHEDULE_TIME',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        departureTime: dto.departureTime ? departureTime : undefined,
        arrivalTime: dto.arrivalTime ? arrivalTime : undefined,
        basePrice: dto.basePrice ? toDecimal(dto.basePrice) : undefined,
      },
      include: {
        train: true,
        route: {
          include: {
            originStation: true,
            destinationStation: true,
          },
        },
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'SCHEDULE_UPDATED',
      entityType: 'Schedule',
      entityPublicId: publicId,
      oldData: schedule,
      newData: updated,
    });

    return {
      message: 'Schedule updated successfully',
      data: updated,
    };
  }

  async updateStatus(
    publicId: string,
    dto: UpdateScheduleStatusDto,
    userId: number,
  ) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: dto.status },
    });

    await this.auditLogService.log({
      userId,
      action: 'SCHEDULE_STATUS_UPDATED',
      entityType: 'Schedule',
      entityPublicId: publicId,
      newData: { status: dto.status },
    });

    return {
      message: 'Schedule status updated successfully',
      data: updated,
    };
  }

  async softDelete(publicId: string, userId: number) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: { deletedAt: new Date(), status: ScheduleStatus.CANCELLED },
    });

    await this.auditLogService.log({
      userId,
      action: 'SCHEDULE_DELETED',
      entityType: 'Schedule',
      entityPublicId: publicId,
    });

    return { message: 'Schedule deleted successfully', data: null };
  }

  async getSeatAvailability(schedulePublicId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { publicId: schedulePublicId, deletedAt: null },
      include: { train: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const seats = await this.prisma.seat.findMany({
      where: { trainId: schedule.trainId, isActive: true },
      orderBy: [{ carriageNumber: 'asc' }, { seatNumber: 'asc' }],
    });

    const now = new Date();

    const activeBookingItems = await this.prisma.bookingItem.findMany({
      where: {
        scheduleId: schedule.id,
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
      include: {
        booking: { select: { holdExpiresAt: true, status: true } },
      },
    });

    const seatStatusMap = new Map<number, SeatAvailabilityStatus>();

    for (const item of activeBookingItems) {
      if (item.status === BookingItemStatus.BOOKED) {
        seatStatusMap.set(item.seatId, SeatAvailabilityStatus.BOOKED);
      } else if (item.status === BookingItemStatus.HELD) {
        const holdExpired = item.booking.holdExpiresAt < now;
        if (holdExpired) {
          continue;
        }
        seatStatusMap.set(item.seatId, SeatAvailabilityStatus.HELD);
      }
    }

    const availability = seats.map((seat) => {
      let status = seatStatusMap.get(seat.id) || SeatAvailabilityStatus.AVAILABLE;

      if (schedule.status === ScheduleStatus.CANCELLED) {
        status = SeatAvailabilityStatus.UNAVAILABLE;
      }

      return {
        publicId: seat.publicId,
        carriageNumber: seat.carriageNumber,
        seatNumber: seat.seatNumber,
        seatClass: seat.seatClass,
        price: decimalToNumber(schedule.basePrice),
        availabilityStatus: status,
      };
    });

    return {
      message: 'Seat availability retrieved successfully',
      data: availability,
    };
  }

  private buildSearchWhere(query: SearchSchedulesDto): Prisma.ScheduleWhereInput {
    const where: Prisma.ScheduleWhereInput = {
      deletedAt: null,
      status: { not: ScheduleStatus.CANCELLED },
    };

    if (query.originStation || query.destinationStation) {
      where.route = {};
      if (query.originStation) {
        where.route.originStation = { code: query.originStation };
      }
      if (query.destinationStation) {
        where.route.destinationStation = { code: query.destinationStation };
      }
    }

    if (query.departureDate) {
      const startOfDay = new Date(query.departureDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.departureDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.departureTime = { gte: startOfDay, lte: endOfDay };
    }

    if (query.trainClass) {
      where.train = { trainClass: query.trainClass };
    }

    if (query.minimumPrice !== undefined || query.maximumPrice !== undefined) {
      where.basePrice = {};
      if (query.minimumPrice !== undefined) {
        where.basePrice.gte = toDecimal(query.minimumPrice);
      }
      if (query.maximumPrice !== undefined) {
        where.basePrice.lte = toDecimal(query.maximumPrice);
      }
    }

    return where;
  }
}
