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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import type {
  ConvertIdeaResponse,
  IdeaListResponse,
  IdeaResponse,
  SimilarIdeasResponse,
} from '@orbit/contracts';

import {
  ConvertIdeaResponseDto,
  CreateIdeaRequestDto,
  IdeaListQueryDto,
  IdeaListResponseDto,
  IdeaResponseDto,
  IdParamDto,
  SetTagsRequestDto,
  SimilarIdeasResponseDto,
  UpdateIdeaRequestDto,
} from '../organization.dto';
import { respondCreation } from '../shared/http';
import { parseIfMatch, setEtag } from '../shared/versioning';

import { IdeaConversionService } from './idea-conversion.service';
import { IdeasService } from './ideas.service';

/** Idées (API.md §14.5). */
@Controller('ideas')
export class IdeasController {
  constructor(
    private readonly ideas: IdeasService,
    private readonly conversion: IdeaConversionService,
  ) {}

  @Get()
  @ZodSerializerDto(IdeaListResponseDto)
  list(@Query() query: IdeaListQueryDto): Promise<IdeaListResponse> {
    return this.ideas.list(query);
  }

  @Post()
  @ZodSerializerDto(IdeaResponseDto)
  async create(
    @Body() body: CreateIdeaRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdeaResponse> {
    const { row, created } = await this.ideas.create(body);
    respondCreation(response, created, `/ideas/${row.id}`);
    setEtag(response, row.version);
    return { data: row };
  }

  @Get(':id')
  @ZodSerializerDto(IdeaResponseDto)
  async get(
    @Param() params: IdParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdeaResponse> {
    const idea = await this.ideas.get(params.id);
    setEtag(response, idea.version);
    return { data: idea };
  }

  @Patch(':id')
  @ZodSerializerDto(IdeaResponseDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateIdeaRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdeaResponse> {
    const idea = await this.ideas.update(params.id, body, parseIfMatch(ifMatch));
    setEtag(response, idea.version);
    return { data: idea };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto): Promise<void> {
    await this.ideas.remove(params.id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(IdeaResponseDto)
  async archive(@Param() params: IdParamDto): Promise<IdeaResponse> {
    return { data: await this.ideas.setArchived(params.id, true) };
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(IdeaResponseDto)
  async restore(@Param() params: IdParamDto): Promise<IdeaResponse> {
    return { data: await this.ideas.setArchived(params.id, false) };
  }

  @Put(':id/tags')
  @ZodSerializerDto(IdeaResponseDto)
  async setTags(@Param() params: IdParamDto, @Body() body: SetTagsRequestDto): Promise<IdeaResponse> {
    return { data: await this.ideas.setTags(params.id, body.tagIds) };
  }

  @Post(':id/convert-to-project')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ConvertIdeaResponseDto)
  async convert(@Param() params: IdParamDto): Promise<ConvertIdeaResponse> {
    return { data: await this.conversion.convert(params.id) };
  }

  @Get(':id/similar')
  @ZodSerializerDto(SimilarIdeasResponseDto)
  similar(@Param() params: IdParamDto): Promise<SimilarIdeasResponse> {
    return this.ideas.similar(params.id);
  }
}
