import { WeightUnit } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import { IsIanaTimeZone } from './iana-time-zone.validator';

export class ProvisionAccountDto {
  @ApiProperty({ example: 'America/Argentina/Buenos_Aires', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  @IsIanaTimeZone()
  timeZone!: string;

  @ApiProperty({ enum: WeightUnit, example: WeightUnit.KG })
  @IsEnum(WeightUnit)
  preferredWeightUnit!: WeightUnit;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'Account time zone is immutable. Repeating the current value is accepted; changing it is rejected.',
    example: 'America/Argentina/Buenos_Aires',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(64)
  @IsIanaTimeZone()
  timeZone?: string;

  @ApiPropertyOptional({ enum: WeightUnit, example: WeightUnit.LB })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(WeightUnit)
  preferredWeightUnit?: WeightUnit;
}
