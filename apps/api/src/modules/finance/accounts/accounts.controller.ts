import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type {
  AccountEnvelope,
  AccountListEnvelope,
  ReconciliationResultEnvelope,
  ReconciliationStatusEnvelope,
  TransactionEnvelope,
} from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import {
  AccountAdjustmentDto,
  AccountEnvelopeDto,
  AccountListEnvelopeDto,
  CloseAccountDto,
  ConfirmReconciliationDto,
  CreateAccountDto,
  IdParamDto,
  ListAccountsQueryDto,
  ReconciliationQueryDto,
  ReconciliationResultEnvelopeDto,
  ReconciliationStatusEnvelopeDto,
  ReopenAccountDto,
  TransactionEnvelopeDto,
  UpdateAccountDto,
} from '../finance.dto';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

import { AccountsService } from './accounts.service';

/** Comptes financiers (API.md §14.6, FINANCE_RULES.md §1). */
@Controller('finance/accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Post()
  @ZodSerializerDto(AccountEnvelopeDto)
  async create(@Body() body: CreateAccountDto): Promise<AccountEnvelope> {
    const data = await this.accounts.create(body);
    return { data };
  }

  @Get()
  @ZodSerializerDto(AccountListEnvelopeDto)
  async list(@Query() query: ListAccountsQueryDto): Promise<AccountListEnvelope> {
    const data = await this.accounts.list(query);
    return { data };
  }

  @Get(':id')
  @ZodSerializerDto(AccountEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<AccountEnvelope> {
    const data = await this.accounts.getById(params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(AccountEnvelopeDto)
  async update(@Param() params: IdParamDto, @Body() body: UpdateAccountDto): Promise<AccountEnvelope> {
    const data = await this.accounts.update(params.id, body);
    return { data };
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AccountEnvelopeDto)
  async close(@Param() params: IdParamDto, @Body() body: CloseAccountDto): Promise<AccountEnvelope> {
    const data = await this.accounts.close(params.id, body);
    return { data };
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AccountEnvelopeDto)
  async reopen(@Param() params: IdParamDto, @Body() body: ReopenAccountDto): Promise<AccountEnvelope> {
    const data = await this.accounts.reopen(params.id, body);
    return { data };
  }

  @Post(':id/adjustments')
  @Idempotent()
  @ZodSerializerDto(TransactionEnvelopeDto)
  async adjustAccount(
    @Param() params: IdParamDto,
    @Body() body: AccountAdjustmentDto,
  ): Promise<TransactionEnvelope> {
    const data = await this.reconciliation.adjust(params.id, body);
    return { data };
  }

  @Get(':id/reconciliations')
  @ZodSerializerDto(ReconciliationStatusEnvelopeDto)
  async previewReconciliation(
    @Param() params: IdParamDto,
    @Query() query: ReconciliationQueryDto,
  ): Promise<ReconciliationStatusEnvelope> {
    const data = await this.reconciliation.previewReconciliation(params.id, query);
    return { data };
  }

  @Post(':id/reconciliations')
  @Idempotent()
  @ZodSerializerDto(ReconciliationResultEnvelopeDto)
  async confirmReconciliation(
    @Param() params: IdParamDto,
    @Body() body: ConfirmReconciliationDto,
  ): Promise<ReconciliationResultEnvelope> {
    const data = await this.reconciliation.confirmReconciliation(params.id, body);
    return { data };
  }
}
