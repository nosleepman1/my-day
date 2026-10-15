import { Pin } from 'lucide-react';
import { useDeferredValue, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import type { NoteSummary } from '@orbit/contracts';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { uuidv7 } from '@/lib/ids';

import { rowsOf, useOrganizationList, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { LoadMore, PageHeader, useDates } from '../components/common';

function NoteCard({ note }: Readonly<{ note: NoteSummary }>): JSX.Element {
  const { t } = useTranslation('organization');
  const dates = useDates();
  return (
    <li>
      <Card className="flex flex-col gap-1">
        <Link
          to={`/notes/${note.id}`}
          className="flex items-center gap-2 text-body-strong text-foreground hover:underline"
        >
          {note.pinnedAt !== null && <Pin aria-label={t('fields.pinned')} className="size-4" />}
          {note.title ?? t('notes.untitled')}
        </Link>
        {/* Extrait affiché en texte brut : jamais interprété ici (SECURITY.md). */}
        <p className="line-clamp-2 text-small text-muted-foreground">{note.excerpt}</p>
        <span className="text-caption text-muted-foreground">
          {t(`noteKind.${note.kind}`)} · {dates.instant(note.updatedAt)}
        </span>
      </Card>
    </li>
  );
}

function NoteSection({
  title,
  notes,
}: Readonly<{ title: string; notes: readonly NoteSummary[] }>): JSX.Element | null {
  if (notes.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h3">{title}</h2>
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </ul>
    </section>
  );
}

/** `/notes` : épinglées en tête, recherche dans le titre et le contenu (PHASE-04 §6). */
export function NotesPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const filter = q.length >= 2 ? q : undefined;
  const pinned = useOrganizationList('notes', { pinned: 'true', q: filter, limit: '50' });
  const others = useOrganizationList('notes', { pinned: 'false', q: filter });
  const create = useOrganizationMutation(() => organizationApi.createNote({ id: uuidv7(), content: '' }));
  const pinnedRows = rowsOf(pinned.data?.pages);
  const otherRows = rowsOf(others.data?.pages);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t('notes.title')}>
        <Button
          disabled={create.isPending}
          onClick={() => {
            create.mutate(undefined, { onSuccess: (note) => void navigate(`/notes/${note.data.id}`) });
          }}
        >
          {t('notes.new')}
        </Button>
      </PageHeader>
      <Input
        type="search"
        aria-label={t('fields.search')}
        placeholder={t('fields.search')}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      {others.isPending || pinned.isPending ? (
        <LoadingState />
      ) : others.isError ? (
        <ErrorState error={others.error} onRetry={() => void others.refetch()} />
      ) : pinnedRows.length + otherRows.length === 0 ? (
        <EmptyState title={t('notes.empty')} body={t('notes.emptyBody')} />
      ) : (
        <>
          <NoteSection title={t('notes.pinnedTitle')} notes={pinnedRows} />
          <NoteSection title={t('notes.othersTitle')} notes={otherRows} />
        </>
      )}
      <LoadMore pager={others} />
    </section>
  );
}
