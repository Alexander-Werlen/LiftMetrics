import 'reflect-metadata';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ApiErrorResponseDto } from './common/api-error.dto';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logLevels: Record<string, LogLevel[]> = {
    error: ['error'],
    warn: ['error', 'warn'],
    log: ['error', 'warn', 'log'],
    debug: ['error', 'warn', 'log', 'debug'],
    verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
  };
  app.useLogger(logLevels[config.get<string>('LOG_LEVEL', 'log')]);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  const configBuilder = new DocumentBuilder().setTitle('LiftMetrics API')
    .setDescription(`REST/JSON API for LiftMetrics account, weight, workout, and schedule data. Protected endpoints require an Auth0 access token for the configured API audience. Personal records are always scoped to the authenticated account; a foreign or missing personal record returns the same not-found response. Validation errors use the documented error response, and request bodies reject unknown properties.`)
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Auth0 access token for the LiftMetrics API audience.' })
    .build();
  const document = SwaggerModule.createDocument(app, configBuilder, { extraModels: [ApiErrorResponseDto] });
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/openapi.json',
  });
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
