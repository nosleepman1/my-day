import type { JSX } from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { IDEA_STATUSES, PRIORITY_LEVELS, type Idea, type UpdateIdeaRequest } from '@orbit/contracts';

import { ArchivedBanner } from '@/components/data-display/banners';
import { ErrorState, LoadingState, NotFoundState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/http/client';

import { useIdea, useOrganizationMutation, useSimilarIdeas } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { enumOptions, LifecycleActions, NativeSelect, PageHeader } from '../components/common';
import { LinkedNotes } from '../components/linked-notes';
import { TagPicker } from '../components/tag-picker';

interface IdeaFormValues {
  title: string;
  description: string;
  status: Idea['status'];
  priority: string;
  domain: string;
  potentialScore: string;
  decisionNote: string;
}

function toPatch(values: IdeaFormValues): UpdateIdeaRequest {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority === '' ? null : (values.priority as Idea['priority']),
    domain: values.domain,
    potentialScore: values.potentialScore === '' ? null : Number(values.potentialScore),
    decisionNote: values.decisionNote,
  };
}

function IdeaFields({ register }: Readonly<{ register: UseFormRegister<IdeaFormValues> }>): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <>
      <FormField label={t('fields.title')}>
        <Input maxLength={200} required {...register('title')} />
      </FormField>
      <FormField label={t('fields.description')}>
        <Textarea rows={4} {...register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label={t('fields.status')}>
          <NativeSelect
            options={enumOptions(IDEA_STATUSES, (value) => t(`ideaStatus.${value as Idea['status']}`))}
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
        <FormField label={t('fields.potentialScore')}>
          <Input type="number" min={1} max={10} inputMode="numeric" {...register('potentialScore')} />
        </FormField>
      </div>
      <FormField label={t('fields.domain')}>
        <Input maxLength={60} {...register('domain')} />
      </FormField>
      <FormField label={t('fields.decisionNote')}>
        <Textarea rows={3} {...register('decisionNote')} />
      </FormField>
    </>
  );
}

function IdeaForm({ idea }: Readonly<{ idea: Idea }>): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const save = useOrganizationMutation(
    (patch: UpdateIdeaRequest) => organizationApi.updateIdea(idea.id, patch, idea.version),
    { successMessage: t('feedback.saved') },
  );
  const form = useForm<IdeaFormValues>({
    defaultValues: {
      title: idea.title,
      description: idea.description ?? '',
      status: idea.status,
      priority: idea.priority ?? '',
      domain: idea.domain ?? '',
      potentialScore: idea.potentialScore === null ? '' : String(idea.potentialScore),
      decisionNote: idea.decisionNote ?? '',
    },
  });
  const readOnly = idea.archivedAt !== null;
  const onSubmit = form.handleSubmit((values) => {
    save.mutate(toPatch(values));
  });
  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <fieldset disabled={readOnly} className="flex flex-col gap-4">
          <IdeaFields register={form.register} />
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

function IdeaActions({ idea }: Readonly<{ idea: Idea }>): JSX.Element {
  const { t } = useTranslation('organization');
  const navigate = useNavigate();
  const convert = useOrganizationMutation(() => organizationApi.convertIdea(idea.id));
  const archived = idea.archivedAt !== null;
  return (
    <div className="flex flex-wrap gap-2">
      {idea.convertedProjectId === null ? (
        <Button
          disabled={archived || convert.isPending || idea.status === 'ABANDONED'}
          onClick={() => {
            convert.mutate(undefined, {
              onSuccess: (response) => {
                toast.success(t('ideas.converted'));
                void navigate(`/projects/${response.data.project.id}`);
              },
            });
          }}
        >
          {t('ideas.convert')}
        </Button>
      ) : (
        <Button variant="secondary" asChild>
          <Link to={`/projects/${idea.convertedProjectId}`}>{t('ideas.openProject')}</Link>
        </Button>
      )}
      <LifecycleActions resource="ideas" id={idea.id} archived={archived} />
      <FormError error={convert.isError ? convert.error : null} />
    </div>
  );
}

function SimilarIdeas({ id }: Readonly<{ id: string }>): JSX.Element {
  const { t } = useTranslation('organization');
  const similar = useSimilarIdeas(id);
  const rows = similar.data?.data ?? [];
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{t('ideas.similar')}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-small text-muted-foreground">{t('ideas.similarEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/ideas/${row.id}`} className="text-primary hover:underline">
                {row.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** `/ideas/:id` : évaluation, décision, conversion en projet, doublons suggérés, notes liées. */
export function IdeaDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const idea = useIdea(id);
  if (idea.isPending) return <LoadingState />;
  if (idea.isError) {
    if (idea.error instanceof ApiError && idea.error.code === 'NOT_FOUND') return <NotFoundState />;
    return <ErrorState error={idea.error} onRetry={() => void idea.refetch()} />;
  }
  const data = idea.data.data;
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={data.title}>
        <IdeaActions idea={data} />
      </PageHeader>
      {data.archivedAt !== null && <ArchivedBanner />}
      <IdeaForm key={data.version} idea={data} />
      <TagPicker resource="ideas" id={data.id} tagIds={data.tagIds} disabled={data.archivedAt !== null} />
      <div className="grid gap-4 md:grid-cols-2">
        <SimilarIdeas id={data.id} />
        <LinkedNotes target="ideaId" id={data.id} />
      </div>
    </section>
  );
}
