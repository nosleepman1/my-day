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

import type { ProjectListResponse, ProjectResponse, ProjectSummaryResponse } from '@orbit/contracts';

import {
  CreateProjectRequestDto,
  IdParamDto,
  ProjectListQueryDto,
  ProjectListResponseDto,
  ProjectResponseDto,
  ProjectSummaryResponseDto,
  SetTagsRequestDto,
  UpdateProjectRequestDto,
} from '../organization.dto';
import { respondCreation } from '../shared/http';
import { parseIfMatch, setEtag } from '../shared/versioning';

import { ProjectsService } from './projects.service';

/** Projets (API.md §14.5). */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ZodSerializerDto(ProjectListResponseDto)
  list(@Query() query: ProjectListQueryDto): Promise<ProjectListResponse> {
    return this.projects.list(query);
  }

  @Post()
  @ZodSerializerDto(ProjectResponseDto)
  async create(
    @Body() body: CreateProjectRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectResponse> {
    const { row, created } = await this.projects.create(body);
    respondCreation(response, created, `/projects/${row.id}`);
    setEtag(response, row.version);
    return { data: row };
  }

  @Get(':id')
  @ZodSerializerDto(ProjectResponseDto)
  async get(
    @Param() params: IdParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectResponse> {
    const project = await this.projects.get(params.id);
    setEtag(response, project.version);
    return { data: project };
  }

  @Patch(':id')
  @ZodSerializerDto(ProjectResponseDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateProjectRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectResponse> {
    const project = await this.projects.update(params.id, body, parseIfMatch(ifMatch));
    setEtag(response, project.version);
    return { data: project };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto): Promise<void> {
    await this.projects.remove(params.id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ProjectResponseDto)
  async archive(@Param() params: IdParamDto): Promise<ProjectResponse> {
    return { data: await this.projects.setArchived(params.id, true) };
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ProjectResponseDto)
  async restore(@Param() params: IdParamDto): Promise<ProjectResponse> {
    return { data: await this.projects.setArchived(params.id, false) };
  }

  @Put(':id/tags')
  @ZodSerializerDto(ProjectResponseDto)
  async setTags(@Param() params: IdParamDto, @Body() body: SetTagsRequestDto): Promise<ProjectResponse> {
    return { data: await this.projects.setTags(params.id, body.tagIds) };
  }

  @Get(':id/summary')
  @ZodSerializerDto(ProjectSummaryResponseDto)
  async summary(@Param() params: IdParamDto): Promise<ProjectSummaryResponse> {
    return { data: await this.projects.summary(params.id) };
  }
}
