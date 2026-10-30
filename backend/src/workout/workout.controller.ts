import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WeightUnit } from '@prisma/client';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { CurrentAccount } from '../auth/auth-principal.decorator';
import { AccountContext } from '../auth/auth.types';
import { LocalAccountGuard } from '../account/local-account.guard';
import { StartAdHocWorkoutDto, UpdateWorkoutDto, WorkoutHistoryQuery, WorkoutResponse } from './workout.dto';
import { WorkoutService } from './workout.service';

@ApiTags('workout sessions')
@ApiBearerAuth()
@UseGuards(Auth0AccessTokenGuard, LocalAccountGuard)
@Controller('api/workout-sessions')
export class WorkoutController {
  constructor(private readonly workouts: WorkoutService) {}

  @Post()
  @ApiOperation({ summary: 'Start an ad hoc workout without a session blueprint' })
  @ApiCreatedResponse({ type: WorkoutResponse })
  @ApiBadRequestResponse({ description: 'The optional name or local date is invalid.' })
  @ApiConflictResponse({ description: 'This user already has an in-progress workout.' })
  startAdHoc(@CurrentAccount() account: AccountContext, @Body() input: StartAdHocWorkoutDto) {
    return this.workouts.startAdHoc(account, input);
  }

  @Post('from-recommendation/:assignmentId')
  @ApiOperation({ summary: 'Start today’s scheduled recommendation and copy its exercise prescription' })
  @ApiCreatedResponse({ type: WorkoutResponse })
  @ApiConflictResponse({ description: 'This user already has an in-progress workout.' })
  @ApiNotFoundResponse({ description: 'The assignment is not on today’s active plan.' })
  startRecommendation(@CurrentAccount() account: AccountContext, @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string) {
    return this.workouts.startRecommendation(account, assignmentId);
  }

  @Get()
  @ApiOperation({ summary: 'List this user’s workouts, newest workout date first' })
  @ApiOkResponse({ type: WorkoutResponse, isArray: true })
  @ApiBadRequestResponse({ description: 'A date range is invalid.' })
  list(@CurrentAccount() account: AccountContext, @Query() query: WorkoutHistoryQuery) {
    return this.workouts.list(account, query);
  }

  @Get('in-progress')
  @ApiOperation({ summary: 'Resume the user’s in-progress workout, if one exists' })
  @ApiQuery({ name: 'unit', required: false, enum: WeightUnit })
  @ApiOkResponse({ type: WorkoutResponse, nullable: true })
  inProgress(
    @CurrentAccount() account: AccountContext,
    @Query('unit', new ParseEnumPipe(WeightUnit, { optional: true })) unit?: WeightUnit,
  ) {
    return this.workouts.inProgress(account, unit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one workout and its ordered exercises and sets' })
  @ApiQuery({ name: 'unit', required: false, enum: WeightUnit })
  @ApiOkResponse({ type: WorkoutResponse })
  @ApiNotFoundResponse({ description: 'The workout does not exist for this user.' })
  get(
    @CurrentAccount() account: AccountContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('unit', new ParseEnumPipe(WeightUnit, { optional: true })) unit?: WeightUnit,
  ) {
    return this.workouts.get(account, id, unit);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace workout date, ordered exercises, and their sets; corrects completed records too' })
  @ApiOkResponse({ type: WorkoutResponse })
  @ApiBadRequestResponse({ description: 'Exercise selection or set values do not match the exercise measurement type.' })
  @ApiNotFoundResponse({ description: 'The workout does not exist for this user.' })
  update(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateWorkoutDto) {
    return this.workouts.update(account, id, input);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an in-progress workout' })
  @ApiOkResponse({ type: WorkoutResponse })
  @ApiNotFoundResponse({ description: 'The workout does not exist for this user.' })
  complete(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.workouts.complete(account, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workout and its exercises and sets' })
  @ApiNoContentResponse({ description: 'Workout and child records were deleted.' })
  @ApiNotFoundResponse({ description: 'The workout does not exist for this user.' })
  async delete(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.workouts.delete(account, id);
  }
}
