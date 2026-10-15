import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';

import type { TagListResponse, TagResponse } from '@orbit/contracts';

import {
  CreateTagRequestDto,
  IdParamDto,
  MergeTagRequestDto,
  TagListResponseDto,
  TagResponseDto,
  UpdateTagRequestDto,
} from '../organization.dto';

import { TagsService } from './tags.service';

/** Tags de l'utilisateur (API.md §14.5). */
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ZodSerializerDto(TagListResponseDto)
  async list(): Promise<TagListResponse> {
    return { data: await this.tags.list() };
  }

  @Post()
  @ZodSerializerDto(TagResponseDto)
  async create(@Body() body: CreateTagRequestDto): Promise<TagResponse> {
    return { data: await this.tags.create(body) };
  }

  @Patch(':id')
  @ZodSerializerDto(TagResponseDto)
  async update(@Param() params: IdParamDto, @Body() body: UpdateTagRequestDto): Promise<TagResponse> {
    return { data: await this.tags.update(params.id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto): Promise<void> {
    await this.tags.remove(params.id);
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TagResponseDto)
  async merge(@Param() params: IdParamDto, @Body() body: MergeTagRequestDto): Promise<TagResponse> {
    return { data: await this.tags.merge(params.id, body.targetTagId) };
  }
}
