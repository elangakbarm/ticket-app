import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  userId?: number;
  action: string;
  entityType: string;
  entityPublicId?: string;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityPublicId: input.entityPublicId,
        oldData: input.oldData,
        newData: input.newData,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
