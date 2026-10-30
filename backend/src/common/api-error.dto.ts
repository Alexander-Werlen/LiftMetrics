import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message!: string | string[];

  @ApiProperty({ format: 'uuid', description: 'Request correlation ID. Also returned in the X-Request-Id response header.' })
  requestId!: string;

  @ApiProperty({ example: '/api/weight-entries/2026-10-30' })
  path!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;
}
