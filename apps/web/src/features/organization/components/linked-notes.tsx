import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Card, CardTitle } from '@/components/ui/card';

import { rowsOf, useOrganizationList } from '../api/hooks';

type LinkedNotesProps = Readonly<{ target: 'ideaId' | 'projectId' | 'taskId'; id: string }>;

/** Notes reliées explicitement à un élément (ADR-018), affichées sur sa fiche. */
export function LinkedNotes({ target, id }: LinkedNotesProps): JSX.Element {
  const { t } = useTranslation('organization');
  const notes = useOrganizationList('notes', { [target]: id, limit: '20' });
  const rows = rowsOf(notes.data?.pages);
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{t('notes.linkedNotes')}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-small text-muted-foreground">{t('notes.noLinkedNotes')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((note) => (
            <li key={note.id}>
              <Link to={`/notes/${note.id}`} className="text-primary underline-offset-2 hover:underline">
                {note.title ?? t('notes.untitled')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
