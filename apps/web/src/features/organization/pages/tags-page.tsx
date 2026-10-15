import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { Tag } from '@orbit/contracts';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { FormError } from '@/components/forms/validation-errors';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useOrganizationMutation, useTags } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { ConfirmButton, PickAndAdd, QuickAdd } from '../components/common';

const DEFAULT_COLOR = '#64748b';

function usageOf(tag: Tag): number {
  return tag.usage.ideas + tag.usage.projects + tag.usage.tasks + tag.usage.notes;
}

/** Couleur, nom (enregistré à la sortie du champ), usage et suppression d'un tag. */
function TagHeader({ tag }: Readonly<{ tag: Tag }>): JSX.Element {
  const { t } = useTranslation('organization');
  const [name, setName] = useState(tag.name);
  const update = useOrganizationMutation((patch: Readonly<{ name?: string; color?: string }>) =>
    organizationApi.updateTag(tag.id, patch),
  );
  const remove = useOrganizationMutation(() => organizationApi.removeTag(tag.id));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          aria-label={`${t('fields.color')} ${tag.name}`}
          value={tag.color ?? DEFAULT_COLOR}
          onChange={(event) => {
            update.mutate({ color: event.target.value });
          }}
          className="size-11 rounded-md border border-input-border bg-surface p-1"
        />
        <Input
          aria-label={`${t('fields.name')} ${tag.name}`}
          value={name}
          maxLength={40}
          className="min-w-40 flex-1"
          onChange={(event) => {
            setName(event.target.value);
          }}
          onBlur={() => {
            if (name.trim() !== '' && name !== tag.name) update.mutate({ name: name.trim() });
          }}
        />
        <span className="text-caption text-muted-foreground">{t('tags.usage', { count: usageOf(tag) })}</span>
        <ConfirmButton
          label={t('actions.delete')}
          message={t('tags.deleteConfirm')}
          onConfirm={() => {
            remove.mutate(undefined);
          }}
        />
      </div>
      <FormError error={update.isError ? update.error : null} />
    </>
  );
}

function TagItem({ tag, others }: Readonly<{ tag: Tag; others: readonly Tag[] }>): JSX.Element {
  const { t } = useTranslation('organization');
  const merge = useOrganizationMutation((targetTagId: string) =>
    organizationApi.mergeTag(tag.id, targetTagId),
  );
  return (
    <li>
      <Card className="flex flex-col gap-3">
        <TagHeader tag={tag} />
        {others.length > 0 && (
          <PickAndAdd
            label={`${t('tags.merge')} ${tag.name}`}
            actionLabel={t('tags.mergeAction')}
            options={others.map((other) => ({ value: other.id, label: other.name }))}
            pending={merge.isPending}
            onPick={(target) => merge.mutateAsync(target).then(() => toast.success(t('tags.merged')))}
          />
        )}
        <FormError error={merge.isError ? merge.error : null} />
      </Card>
    </li>
  );
}

/** `/settings/tags` : créer, renommer, colorer, fusionner et supprimer les tags (PHASE-04 §6). */
export function TagsPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const tags = useTags();
  const create = useOrganizationMutation((name: string) => organizationApi.createTag({ name }));
  if (tags.isPending) return <LoadingState />;
  if (tags.isError) return <ErrorState error={tags.error} onRetry={() => void tags.refetch()} />;
  const rows = tags.data.data;
  return (
    <section className="flex flex-col gap-4">
      <QuickAdd
        label={t('tags.new')}
        placeholder={t('tags.placeholder')}
        pending={create.isPending}
        onAdd={(name) => create.mutateAsync(name)}
      />
      <FormError error={create.isError ? create.error : null} />
      {rows.length === 0 ? (
        <EmptyState title={t('tags.empty')} compact />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((tag) => (
            <TagItem key={tag.id} tag={tag} others={rows.filter((other) => other.id !== tag.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
