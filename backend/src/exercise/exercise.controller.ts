import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { ApiCommonProtectedResponses } from '../common/api-common-responses';
import { ApiErrorResponseDto } from '../common/api-error.dto';
import { ExerciseListQuery, ExerciseResponse } from './exercise.dto';
import { ExerciseService } from './exercise.service';

@ApiTags('exercises')
@ApiBearerAuth()
@ApiCommonProtectedResponses()
@UseGuards(Auth0AccessTokenGuard)
@Controller('api/exercises')
export class ExerciseController {
  constructor(private readonly exercises: ExerciseService) {}

  @Get()
  @ApiOperation({ summary: 'Browse active exercises in the shared catalog' })
  @ApiQuery({ name: 'q', required: false, description: 'Case-insensitive name search' })
  @ApiOkResponse({ type: ExerciseResponse, isArray: true, description: 'Active catalog exercises, alphabetically ordered.' })
  list(@Query() query: ExerciseListQuery): Promise<ExerciseResponse[]> {
    return this.exercises.list(query.q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an exercise, including an archived exercise referenced by existing records' })
  @ApiOkResponse({ type: ExerciseResponse })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'No exercise has this ID.' })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<ExerciseResponse> {
    return this.exercises.getById(id);
  }
}
