import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/route.dto';
import {
  PaginationQueryDto,
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { toDecimal } from '../../common/utils';

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const where = { deletedAt: null };

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        skip,
        take: limit,
        include: {
          originStation: true,
          destinationStation: true,
        },
        orderBy: { [query.sortBy || 'routeCode']: query.sortOrder || 'asc' },
      }),
      this.prisma.route.count({ where }),
    ]);

    return {
      message: 'Routes retrieved successfully',
      data: routes,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(publicId: string) {
    const route = await this.prisma.route.findFirst({
      where: { publicId, deletedAt: null },
      include: {
        originStation: true,
        destinationStation: true,
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return {
      message: 'Route retrieved successfully',
      data: route,
    };
  }

  async create(dto: CreateRouteDto, userId: number) {
    if (dto.originStationPublicId === dto.destinationStationPublicId) {
      throw new BusinessException(
        'Origin and destination cannot be the same',
        'INVALID_ROUTE',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.route.findUnique({
      where: { routeCode: dto.routeCode },
    });

    if (existing) {
      throw new ConflictException('Route code already exists', 'ROUTE_CODE_EXISTS');
    }

    const [origin, destination] = await Promise.all([
      this.prisma.station.findFirst({
        where: { publicId: dto.originStationPublicId, deletedAt: null },
      }),
      this.prisma.station.findFirst({
        where: { publicId: dto.destinationStationPublicId, deletedAt: null },
      }),
    ]);

    if (!origin) {
      throw new NotFoundException('Origin station not found');
    }
    if (!destination) {
      throw new NotFoundException('Destination station not found');
    }

    const route = await this.prisma.route.create({
      data: {
        routeCode: dto.routeCode,
        originStationId: origin.id,
        destinationStationId: destination.id,
        distanceKm: toDecimal(dto.distanceKm),
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
      },
      include: {
        originStation: true,
        destinationStation: true,
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'ROUTE_CREATED',
      entityType: 'Route',
      entityPublicId: route.publicId,
      newData: route,
    });

    return {
      message: 'Route created successfully',
      data: route,
    };
  }

  async update(publicId: string, dto: UpdateRouteDto, userId: number) {
    const route = await this.prisma.route.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    const updated = await this.prisma.route.update({
      where: { id: route.id },
      data: {
        distanceKm: dto.distanceKm ? toDecimal(dto.distanceKm) : undefined,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        isActive: dto.isActive,
      },
      include: {
        originStation: true,
        destinationStation: true,
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'ROUTE_UPDATED',
      entityType: 'Route',
      entityPublicId: publicId,
      oldData: route,
      newData: updated,
    });

    return {
      message: 'Route updated successfully',
      data: updated,
    };
  }

  async softDelete(publicId: string, userId: number) {
    const route = await this.prisma.route.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    await this.prisma.route.update({
      where: { id: route.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditLogService.log({
      userId,
      action: 'ROUTE_DELETED',
      entityType: 'Route',
      entityPublicId: publicId,
    });

    return { message: 'Route deleted successfully', data: null };
  }
}
