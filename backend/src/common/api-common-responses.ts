import { applyDecorators } from '@nestjs/common';
import { ApiInternalServerErrorResponse, ApiServiceUnavailableResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiErrorResponseDto } from './api-error.dto';

export function ApiCommonProtectedResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({ type: ApiErrorResponseDto, description: 'The bearer token is missing, invalid, expired, or not authorized for this API.' }),
    ApiServiceUnavailableResponse({ type: ApiErrorResponseDto, description: 'A required authentication or database dependency is not configured or available.' }),
    ApiInternalServerErrorResponse({ type: ApiErrorResponseDto, description: 'The request failed unexpectedly. Use requestId when reporting the failure.' }),
  );
}
