import { Controller, Req, Res, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ServiceCaller } from './service-caller.service';
import type { Request, Response } from 'express';
import { CreateBookingDto, AddPassengerDto, CancelBookingDto } from '../bookings/dto/booking.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsGatewayController {
  constructor(private readonly caller: ServiceCaller) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new booking' })
  create(
    @Body() dto: CreateBookingDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward('bookings', 'POST', ['bookings'], req, res, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward('bookings', 'GET', ['bookings'], req, res, undefined, query);
  }

  @Get(':bookingCode')
  @ApiOperation({ summary: 'Get booking by code' })
  findOne(
    @Param('bookingCode') bookingCode: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward('bookings', 'GET', ['bookings', bookingCode], req, res);
  }

  @Patch(':bookingCode/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: CancelBookingDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward(
      'bookings',
      'PATCH',
      ['bookings', bookingCode, 'cancel'],
      req,
      res,
      dto,
    );
  }

  @Post(':bookingCode/passengers')
  @ApiOperation({ summary: 'Add passenger to booking' })
  addPassenger(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: AddPassengerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.caller.forward(
      'bookings',
      'POST',
      ['bookings', bookingCode, 'passengers'],
      req,
      res,
      dto,
    );
  }
}
