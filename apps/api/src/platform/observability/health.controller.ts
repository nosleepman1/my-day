import { Controller, Get } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';

import { HealthResponseSchema, type HealthResponse } from '@orbit/contracts';

import { PrismaService } from '../database/prisma.service';
import { pingDatabase } from '../database/raw/health.queries';
import { DomainError } from '../errors/domain-error';

class HealthResponseDto extends createZodDto(HealthResponseSchema) {}

const OK: HealthResponse = { data: { status: 'ok' } };

/** Sondes publiques, sans version ni détail interne (API.md §14.2, ADR-038). */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(HealthController.name) private readonly logger: PinoLogger,
  ) {}

  @Get('live')
  @ZodSerializerDto(HealthResponseDto)
  live(): HealthResponse {
    return OK;
  }

  @Get('ready')
  @ZodSerializerDto(HealthResponseDto)
  async ready(): Promise<HealthResponse> {
    try {
      await pingDatabase(this.prisma);
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'health.database_unreachable');
      throw new DomainError('SERVICE_UNAVAILABLE', 'Service momentanément indisponible.', undefined);
    }
    return OK;
  }
}
