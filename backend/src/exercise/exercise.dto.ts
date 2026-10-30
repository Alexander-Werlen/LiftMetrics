import { ApiProperty } from '@nestjs/swagger';
import { ExerciseMeasurementType } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExerciseListQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class ExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Back squat' })
  name!: string;

  @ApiProperty({ enum: ExerciseMeasurementType, enumName: 'ExerciseMeasurementType' })
  measurementType!: ExerciseMeasurementType;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;
}
