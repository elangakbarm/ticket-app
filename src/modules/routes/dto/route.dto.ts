import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRouteDto {
  @ApiProperty({ example: 'GMR-BD' })
  @IsString()
  @IsNotEmpty()
  routeCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originStationPublicId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationStationPublicId: string;

  @ApiProperty({ example: 150.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm: number;

  @ApiProperty({ example: 120 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedDurationMinutes: number;
}

export class UpdateRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
