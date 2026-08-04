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
import { StationsService } from './stations.service';
import { CreateStationDto, UpdateStationDto } from './dto/station.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Stations')
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all stations' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.stationsService.findAll(query);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Get station by public ID' })
  findOne(@Param('publicId') publicId: string) {
    return this.stationsService.findOne(publicId);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new station (Admin only)' })
  create(
    @Body() dto: CreateStationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stationsService.create(dto, user.id);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update station (Admin only)' })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateStationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stationsService.update(publicId, dto, user.id);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete station (Admin only)' })
  remove(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stationsService.softDelete(publicId, user.id);
  }
}
