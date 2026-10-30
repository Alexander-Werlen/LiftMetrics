import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { Auth0AccessTokenGuard } from '../auth/auth0-access-token.guard';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise.service';

@Module({
  imports: [AuthModule],
  controllers: [ExerciseController],
  providers: [ExerciseService, Auth0AccessTokenGuard],
})
export class ExerciseModule {}
