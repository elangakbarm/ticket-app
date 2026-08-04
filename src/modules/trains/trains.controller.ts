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
import { TrainsService } from './trains.service';
import { CreateTrainDto, UpdateTrainDto } from './dto/train.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Trains')
@Controller('trains')
export class TrainsController {
  constructor(private readonly trainsService: TrainsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all trains' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.trainsService.findAll(query);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Get train by public ID' })
  findOne(@Param('publicId') publicId: string) {
    return this.trainsService.findOne(publicId);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new train (Admin only)' })
  create(
    @Body() dto: CreateTrainDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trainsService.create(dto, user.id);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update train (Admin only)' })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateTrainDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trainsService.update(publicId, dto, user.id);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete train (Admin only)' })
  remove(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trainsService.softDelete(publicId, user.id);
  }
}
