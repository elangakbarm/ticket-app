import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  UpdateScheduleStatusDto,
  SearchSchedulesDto,
} from './dto/schedule.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Schedules')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search schedules' })
  findAll(@Query() query: SearchSchedulesDto) {
    return this.schedulesService.findAll(query);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Get schedule by public ID' })
  findOne(@Param('publicId') publicId: string) {
    return this.schedulesService.findOne(publicId);
  }

  @Public()
  @Get(':publicId/seats')
  @ApiOperation({ summary: 'Get seat availability for a schedule' })
  getSeatAvailability(@Param('publicId') publicId: string) {
    return this.schedulesService.getSeatAvailability(publicId);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a schedule' })
  create(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.create(dto, user.id);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update a schedule' })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.update(publicId, dto, user.id);
  }

  @Patch(':publicId/status')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update schedule status' })
  updateStatus(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateScheduleStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.updateStatus(publicId, dto, user.id);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a schedule (Admin only)' })
  remove(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.softDelete(publicId, user.id);
  }
}
