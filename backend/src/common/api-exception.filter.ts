import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const details: unknown = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.messageFrom(details);
    const requestId = response.getHeader('x-request-id')?.toString() ?? randomUUID();
    if (status >= 500) this.logger.error(JSON.stringify({ event: 'request_failed', requestId, status, path: request.path }));
    response.status(status).json({ statusCode: status,
      error: exception instanceof HttpException ? (HttpStatus[status] ?? 'Request Error') : 'Internal Server Error',
      message, requestId, path: request.path, timestamp: new Date().toISOString() });
  }
  private messageFrom(details: unknown): string | string[] {
    if (typeof details === 'string') return details;
    if (details && typeof details === 'object' && 'message' in details) {
      const message: unknown = (details as { message: unknown }).message;
      if (typeof message === 'string' || Array.isArray(message)) return message as string | string[];
    }
    return 'Request could not be completed';
  }
}
