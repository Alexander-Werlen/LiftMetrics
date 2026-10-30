import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseMeasurementType, WeightUnit, WorkoutStatus } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class StartAdHocWorkoutDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 120, description: 'Optional name shown in workout history.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-30', description: 'User-local date; defaults to today in the account time zone.' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workoutDate?: string;
}

export class WorkoutSetInput {
  @ApiPropertyOptional({ minimum: 1, example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  repetitions?: number;

  @ApiPropertyOptional({ example: '0', description: 'Decimal load; zero is valid. Provide unit when weight is present.' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/)
  weight?: string;

  @ApiPropertyOptional({ enum: WeightUnit, enumName: 'WeightUnit' })
  @IsOptional()
  @IsEnum(WeightUnit)
  unit?: WeightUnit;

  @ApiPropertyOptional({ minimum: 1, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  durationSeconds?: number;
}

export class WorkoutExerciseInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId!: string;

  @ApiProperty({ type: [WorkoutSetInput], description: 'Array order determines set order. Each set must match the exercise measurement type.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetInput)
  sets!: WorkoutSetInput[];
}

export class UpdateWorkoutDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-10-30' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workoutDate?: string;

  @ApiProperty({ type: [WorkoutExerciseInput], description: 'Full replacement; array order determines exercise order.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInput)
  exercises!: WorkoutExerciseInput[];
}

export class WorkoutHistoryQuery {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: WorkoutStatus, enumName: 'WorkoutStatus' })
  @IsOptional()
  @IsEnum(WorkoutStatus)
  status?: WorkoutStatus;

  @ApiPropertyOptional({ enum: WeightUnit, enumName: 'WeightUnit', description: 'Defaults to the account’s preferred unit.' })
  @IsOptional()
  @IsEnum(WeightUnit)
  unit?: WeightUnit;
}

export class WorkoutExerciseCatalogResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ExerciseMeasurementType, enumName: 'ExerciseMeasurementType' })
  measurementType!: ExerciseMeasurementType;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;
}

export class WorkoutSetResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ type: Number, nullable: true })
  repetitions!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '0.000' })
  weight!: string | null;

  @ApiProperty({ enum: WeightUnit, enumName: 'WeightUnit', nullable: true })
  unit!: WeightUnit | null;

  @ApiProperty({ type: Number, nullable: true })
  durationSeconds!: number | null;
}

export class WorkoutExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty()
  exerciseNameSnapshot!: string;

  @ApiProperty({ enum: ExerciseMeasurementType, enumName: 'ExerciseMeasurementType' })
  measurementTypeSnapshot!: ExerciseMeasurementType;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ type: Number, nullable: true, minimum: 1 })
  plannedSetCountSnapshot!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 1 })
  targetRepMinSnapshot!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 1 })
  targetRepMaxSnapshot!: number | null;

  @ApiProperty({ type: () => WorkoutExerciseCatalogResponse })
  exercise!: WorkoutExerciseCatalogResponse;

  @ApiProperty({ type: [WorkoutSetResponse] })
  sets!: WorkoutSetResponse[];
}

export class WorkoutResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  sourceBlueprintId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sourceNameSnapshot!: string | null;

  @ApiProperty({ format: 'date' })
  workoutDate!: string;

  @ApiProperty({ enum: WorkoutStatus, enumName: 'WorkoutStatus' })
  status!: WorkoutStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: [WorkoutExerciseResponse] })
  exercises!: WorkoutExerciseResponse[];
}
