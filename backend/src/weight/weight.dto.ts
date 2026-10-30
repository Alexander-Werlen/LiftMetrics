import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SaveWeightEntryDto {
  @ApiProperty({ description: 'Positive decimal string; up to six fractional digits before canonical rounding.', example: '180.25' })
  @IsString()
  @MaxLength(32)
  @Matches(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/, { message: 'weight must be a non-negative decimal string with at most six fractional digits' })
  weight!: string;

  @ApiProperty({ enum: WeightUnit, enumName: 'WeightUnit' })
  @IsEnum(WeightUnit)
  unit!: WeightUnit;
}

export class WeightHistoryQuery {
  @ApiPropertyOptional({ enum: WeightUnit, enumName: 'WeightUnit', description: "Defaults to the account's preferred unit." })
  @IsOptional()
  @IsEnum(WeightUnit)
  unit?: WeightUnit;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-01-01', description: 'Inclusive lower date bound.' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-12-31', description: 'Inclusive upper date bound.' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class WeightEntryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-10-30' })
  entryDate!: string;

  @ApiProperty({ description: 'Decimal string in the response unit.' })
  weight!: string;

  @ApiProperty({ enum: WeightUnit, enumName: 'WeightUnit' })
  unit!: WeightUnit;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
