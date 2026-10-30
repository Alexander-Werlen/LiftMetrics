import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { BlueprintController } from './blueprint.controller';
import { BlueprintService } from './blueprint.service';

@Module({
  imports: [AccountModule, AuthModule],
  controllers: [BlueprintController],
  providers: [BlueprintService, Auth0AccessTokenGuard],
})
export class BlueprintModule {}
