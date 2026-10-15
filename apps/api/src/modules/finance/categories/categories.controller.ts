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

import type { CategoryEnvelope, CategoryListEnvelope } from '@orbit/contracts';

import {
  CategoryEnvelopeDto,
  CategoryListEnvelopeDto,
  CreateCategoryDto,
  IdParamDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from '../finance.dto';

import { CategoriesService } from './categories.service';

/** Catégories de transactions (API.md §14.6, FINANCE_RULES.md §4). */
@Controller('finance/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  @ZodSerializerDto(CategoryEnvelopeDto)
  async create(@Body() body: CreateCategoryDto): Promise<CategoryEnvelope> {
    const data = await this.categories.create(body);
    return { data };
  }

  @Get()
  @ZodSerializerDto(CategoryListEnvelopeDto)
  async list(@Query() query: ListCategoriesQueryDto): Promise<CategoryListEnvelope> {
    const data = await this.categories.list(query);
    return { data };
  }

  @Get(':id')
  @ZodSerializerDto(CategoryEnvelopeDto)
  async getById(@Param() params: IdParamDto): Promise<CategoryEnvelope> {
    const data = await this.categories.getById(params.id);
    return { data };
  }

  @Patch(':id')
  @ZodSerializerDto(CategoryEnvelopeDto)
  async update(@Param() params: IdParamDto, @Body() body: UpdateCategoryDto): Promise<CategoryEnvelope> {
    const data = await this.categories.update(params.id, body);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto): Promise<void> {
    await this.categories.delete(params.id);
  }
}
