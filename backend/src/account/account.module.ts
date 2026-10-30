import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { Auth0ManagementClient } from './auth0-management.client';
import { AccountDeletionWorker } from './account-deletion.worker';
import { IanaTimeZoneConstraint } from './iana-time-zone.validator';
import { LocalAccountGuard } from './local-account.guard';

@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService, Auth0ManagementClient, AccountDeletionWorker, Auth0AccessTokenGuard,
    LocalAccountGuard, IanaTimeZoneConstraint],
  exports: [AccountService, LocalAccountGuard],
})
export class AccountModule {}
