import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { TASK_VIEWS, type TaskView } from '@orbit/contracts';

import { todayInZone } from '@/lib/dates';
import { usePreferences } from '@/lib/http/session.api';
import { uuidv7 } from '@/lib/ids';

import { useOrganizationList, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { ListResults, PageHeader, QuickAdd } from '../components/common';
import { TaskBoard } from '../components/task-board';
import { TaskRow } from '../components/task-row';

type Tab = TaskView | 'ALL';
const TABS: readonly Tab[] = [...TASK_VIEWS, 'ALL'];
const DISPLAYS = ['list', 'kanban'] as const;
type Display = (typeof DISPLAYS)[number];

const TAB_CLASS =
  'inline-flex min-h-11 items-center rounded-sm px-3 text-small whitespace-nowrap text-muted-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm';

/** Vue et affichage dans l'URL (`?view=OVERDUE&display=kanban`) : partageables et conservés au retour. */
function useTaskTabs(): Readonly<{ tab: Tab; display: Display; set: (key: string, value: string) => void }> {
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const tab = TABS.find((candidate) => candidate === view) ?? 'TODAY';
  const display = params.get('display') === 'kanban' ? 'kanban' : 'list';
  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  return { tab, display, set };
}

/** Échéance proposée à l'ajout rapide : aujourd'hui dans les vues datées, aucune sinon. */
function defaultDueDate(tab: Tab, timeZone: string): string | undefined {
  return tab === 'TODAY' || tab === 'THIS_WEEK' ? todayInZone(timeZone) : undefined;
}

type ToggleGroupProps<T extends string> = Readonly<{
  label: string;
  values: readonly T[];
  current: T;
  text: (value: T) => string;
  onSelect: (value: T) => void;
}>;

function ToggleGroup<T extends string>({
  label,
  values,
  current,
  text,
  onSelect,
}: ToggleGroupProps<T>): JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-md bg-surface-muted p-1"
    >
      {values.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          className={TAB_CLASS}
          onClick={() => {
            onSelect(value);
          }}
        >
          {text(value)}
        </button>
      ))}
    </div>
  );
}

/** Ajout rapide : la tâche reçoit l'échéance du jour dans les vues datées. */
function QuickTask({ tab }: Readonly<{ tab: Tab }>): JSX.Element {
  const { t } = useTranslation('organization');
  const timeZone = usePreferences().data?.data.timezone ?? 'Africa/Dakar';
  const create = useOrganizationMutation((title: string) => {
    const dueDate = defaultDueDate(tab, timeZone);
    return organizationApi.createTask({ id: uuidv7(), title, ...(dueDate === undefined ? {} : { dueDate }) });
  });
  return (
    <QuickAdd
      label={t('tasks.placeholder')}
      placeholder={t('tasks.placeholder')}
      pending={create.isPending}
      onAdd={(title) => create.mutateAsync(title)}
    />
  );
}

/** `/tasks` : vues Aujourd'hui, En retard, Semaine, Sans échéance, Toutes ; liste ou Kanban (PHASE-04 §6). */
export function TasksPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const { tab, display, set } = useTaskTabs();
  const tasks = useOrganizationList('tasks', {
    view: tab === 'ALL' ? undefined : tab,
    parentTaskId: 'none',
    limit: display === 'kanban' ? '100' : undefined,
  });
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t('tasks.title')}>
        <ToggleGroup
          label={t('tasks.display')}
          values={DISPLAYS}
          current={display}
          text={(value) => t(`tasks.${value}`)}
          onSelect={(value) => {
            set('display', value);
          }}
        />
      </PageHeader>
      <ToggleGroup
        label={t('tasks.title')}
        values={TABS}
        current={tab}
        text={(value) => t(`views.${value}`)}
        onSelect={(value) => {
          set('view', value);
        }}
      />
      <QuickTask tab={tab} />
      <ListResults
        query={tasks}
        empty={{ title: t('tasks.empty'), body: t('tasks.emptyBody') }}
        render={(rows) =>
          display === 'kanban' ? (
            <TaskBoard tasks={rows} />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          )
        }
      />
    </section>
  );
}
