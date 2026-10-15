import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PROJECT_STATUSES, type Project } from '@orbit/contracts';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';
import { uuidv7 } from '@/lib/ids';

import { rowsOf, useOrganizationList, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { enumOptions, LoadMore, NativeSelect, PageHeader, QuickAdd, useDates } from '../components/common';

function ProjectCard({ project }: Readonly<{ project: Project }>): JSX.Element {
  const { t } = useTranslation('organization');
  const dates = useDates();
  return (
    <li>
      <Card className="flex flex-col gap-1">
        <Link to={`/projects/${project.id}`} className="text-body-strong text-foreground hover:underline">
          {project.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <Badge tone={project.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {t(`projectStatus.${project.status}`)}
          </Badge>
          <span>{t(`projectType.${project.type}`)}</span>
          {project.targetOn !== null && (
            <span>{t('tasks.due', { date: dates.civil(project.targetOn) })}</span>
          )}
        </div>
      </Card>
    </li>
  );
}

/** `/projects` : liste filtrée par statut et création rapide (PHASE-04 §6). */
export function ProjectsPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const [status, setStatus] = useState('');
  const projects = useOrganizationList('projects', { status: status === '' ? undefined : status });
  const create = useOrganizationMutation((name: string) =>
    organizationApi.createProject({ id: uuidv7(), name }),
  );
  const rows = rowsOf(projects.data?.pages);
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t('projects.title')} />
      <QuickAdd
        label={t('projects.new')}
        placeholder={t('projects.placeholder')}
        pending={create.isPending}
        onAdd={(name) => create.mutateAsync(name)}
      />
      <NativeSelect
        aria-label={t('fields.status')}
        className="md:max-w-60"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
        }}
        options={enumOptions(
          PROJECT_STATUSES,
          (value) => t(`projectStatus.${value as Project['status']}`),
          t('filters.allStatuses'),
        )}
      />
      {projects.isPending ? (
        <LoadingState />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('projects.empty')} body={t('projects.emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
      <LoadMore pager={projects} />
    </section>
  );
}
