import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/interfaces';
import { IDEMPOTENCY_KEY_HEADER } from '../../common/constants';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bookings/:bookingCode/payments')
  @ApiOperation({ summary: 'Create payment for a booking' })
  create(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.create(bookingCode, dto, user);
  }

  @Get('payments/:paymentReference')
  @ApiOperation({ summary: 'Get payment by reference' })
  findOne(
    @Param('paymentReference') paymentReference: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findOne(paymentReference, user);
  }

  @Post('payments/:paymentReference/confirm')
  @ApiOperation({ summary: 'Confirm payment (mock)' })
  @ApiHeader({ name: IDEMPOTENCY_KEY_HEADER, required: false })
  confirm(
    @Param('paymentReference') paymentReference: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ) {
    return this.paymentsService.confirm(paymentReference, user, idempotencyKey);
  }

  @Post('payments/:paymentReference/fail')
  @ApiOperation({ summary: 'Mark payment as failed (mock)' })
  fail(
    @Param('paymentReference') paymentReference: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.fail(paymentReference, user);
  }
}
