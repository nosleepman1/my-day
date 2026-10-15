import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { TransferEnvelope } from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import { CreateTransferDto, IdParamDto, TransferEnvelopeDto } from '../finance.dto';

import { TransfersService } from './transfers.service';

/** Transferts inter-comptes (API.md §14.6, FINANCE_RULES.md §6). */
@Controller('finance/transfers')
export class TransfersController {
  constructor(
    private readonly transfers: TransfersService,
    private readonly tenant: TenantContext,
  ) {}

  @Post()
  @Idempotent()
  @ZodSerializerDto(TransferEnvelopeDto)
  async create(
    @Body() body: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<TransferEnvelope> {
    const data = await this.transfers.create(this.tenant.requireUserId(), body, idempotencyKey);
    return { data };
  }

  @Get(':id')
  @ZodSerializerDto(TransferEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<TransferEnvelope> {
    const data = await this.transfers.getById(this.tenant.requireUserId(), params.id);
    return { data };
  }
}
