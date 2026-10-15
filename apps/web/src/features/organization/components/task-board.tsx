import { useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { Task, TaskStatus } from '@orbit/contracts';

import { cn } from '@/lib/cn';

import { NativeSelect } from './common';
import { TaskDue, useTaskStatusChange } from './task-row';

const COLUMNS: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const DRAG_TYPE = 'application/x-orbit-task';

function startDrag(event: DragEvent, id: string): void {
  const transfer = event.dataTransfer;
  transfer.setData(DRAG_TYPE, id);
  transfer.effectAllowed = 'move';
}

function BoardCard({
  task,
  onMove,
}: Readonly<{ task: Task; onMove: (to: TaskStatus) => void }>): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <li
      draggable
      onDragStart={(event) => {
        startDrag(event, task.id);
      }}
      className="flex cursor-grab flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-sm"
    >
      <Link to={`/tasks/${task.id}`} className="text-body text-foreground hover:underline">
        {task.title}
      </Link>
      <div className="text-caption text-muted-foreground">
        <TaskDue task={task} />
      </div>
      {/* Alternative clavier et lecteur d'écran au glisser-déposer (DESIGN_SYSTEM.md §4). */}
      <NativeSelect
        aria-label={t('tasks.moveTo', { title: task.title })}
        value={task.status}
        className="min-h-9 text-small"
        onChange={(event) => {
          onMove(event.target.value as TaskStatus);
        }}
        options={COLUMNS.map((status) => ({ value: status, label: t(`taskStatus.${status}`) }))}
      />
    </li>
  );
}

/** Kanban par statut (PHASE-04 §6) : glisser-déposer, ou liste « Déplacer vers » sur chaque carte. */
type ColumnProps = Readonly<{
  status: TaskStatus;
  items: readonly Task[];
  onMove: (task: Task, to: TaskStatus) => void;
  onDropTask: (id: string, to: TaskStatus) => void;
}>;

function BoardColumn({ status, items, onMove, onDropTask }: ColumnProps): JSX.Element {
  const { t } = useTranslation('organization');
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent): void => {
    event.preventDefault();
    setOver(false);
    onDropTask(event.dataTransfer.getData(DRAG_TYPE), status);
  };
  return (
    <section
      aria-label={t(`taskStatus.${status}`)}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={drop}
      className={cn(
        'flex min-h-40 flex-col gap-2 rounded-md bg-surface-muted p-2',
        over && 'ring-2 ring-primary',
      )}
    >
      <h2 className="px-1 text-small font-semibold">
        {t(`taskStatus.${status}`)} ({items.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            onMove={(to) => {
              onMove(task, to);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

export function TaskBoard({ tasks }: Readonly<{ tasks: readonly Task[] }>): JSX.Element {
  const change = useTaskStatusChange();
  const move = (task: Task | undefined, to: TaskStatus): void => {
    if (task !== undefined && task.status !== to) change.mutate({ task, to });
  };
  return (
    <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
      {COLUMNS.map((status) => (
        <BoardColumn
          key={status}
          status={status}
          items={tasks.filter((task) => task.status === status)}
          onMove={move}
          onDropTask={(id, to) => {
            move(
              tasks.find((task) => task.id === id),
              to,
            );
          }}
        />
      ))}
    </div>
  );
}
