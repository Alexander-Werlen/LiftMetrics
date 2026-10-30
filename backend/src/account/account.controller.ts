import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { AuthPrincipal, CurrentAccount } from '../auth/auth-principal.decorator';
import { AccountContext, AuthenticatedIdentity } from '../auth/auth.types';
import { AccountDeletionAcceptedResponseDto, AccountResponseDto, ProvisionAccountDto, UpdateAccountDto } from './account.dto';
import { AccountService } from './account.service';
import { LocalAccountGuard } from './local-account.guard';
import { ApiCommonProtectedResponses } from '../common/api-common-responses';
import { ApiErrorResponseDto } from '../common/api-error.dto';

@ApiTags('account')
@ApiBearerAuth()
@ApiCommonProtectedResponses()
@UseGuards(Auth0AccessTokenGuard)
@Controller('api/account')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Post()
  @ApiOperation({ summary: 'Provision or retrieve the authenticated user account' })
  @ApiResponse({ status: 201, type: AccountResponseDto, description: 'Account provisioned.' })
  @ApiResponse({ status: 200, type: AccountResponseDto, description: 'Account already exists; the request is idempotent.' })
  async provision(
    @AuthPrincipal() identity: AuthenticatedIdentity,
    @Body() input: ProvisionAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountContext> {
    const result = await this.accounts.provision(identity, input);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.account;
  }

  @Get()
  @UseGuards(LocalAccountGuard)
  @ApiOperation({ summary: 'Return the authenticated LiftMetrics account' })
  @ApiResponse({ status: 200, type: AccountResponseDto, description: 'The local account.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'No LiftMetrics account is provisioned for this identity.' })
  getCurrent(@CurrentAccount() account: AccountContext): AccountContext { return account; }

  @Patch()
  @UseGuards(LocalAccountGuard)
  @ApiOperation({ summary: 'Update account preferences without changing its time zone' })
  @ApiResponse({ status: 200, type: AccountResponseDto, description: 'Updated account.' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: 'The request is invalid or the immutable time zone was changed.' })
  update(@CurrentAccount() account: AccountContext, @Body() input: UpdateAccountDto): Promise<AccountContext> {
    return this.accounts.update(account, input);
  }

  @Delete()
  @UseGuards(LocalAccountGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Delete local account data and schedule Auth0 identity deletion' })
  @ApiAcceptedResponse({ type: AccountDeletionAcceptedResponseDto, description: 'Local data was deleted and remote identity deletion was queued.' })
  async delete(@CurrentAccount() account: AccountContext): Promise<{ status: 'deletion_scheduled' }> {
    await this.accounts.scheduleDeletion(account.id);
    return { status: 'deletion_scheduled' };
  }
}
