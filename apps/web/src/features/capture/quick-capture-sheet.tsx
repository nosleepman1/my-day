import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type JSX, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { UserModule } from '@orbit/contracts';

import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { cn } from '@/lib/cn';
import type { CaptureKind } from '@/lib/offline/capture-queue';
import { organizationKeys } from '@/lib/query-keys';

import {
  availableCaptureTypes,
  isTypingTarget,
  type CaptureType,
  type CaptureTypeKey,
} from './capture-types';
import { submitCapture } from './capture.api';

/** `N` ouvre la capture rapide sur desktop, hors champ de saisie et sans modificateur. */
export function useCaptureShortcut(open: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey) return;
      // Jamais pendant une saisie, un dialogue ouvert (ré-authentification…) ou un événement déjà traité.
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') !== null) return;
      event.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
}

type TypePickerProps = Readonly<{
  types: readonly CaptureType[];
  selected: CaptureTypeKey | null;
  onSelect: (key: CaptureTypeKey) => void;
}>;

/** Groupe radio des types (tabindex itinérant et flèches, WAI-ARIA). */
function TypePicker({ types, selected, onSelect }: TypePickerProps): JSX.Element {
  const { t } = useTranslation('capture');
  return (
    <div role="radiogroup" aria-label={t('typeLabel')} className="flex flex-wrap gap-2">
      {types.map(({ key, icon: Icon }, index) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={selected === key}
          tabIndex={selected === key ? 0 : -1}
          onClick={() => {
            onSelect(key);
          }}
          onKeyDown={(event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (step === undefined) return;
            event.preventDefault();
            const nextIndex = (index + step + types.length) % types.length;
            const nextType = types[nextIndex];
            if (nextType === undefined) return;
            onSelect(nextType.key);
            (event.currentTarget.parentElement?.children[nextIndex] as HTMLElement | undefined)?.focus();
          }}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full border border-input-border px-4 text-small',
            selected === key && 'border-primary bg-primary text-primary-foreground',
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          {t(`types.${key}`)}
        </button>
      ))}
    </div>
  );
}

function useCaptureSubmit(ownerId: string, onDone: () => void) {
  const { t } = useTranslation('capture');
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (kind: CaptureKind, text: string, dueDate: string): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      const result = await submitCapture({ kind, text, ...(dueDate === '' ? {} : { dueDate }) }, ownerId);
      toast.success(result === 'sent' ? t('sent') : t('queued'));
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      onDone();
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, submit };
}

/** Champ avancé replié d'une tâche : échéance facultative. */
function DueDateOption({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>): JSX.Element {
  const { t } = useTranslation('capture');
  return (
    <details className="text-small">
      <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">{t('more')}</summary>
      <FormField label={t('dueDate')}>
        <Input
          type="date"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </FormField>
    </details>
  );
}

function FinanceCaptureAction({
  isOnline,
  selected,
  text,
  onDone,
}: Readonly<{
  isOnline: boolean;
  selected: 'expense' | 'income';
  text: string;
  onDone: () => void;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'capture', 'common']);
  const navigate = useNavigate();
  if (!isOnline) {
    return (
      <p role="alert" className="rounded-md bg-surface-muted px-3 py-2 text-small text-danger">
        {t('finance:offlineWarning')}
      </p>
    );
  }
  const typeParam = selected === 'expense' ? 'EXPENSE' : 'INCOME';
  const handleOpen = (): void => {
    const descParam = text.trim() !== '' ? `&description=${encodeURIComponent(text.trim())}` : '';
    void navigate(`/finance/transactions/new?type=${typeParam}${descParam}`);
    onDone();
  };
  return (
    <Button type="button" className="self-end" onClick={handleOpen}>
      {t('capture:submit')}
    </Button>
  );
}

function StandardCaptureAction({
  kind,
  dueDate,
  setDueDate,
  error,
  pending,
  disabled,
}: Readonly<{
  kind: CaptureKind | null;
  dueDate: string;
  setDueDate: (val: string) => void;
  error: unknown;
  pending: boolean;
  disabled: boolean;
}>): JSX.Element {
  const { t } = useTranslation('capture');
  return (
    <>
      {kind === 'task' && <DueDateOption value={dueDate} onChange={setDueDate} />}
      <FormError error={error} />
      <Button type="submit" className="self-end" disabled={disabled || pending}>
        {t('submit')}
      </Button>
    </>
  );
}

type CaptureBodyProps = Readonly<{
  enabledModules: readonly UserModule[];
  ownerId: string;
  onDone: () => void;
}>;

interface SubmitDispatcherOptions {
  selected: CaptureTypeKey | null;
  isOnline: boolean;
  text: string;
  dueDate: string;
  pending: boolean;
  kind: CaptureKind | null;
  submit: (k: CaptureKind, t: string, d: string) => Promise<void>;
  onDone: () => void;
}

