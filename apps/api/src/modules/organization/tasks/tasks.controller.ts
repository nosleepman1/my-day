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
  CompleteTaskResponse,
  TaskDetailResponse,
  TaskHistoryResponse,
  TaskListResponse,
  TaskResponse,
} from '@orbit/contracts';

import {
  AddTaskDependencyRequestDto,
  CompleteTaskResponseDto,
  CreateTaskRequestDto,
  IdParamDto,
  SetTagsRequestDto,
  TaskDependencyParamDto,
  TaskDetailResponseDto,
  TaskHistoryResponseDto,
  TaskListQueryDto,
  TaskListResponseDto,
  TaskResponseDto,
  UpdateTaskRequestDto,
} from '../organization.dto';
import { respondCreation } from '../shared/http';
import { parseIfMatch, setEtag } from '../shared/versioning';

import { TaskCompletionService } from './task-completion.service';
import { TaskRelationsService } from './task-relations.service';
import { TasksService } from './tasks.service';

/** Tâches (API.md §14.5). */
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly completion: TaskCompletionService,
    private readonly relations: TaskRelationsService,
  ) {}

  @Get()
  @ZodSerializerDto(TaskListResponseDto)
  list(@Query() query: TaskListQueryDto): Promise<TaskListResponse> {
    return this.tasks.list(query);
  }

  @Post()
  @ZodSerializerDto(TaskResponseDto)
  async create(
    @Body() body: CreateTaskRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TaskResponse> {
    const { row, created } = await this.tasks.create(body);
    respondCreation(response, created, `/tasks/${row.id}`);
    setEtag(response, row.version);
    return { data: row };
  }

  @Get(':id')
  @ZodSerializerDto(TaskDetailResponseDto)
  async get(
    @Param() params: IdParamDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TaskDetailResponse> {
    const task = await this.relations.detail(params.id);
    setEtag(response, task.version);
    return { data: task };
  }

  @Patch(':id')
  @ZodSerializerDto(TaskResponseDto)
  async update(
    @Param() params: IdParamDto,
    @Body() body: UpdateTaskRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TaskResponse> {
    const task = await this.tasks.update(params.id, body, parseIfMatch(ifMatch));
    setEtag(response, task.version);
    return { data: task };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: IdParamDto): Promise<void> {
    await this.tasks.remove(params.id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(CompleteTaskResponseDto)
  async complete(@Param() params: IdParamDto): Promise<CompleteTaskResponse> {
    return { data: await this.completion.complete(params.id) };
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TaskResponseDto)
  async reopen(@Param() params: IdParamDto): Promise<TaskResponse> {
    return { data: await this.tasks.reopen(params.id) };
  }

  @Post(':id/recurrence/stop')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TaskResponseDto)
  async stopRecurrence(@Param() params: IdParamDto): Promise<TaskResponse> {
    return { data: await this.tasks.stopRecurrence(params.id) };
  }

  @Put(':id/tags')
  @ZodSerializerDto(TaskResponseDto)
  async setTags(@Param() params: IdParamDto, @Body() body: SetTagsRequestDto): Promise<TaskResponse> {
    return { data: await this.tasks.setTags(params.id, body.tagIds) };
  }

  @Get(':id/history')
  @ZodSerializerDto(TaskHistoryResponseDto)
  async history(@Param() params: IdParamDto): Promise<TaskHistoryResponse> {
    return { data: await this.relations.history(params.id) };
  }

  @Post(':id/dependencies')
  @ZodSerializerDto(TaskDetailResponseDto)
  async addDependency(
    @Param() params: IdParamDto,
    @Body() body: AddTaskDependencyRequestDto,
  ): Promise<TaskDetailResponse> {
    return { data: await this.relations.addDependency(params.id, body.dependsOnTaskId) };
  }

  @Delete(':id/dependencies/:dependsOnTaskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDependency(@Param() params: TaskDependencyParamDto): Promise<void> {
    await this.relations.removeDependency(params.id, params.dependsOnTaskId);
  }
}
