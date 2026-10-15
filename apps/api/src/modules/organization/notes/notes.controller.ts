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

import type { NoteLinkResponse, NoteListResponse, NoteResponse } from '@orbit/contracts';

import {
  CreateNoteLinkRequestDto,
  CreateNoteRequestDto,
  IdParamDto,
  NoteLinkParamDto,
  NoteLinkResponseDto,
  NoteListQueryDto,
  NoteListResponseDto,
  NoteResponseDto,
  SetTagsRequestDto,
  UpdateNoteRequestDto,
} from '../organization.dto';
import { respondCreation } from '../shared/http';
import { requireIfMatch, setEtag } from '../shared/versioning';

import { NoteLinksService } from './note-links.service';
import { NotesService } from './notes.service';

/** Notes et liens de notes (API.md §14.5, ADR-018) ; `If-Match` obligatoire sur PATCH et DELETE. */
@Controller('notes')
export class NotesController {
  constructor(
    private readonly notes: NotesService,
    private readonly links: NoteLinksService,
  ) {}

  @Get()
  @ZodSerializerDto(NoteListResponseDto)
  list(@Query() query: NoteListQueryDto): Promise<NoteListResponse> {
    return this.notes.list(query);
  }

  @Post()
  @ZodSerializerDto(NoteResponseDto)
  async create(
    @Body() body: CreateNoteRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NoteResponse> {
    const { row, created } = await this.notes.create(body);
    respondCreation(response, created, `/notes/${row.id}`);
    setEtag(response, row.version);
    return { data: row };
  }

  @Get(':id')
  @ZodSerializerDto(NoteResponseDto)
  async get(
    @Param() params: IdParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NoteResponse> {
    const note = await this.notes.get(params.id);
    setEtag(response, note.version);
    return { data: note };
  }

  @Patch(':id')
  @ZodSerializerDto(NoteResponseDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateNoteRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NoteResponse> {
    const note = await this.notes.update(params.id, body, requireIfMatch(ifMatch));
    setEtag(response, note.version);
    return { data: note };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto, @Headers('if-match') ifMatch: string | undefined): Promise<void> {
    await this.notes.remove(params.id, requireIfMatch(ifMatch));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(NoteResponseDto)
  async archive(@Param() params: IdParamDto): Promise<NoteResponse> {
    return { data: await this.notes.setArchived(params.id, true) };
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(NoteResponseDto)
  async restore(@Param() params: IdParamDto): Promise<NoteResponse> {
    return { data: await this.notes.setArchived(params.id, false) };
  }

  @Put(':id/tags')
  @ZodSerializerDto(NoteResponseDto)
  async setTags(@Param() params: IdParamDto, @Body() body: SetTagsRequestDto): Promise<NoteResponse> {
    return { data: await this.notes.setTags(params.id, body.tagIds) };
  }

  @Post(':id/links')
  @ZodSerializerDto(NoteLinkResponseDto)
  async link(@Param() params: IdParamDto, @Body() body: CreateNoteLinkRequestDto): Promise<NoteLinkResponse> {
    return { data: await this.links.create(params.id, body) };
  }

  @Delete(':id/links/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(@Param() params: NoteLinkParamDto): Promise<void> {
    await this.links.remove(params.id, params.linkId);
  }
}
