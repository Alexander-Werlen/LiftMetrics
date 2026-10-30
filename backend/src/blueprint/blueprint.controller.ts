import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { CurrentAccount } from '../auth/auth-principal.decorator';
import { AccountContext } from '../auth/auth.types';
import { LocalAccountGuard } from '../account/local-account.guard';
import { BlueprintResponse, CreateBlueprintDto, UpdateBlueprintDto } from './blueprint.dto';
import { BlueprintService } from './blueprint.service';

@ApiTags('session blueprints')
@ApiBearerAuth()
@UseGuards(Auth0AccessTokenGuard, LocalAccountGuard)
@Controller('api/session-blueprints')
export class BlueprintController {
  constructor(private readonly blueprints: BlueprintService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reusable workout session blueprint' })
  @ApiCreatedResponse({ type: BlueprintResponse, description: 'Created blueprint with exercises in submitted order.' })
  @ApiBadRequestResponse({ description: 'A selected exercise or prescription is invalid.' })
  create(@CurrentAccount() account: AccountContext, @Body() input: CreateBlueprintDto) {
    return this.blueprints.create(account, input);
  }

  @Get()
  @ApiOperation({ summary: 'List this user’s blueprints' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiOkResponse({ type: BlueprintResponse, isArray: true })
  list(@CurrentAccount() account: AccountContext, @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean) {
    return this.blueprints.list(account, includeArchived);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one blueprint, including its ordered exercise prescriptions' })
  @ApiOkResponse({ type: BlueprintResponse })
  @ApiNotFoundResponse({ description: 'The blueprint does not exist for this user.' })
  get(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.blueprints.get(account, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a blueprint and its ordered exercise prescriptions' })
  @ApiOkResponse({ type: BlueprintResponse })
  @ApiBadRequestResponse({ description: 'A selected exercise or prescription is invalid.' })
  @ApiNotFoundResponse({ description: 'The active blueprint does not exist for this user.' })
  update(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateBlueprintDto) {
    return this.blueprints.update(account, id, input);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a reusable blueprint while preserving references' })
  @ApiOkResponse({ type: BlueprintResponse })
  @ApiNotFoundResponse({ description: 'The blueprint does not exist for this user.' })
  archive(@CurrentAccount() account: AccountContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.blueprints.archive(account, id);
  }
}
