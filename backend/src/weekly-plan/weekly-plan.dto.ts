import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { BlueprintResponse } from '../blueprint/blueprint.dto';

export class WeeklyPlanAssignmentInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  blueprintId!: string;

  /** ISO weekday: Monday=1 through Sunday=7. */
  @ApiProperty({ minimum: 1, maximum: 7, example: 1, description: 'ISO weekday: Monday=1, Sunday=7.' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;
}

export class CreateWeeklyPlanDto {
  @ApiProperty({ example: 'My weekly plan', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [WeeklyPlanAssignmentInput], description: 'Array order determines the session order for each weekday.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyPlanAssignmentInput)
  assignments!: WeeklyPlanAssignmentInput[];
}

export class UpdateWeeklyPlanDto extends CreateWeeklyPlanDto {}

export class WeeklyPlanAssignmentResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  blueprintId!: string;

  @ApiProperty({ minimum: 1, maximum: 7 })
  weekday!: number;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ type: () => BlueprintResponse, description: 'Blueprint with its ordered exercise prescription.' })
  blueprint!: BlueprintResponse;
}

export class WeeklyPlanResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: [WeeklyPlanAssignmentResponse] })
  assignments!: WeeklyPlanAssignmentResponse[];
}

export class ActiveWeeklyPlanResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;
}

export class DailyRecommendationResponse {
  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty({ type: () => ActiveWeeklyPlanResponse, nullable: true, description: 'Active plan metadata, or null when the user has no active plan.' })
  weeklyPlan!: ActiveWeeklyPlanResponse | null;

  @ApiProperty({ type: [WeeklyPlanAssignmentResponse], description: 'Ordered session recommendations for this local date; empty when none are scheduled.' })
  sessions!: WeeklyPlanAssignmentResponse[];
}
