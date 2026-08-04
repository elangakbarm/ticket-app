import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreatePaymentDto } from './dto/payment.dto';
import {
  NotFoundException,
  ForbiddenException,
  BusinessException,
  ConflictException,
} from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import {
  generatePaymentReference,
  generateTicketNumber,
  generateQrCodeValue,
  toDecimal,
  decimalToNumber,
} from '../../common/utils';
import {
  BookingStatus,
  BookingItemStatus,
  PaymentStatus,
  TicketStatus,
  UserRole,
} from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    bookingCode: string,
    dto: CreatePaymentDto,
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

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BusinessException(
        'Booking is not pending payment',
        'INVALID_BOOKING_STATUS',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.holdExpiresAt < new Date()) {
      throw new BusinessException(
        'Booking hold has expired',
        'BOOKING_EXPIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (decimalToNumber(booking.totalAmount) !== dto.amount) {
      throw new BusinessException(
        'Payment amount does not match booking total',
        'AMOUNT_MISMATCH',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPayment) {
      return {
        message: 'Payment already exists',
        data: existingPayment,
      };
    }

    const paymentReference = generatePaymentReference();
    const payment = await this.prisma.payment.create({
      data: {
        paymentReference,
        bookingId: booking.id,
        paymentMethod: dto.paymentMethod,
        amount: toDecimal(dto.amount),
        status: PaymentStatus.PENDING,
      },
    });

    return {
      message: 'Payment created successfully',
      data: payment,
    };
  }

  async findOne(paymentReference: string, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { paymentReference },
      include: {
        booking: {
          include: {
            schedule: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      user.role === UserRole.CUSTOMER &&
      payment.booking.userId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return {
      message: 'Payment retrieved successfully',
      data: payment,
    };
  }

  async confirm(
    paymentReference: string,
    user: AuthenticatedUser,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existing && existing.expiresAt > new Date()) {
        return existing.responseBody as {
          message: string;
          data: unknown;
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { paymentReference },
        include: {
          booking: {
            include: {
              items: {
                include: { passenger: true, seat: true },
              },
              schedule: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (
        user.role === UserRole.CUSTOMER &&
        payment.booking.userId !== user.id
      ) {
        throw new ForbiddenException('Access denied');
      }

      if (payment.status === PaymentStatus.PAID) {
        return {
          message: 'Payment already confirmed',
          data: payment,
        };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BusinessException(
          'Payment cannot be confirmed',
          'INVALID_PAYMENT_STATUS',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (payment.booking.status !== BookingStatus.PENDING_PAYMENT) {
        throw new BusinessException(
          'Booking is not pending payment',
          'INVALID_BOOKING_STATUS',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (payment.booking.holdExpiresAt < new Date()) {
        throw new BusinessException(
          'Booking hold has expired',
          'BOOKING_EXPIRED',
          HttpStatus.BAD_REQUEST,
        );
      }

      const now = new Date();

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, paidAt: now },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });

      await tx.bookingItem.updateMany({
        where: { bookingId: payment.bookingId },
        data: { status: BookingItemStatus.BOOKED },
      });

      const tickets = [];
      for (const item of payment.booking.items) {
        const ticketNumber = generateTicketNumber();
        const qrCodeValue = generateQrCodeValue();

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber,
            bookingId: payment.bookingId,
            bookingItemId: item.id,
            passengerId: item.passengerId!,
            scheduleId: payment.booking.scheduleId,
            seatId: item.seatId,
            qrCodeValue,
            status: TicketStatus.ACTIVE,
          },
        });
        tickets.push(ticket);
      }

      await this.auditLogService.log({
        userId: user.id,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'Payment',
        entityPublicId: paymentReference,
        newData: { ticketCount: tickets.length },
      });

      return {
        message: 'Payment confirmed successfully',
        data: {
          payment: updatedPayment,
          tickets,
        },
      };
    });

    if (idempotencyKey) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await this.prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          requestPath: `/payments/${paymentReference}/confirm`,
          responseBody: result as unknown as Prisma.InputJsonValue,
          statusCode: 200,
          expiresAt,
        },
        update: {
          responseBody: result as unknown as Prisma.InputJsonValue,
          statusCode: 200,
          expiresAt,
        },
      });
    }

    return result;
  }

  async fail(paymentReference: string, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { paymentReference },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      user.role === UserRole.CUSTOMER &&
      payment.booking.userId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException(
        'Payment cannot be marked as failed',
        'INVALID_PAYMENT_STATUS',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });

    return {
      message: 'Payment marked as failed',
      data: updated,
    };
  }
}
