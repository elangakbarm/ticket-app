import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  CreateSeatDto,
  BulkCreateSeatsDto,
  GenerateSeatsDto,
} from './dto/seat.dto';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findByTrain(trainPublicId: string) {
    const train = await this.prisma.train.findFirst({
      where: { publicId: trainPublicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    const seats = await this.prisma.seat.findMany({
      where: { trainId: train.id, isActive: true },
      orderBy: [{ carriageNumber: 'asc' }, { seatNumber: 'asc' }],
    });

    return {
      message: 'Seats retrieved successfully',
      data: seats,
    };
  }

  async create(trainPublicId: string, dto: CreateSeatDto, userId: number) {
    const train = await this.prisma.train.findFirst({
      where: { publicId: trainPublicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    const existing = await this.prisma.seat.findUnique({
      where: {
        trainId_carriageNumber_seatNumber: {
          trainId: train.id,
          carriageNumber: dto.carriageNumber,
          seatNumber: dto.seatNumber,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Seat already exists for this train',
        'SEAT_EXISTS',
      );
    }

    const seat = await this.prisma.seat.create({
      data: {
        trainId: train.id,
        carriageNumber: dto.carriageNumber,
        seatNumber: dto.seatNumber,
        seatClass: dto.seatClass,
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'SEAT_CREATED',
      entityType: 'Seat',
      entityPublicId: seat.publicId,
      newData: seat,
    });

    return {
      message: 'Seat created successfully',
      data: seat,
    };
  }

  async bulkCreate(
    trainPublicId: string,
    dto: BulkCreateSeatsDto,
    userId: number,
  ) {
    const train = await this.prisma.train.findFirst({
      where: { publicId: trainPublicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    const seats = await this.prisma.$transaction(
      dto.seats.map((seatDto) =>
        this.prisma.seat.create({
          data: {
            trainId: train.id,
            carriageNumber: seatDto.carriageNumber,
            seatNumber: seatDto.seatNumber,
            seatClass: seatDto.seatClass,
          },
        }),
      ),
    );

    await this.auditLogService.log({
      userId,
      action: 'SEATS_BULK_CREATED',
      entityType: 'Train',
      entityPublicId: trainPublicId,
      newData: { count: seats.length },
    });

    return {
      message: `${seats.length} seats created successfully`,
      data: seats,
    };
  }

  async generateSeats(
    trainPublicId: string,
    dto: GenerateSeatsDto,
    userId: number,
  ) {
    const train = await this.prisma.train.findFirst({
      where: { publicId: trainPublicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    const seatData: CreateSeatDto[] = [];
    for (let c = 1; c <= dto.carriages; c++) {
      for (let s = 1; s <= dto.seatsPerCarriage; s++) {
        seatData.push({
          carriageNumber: c,
          seatNumber: `${String.fromCharCode(64 + c)}${s}`,
          seatClass: dto.seatClass,
        });
      }
    }

    return this.bulkCreate(trainPublicId, { seats: seatData }, userId);
  }
}
