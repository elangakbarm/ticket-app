import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateStationDto, UpdateStationDto } from './dto/station.dto';
import {
  PaginationQueryDto,
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class StationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const where = { deletedAt: null };

    const [stations, total] = await Promise.all([
      this.prisma.station.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'name']: query.sortOrder || 'asc' },
      }),
      this.prisma.station.count({ where }),
    ]);

    return {
      message: 'Stations retrieved successfully',
      data: stations,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(publicId: string) {
    const station = await this.prisma.station.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    return {
      message: 'Station retrieved successfully',
      data: station,
    };
  }

  async create(dto: CreateStationDto, userId: number) {
    const existing = await this.prisma.station.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Station code already exists', 'STATION_CODE_EXISTS');
    }

    const station = await this.prisma.station.create({ data: dto });

    await this.auditLogService.log({
      userId,
      action: 'STATION_CREATED',
      entityType: 'Station',
      entityPublicId: station.publicId,
      newData: station,
    });

    return {
      message: 'Station created successfully',
      data: station,
    };
  }

  async update(publicId: string, dto: UpdateStationDto, userId: number) {
    const station = await this.prisma.station.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    const updated = await this.prisma.station.update({
      where: { id: station.id },
      data: dto,
    });

    await this.auditLogService.log({
      userId,
      action: 'STATION_UPDATED',
      entityType: 'Station',
      entityPublicId: publicId,
      oldData: station,
      newData: updated,
    });

    return {
      message: 'Station updated successfully',
      data: updated,
    };
  }

  async softDelete(publicId: string, userId: number) {
    const station = await this.prisma.station.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    await this.prisma.station.update({
      where: { id: station.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditLogService.log({
      userId,
      action: 'STATION_DELETED',
      entityType: 'Station',
      entityPublicId: publicId,
    });

    return { message: 'Station deleted successfully', data: null };
  }
}
