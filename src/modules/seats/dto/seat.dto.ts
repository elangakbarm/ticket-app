import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TrainClass } from '../../../common/enums';

export class CreateSeatDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carriageNumber: number;

  @ApiProperty({ example: 'A1' })
  @IsString()
  @IsNotEmpty()
  seatNumber: string;

  @ApiProperty({ enum: TrainClass })
  @IsEnum(TrainClass)
  seatClass: TrainClass;
}

export class BulkCreateSeatsDto {
  @ApiProperty({ type: [CreateSeatDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSeatDto)
  seats: CreateSeatDto[];
}

export class GenerateSeatsDto {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carriages: number;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatsPerCarriage: number;

  @ApiProperty({ enum: TrainClass })
  @IsEnum(TrainClass)
  seatClass: TrainClass;
}