function useSubmitDispatcher({
  selected,
  isOnline,
  text,
  dueDate,
  pending,
  kind,
  submit,
  onDone,
}: SubmitDispatcherOptions) {
  const navigate = useNavigate();
  return (event?: SyntheticEvent): void => {
    event?.preventDefault();
    if (selected === 'expense' || selected === 'income') {
      if (!isOnline) return;
      const typeParam = selected === 'expense' ? 'EXPENSE' : 'INCOME';
      const descParam = text.trim() !== '' ? `&description=${encodeURIComponent(text.trim())}` : '';
      void navigate(`/finance/transactions/new?type=${typeParam}${descParam}`);
      onDone();
      return;
    }
    if (kind !== null && text.trim() !== '' && !pending) void submit(kind, text, dueDate);
  };
}

function CaptureContent({
  selected,
  isOnline,
  text,
  onDone,
  kind,
  current,
  dueDate,
  setDueDate,
  error,
  pending,
}: Readonly<{
  selected: CaptureTypeKey | null;
  isOnline: boolean;
  text: string;
  onDone: () => void;
  kind: CaptureKind | null;
  current?: CaptureType;
  dueDate: string;
  setDueDate: (val: string) => void;
  error: unknown;
  pending: boolean;
}>): JSX.Element {
  const { t } = useTranslation('capture');
  if (selected === 'expense' || selected === 'income') {
    return <FinanceCaptureAction isOnline={isOnline} selected={selected} text={text} onDone={onDone} />;
  }
  if (kind === null) {
    return (
      <p role="status" className="rounded-md bg-surface-muted px-3 py-2 text-small text-muted-foreground">
        {current === undefined ? t('noType') : t('soon', { phase: String(current.phase).padStart(2, '0') })}
      </p>
    );
  }
  return (
    <StandardCaptureAction
      kind={kind}
      dueDate={dueDate}
      setDueDate={setDueDate}
      error={error}
      pending={pending}
      disabled={text.trim() === ''}
    />
  );
}

function CaptureInput({
  text,
  onChange,
  onSubmit,
}: Readonly<{
  text: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
}>): JSX.Element {
  const { t } = useTranslation('capture');
  return (
    <Textarea
      aria-label={t('inputLabel')}
      placeholder={t('placeholder')}
      enterKeyHint="send"
      rows={3}
      value={text}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

function CaptureBody({ enabledModules, ownerId, onDone }: CaptureBodyProps): JSX.Element {
  const isOnline = useOnlineStatus();
  const types = availableCaptureTypes(enabledModules);
  const [selected, setSelected] = useState<CaptureTypeKey | null>(types[0]?.key ?? null);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const { pending, error, submit } = useCaptureSubmit(ownerId, onDone);
  const isFinance = selected === 'expense' || selected === 'income';
  const current = types.find((type) => type.key === selected);
  const kind = current?.ready === true && !isFinance ? (current.key as CaptureKind) : null;
  const onSubmit = useSubmitDispatcher({
    selected,
    isOnline,
    text,
    dueDate,
    pending,
    kind,
    submit,
    onDone,
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CaptureInput text={text} onChange={setText} onSubmit={onSubmit} />
      <TypePicker types={types} selected={selected} onSelect={setSelected} />
      <CaptureContent
        selected={selected}
        isOnline={isOnline}
        text={text}
        onDone={onDone}
        kind={kind}
        current={current}
        dueDate={dueDate}
        setDueDate={setDueDate}
        error={error}
        pending={pending}
      />
    </form>
  );
}

type QuickCaptureSheetProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledModules: readonly UserModule[];
  /** Compte connecté, auteur des captures mises en file hors ligne. */
  ownerId: string;
}>;

/** Capture rapide (PHASE-04 T15) : feuille du bas sur mobile, dialogue centré sur desktop. */
export function QuickCaptureSheet({
  open,
  onOpenChange,
  enabledModules,
  ownerId,
}: QuickCaptureSheetProps): JSX.Element {
  const { t } = useTranslation(['capture', 'common']);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const close = (): void => {
    onOpenChange(false);
  };
  const body: ReactNode = open ? (
    <CaptureBody enabledModules={enabledModules} ownerId={ownerId} onDone={close} />
  ) : null;
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent closeLabel={t('common:actions.close')} className="max-w-[560px]">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" closeLabel={t('common:actions.close')}>
        <SheetTitle className="text-h3">{t('title')}</SheetTitle>
        <SheetDescription className="text-small text-muted-foreground">{t('description')}</SheetDescription>
        {body}
      </SheetContent>
    </Sheet>
  );
}
