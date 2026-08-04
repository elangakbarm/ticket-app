import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/user.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Get user by public ID' })
  findOne(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findOne(publicId, user);
  }

  @Patch(':publicId')
  @ApiOperation({ summary: 'Update user profile' })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(publicId, dto, user);
  }

  @Patch(':publicId/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user active status (Admin only)' })
  updateStatus(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateStatus(publicId, dto, user.id);
  }

  @Delete(':publicId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete user (Admin only)' })
  remove(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.softDelete(publicId, user.id);
  }
}
