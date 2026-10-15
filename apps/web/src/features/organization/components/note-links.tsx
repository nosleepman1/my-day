import { X } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { NOTE_LINK_TARGETS, type Note } from '@orbit/contracts';

import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

import { rowsOf, useOrganizationList, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';

import { NativeSelect, PickAndAdd } from './common';

type Target = (typeof NOTE_LINK_TARGETS)[number];

const PATHS: Readonly<Record<Target, string>> = { IDEA: '/ideas', PROJECT: '/projects', TASK: '/tasks' };
const BODY_KEYS: Readonly<Record<Target, 'ideaId' | 'projectId' | 'taskId'>> = {
  IDEA: 'ideaId',
  PROJECT: 'projectId',
  TASK: 'taskId',
};

/** Éléments proposés pour un lien : les 100 premiers de la liste du type choisi. */
function useTargetOptions(type: Target): { value: string; label: string }[] {
  const ideas = useOrganizationList('ideas', { limit: '100' }, type === 'IDEA');
  const projects = useOrganizationList('projects', { limit: '100' }, type === 'PROJECT');
  const tasks = useOrganizationList('tasks', { limit: '100' }, type === 'TASK');
  if (type === 'IDEA') return rowsOf(ideas.data?.pages).map((row) => ({ value: row.id, label: row.title }));
  if (type === 'PROJECT')
    return rowsOf(projects.data?.pages).map((row) => ({ value: row.id, label: row.name }));
  return rowsOf(tasks.data?.pages).map((row) => ({ value: row.id, label: row.title }));
}

/** Liens explicites d'une note vers une idée, un projet ou une tâche (ADR-018). */
function LinkList({ note }: Readonly<{ note: Note }>): JSX.Element {
  const { t } = useTranslation('organization');
  const unlink = useOrganizationMutation((linkId: string) => organizationApi.unlinkNote(note.id, linkId));
  if (note.links.length === 0)
    return <p className="text-small text-muted-foreground">{t('notes.noLinks')}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {note.links.map((item) => (
        <li key={item.id} className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground">
            {t(`notes.linkTypes.${item.targetType}`)}
          </span>
          <Link
            to={`${PATHS[item.targetType]}/${item.targetId}`}
            className="flex-1 text-primary hover:underline"
          >
            {item.targetTitle}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t('actions.remove')} ${item.targetTitle}`}
            onClick={() => {
              unlink.mutate(item.id);
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function NoteLinks({ note }: Readonly<{ note: Note }>): JSX.Element {
  const { t } = useTranslation('organization');
  const [type, setType] = useState<Target>('TASK');
  const options = useTargetOptions(type);
  const link = useOrganizationMutation((target: string) =>
    organizationApi.linkNote(note.id, { [BODY_KEYS[type]]: target }),
  );
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('notes.links')}</CardTitle>
      <LinkList note={note} />
      <div className="grid gap-2 md:grid-cols-[160px_1fr]">
        <NativeSelect
          aria-label={t('notes.linkType')}
          value={type}
          onChange={(event) => {
            setType(event.target.value as Target);
          }}
          options={NOTE_LINK_TARGETS.map((value) => ({ value, label: t(`notes.linkTypes.${value}`) }))}
        />
        <PickAndAdd
          key={type}
          label={t('notes.linkTarget')}
          actionLabel={t('notes.addLink')}
          options={options}
          pending={link.isPending}
          onPick={(target) => link.mutateAsync(target)}
        />
      </div>
      <FormError error={link.isError ? link.error : null} />
    </Card>
  );
}
