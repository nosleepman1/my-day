import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type {
  RecurringOccurrenceEnvelope,
  RecurringOccurrenceListEnvelope,
  RecurringTransactionEnvelope,
  RecurringTransactionListEnvelope,
} from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import {
  ConfirmOccurrenceDto,
  CreateRecurringTransactionDto,
  IdParamDto,
  ListOccurrencesQueryDto,
  ListRecurringTransactionsQueryDto,
  RecurringOccurrenceEnvelopeDto,
  RecurringOccurrenceListEnvelopeDto,
  RecurringTransactionEnvelopeDto,
  RecurringTransactionListEnvelopeDto,
  SkipOccurrenceDto,
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

  @Get('occurrences')
  @ZodSerializerDto(RecurringOccurrenceListEnvelopeDto)
  async listOccurrences(@Query() query: ListOccurrencesQueryDto): Promise<RecurringOccurrenceListEnvelope> {
    const { items, nextCursor } = await this.recurring.listOccurrences(this.tenant.requireUserId(), query);
    return {
      data: items,
      meta: {
        limit: query.limit,
        hasMore: Boolean(nextCursor),
        nextCursor: nextCursor ?? null,
      },
    };
  }

  @Post('occurrences/:id/confirm')
  @Idempotent()
  @ZodSerializerDto(RecurringOccurrenceEnvelopeDto)
  async confirmOccurrence(
    @Param() params: IdParamDto,
    @Body() body: ConfirmOccurrenceDto,
  ): Promise<RecurringOccurrenceEnvelope> {
    const data = await this.recurring.confirmOccurrence(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Post('occurrences/:id/skip')
  @Idempotent()
  @ZodSerializerDto(RecurringOccurrenceEnvelopeDto)
  async skipOccurrence(
    @Param() params: IdParamDto,
    @Body() body: SkipOccurrenceDto,
  ): Promise<RecurringOccurrenceEnvelope> {
    const data = await this.recurring.skipOccurrence(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Get(':id')
  @ZodSerializerDto(RecurringTransactionEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<RecurringTransactionEnvelope> {
    const data = await this.recurring.getById(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Get(':id/occurrences')
  @ZodSerializerDto(RecurringOccurrenceListEnvelopeDto)
  async listOccurrencesForRecurrence(
    @Param() params: IdParamDto,
    @Query() query: ListOccurrencesQueryDto,
  ): Promise<RecurringOccurrenceListEnvelope> {
    const userId = this.tenant.requireUserId();
    if (query.to) {
      await this.recurring.materializeOccurrences(userId, params.id, query.to);
    }
    const { items, nextCursor } = await this.recurring.listOccurrences(userId, {
      from: query.from,
      to: query.to,
      status: query.status,
      accountId: query.accountId,
      limit: query.limit,
      cursor: query.cursor,
      recurringTransactionId: params.id,
    });
    return {
      data: items,
      meta: {
        limit: query.limit,
        hasMore: Boolean(nextCursor),
        nextCursor: nextCursor ?? null,
      },
    };
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
