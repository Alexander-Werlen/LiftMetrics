import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { CurrentAccount } from '../auth/auth-principal.decorator';
import { AccountContext } from '../auth/auth.types';
import { LocalAccountGuard } from '../account/local-account.guard';
import { CreateWeeklyPlanDto, DailyRecommendationResponse, UpdateWeeklyPlanDto, WeeklyPlanResponse } from './weekly-plan.dto';
import { WeeklyPlanService } from './weekly-plan.service';

@ApiTags('weekly plans')
@ApiBearerAuth()
@UseGuards(Auth0AccessTokenGuard, LocalAccountGuard)
@Controller('api/weekly-plans')
export class WeeklyPlanController {
  constructor(private readonly plans: WeeklyPlanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a weekly plan and its weekday assignments' })
  @ApiCreatedResponse({ type: WeeklyPlanResponse })
  @ApiBadRequestResponse({ description: 'The plan name or assignments are invalid.' })
  create(@CurrentAccount() account: AccountContext, @Body() input: CreateWeeklyPlanDto) {
    return this.plans.create(account, input);
  }

  @Get()
  @ApiOperation({ summary: 'List this user’s weekly plans' })
  @ApiOkResponse({ type: WeeklyPlanResponse, isArray: true })
  list(@CurrentAccount() account: AccountContext) {
    return this.plans.list(account);
  }

  @Get('recommendation/today')
  @ApiOperation({ summary: 'Get ordered session recommendations for today in the user’s time zone' })
  @ApiOkResponse({ type: DailyRecommendationResponse })
  recommendation(@CurrentAccount() account: AccountContext) {
    return this.plans.recommendation(account);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one weekly plan and its ordered assignments' })
  @ApiOkResponse({ type: WeeklyPlanResponse })
  @ApiNotFoundResponse({ description: 'The plan does not exist for this user.' })
  get(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.get(account, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a weekly plan’s name and assignments' })
  @ApiOkResponse({ type: WeeklyPlanResponse })
  @ApiBadRequestResponse({ description: 'The plan name or assignments are invalid.' })
  @ApiNotFoundResponse({ description: 'The plan does not exist for this user.' })
  update(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateWeeklyPlanDto) {
    return this.plans.update(account, id, input);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate this plan and deactivate any other plan for the user' })
  @ApiOkResponse({ type: WeeklyPlanResponse })
  @ApiConflictResponse({ description: 'Another weekly plan was activated concurrently.' })
  @ApiNotFoundResponse({ description: 'The plan does not exist for this user.' })
  activate(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.activate(account, id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate this plan' })
  @ApiOkResponse({ type: WeeklyPlanResponse })
  @ApiNotFoundResponse({ description: 'The plan does not exist for this user.' })
  deactivate(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.deactivate(account, id);
  }
}
