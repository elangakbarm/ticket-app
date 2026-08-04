import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateTrainDto, UpdateTrainDto } from './dto/train.dto';
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
export class TrainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);
    const where = { deletedAt: null };

    const [trains, total] = await Promise.all([
      this.prisma.train.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'trainCode']: query.sortOrder || 'asc' },
      }),
      this.prisma.train.count({ where }),
    ]);

    return {
      message: 'Trains retrieved successfully',
      data: trains,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(publicId: string) {
    const train = await this.prisma.train.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    return {
      message: 'Train retrieved successfully',
      data: train,
    };
  }

  async create(dto: CreateTrainDto, userId: number) {
    const existing = await this.prisma.train.findUnique({
      where: { trainCode: dto.trainCode },
    });

    if (existing) {
      throw new ConflictException('Train code already exists', 'TRAIN_CODE_EXISTS');
    }

    const train = await this.prisma.train.create({ data: dto });

    await this.auditLogService.log({
      userId,
      action: 'TRAIN_CREATED',
      entityType: 'Train',
      entityPublicId: train.publicId,
      newData: train,
    });

    return {
      message: 'Train created successfully',
      data: train,
    };
  }

  async update(publicId: string, dto: UpdateTrainDto, userId: number) {
    const train = await this.prisma.train.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    const updated = await this.prisma.train.update({
      where: { id: train.id },
      data: dto,
    });

    await this.auditLogService.log({
      userId,
      action: 'TRAIN_UPDATED',
      entityType: 'Train',
      entityPublicId: publicId,
      oldData: train,
      newData: updated,
    });

    return {
      message: 'Train updated successfully',
      data: updated,
    };
  }

  async softDelete(publicId: string, userId: number) {
    const train = await this.prisma.train.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!train) {
      throw new NotFoundException('Train not found');
    }

    await this.prisma.train.update({
      where: { id: train.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditLogService.log({
      userId,
      action: 'TRAIN_DELETED',
      entityType: 'Train',
      entityPublicId: publicId,
    });

    return { message: 'Train deleted successfully', data: null };
  }
}
