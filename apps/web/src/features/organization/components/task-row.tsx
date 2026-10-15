import { Repeat } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';

import type { Task, TaskStatus } from '@orbit/contracts';

import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

import { useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';

import { useDates } from './common';

/**
 * Changements d'état d'une tâche : `DONE` passe par `/complete` (occurrence suivante d'une série), la
 * sortie d'un état terminal par `/reopen`, le reste par un PATCH du statut.
 */
export function useTaskStatusChange() {
  const { t } = useTranslation('organization');
  const dates = useDates();
  return useOrganizationMutation(async ({ task, to }: Readonly<{ task: Task; to: TaskStatus }>) => {
    if (to === 'DONE') {
      const response = await organizationApi.completeTask(task.id);
      const next = response.data.nextOccurrence;
      if (next !== null) toast.success(t('tasks.nextCreated', { date: dates.civil(next.dueDate) }));
      return;
    }
    const terminal = task.status === 'DONE' || task.status === 'CANCELLED';
    if (terminal) await organizationApi.reopenTask(task.id);
    // La réouverture laisse la tâche « À faire » : un PATCH n'est utile que pour un autre statut.
    if (!terminal || to !== 'TODO') await organizationApi.updateTask(task.id, { status: to });
  });
}

export function TaskDue({ task }: Readonly<{ task: Task }>): JSX.Element | null {
  const { t } = useTranslation('organization');
  const dates = useDates();
  if (task.dueDate === null) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{t('tasks.due', { date: dates.civil(task.dueDate) })}</span>
      {task.overdue && <Badge tone="danger">{t('tasks.overdue')}</Badge>}
    </span>
  );
}

/** Ligne de tâche : case à cocher pour terminer ou rouvrir, titre, échéance et retard dérivé. */
export function TaskRow({ task }: Readonly<{ task: Task }>): JSX.Element {
  const { t } = useTranslation('organization');
  const change = useTaskStatusChange();
  const done = task.status === 'DONE';
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <Checkbox
        checked={done}
        disabled={change.isPending || task.status === 'CANCELLED'}
        aria-label={
          done ? t('tasks.reopen', { title: task.title }) : t('tasks.complete', { title: task.title })
        }
        onCheckedChange={() => {
          change.mutate({ task, to: done ? 'TODO' : 'DONE' });
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'truncate text-body text-foreground hover:underline',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          {task.status !== 'TODO' && !done && <Badge>{t(`taskStatus.${task.status}`)}</Badge>}
          <TaskDue task={task} />
          {(task.recurrence !== null || task.recurrenceSeriesId !== null) && (
            <Repeat aria-label={t('tasks.recurrence')} className="size-3.5" />
          )}
        </div>
      </div>
    </li>
  );
}
