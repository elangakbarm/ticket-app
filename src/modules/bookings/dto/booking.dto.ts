import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IdentityType, PassengerType } from '../../../common/enums';

export class PassengerDto {
  @ApiProperty({ example: 'Elang Akbar' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ enum: IdentityType })
  @IsEnum(IdentityType)
  identityType: IdentityType;

  @ApiProperty({ example: '3174000000000001' })
  @IsString()
  @IsNotEmpty()
  identityNumber: string;

  @ApiProperty({ example: '1998-01-01' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: PassengerType })
  @IsEnum(PassengerType)
  passengerType: PassengerType;
}

export class BookingSeatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  seatPublicId: string;

  @ApiProperty({ type: PassengerDto })
  @ValidateNested()
  @Type(() => PassengerDto)
  passenger: PassengerDto;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  schedulePublicId: string;

  @ApiProperty({ type: [BookingSeatDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingSeatDto)
  seats: BookingSeatDto[];
}

export class AddPassengerDto {
  @ApiProperty({ type: PassengerDto })
  @ValidateNested()
  @Type(() => PassengerDto)
  passenger: PassengerDto;
}

export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
