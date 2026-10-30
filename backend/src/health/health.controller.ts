import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ApiErrorResponseDto } from '../common/api-error.dto';

@ApiTags('operations')
@Controller('api')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'The process is running.' })
  health(): { status: 'ok' } { return { status: 'ok' }; }
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check including PostgreSQL connectivity' })
  @ApiResponse({ status: 200, description: 'The service and database are ready.' })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto, description: 'The database dependency is unavailable.' })
  async readiness(): Promise<{ status: 'ready' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new HttpException({ statusCode: 503, message: 'A required dependency is unavailable' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
