import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  AddPassengerDto,
  CancelBookingDto,
} from './dto/booking.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new booking' })
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings' })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.findAll(query, user);
  }

  @Get(':bookingCode')
  @ApiOperation({ summary: 'Get booking by code' })
  findOne(
    @Param('bookingCode') bookingCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.findOne(bookingCode, user);
  }

  @Patch(':bookingCode/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancel(bookingCode, dto, user);
  }

  @Post(':bookingCode/passengers')
  @ApiOperation({ summary: 'Add passenger to booking' })
  addPassenger(
    @Param('bookingCode') bookingCode: string,
    @Body() dto: AddPassengerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.addPassenger(bookingCode, dto, user);
  }
}
