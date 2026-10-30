import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';
import { AccountModule } from './account/account.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ExerciseModule } from './exercise/exercise.module';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),
  AUTH0_ISSUER: Joi.string().uri({ scheme: ['https'] }).empty(''),
  AUTH0_API_AUDIENCE: Joi.string().min(1).empty(''),
  AUTH0_CLIENT_IDS: Joi.string().pattern(/^\s*[^,\s]+(\s*,\s*[^,\s]+)*\s*$/).empty(''),
  AUTH0_MGMT_CLIENT_ID: Joi.string().min(1).empty(''),
  AUTH0_MGMT_CLIENT_SECRET: Joi.string().min(1).empty(''),
  AUTH0_MGMT_AUDIENCE: Joi.string().uri({ scheme: ['https'] }).empty(''),
  ACCOUNT_DELETION_POLL_MS: Joi.number().integer().min(500).default(5000),
}).and('AUTH0_ISSUER', 'AUTH0_API_AUDIENCE', 'AUTH0_CLIENT_IDS')
  .and('AUTH0_MGMT_CLIENT_ID', 'AUTH0_MGMT_CLIENT_SECRET', 'AUTH0_MGMT_AUDIENCE')
  .when(Joi.object({ NODE_ENV: Joi.valid('production') }).unknown(), {
    then: Joi.object({
      AUTH0_ISSUER: Joi.required(),
      AUTH0_API_AUDIENCE: Joi.required(),
      AUTH0_CLIENT_IDS: Joi.required(),
      AUTH0_MGMT_CLIENT_ID: Joi.required(),
      AUTH0_MGMT_CLIENT_SECRET: Joi.required(),
      AUTH0_MGMT_AUDIENCE: Joi.required(),
    }),
  });

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: environmentSchema }),
    PrismaModule,
    HealthModule,
    AccountModule,
    ExerciseModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
