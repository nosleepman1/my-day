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

import type { CounterpartyEnvelope, CounterpartyListEnvelope } from '@orbit/contracts';

import {
  CounterpartyEnvelopeDto,
  CounterpartyListEnvelopeDto,
  CreateCounterpartyDto,
  IdParamDto,
  ListCounterpartiesQueryDto,
  MergeCounterpartyDto,
  UpdateCounterpartyDto,
} from '../finance.dto';

import { CounterpartiesService } from './counterparties.service';

/** Contreparties financières (API.md §14.6, FINANCE_RULES.md §4). */
@Controller('finance/counterparties')
export class CounterpartiesController {
  constructor(private readonly counterparties: CounterpartiesService) {}

  @Post()
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async create(@Body() body: CreateCounterpartyDto): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.create(body);
    return { data };
  }

  @Get()
  @ZodSerializerDto(CounterpartyListEnvelopeDto)
  async list(@Query() query: ListCounterpartiesQueryDto): Promise<CounterpartyListEnvelope> {
    return this.counterparties.list(query);
  }

  @Get(':id')
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async get(@Param() params: IdParamDto): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.get(params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateCounterpartyDto,
  ): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.update(params.id, body);
    return { data };
  }

  @Post(':id/archive')
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async archive(@Param() params: IdParamDto): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.archive(params.id);
    return { data };
  }

  @Post(':id/unarchive')
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async unarchive(@Param() params: IdParamDto): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.unarchive(params.id);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param() params: IdParamDto): Promise<void> {
    await this.counterparties.delete(params.id);
  }

  @Post(':id/merge')
  @ZodSerializerDto(CounterpartyEnvelopeDto)
  async merge(
    @Param() params: IdParamDto,
    @Body() body: MergeCounterpartyDto,
  ): Promise<CounterpartyEnvelope> {
    const data = await this.counterparties.merge(params.id, body);
    return { data };
  }
}
