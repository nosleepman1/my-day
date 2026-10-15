import { useState, type ComponentProps, type JSX, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatCivilDate, formatInstant } from '@/lib/dates';
import { usePreferences } from '@/lib/http/session.api';

import { useOrganizationMutation } from '../api/hooks';
import { organizationApi } from '../api/organization.api';

export function PageHeader({
  title,
  children,
}: Readonly<{ title: string; children?: ReactNode }>): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-h1">{title}</h1>
      {children}
    </header>
  );
}

export type Option = Readonly<{ value: string; label: string }>;

/** Liste déroulante native : accessible au clavier et aux lecteurs d'écran sans surcouche. */
export function NativeSelect({
  options,
  className,
  ...props
}: ComponentProps<'select'> & Readonly<{ options: readonly Option[] }>): JSX.Element {
  return (
    <select
      className={cn(
        'min-h-11 w-full rounded-md border border-input-border bg-surface px-3 text-body text-foreground',
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type PickAndAddProps = Readonly<{
  label: string;
  actionLabel: string;
  options: readonly Option[];
  pending: boolean;
  onPick: (value: string) => Promise<unknown>;
}>;

/** Choix dans une liste puis ajout (dépendance, lien de note) ; l'erreur est affichée par l'appelant. */
export function PickAndAdd({ label, actionLabel, options, pending, onPick }: PickAndAddProps): JSX.Element {
  const [choice, setChoice] = useState('');
  return (
    <div className="flex gap-2">
      <NativeSelect
        aria-label={label}
        value={choice}
        onChange={(event) => {
          setChoice(event.target.value);
        }}
        options={[{ value: '', label }, ...options]}
      />
      <Button
        disabled={choice === '' || pending}
        onClick={() => {
          void onPick(choice).then(
            () => {
              setChoice('');
            },
            () => undefined,
          );
        }}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

type ListQuery<T> = Readonly<{
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  data: Readonly<{ pages: readonly Readonly<{ data: readonly T[] }>[] }> | undefined;
}>;

type ListResultsProps<T> = Readonly<{
  query: ListQuery<T>;
  empty: Readonly<{ title: string; body: string }>;
  render: (rows: T[]) => ReactNode;
}>;

/** États d'une liste paginée (chargement, erreur, vide), puis les lignes et « Charger plus ». */
export function ListResults<T>({ query, empty, render }: ListResultsProps<T>): JSX.Element {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const rows = (query.data?.pages ?? []).flatMap((page) => page.data);
  if (rows.length === 0) return <EmptyState title={empty.title} body={empty.body} />;
  return (
    <>
      {render(rows)}
      <LoadMore pager={query} />
    </>
  );
}

type Pager = Readonly<{ hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }>;

export function LoadMore({ pager }: Readonly<{ pager: Pager }>): JSX.Element | null {
  const { t } = useTranslation('organization');
  if (!pager.hasNextPage) return null;
  return (
    <Button
      variant="secondary"
      className="self-center"
      disabled={pager.isFetchingNextPage}
      onClick={() => void pager.fetchNextPage()}
    >
      {t('actions.loadMore')}
    </Button>
  );
}

type QuickAddProps = Readonly<{
  label: string;
  placeholder: string;
  pending: boolean;
  onAdd: (title: string) => Promise<unknown>;
}>;

/** Ajout en une ligne : titre seul, champ vidé après succès. */
export function QuickAdd({ label, placeholder, pending, onAdd }: QuickAddProps): JSX.Element {
  const { t } = useTranslation('organization');
  const [title, setTitle] = useState('');
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const value = title.trim();
    if (value === '') return;
    // L'erreur est affichée par l'appelant (état de la mutation) ; la saisie est conservée.
    void onAdd(value).then(
      () => {
        setTitle('');
      },
      () => undefined,
    );
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={title}
        maxLength={300}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <Button type="submit" disabled={pending || title.trim() === ''}>
        {t('actions.add')}
      </Button>
    </form>
  );
}

type ConfirmProps = Readonly<{
  label: string;
  message: string;
  onConfirm: () => void;
  disabled?: boolean;
}>;

/** Action destructive confirmée dans un dialogue (DESIGN_SYSTEM.md §5). */
export function ConfirmButton({ label, message, onConfirm, disabled = false }: ConfirmProps): JSX.Element {
  const { t } = useTranslation(['organization', 'common']);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t('common:actions.close')}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {t('common:actions.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type LifecycleProps = Readonly<{
  resource: 'ideas' | 'projects' | 'notes';
  id: string;
  archived: boolean;
  /** Version attendue, exigée pour supprimer une note (API.md §10). */
  version?: number;
}>;

/** Archiver ou restaurer, puis supprimer (logiquement) avec confirmation et retour à la liste. */
export function LifecycleActions({ resource, id, archived, version }: LifecycleProps): JSX.Element {
  const { t } = useTranslation('organization');
  const navigate = useNavigate();
  const archive = useOrganizationMutation((next: boolean) => organizationApi.setArchived(resource, id, next));
  const remove = useOrganizationMutation(() => organizationApi.remove(resource, id, version));
  return (
    <>
      <Button
        variant="secondary"
        disabled={archive.isPending}
        onClick={() => {
          archive.mutate(!archived, {
            onSuccess: () => toast.success(archived ? t('feedback.restored') : t('feedback.archived')),
          });
        }}
      >
        {archived ? t('actions.restore') : t('actions.archive')}
      </Button>
      <ConfirmButton
        label={t('actions.delete')}
        message={t('feedback.deleteConfirm')}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success(t('feedback.deleted'));
              void navigate(`/${resource}`);
            },
          });
        }}
      />
    </>
  );
}

/** Dates affichées au format et dans le fuseau des préférences (ADR-023). */
export function useDates(): Readonly<{
  civil: (value: string | null) => string;
  instant: (value: string) => string;
}> {
  const preferences = usePreferences().data?.data;
  const format = preferences?.dateFormat ?? 'dd/MM/yyyy';
  const timeZone = preferences?.timezone ?? 'Africa/Dakar';
  return {
    civil: (value) => (value === null ? '' : formatCivilDate(value, format)),
    instant: (value) => formatInstant(value, timeZone, format),
  };
}

/** Options d'une énumération traduite (`<espace>.<VALEUR>`), avec une entrée vide facultative. */
export function enumOptions(
  values: readonly string[],
  label: (value: string) => string,
  empty?: string,
): Option[] {
  const options = values.map((value) => ({ value, label: label(value) }));
  return empty === undefined ? options : [{ value: '', label: empty }, ...options];
}
