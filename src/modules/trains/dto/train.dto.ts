import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TrainClass } from '../../../common/enums';

export class CreateTrainDto {
  @ApiProperty({ example: 'KA-101' })
  @IsString()
  @IsNotEmpty()
  trainCode: string;

  @ApiProperty({ example: 'Argo Bromo Anggrek' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TrainClass })
  @IsEnum(TrainClass)
  trainClass: TrainClass;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeats: number;
}

export class UpdateTrainDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: TrainClass })
  @IsOptional()
  @IsEnum(TrainClass)
  trainClass?: TrainClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
