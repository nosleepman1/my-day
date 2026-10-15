import { useState, type JSX } from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import {
  PRIORITY_LEVELS,
  RECURRENCE_FREQUENCIES,
  formatRecurrence,
  parseRecurrence,
  type Recurrence,
  type TaskDetail,
  type UpdateTaskRequest,
} from '@orbit/contracts';

import { ErrorState, LoadingState, NotFoundState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/http/client';

import { rowsOf, useOrganizationList, useOrganizationMutation, useTask } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { ConfirmButton, enumOptions, NativeSelect, PageHeader, useDates } from '../components/common';
import { LinkedNotes } from '../components/linked-notes';
import { TagPicker } from '../components/tag-picker';
import { Dependencies, Subtasks, TaskHistory } from '../components/task-relations';
import { useTaskStatusChange } from '../components/task-row';

const EDITABLE_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'CANCELLED'] as const;

interface TaskFormValues {
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string;
  startsOn: string;
  dueDate: string;
  estimatedMinutes: string;
}

function toPatch(values: TaskFormValues, terminal: boolean): UpdateTaskRequest {
  const nullable = (value: string): string | null => (value === '' ? null : value);
  return {
    title: values.title,
    description: values.description,
    ...(terminal ? {} : { status: values.status as UpdateTaskRequest['status'] }),
    priority: nullable(values.priority) as UpdateTaskRequest['priority'],
    projectId: nullable(values.projectId),
    startsOn: nullable(values.startsOn),
    dueDate: nullable(values.dueDate),
    estimatedMinutes: values.estimatedMinutes === '' ? null : Number(values.estimatedMinutes),
  };
}

function useProjectOptions(): { value: string; label: string }[] {
  const projects = useOrganizationList('projects', { limit: '100' });
  return rowsOf(projects.data?.pages).map((project) => ({ value: project.id, label: project.name }));
}

type TaskFieldsProps = Readonly<{ register: UseFormRegister<TaskFormValues>; terminal: boolean }>;

function TaskFields({ register, terminal }: TaskFieldsProps): JSX.Element {
  const { t } = useTranslation('organization');
  const projects = useProjectOptions();
  const statuses = terminal ? ['DONE', 'CANCELLED'] : EDITABLE_STATUSES;
  return (
    <>
      <FormField label={t('fields.title')}>
        <Input maxLength={300} required {...register('title')} />
      </FormField>
      <FormField label={t('fields.description')}>
        <Textarea rows={3} {...register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label={t('fields.status')}>
          <NativeSelect
            disabled={terminal}
            options={enumOptions(statuses, (value) => t(`taskStatus.${value as 'TODO'}`))}
            {...register('status')}
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
        <FormField label={t('fields.project')}>
          <NativeSelect
            options={[{ value: '', label: t('fields.noProject') }, ...projects]}
            {...register('projectId')}
          />
        </FormField>
        <FormField label={t('fields.startsOn')}>
          <Input type="date" {...register('startsOn')} />
        </FormField>
        <FormField label={t('fields.dueDate')}>
          <Input type="date" {...register('dueDate')} />
        </FormField>
        <FormField label={t('fields.estimatedMinutes')}>
          <Input type="number" min={0} inputMode="numeric" {...register('estimatedMinutes')} />
        </FormField>
      </div>
    </>
  );
}

function TaskForm({ task }: Readonly<{ task: TaskDetail }>): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const save = useOrganizationMutation(
    (patch: UpdateTaskRequest) => organizationApi.updateTask(task.id, patch, task.version),
    { successMessage: t('feedback.saved') },
  );
  const terminal = task.status === 'DONE' || task.status === 'CANCELLED';
  const form = useForm<TaskFormValues>({
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority ?? '',
      projectId: task.projectId ?? '',
      startsOn: task.startsOn ?? '',
      dueDate: task.dueDate ?? '',
      estimatedMinutes: task.estimatedMinutes === null ? '' : String(task.estimatedMinutes),
    },
  });
  const onSubmit = form.handleSubmit((values) => {
    save.mutate(toPatch(values, terminal));
  });
  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <TaskFields register={form.register} terminal={terminal} />
        <FormError error={save.isError ? save.error : null} />
        <Button type="submit" className="self-end" disabled={save.isPending}>
          {t('common:actions.save')}
        </Button>
      </form>
    </Card>
  );
}

/** Récurrence simple : fréquence et intervalle ; réglée sur la tâche d'origine de la série. */
/**
 * Règle à enregistrer : les autres parties (BYDAY, BYMONTHDAY, COUNT, UNTIL) sont conservées tant que la
 * fréquence ne change pas ; elles n'ont plus de sens pour une autre fréquence.
 */
