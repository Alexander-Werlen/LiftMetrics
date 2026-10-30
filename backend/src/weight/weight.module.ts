import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { WeightController } from './weight.controller';
import { WeightService } from './weight.service';

@Module({
  imports: [AccountModule, AuthModule],
  controllers: [WeightController],
  providers: [WeightService, Auth0AccessTokenGuard],
})
export class WeightModule {}
