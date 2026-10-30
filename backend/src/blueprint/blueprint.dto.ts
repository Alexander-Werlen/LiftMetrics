import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseMeasurementType } from '@prisma/client';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class BlueprintExerciseInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId!: string;

  @ApiProperty({ minimum: 1, example: 3 })
  @IsInt()
  @Min(1)
  plannedSetCount!: number;

  @ApiPropertyOptional({ minimum: 1, example: 8, description: 'Optional repetition range; provide both bounds.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetRepMin?: number;

  @ApiPropertyOptional({ minimum: 1, example: 12, description: 'Optional repetition range; provide both bounds.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetRepMax?: number;
}

export class CreateBlueprintDto {
  @ApiProperty({ example: 'Upper body A', maxLength: 120 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ type: [BlueprintExerciseInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintExerciseInput)
  exercises!: BlueprintExerciseInput[];
}

export class UpdateBlueprintDto extends CreateBlueprintDto {}

export class BlueprintCatalogExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ExerciseMeasurementType, enumName: 'ExerciseMeasurementType' })
  measurementType!: ExerciseMeasurementType;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;
}

export class BlueprintExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ minimum: 1 })
  plannedSetCount!: number;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  targetRepMin!: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  targetRepMax!: number | null;

  @ApiProperty({ type: () => BlueprintCatalogExerciseResponse })
  exercise!: BlueprintCatalogExerciseResponse;
}

export class BlueprintResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: [BlueprintExerciseResponse] })
  exercises!: BlueprintExerciseResponse[];
}
