import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('http');
  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const requestId = randomUUID();
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => this.logger.log(JSON.stringify({ event: 'http_request', requestId,
      method: request.method, path: request.path, statusCode: response.statusCode,
      durationMs: Date.now() - startedAt })));
    next();
  }
}
