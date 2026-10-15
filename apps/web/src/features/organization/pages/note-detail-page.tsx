import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import { NOTE_CONTENT_MAX, NOTE_KINDS, type Note, type UpdateNoteRequest } from '@orbit/contracts';

import { ArchivedBanner } from '@/components/data-display/banners';
import { ConflictDialog } from '@/components/data-display/conflict-dialog';
import { SafeMarkdown } from '@/components/data-display/safe-markdown';
import { ErrorState, LoadingState, NotFoundState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/http/client';

import { useNote, useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';
import { enumOptions, LifecycleActions, NativeSelect, PageHeader } from '../components/common';
import { NoteLinks } from '../components/note-links';
import { TagPicker } from '../components/tag-picker';

type Draft = Readonly<{ title: string; content: string; kind: Note['kind']; pinned: boolean }>;
type DraftProps = Readonly<{ draft: Draft; onChange: (changes: Partial<Draft>) => void }>;

const draftOf = (note: Note): Draft => ({
  title: note.title ?? '',
  content: note.content,
  kind: note.kind,
  pinned: note.pinnedAt !== null,
});

function versionOf(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== 'VERSION_CONFLICT') return null;
  const details = error.details as { currentVersion?: unknown } | undefined;
  return typeof details?.currentVersion === 'number' ? details.currentVersion : null;
}

/** Enregistrement protégé par `If-Match` (API.md §10) : un 412 ouvre le dialogue de conflit. */
function useNoteSave(note: Note) {
  const { t } = useTranslation('organization');
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const save = useOrganizationMutation(
    ({ patch, version }: Readonly<{ patch: UpdateNoteRequest; version: number }>) =>
      organizationApi.updateNote(note.id, patch, version),
  );
  const submit = (patch: UpdateNoteRequest, version: number): void => {
    save.mutate(
      { patch, version },
      {
        onSuccess: () => toast.success(t('feedback.saved')),
        onError: (error) => {
          setConflictVersion(versionOf(error));
        },
      },
    );
  };
  return {
    save,
    submit,
    conflictVersion,
    clearConflict: () => {
      setConflictVersion(null);
    },
  };
}

function NoteMetaFields({ draft, onChange }: DraftProps): JSX.Element {
  const { t } = useTranslation('organization');
  return (
    <>
      <FormField label={t('fields.title')}>
        <Input
          value={draft.title}
          maxLength={200}
          onChange={(event) => {
            onChange({ title: event.target.value });
          }}
        />
      </FormField>
      <div className="flex flex-wrap items-end gap-4">
        <FormField label={t('fields.kind')}>
          <NativeSelect
            value={draft.kind}
            onChange={(event) => {
              onChange({ kind: event.target.value as Note['kind'] });
            }}
            options={enumOptions(NOTE_KINDS, (value) => t(`noteKind.${value as Note['kind']}`))}
          />
        </FormField>
        <div className="flex min-h-11 items-center gap-2">
          <Switch
            id="note-pinned"
            checked={draft.pinned}
            onCheckedChange={(pinned) => {
              onChange({ pinned });
            }}
          />
          <Label htmlFor="note-pinned">{t('fields.pinned')}</Label>
        </div>
      </div>
    </>
  );
}

/** Saisie Markdown brute, ou aperçu rendu par `SafeMarkdown` (jamais de HTML interprété). */
function ContentArea({ draft, onChange }: DraftProps): JSX.Element {
  const { t } = useTranslation('organization');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  return (
    <>
      <div
        role="group"
        aria-label={t('fields.content')}
        className="flex gap-1 self-start rounded-md bg-surface-muted p-1"
      >
        {(['write', 'preview'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
            }}
            className="inline-flex min-h-9 items-center rounded-sm px-3 text-small text-muted-foreground aria-pressed:bg-surface aria-pressed:text-foreground"
          >
            {t(`notes.${value}`)}
          </button>
        ))}
      </div>
      {mode === 'write' ? (
        <Textarea
          aria-label={t('fields.content')}
          rows={14}
          maxLength={NOTE_CONTENT_MAX}
          value={draft.content}
          onChange={(event) => {
            onChange({ content: event.target.value });
          }}
          className="font-mono"
        />
      ) : draft.content.trim() === '' ? (
        <p className="text-small text-muted-foreground">{t('notes.previewEmpty')}</p>
      ) : (
        <SafeMarkdown source={draft.content} />
      )}
    </>
  );
}

/** Éditeur : en cas de modification concurrente, recharger la version actuelle ou imposer la sienne. */
function NoteEditor({ note, onReload }: Readonly<{ note: Note; onReload: () => void }>): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const [draft, setDraft] = useState<Draft>(() => draftOf(note));
  const { save, submit, conflictVersion, clearConflict } = useNoteSave(note);
  const readOnly = note.archivedAt !== null;
  const patch: UpdateNoteRequest = { ...draft };
  const change = (changes: Partial<Draft>): void => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  return (
    <Card className="flex flex-col gap-4">
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <NoteMetaFields draft={draft} onChange={change} />
        <ContentArea draft={draft} onChange={change} />
      </fieldset>
      <FormError error={save.isError && conflictVersion === null ? save.error : null} />
      {!readOnly && (
        <Button
          className="self-end"
          disabled={save.isPending}
          onClick={() => {
            submit(patch, note.version);
          }}
        >
          {t('common:actions.save')}
        </Button>
      )}
      <ConflictDialog
        open={conflictVersion !== null}
        onOpenChange={(open) => {
          if (!open) clearConflict();
        }}
        onReload={() => {
          clearConflict();
          onReload();
        }}
        onKeepMine={() => {
          clearConflict();
          if (conflictVersion !== null) submit(patch, conflictVersion);
        }}
      />
    </Card>
  );
}

/** `/notes/:id` : édition Markdown, aperçu assaini, tags et liens (PHASE-04 §6). */
export function NoteDetailPage(): JSX.Element {
  const { t } = useTranslation('organization');
  const { id = '' } = useParams();
  const note = useNote(id);
  const [editorKey, setEditorKey] = useState(0);
  if (note.isPending) return <LoadingState />;
  if (note.isError) {
    if (note.error instanceof ApiError && note.error.code === 'NOT_FOUND') return <NotFoundState />;
    return <ErrorState error={note.error} onRetry={() => void note.refetch()} />;
  }
  const data = note.data.data;
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={data.title ?? t('notes.untitled')}>
        <div className="flex flex-wrap gap-2">
          <LifecycleActions
            resource="notes"
            id={data.id}
            archived={data.archivedAt !== null}
            version={data.version}
          />
        </div>
      </PageHeader>
      {data.archivedAt !== null && <ArchivedBanner />}
      <NoteEditor
        key={`${data.id}-${editorKey}`}
        note={data}
        onReload={() => {
          void note.refetch().then(() => {
            setEditorKey((key) => key + 1);
          });
        }}
      />
      <TagPicker resource="notes" id={data.id} tagIds={data.tagIds} disabled={data.archivedAt !== null} />
      <NoteLinks note={data} />
    </section>
  );
}
