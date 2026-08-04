import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/user.dto';
import {
  PaginationQueryDto,
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { sanitizeUser } from '../../common/utils';
import { AuthenticatedUser } from '../../common/interfaces';
import { UserRole } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip } = getPaginationParams(query);

    const where = { deletedAt: null };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Users retrieved successfully',
      data: users.map(sanitizeUser),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(publicId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.role === UserRole.CUSTOMER &&
      currentUser.publicId !== publicId
    ) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User retrieved successfully',
      data: sanitizeUser(user),
    };
  }

  async update(
    publicId: string,
    dto: UpdateUserDto,
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role === UserRole.CUSTOMER &&
      currentUser.publicId !== publicId
    ) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...dto,
        updatedBy: currentUser.publicId,
      },
    });

    await this.auditLogService.log({
      userId: currentUser.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityPublicId: publicId,
      oldData: sanitizeUser(user),
      newData: sanitizeUser(updated),
    });

    return {
      message: 'User updated successfully',
      data: sanitizeUser(updated),
    };
  }

  async updateStatus(publicId: string, dto: UpdateUserStatusDto, adminId: number) {
    const user = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: dto.isActive },
    });

    await this.auditLogService.log({
      userId: adminId,
      action: 'USER_STATUS_UPDATED',
      entityType: 'User',
      entityPublicId: publicId,
      newData: { isActive: dto.isActive },
    });

    return {
      message: 'User status updated successfully',
      data: sanitizeUser(updated),
    };
  }

  async softDelete(publicId: string, adminId: number) {
    const user = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditLogService.log({
      userId: adminId,
      action: 'USER_DELETED',
      entityType: 'User',
      entityPublicId: publicId,
    });

    return { message: 'User deleted successfully', data: null };
  }
}
