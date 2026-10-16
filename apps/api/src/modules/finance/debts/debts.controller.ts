import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type {
  DebtEnvelope,
  DebtListEnvelope,
  DebtSummaryEnvelope,
  RepaymentEnvelope,
  RepaymentListEnvelope,
} from '@orbit/contracts';

import { Idempotent } from '../../../platform/idempotency/idempotent.decorator';
import { TenantContext } from '../../../platform/tenant/tenant-context';
import {
  CancelDebtDto,
  CreateDebtDto,
  CreateRepaymentDto,
  DebtEnvelopeDto,
  DebtListEnvelopeDto,
  DebtRepaymentParamDto,
  DebtSummaryEnvelopeDto,
  IdParamDto,
  ListDebtsQueryDto,
  RepaymentEnvelopeDto,
  RepaymentListEnvelopeDto,
  UpdateDebtDto,
  WriteOffDebtDto,
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

  @Get('summary')
  @ZodSerializerDto(DebtSummaryEnvelopeDto)
  async getSummary(): Promise<DebtSummaryEnvelope> {
    const data = await this.debts.getSummary(this.tenant.requireUserId());
    return { data };
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

  @Post(':id/cancel')
  @Idempotent()
  @ZodSerializerDto(DebtEnvelopeDto)
  async cancel(@Param() params: IdParamDto, @Body() body: CancelDebtDto): Promise<DebtEnvelope> {
    const data = await this.debts.cancel(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Post(':id/write-off')
  @Idempotent()
  @ZodSerializerDto(DebtEnvelopeDto)
  async writeOff(@Param() params: IdParamDto, @Body() body: WriteOffDebtDto): Promise<DebtEnvelope> {
    const data = await this.debts.writeOff(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Post(':id/repayments')
  @Idempotent()
  @ZodSerializerDto(RepaymentEnvelopeDto)
  async createRepayment(
    @Param() params: IdParamDto,
    @Body() body: CreateRepaymentDto,
  ): Promise<RepaymentEnvelope> {
    const data = await this.debts.createRepayment(this.tenant.requireUserId(), params.id, body);
    return { data };
  }

  @Get(':id/repayments')
  @ZodSerializerDto(RepaymentListEnvelopeDto)
  async listRepayments(@Param() params: IdParamDto): Promise<RepaymentListEnvelope> {
    const items = await this.debts.listRepayments(this.tenant.requireUserId(), params.id);
    return {
      data: items,
      meta: {
        limit: items.length || 1,
        hasMore: false,
        nextCursor: null,
      },
    };
  }

  @Delete(':id/repayments/:repaymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRepayment(@Param() params: DebtRepaymentParamDto): Promise<void> {
    await this.debts.deleteRepayment(this.tenant.requireUserId(), params.id, params.repaymentId);
  }
}
