import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  PaginationQueryDto,
  getPaginationParams,
  buildPaginationMeta,
} from '../../common/dto/pagination-query.dto';
import {
  NotFoundException,
  ForbiddenException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { TicketStatus, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser) {
    const { page, limit, skip } = getPaginationParams(query);

    const where: { booking?: { userId: number } } = {};
    if (user.role === UserRole.CUSTOMER) {
      where.booking = { userId: user.id };
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          passenger: true,
          seat: true,
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
          booking: { select: { bookingCode: true, userId: true } },
        },
        orderBy: { [query.sortBy || 'issuedAt']: query.sortOrder || 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      message: 'Tickets retrieved successfully',
      data: tickets,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(ticketNumber: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        passenger: true,
        seat: true,
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
        booking: { select: { bookingCode: true, userId: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (
      user.role === UserRole.CUSTOMER &&
      ticket.booking.userId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return {
      message: 'Ticket retrieved successfully',
      data: ticket,
    };
  }

  async useTicket(ticketNumber: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketNumber },
      include: { booking: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new BusinessException(
        'Ticket is not active',
        'INVALID_TICKET_STATUS',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.USED, usedAt: new Date() },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'TICKET_USED',
      entityType: 'Ticket',
      entityPublicId: ticketNumber,
    });

    return {
      message: 'Ticket marked as used',
      data: updated,
    };
  }
}
