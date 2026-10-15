import { X } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { TaskDetail, TaskHistoryEntry, TaskRef } from '@orbit/contracts';

import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { uuidv7 } from '@/lib/ids';

import { rowsOf, useOrganizationList, useOrganizationMutation, useTaskHistory } from '../api/hooks';
import { organizationApi } from '../api/organization.api';

import { PickAndAdd, QuickAdd, useDates } from './common';

function RefList({
  items,
  onRemove,
  removeLabel,
}: Readonly<{
  items: readonly TaskRef[];
  onRemove?: (id: string) => void;
  removeLabel?: string;
}>): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2">
          <Link to={`/tasks/${item.id}`} className="flex-1 text-primary hover:underline">
            {item.title}
          </Link>
          <span className="text-caption text-muted-foreground">{t(`taskStatus.${item.status}`)}</span>
          {onRemove !== undefined && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${removeLabel ?? ''} ${item.title}`}
              onClick={() => {
                onRemove(item.id);
              }}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Subtasks({ task }: Readonly<{ task: TaskDetail }>): JSX.Element {
  const { t } = useTranslation('organization');
  const add = useOrganizationMutation((title: string) =>
    organizationApi.createTask({ id: uuidv7(), title, parentTaskId: task.id }),
  );
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('tasks.subtasks')}</CardTitle>
      <RefList items={task.subtasks} />
      {task.parentTaskId === null && (
        <QuickAdd
          label={t('tasks.subtaskPlaceholder')}
          placeholder={t('tasks.subtaskPlaceholder')}
          pending={add.isPending}
          onAdd={(title) => add.mutateAsync(title)}
        />
      )}
    </Card>
  );
}

/** Dépendances : ajout refusé par l'API si un cycle apparaît (`CIRCULAR_DEPENDENCY`). */
export function Dependencies({ task }: Readonly<{ task: TaskDetail }>): JSX.Element {
  const { t } = useTranslation('organization');
  const candidates = useOrganizationList('tasks', { status: 'TODO,IN_PROGRESS,BLOCKED', limit: '100' });
  const add = useOrganizationMutation((dependsOnTaskId: string) =>
    organizationApi.addDependency(task.id, dependsOnTaskId),
  );
  const remove = useOrganizationMutation((dependsOnTaskId: string) =>
    organizationApi.removeDependency(task.id, dependsOnTaskId),
  );
  const taken = new Set([task.id, ...task.dependsOn.map((item) => item.id)]);
  const options = rowsOf(candidates.data?.pages)
    .filter((candidate) => !taken.has(candidate.id))
    .map((candidate) => ({ value: candidate.id, label: candidate.title }));
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('tasks.dependsOn')}</CardTitle>
      {task.dependsOn.length === 0 ? (
        <p className="text-small text-muted-foreground">{t('tasks.noDependency')}</p>
      ) : (
        <RefList
          items={task.dependsOn}
          onRemove={(id) => {
            remove.mutate(id);
          }}
          removeLabel={t('actions.remove')}
        />
      )}
      <PickAndAdd
        label={t('tasks.chooseTask')}
        actionLabel={t('actions.add')}
        options={options}
        pending={add.isPending}
        onPick={(id) => add.mutateAsync(id)}
      />
      <FormError error={add.isError ? add.error : null} />
      {task.blocks.length > 0 && (
        <>
          <h3 className="text-small font-semibold">{t('tasks.blocks')}</h3>
          <RefList items={task.blocks} />
        </>
      )}
    </Card>
  );
}

function historyLine(
  entry: TaskHistoryEntry,
  label: (value: string | null) => string,
  t: ReturnType<typeof useTranslation<'organization'>>['t'],
): string {
  if (entry.kind === 'CREATED') return t('tasks.historyKinds.CREATED');
  return t(`tasks.historyKinds.${entry.kind}`, { from: label(entry.from), to: label(entry.to) });
}

export function TaskHistory({ id }: Readonly<{ id: string }>): JSX.Element {
  const { t } = useTranslation('organization');
  const dates = useDates();
  const history = useTaskHistory(id);
  const label = (value: string | null): string => {
    if (value === null) return t('tasks.none');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dates.civil(value);
    return t(`taskStatus.${value as 'TODO'}`, { defaultValue: value });
  };
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{t('tasks.history')}</CardTitle>
      <ol className="flex flex-col gap-1 text-small">
        {(history.data?.data ?? []).map((entry) => (
          <li key={`${entry.id}-${entry.kind}`} className="flex justify-between gap-3">
            <span>{historyLine(entry, label, t)}</span>
            <span className="text-muted-foreground">{dates.instant(entry.occurredAt)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
