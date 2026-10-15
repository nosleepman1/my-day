import { useState, type ComponentProps, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { formatCivilDate, formatInstant } from '@/lib/dates';
import { usePreferences } from '@/lib/http/session.api';

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

/** Liste déroulante native accessible au clavier et aux lecteurs d'écran. */
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

type ConfirmProps = Readonly<{
  label: string;
  message: string;
  onConfirm: () => void;
  disabled?: boolean;
}>;

export function ConfirmButton({ label, message, onConfirm, disabled = false }: ConfirmProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
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

/** Dates affichées selon les préférences utilisateur (fuseau et format). */
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

/** Transforme un tableau de chaînes en options déroulantes traduites. */
export function enumOptions(
  values: readonly string[],
  label: (value: string) => string,
  empty?: string,
): Option[] {
  const options = values.map((value) => ({ value, label: label(value) }));
  return empty === undefined ? options : [{ value: '', label: empty }, ...options];
}
