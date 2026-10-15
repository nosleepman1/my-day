import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { AccountEnvelope, AccountListEnvelope } from '@orbit/contracts';

import {
  AccountEnvelopeDto,
  AccountListEnvelopeDto,
  CloseAccountDto,
  CreateAccountDto,
  IdParamDto,
  ListAccountsQueryDto,
  ReopenAccountDto,
  UpdateAccountDto,
} from '../finance.dto';

import { AccountsService } from './accounts.service';

/** Comptes financiers (API.md §14.6, FINANCE_RULES.md §1). */
@Controller('finance/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

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
}
