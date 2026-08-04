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
import { RoutesService } from './routes.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/route.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all routes' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.routesService.findAll(query);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Get route by public ID' })
  findOne(@Param('publicId') publicId: string) {
    return this.routesService.findOne(publicId);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new route (Admin only)' })
  create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.routesService.create(dto, user.id);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update route (Admin only)' })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.routesService.update(publicId, dto, user.id);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete route (Admin only)' })
  remove(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.routesService.softDelete(publicId, user.id);
  }
}
