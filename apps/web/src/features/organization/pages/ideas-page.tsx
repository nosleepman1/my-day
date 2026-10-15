import { useDeferredValue, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { IDEA_STATUSES, type Idea } from '@orbit/contracts';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { uuidv7 } from '@/lib/ids';

import { useOrganizationList, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { enumOptions, ListResults, NativeSelect, PageHeader, QuickAdd, useDates } from '../components/common';

function IdeaCard({ idea }: Readonly<{ idea: Idea }>): JSX.Element {
  const { t } = useTranslation('organization');
  const dates = useDates();
  return (
    <li>
      <Card className="flex flex-col gap-1">
        <Link to={`/ideas/${idea.id}`} className="text-body-strong text-foreground hover:underline">
          {idea.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <Badge tone={idea.status === 'ABANDONED' ? 'neutral' : 'info'}>
            {t(`ideaStatus.${idea.status}`)}
          </Badge>
          {idea.priority !== null && <Badge tone="warning">{t(`priority.${idea.priority}`)}</Badge>}
          <span>{t('ideas.capturedOn', { date: dates.instant(idea.capturedAt) })}</span>
        </div>
      </Card>
    </li>
  );
}

type Filters = Readonly<{ status: string; search: string; archived: boolean }>;

function IdeaFilters({
  filters,
  onChange,
}: Readonly<{ filters: Filters; onChange: (changes: Partial<Filters>) => void }>): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-center">
      <Input
        type="search"
        aria-label={t('fields.search')}
        placeholder={t('fields.search')}
        value={filters.search}
        onChange={(event) => {
          onChange({ search: event.target.value });
        }}
      />
      <NativeSelect
        aria-label={t('fields.status')}
        value={filters.status}
        onChange={(event) => {
          onChange({ status: event.target.value });
        }}
        options={enumOptions(
          IDEA_STATUSES,
          (value) => t(`ideaStatus.${value as Idea['status']}`),
          t('filters.allStatuses'),
        )}
      />
      <div className="flex items-center gap-2">
        <Switch
          id="ideas-archived"
          checked={filters.archived}
          onCheckedChange={(archived) => {
            onChange({ archived });
          }}
        />
        <Label htmlFor="ideas-archived">{t('fields.archived')}</Label>
      </div>
    </div>
  );
}

/** `/ideas` : capture, filtres (statut, recherche, archivées) et liste paginée (PHASE-04 §6). */
export function IdeasPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const [filters, setFilters] = useState<Filters>({ status: '', search: '', archived: false });
  const q = useDeferredValue(filters.search.trim());
  const ideas = useOrganizationList('ideas', {
    status: filters.status === '' ? undefined : filters.status,
    q: q.length >= 2 ? q : undefined,
    archived: filters.archived ? 'true' : undefined,
  });
  const create = useOrganizationMutation((title: string) =>
    organizationApi.createIdea({ id: uuidv7(), title }),
  );
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t('ideas.title')} />
      <QuickAdd
        label={t('ideas.new')}
        placeholder={t('ideas.placeholder')}
        pending={create.isPending}
        onAdd={(title) => create.mutateAsync(title)}
      />
      <IdeaFilters
        filters={filters}
        onChange={(changes) => {
          setFilters((current) => ({ ...current, ...changes }));
        }}
      />
      <ListResults
        query={ideas}
        empty={{ title: t('ideas.empty'), body: t('ideas.emptyBody') }}
        render={(rows) => (
          <ul className="flex flex-col gap-2">
            {rows.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </ul>
        )}
      />
    </section>
  );
}
