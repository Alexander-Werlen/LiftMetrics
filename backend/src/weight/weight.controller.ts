import { Body, Controller, Get, Param, ParseEnumPipe, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WeightUnit } from '@prisma/client';
import { ApiCommonProtectedResponses } from '../common/api-common-responses';
import { ApiErrorResponseDto } from '../common/api-error.dto';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { CurrentAccount } from '../auth/auth-principal.decorator';
import { AccountContext } from '../auth/auth.types';
import { LocalAccountGuard } from '../account/local-account.guard';
import { SaveWeightEntryDto, WeightEntryResponse, WeightHistoryPageResponse, WeightHistoryQuery } from './weight.dto';
import { WeightService } from './weight.service';

@ApiTags('weight entries')
@ApiBearerAuth()
@ApiCommonProtectedResponses()
@UseGuards(Auth0AccessTokenGuard, LocalAccountGuard)
@Controller('api/weight-entries')
export class WeightController {
  constructor(private readonly weights: WeightService) {}

  @Put(':entryDate')
  @ApiOperation({ summary: 'Create or correct the authenticated user’s entry for a calendar date' })
  @ApiParam({ name: 'entryDate', description: 'User-local calendar date in YYYY-MM-DD format.' })
  @ApiOkResponse({ type: WeightEntryResponse, description: 'The saved value in the submitted unit.' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: 'The date or weight is invalid.' })
  save(
    @CurrentAccount() account: AccountContext,
    @Param('entryDate') entryDate: string,
    @Body() input: SaveWeightEntryDto,
  ): Promise<WeightEntryResponse> {
    return this.weights.save(account, entryDate, input);
  }

  @Get(':entryDate')
  @ApiOperation({ summary: 'Read one weight entry in an explicit or preferred unit' })
  @ApiParam({ name: 'entryDate', description: 'User-local calendar date in YYYY-MM-DD format.' })
  @ApiQuery({ name: 'unit', required: false, enum: WeightUnit, description: "Defaults to the account's preferred unit." })
  @ApiOkResponse({ type: WeightEntryResponse })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'No entry exists for this user and date.' })
  get(
    @CurrentAccount() account: AccountContext,
    @Param('entryDate') entryDate: string,
    @Query('unit', new ParseEnumPipe(WeightUnit, { optional: true })) unit?: WeightUnit,
  ) {
    return this.weights.get(account, entryDate, unit);
  }

  @Get()
  @ApiOperation({ summary: 'List this user’s weight history, newest date first' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100, description: 'Maximum entries to return; defaults to 50.' })
  @ApiQuery({ name: 'before', required: false, type: String, format: 'date', description: 'Exclusive YYYY-MM-DD cursor from the previous page response.' })
  @ApiOkResponse({ type: WeightHistoryPageResponse })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: 'The date range, page size, or date cursor is invalid.' })
  history(@CurrentAccount() account: AccountContext, @Query() query: WeightHistoryQuery) {
    return this.weights.history(account, query);
  }
}
