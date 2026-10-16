import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { RecurringTransactionEnvelope, RecurringTransactionListEnvelope } from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import {
  CreateRecurringTransactionDto,
  IdParamDto,
  ListRecurringTransactionsQueryDto,
  RecurringTransactionEnvelopeDto,
  RecurringTransactionListEnvelopeDto,
  UpdateRecurringTransactionDto,
} from '../finance.dto';

import { RecurringService } from './recurring.service';

/** Transactions récurrentes (API.md §14.9, FINANCE_RULES.md §12). */
@Controller('finance/recurring')
export class RecurringController {
  constructor(
    private readonly recurring: RecurringService,
    private readonly tenant: TenantContext,
  ) {}

  @Post()
  @Idempotent()
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async create(@Body() body: CreateRecurringTransactionDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.create(this.tenant.requireUserId(), body);
    return { data };
  }

  @Get()
  @ZodSerializerDto(RecurringTransactionListEnvelopeDto)
  async list(@Query() query: ListRecurringTransactionsQueryDto): Promise<RecurringTransactionListEnvelope> {
    const { items, nextCursor } = await this.recurring.list(this.tenant.requireUserId(), query);
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
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.getById(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.update(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Post(':id/pause')
  @Idempotent()
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async pause(@Param() params: IdParamDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.pause(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Post(':id/resume')
  @Idempotent()
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async resume(@Param() params: IdParamDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.resume(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Post(':id/terminate')
  @Idempotent()
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async terminate(@Param() params: IdParamDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.terminate(this.tenant.requireUserId(), params.id);
    return { data };
  }
}
