import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { DebtEnvelope, DebtListEnvelope } from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import {
  CreateDebtDto,
  DebtEnvelopeDto,
  DebtListEnvelopeDto,
  IdParamDto,
  ListDebtsQueryDto,
  UpdateDebtDto,
} from '../finance.dto';

import { DebtsService } from './debts.service';

/** Dettes et créances (API.md §14.8, FINANCE_RULES.md §11). */
@Controller('finance/debts')
export class DebtsController {
  constructor(
    private readonly debts: DebtsService,
    private readonly tenant: TenantContext,
  ) {}

  @Post()
  @Idempotent()
  @ZodSerializerDto(DebtEnvelopeDto)
  async create(@Body() body: CreateDebtDto): Promise<DebtEnvelope> {
    const data = await this.debts.create(this.tenant.requireUserId(), body);
    return { data };
  }

  @Get()
  @ZodSerializerDto(DebtListEnvelopeDto)
  async list(@Query() query: ListDebtsQueryDto): Promise<DebtListEnvelope> {
    const { items, nextCursor } = await this.debts.list(this.tenant.requireUserId(), query);
    return {
      data: items,
      meta: {
        limit: query.limit,
        hasMore: Boolean(nextCursor),
        nextCursor: nextCursor ?? null,
      },
    };
  }

  @Get(':id')
  @ZodSerializerDto(DebtEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<DebtEnvelope> {
    const data = await this.debts.getById(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(DebtEnvelopeDto)
  async update(@Param() params: IdParamDto, @Body() body: UpdateDebtDto): Promise<DebtEnvelope> {
    const data = await this.debts.update(this.tenant.requireUserId(), params.id, body);
    return { data };
  }
}
