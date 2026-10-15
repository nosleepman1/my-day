import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { TransactionEnvelope, TransactionListEnvelope } from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import {
  CreateTransactionDto,
  IdParamDto,
  ListTransactionsQueryDto,
  TransactionEnvelopeDto,
  TransactionListEnvelopeDto,
  UpdateTransactionDetailsDto,
} from '../finance.dto';

import { TransactionsService } from './transactions.service';

/** Transactions financières (API.md §14.6, FINANCE_RULES.md §4). */
@Controller('finance/transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly tenant: TenantContext,
  ) {}

  @Post()
  @Idempotent()
  @ZodSerializerDto(TransactionEnvelopeDto)
  async create(
    @Body() body: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<TransactionEnvelope> {
    const data = await this.transactions.create(this.tenant.requireUserId(), body, idempotencyKey);
    return { data };
  }

  @Get()
  @ZodSerializerDto(TransactionListEnvelopeDto)
  async list(@Query() query: ListTransactionsQueryDto): Promise<TransactionListEnvelope> {
    const { items, nextCursor, hasMore } = await this.transactions.list(this.tenant.requireUserId(), query);
    return {
      data: items,
      meta: {
        limit: query.limit,
        hasMore,
        nextCursor: nextCursor ?? null,
      },
    };
  }

  @Get(':id')
  @ZodSerializerDto(TransactionEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<TransactionEnvelope> {
    const data = await this.transactions.getById(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(TransactionEnvelopeDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateTransactionDetailsDto,
  ): Promise<TransactionEnvelope> {
    const data = await this.transactions.updateDetails(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TransactionEnvelopeDto)
  async validate(@Param() params: IdParamDto): Promise<TransactionEnvelope> {
    const data = await this.transactions.validate(this.tenant.requireUserId(), params.id);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param() params: IdParamDto): Promise<void> {
    await this.transactions.delete(this.tenant.requireUserId(), params.id);
  }
}
