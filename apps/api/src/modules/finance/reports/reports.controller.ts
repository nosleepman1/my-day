import { Controller, Get, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type {
  BalancesReportEnvelope,
  CashFlowEnvelope,
  CategoryBreakdownEnvelope,
  FinanceSummaryEnvelope,
} from '@orbit/contracts';

import {
  BalancesReportEnvelopeDto,
  BalancesReportQueryDto,
  CashFlowEnvelopeDto,
  CashFlowQueryDto,
  CategoryBreakdownEnvelopeDto,
  CategoryBreakdownQueryDto,
  FinanceSummaryEnvelopeDto,
  FinanceSummaryQueryDto,
} from '../finance.dto';

import { ReportsService } from './reports.service';

/** Rapports financiers (API.md §14.6, FINANCE_RULES.md §16). */
@Controller('finance/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ZodSerializerDto(FinanceSummaryEnvelopeDto)
  async getSummary(@Query() query: FinanceSummaryQueryDto): Promise<FinanceSummaryEnvelope> {
    const data = await this.reports.getSummary(query);
    return { data };
  }

  @Get('by-category')
  @ZodSerializerDto(CategoryBreakdownEnvelopeDto)
  async getByCategory(@Query() query: CategoryBreakdownQueryDto): Promise<CategoryBreakdownEnvelope> {
    const data = await this.reports.getCategoryBreakdown(query);
    return { data };
  }

  @Get('cashflow')
  @ZodSerializerDto(CashFlowEnvelopeDto)
  async getCashFlow(@Query() query: CashFlowQueryDto): Promise<CashFlowEnvelope> {
    const data = await this.reports.getCashFlow(query);
    return { data };
  }

  @Get('balances')
  @ZodSerializerDto(BalancesReportEnvelopeDto)
  async getBalances(@Query() query: BalancesReportQueryDto): Promise<BalancesReportEnvelope> {
    const data = await this.reports.getBalances(query);
    return { data };
  }
}
