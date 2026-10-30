import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyPlanController } from './weekly-plan.controller';
import { WeeklyPlanService } from './weekly-plan.service';

@Module({
  imports: [PrismaModule, AuthModule, AccountModule],
  controllers: [WeeklyPlanController],
  providers: [WeeklyPlanService, Auth0AccessTokenGuard],
})
export class WeeklyPlanModule {}
