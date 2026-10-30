import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';

@Module({
  imports: [PrismaModule, AuthModule, AccountModule],
  controllers: [WorkoutController],
  providers: [WorkoutService, Auth0AccessTokenGuard],
})
export class WorkoutModule {}