function ruleOf(freq: string, every: string, current: Recurrence | null): string | null {
  if (freq === 'NONE') return null;
  const interval = Math.min(99, Math.max(1, Number.parseInt(every, 10) || 1));
  const frequency = freq as Recurrence['freq'];
  const kept = current?.freq === frequency ? current : { freq: frequency, interval };
  return formatRecurrence({ ...kept, interval });
}

/** Une occurrence générée renvoie à sa date ; une sous-tâche n'est jamais récurrente. */
function TaskRecurrence({ task }: Readonly<{ task: TaskDetail }>): JSX.Element | null {
  const { t } = useTranslation('organization');
  const dates = useDates();
  if (task.recurrenceSeriesId !== null) {
    return (
      <p className="text-small text-muted-foreground">
        {t('tasks.occurrence', { date: dates.civil(task.occurrenceDate) })}
      </p>
    );
  }
  return task.parentTaskId === null ? <RecurrenceEditor task={task} /> : null;
}

/** Enregistre la règle en conservant l'ancre de la série existante. */
function useRecurrenceSave(task: TaskDetail) {
  const { t } = useTranslation('organization');
  const anchorOn = task.recurrence?.anchorOn;
  return useOrganizationMutation(
    (rule: string | null) =>
      organizationApi.updateTask(task.id, {
        recurrence: rule === null ? null : { rule, ...(anchorOn === undefined ? {} : { anchorOn }) },
      }),
    { successMessage: t('feedback.saved') },
  );
}

function RecurrenceEditor({ task }: Readonly<{ task: TaskDetail }>): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const current = task.recurrence === null ? null : parseRecurrence(task.recurrence.rule);
  const [freq, setFreq] = useState<string>(current?.freq ?? 'NONE');
  const [every, setEvery] = useState(String(current?.interval ?? 1));
  const save = useRecurrenceSave(task);
  const rule = ruleOf(freq, every, current);
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('tasks.recurrence')}</CardTitle>
      <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
        <FormField label={t('tasks.recurrence')}>
          <NativeSelect
            value={freq}
            onChange={(event) => {
              setFreq(event.target.value);
            }}
            options={enumOptions(['NONE', ...RECURRENCE_FREQUENCIES], (value) =>
              t(`tasks.frequency.${value as 'NONE'}`),
            )}
          />
        </FormField>
        <FormField label={t('tasks.interval')}>
          <Input
            type="number"
            min={1}
            max={99}
            value={every}
            disabled={freq === 'NONE'}
            onChange={(event) => {
              setEvery(event.target.value);
            }}
          />
        </FormField>
        <Button
          disabled={save.isPending}
          onClick={() => {
            save.mutate(rule);
          }}
        >
          {t('common:actions.save')}
        </Button>
      </div>
      <FormError error={save.isError ? save.error : null} />
    </Card>
  );
}

function TaskActions({ task }: Readonly<{ task: TaskDetail }>): JSX.Element {
  const { t } = useTranslation('organization');
  const navigate = useNavigate();
  const change = useTaskStatusChange();
  const remove = useOrganizationMutation(() => organizationApi.remove('tasks', task.id));
  const terminal = task.status === 'DONE' || task.status === 'CANCELLED';
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={change.isPending}
        onClick={() => {
          change.mutate({ task, to: terminal ? 'TODO' : 'DONE' });
        }}
      >
        {terminal ? t('tasks.reopenAction') : t('tasks.completeAction')}
      </Button>
      <ConfirmButton
        label={t('actions.delete')}
        message={t('feedback.deleteConfirm')}
        onConfirm={() => {
          remove.mutate(undefined, { onSuccess: () => void navigate('/tasks') });
        }}
      />
    </div>
  );
}

/** `/tasks/:id` : édition, sous-tâches, dépendances, récurrence, historique et notes liées. */
export function TaskDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const task = useTask(id);
  if (task.isPending) return <LoadingState />;
  if (task.isError) {
    if (task.error instanceof ApiError && task.error.code === 'NOT_FOUND') return <NotFoundState />;
    return <ErrorState error={task.error} onRetry={() => void task.refetch()} />;
  }
  const data = task.data.data;
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={data.title}>
        <TaskActions task={data} />
      </PageHeader>
      <TaskForm key={data.version} task={data} />
      <TagPicker resource="tasks" id={data.id} tagIds={data.tagIds} />
      <TaskRecurrence key={`r-${data.version}`} task={data} />
      <div className="grid gap-4 md:grid-cols-2">
        <Subtasks task={data} />
        <Dependencies task={data} />
        <TaskHistory id={data.id} />
        <LinkedNotes target="taskId" id={data.id} />
      </div>
    </section>
  );
}
