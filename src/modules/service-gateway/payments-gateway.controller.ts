import { Controller, Req, Res, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { ServiceCaller } from './service-caller.service';
import type { Request, Response } from 'express';
import { CreatePaymentDto } from '../payments/dto/payment.dto';
import { IDEMPOTENCY_KEY_HEADER } from '../../common/constants';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsGatewayController {
  constructor(private readonly caller: ServiceCaller) {}

  @Post('bookings/:bookingCode/payments')
  @ApiOperation({ summary: 'Create payment for a booking' })
  create(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward(
      'payments',
      'POST',
      ['bookings', bookingCode, 'payments'],
      req,
      res,
      dto,
    );
  }

  @Get('payments/:paymentReference')
  @ApiOperation({ summary: 'Get payment by reference' })
  findOne(
    @Param('paymentReference') paymentReference: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward('payments', 'GET', ['payments', paymentReference], req, res);
  }

  @Post('payments/:paymentReference/confirm')
  @ApiOperation({ summary: 'Confirm payment (mock)' })
  @ApiHeader({ name: IDEMPOTENCY_KEY_HEADER, required: false })
  confirm(
    @Param('paymentReference') paymentReference: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward(
      'payments',
      'POST',
      ['payments', paymentReference, 'confirm'],
      req,
      res,
    );
  }

  @Post('payments/:paymentReference/fail')
  @ApiOperation({ summary: 'Mark payment as failed (mock)' })
  fail(
    @Param('paymentReference') paymentReference: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward(
      'payments',
      'POST',
      ['payments', paymentReference, 'fail'],
      req,
      res,
    );
  }
}
