import type { JSX } from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import {
  PRIORITY_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type UpdateProjectRequest,
} from '@orbit/contracts';

import { ArchivedBanner } from '@/components/data-display/banners';
import { ErrorState, LoadingState, NotFoundState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/http/client';
import { uuidv7 } from '@/lib/ids';

import {
  rowsOf,
  useOrganizationList,
  useOrganizationMutation,
  useProject,
  useProjectSummary,
} from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import {
  LifecycleActions,
  enumOptions,
  LoadMore,
  NativeSelect,
  PageHeader,
  QuickAdd,
} from '../components/common';
import { LinkedNotes } from '../components/linked-notes';
import { TagPicker } from '../components/tag-picker';
import { TaskRow } from '../components/task-row';

interface ProjectFormValues {
  name: string;
  description: string;
  status: string;
  type: string;
  priority: string;
  startsOn: string;
  targetOn: string;
}

function toPatch(values: ProjectFormValues): UpdateProjectRequest {
  const nullable = (value: string): string | null => (value === '' ? null : value);
  return {
    name: values.name,
    description: values.description,
    status: values.status as Project['status'],
    type: values.type as Project['type'],
    priority: nullable(values.priority) as UpdateProjectRequest['priority'],
    startsOn: nullable(values.startsOn),
    targetOn: nullable(values.targetOn),
  };
}

function ProjectFields({
  register,
}: Readonly<{ register: UseFormRegister<ProjectFormValues> }>): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <>
      <FormField label={t('fields.name')}>
        <Input maxLength={120} required {...register('name')} />
      </FormField>
      <FormField label={t('fields.description')}>
        <Textarea rows={3} {...register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label={t('fields.status')}>
          <NativeSelect
            options={enumOptions(PROJECT_STATUSES, (value) =>
              t(`projectStatus.${value as Project['status']}`),
            )}
            {...register('status')}
          />
        </FormField>
        <FormField label={t('fields.type')}>
          <NativeSelect
            options={enumOptions(PROJECT_TYPES, (value) => t(`projectType.${value as Project['type']}`))}
            {...register('type')}
          />
        </FormField>
        <FormField label={t('fields.priority')}>
          <NativeSelect
            options={enumOptions(
              PRIORITY_LEVELS,
              (value) => t(`priority.${value as 'LOW'}`),
              t('priority.none'),
            )}
            {...register('priority')}
          />
        </FormField>
        <FormField label={t('fields.startsOn')}>
          <Input type="date" {...register('startsOn')} />
        </FormField>
        <FormField label={t('fields.targetOn')}>
          <Input type="date" {...register('targetOn')} />
        </FormField>
      </div>
    </>
  );
}

function ProjectForm({ project }: Readonly<{ project: Project }>): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const save = useOrganizationMutation(
    (patch: UpdateProjectRequest) => organizationApi.updateProject(project.id, patch, project.version),
    { successMessage: t('feedback.saved') },
  );
  const form = useForm<ProjectFormValues>({
    defaultValues: {
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      type: project.type,
      priority: project.priority ?? '',
      startsOn: project.startsOn ?? '',
      targetOn: project.targetOn ?? '',
    },
  });
  const readOnly = project.archivedAt !== null;
  const onSubmit = form.handleSubmit((values) => {
    save.mutate(toPatch(values));
  });
  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          <ProjectFields register={form.register} />
        </fieldset>
        <FormError error={save.isError ? save.error : null} />
        {!readOnly && (
          <Button type="submit" className="self-end" disabled={save.isPending}>
            {t('common:actions.save')}
          </Button>
        )}
      </form>
    </Card>
  );
}

function ProjectSummaryCard({ id }: Readonly<{ id: string }>): JSX.Element {
  const { t } = useTranslation('organization');
  const summary = useProjectSummary(id).data?.data;
  if (summary === undefined) return <Card />;
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>
        {summary.progressPercent === null
          ? t('projects.noProgress')
          : t('projects.progress', { percent: summary.progressPercent })}
      </CardTitle>
      {summary.progressPercent !== null && (
        <progress
          value={summary.progressPercent}
          max={100}
          className="h-2 w-full accent-primary"
          aria-hidden="true"
        />
      )}
      <p className="text-small text-muted-foreground">
        {t('projects.taskCount', {
          done: summary.tasks.done,
          total: summary.tasks.total,
          overdue: summary.tasks.overdue,
        })}
      </p>
      {summary.sourceIdea !== null && (
        <Link to={`/ideas/${summary.sourceIdea.id}`} className="text-small text-primary hover:underline">
          {t('projects.sourceIdea', { title: summary.sourceIdea.title })}
        </Link>
      )}
    </Card>
  );
}

function ProjectTasks({ project }: Readonly<{ project: Project }>): JSX.Element {
  const { t } = useTranslation('organization');
  const tasks = useOrganizationList('tasks', { projectId: project.id, parentTaskId: 'none' });
  const add = useOrganizationMutation((title: string) =>
    organizationApi.createTask({ id: uuidv7(), title, projectId: project.id }),
  );
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('projects.tasksTitle')}</CardTitle>
      {project.archivedAt === null && (
        <QuickAdd
          label={t('tasks.placeholder')}
          placeholder={t('tasks.placeholder')}
          pending={add.isPending}
          onAdd={(title) => add.mutateAsync(title)}
        />
      )}
      <ul className="flex flex-col gap-2">
        {rowsOf(tasks.data?.pages).map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
      <LoadMore pager={tasks} />
    </Card>
  );
}

function ProjectActions({ project }: Readonly<{ project: Project }>): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <LifecycleActions resource="projects" id={project.id} archived={project.archivedAt !== null} />
    </div>
  );
}

/** `/projects/:id` : progression dérivée, tâches, notes liées et idée d'origine (PHASE-04 §6). */
export function ProjectDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const project = useProject(id);
  if (project.isPending) return <LoadingState />;
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.code === 'NOT_FOUND') return <NotFoundState />;
    return <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  }
  const data = project.data.data;
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={data.name}>
        <ProjectActions project={data} />
      </PageHeader>
      {data.archivedAt !== null && <ArchivedBanner />}
      <ProjectSummaryCard id={data.id} />
      <ProjectForm key={data.version} project={data} />
      <TagPicker resource="projects" id={data.id} tagIds={data.tagIds} disabled={data.archivedAt !== null} />
      <ProjectTasks project={data} />
      <LinkedNotes target="projectId" id={data.id} />
    </section>
  );
}
