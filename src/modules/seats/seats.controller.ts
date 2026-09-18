import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeatsService } from './seats.service';
import { BulkCreateSeatsDto, CreateSeatDto, GenerateSeatsDto } from './dto/seat.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Seats')
@Controller('trains/:trainPublicId/seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List seats for a train' })
  findByTrain(@Param('trainPublicId') trainPublicId: string) {
    return this.seatsService.findByTrain(trainPublicId);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a seat (Admin only)' })
  create(
    @Param('trainPublicId') trainPublicId: string,
    @Body() dto: CreateSeatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.seatsService.create(trainPublicId, dto, user.id);
  }

  @Post('bulk')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk create seats (Admin only)' })
  bulkCreate(
    @Param('trainPublicId') trainPublicId: string,
    @Body() dto: BulkCreateSeatsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.seatsService.bulkCreate(trainPublicId, dto, user.id);
  }

  @Post('generate')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate missing seats (Admin only)',
    description:
      'Existing seats, including inactive seats, are preserved. Returns only newly created seats in data and requested/created/skipped counts in meta. Existing seat classes are not changed.',
  })
  generate(
    @Param('trainPublicId') trainPublicId: string,
    @Body() dto: GenerateSeatsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.seatsService.generateSeats(trainPublicId, dto, user.id);
  }
}
