import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';

import { useOrganizationMutation, useTags } from '../api/hooks';
import { organizationApi, type Resource } from '../api/organization.api';

type TagPickerProps = Readonly<{
  resource: Resource;
  id: string;
  tagIds: readonly string[];
  disabled?: boolean;
}>;

/** Tags d'un élément : chaque pastille bascule le tag (`PUT /<ressource>/:id/tags`). */
export function TagPicker({ resource, id, tagIds, disabled = false }: TagPickerProps): JSX.Element {
  const { t } = useTranslation('organization');
  const tags = useTags();
  const save = useOrganizationMutation((next: readonly string[]) =>
    organizationApi.setTags(resource, id, next),
  );
  const all = tags.data?.data ?? [];
  if (all.length === 0) return <p className="text-small text-muted-foreground">{t('tags.none')}</p>;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small font-medium">{t('fields.tags')}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((tag) => {
          const active = tagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              disabled={disabled || save.isPending}
              onClick={() => {
                save.mutate(active ? tagIds.filter((tagId) => tagId !== tag.id) : [...tagIds, tag.id]);
              }}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-input-border px-3 text-small',
                active && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {tag.color !== null && (
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
