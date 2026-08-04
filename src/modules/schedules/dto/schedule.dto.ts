import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ScheduleStatus, TrainClass } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateScheduleDto {
  @ApiProperty({ example: 'SCH-001' })
  @IsString()
  @IsNotEmpty()
  scheduleCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  trainPublicId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  routePublicId: string;

  @ApiProperty({ example: '2026-08-10T08:00:00.000Z' })
  @IsDateString()
  departureTime: string;

  @ApiProperty({ example: '2026-08-10T12:00:00.000Z' })
  @IsDateString()
  arrivalTime: string;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  basePrice: number;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  basePrice?: number;
}

export class UpdateScheduleStatusDto {
  @ApiProperty({ enum: ScheduleStatus })
  @IsEnum(ScheduleStatus)
  status: ScheduleStatus;
}

export class SearchSchedulesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'GMR' })
  @IsOptional()
  @IsString()
  originStation?: string;

  @ApiPropertyOptional({ example: 'BD' })
  @IsOptional()
  @IsString()
  destinationStation?: string;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional({ enum: TrainClass })
  @IsOptional()
  @IsEnum(TrainClass)
  trainClass?: TrainClass;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minimumPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maximumPrice?: number;
}
